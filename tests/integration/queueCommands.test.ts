import pino from 'pino';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { startDynamo, stopDynamo, TestDynamo } from '../helpers/dynamodb';
import { startLocalStack, stopLocalStack, createSagaQueues, receiveAll, SagaQueue, FifoQueue } from '../helpers/localstack';
import { DynamoExecutionStore } from '../../src/adapters/gateways/DynamoExecutionStore';
import { DynamoExecutionRepository } from '../../src/adapters/gateways/DynamoExecutionRepository';
import { DynamoOutboxStore } from '../../src/adapters/gateways/DynamoOutboxStore';
import { ExecutionCommandHandler } from '../../src/adapters/messaging/ExecutionCommandHandler';
import { SqsMessageSender } from '../../src/adapters/messaging/SqsMessageSender';
import { SqsQueuePoller } from '../../src/frameworks/messaging/SqsQueuePoller';
import { EnqueueDiagnosisUseCase } from '../../src/use-cases/executions/EnqueueDiagnosisUseCase';
import { EnqueueRepairUseCase } from '../../src/use-cases/executions/EnqueueRepairUseCase';
import { CancelExecutionUseCase } from '../../src/use-cases/executions/CancelExecutionUseCase';
import { PublishPendingMessagesUseCase } from '../../src/use-cases/messaging/PublishPendingMessagesUseCase';
import { MessageEnvelope } from '../../src/use-cases/messaging/MessageEnvelope';
import { finish, start } from '../../src/entities/Execution';

const silentLog = pino({ level: 'silent' });

let dynamo: TestDynamo;
let sqs: SQSClient;
let queues: Record<SagaQueue, FifoQueue>;
let store: DynamoExecutionStore;
let executions: DynamoExecutionRepository;
let poller: SqsQueuePoller;
let publish: PublishPendingMessagesUseCase;

beforeAll(async () => {
  dynamo = await startDynamo();
  sqs = await startLocalStack();
  queues = await createSagaQueues(sqs);
  store = new DynamoExecutionStore(dynamo.documents, dynamo.tables, { currentTraceparent: () => undefined });
  executions = new DynamoExecutionRepository(dynamo.documents, dynamo.tables.executions);

  const enqueueDiagnosis = new EnqueueDiagnosisUseCase(executions, store);
  const enqueueRepair = new EnqueueRepairUseCase(executions, store);
  const cancelExecution = new CancelExecutionUseCase(executions, store);
  const handler = new ExecutionCommandHandler({
    EnqueueDiagnosis: (command) => enqueueDiagnosis.execute(command),
    EnqueueRepair: (command) => enqueueRepair.execute(command),
    CancelExecution: (command) => cancelExecution.execute(command),
  });
  poller = new SqsQueuePoller(sqs, { name: 'execution-commands', url: queues['execution-commands'].url }, handler, silentLog, { waitTimeSeconds: 1 });

  const sender = new SqsMessageSender(sqs, { 'saga-replies': queues['saga-replies'].url }, { record: jest.fn() });
  publish = new PublishPendingMessagesUseCase(new DynamoOutboxStore(dynamo.documents, dynamo.tables.outbox), sender);
});

afterAll(async () => {
  await stopLocalStack();
  await stopDynamo();
});

async function deliver(message: Omit<MessageEnvelope, 'occurredAt'>): Promise<void> {
  await sqs.send(new SendMessageCommand({
    QueueUrl: queues['execution-commands'].url,
    MessageGroupId: message.serviceOrderId,
    MessageDeduplicationId: message.messageId,
    MessageBody: JSON.stringify({ ...message, occurredAt: new Date().toISOString() }),
  }));
}

/** Takes an order through diagnosis the way the mechanic will: queued, started, finished. */
async function finishedDiagnosisFor(serviceOrderId: string, messageId: string): Promise<void> {
  await new EnqueueDiagnosisUseCase(executions, store).execute({
    messageId, type: 'EnqueueDiagnosis', serviceOrderId, occurredAt: '', payload: {},
  });
  const queued = (await executions.findById(serviceOrderId))!;
  await store.save({ execution: { state: start(queued, new Date()), expectedVersion: queued.version }, messages: [] });
  const started = (await executions.findById(serviceOrderId))!;
  await store.save({ execution: { state: finish(started, new Date()), expectedVersion: started.version }, messages: [] });
}

describe('Queue commands', () => {
  it('GIVEN EnqueueDiagnosis on the commands queue WHEN the consumer runs THEN the order is in the queue for diagnosis', async () => {
    // GIVEN
    const serviceOrderId = 'a0000000-0000-4000-8000-000000000001';
    await deliver({ messageId: 'b0000000-0000-4000-8000-000000000001', type: 'EnqueueDiagnosis', serviceOrderId, payload: {} });

    // WHEN
    const handled = await poller.pollOnce();

    // THEN
    expect(handled).toBe(1);
    const queued = await executions.listByStatus('QUEUED');
    expect(queued).toContainEqual(expect.objectContaining({ serviceOrderId, stage: 'DIAGNOSIS', status: 'QUEUED' }));
  });

  it('GIVEN a finished diagnosis WHEN EnqueueRepair is consumed THEN the order is back in the queue for repair with its tasks and nothing is replied', async () => {
    // GIVEN
    const serviceOrderId = 'a0000000-0000-4000-8000-000000000002';
    await finishedDiagnosisFor(serviceOrderId, 'b0000000-0000-4000-8000-000000000002');
    await deliver({
      messageId: 'b0000000-0000-4000-8000-000000000003',
      type: 'EnqueueRepair',
      serviceOrderId,
      payload: { tasks: [{ serviceId: 'c0000000-0000-4000-8000-000000000001', name: 'Oil change' }] },
    });

    // WHEN
    const handled = await poller.pollOnce();

    // THEN
    expect(handled).toBe(1);
    expect(await executions.findById(serviceOrderId)).toMatchObject({
      stage: 'REPAIR',
      status: 'QUEUED',
      tasks: [{ serviceId: 'c0000000-0000-4000-8000-000000000001', name: 'Oil change' }],
    });
    expect(await publish.execute(25)).toBe(0);
    expect(await receiveAll(sqs, queues['saga-replies'].url)).toHaveLength(0);
  });

  it('GIVEN a finished diagnosis WHEN CancelExecution is consumed THEN the execution is CANCELLED and ExecutionCancelled is published', async () => {
    // GIVEN
    const serviceOrderId = 'a0000000-0000-4000-8000-000000000003';
    await finishedDiagnosisFor(serviceOrderId, 'b0000000-0000-4000-8000-000000000004');
    await deliver({
      messageId: 'b0000000-0000-4000-8000-000000000005',
      type: 'CancelExecution',
      serviceOrderId,
      payload: { reason: 'BUDGET_REJECTED' },
    });

    // WHEN
    await poller.pollOnce();
    await publish.execute(25);

    // THEN
    expect(await executions.findById(serviceOrderId)).toMatchObject({ stage: 'DIAGNOSIS', status: 'CANCELLED' });
    const replies = await receiveAll(sqs, queues['saga-replies'].url);
    expect(replies.map((m) => JSON.parse(m.Body ?? '{}'))).toEqual([
      expect.objectContaining({ type: 'ExecutionCancelled', serviceOrderId, payload: {} }),
    ]);
  });
});
