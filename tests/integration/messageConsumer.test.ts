import pino from 'pino';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { startDynamo, stopDynamo, TestDynamo } from '../helpers/dynamodb';
import { startLocalStack, stopLocalStack, createFifoQueue, receiveAll, FifoQueue } from '../helpers/localstack';
import { DynamoExecutionStore } from '../../src/adapters/gateways/DynamoExecutionStore';
import { DynamoExecutionRepository } from '../../src/adapters/gateways/DynamoExecutionRepository';
import { ExecutionCommandHandler } from '../../src/adapters/messaging/ExecutionCommandHandler';
import { SqsQueuePoller } from '../../src/frameworks/messaging/SqsQueuePoller';
import { MessageEnvelope } from '../../src/use-cases/messaging/MessageEnvelope';
import { queueDiagnosis } from '../../src/entities/Execution';

const silentLog = pino({ level: 'silent' });

let dynamo: TestDynamo;
let sqs: SQSClient;
let store: DynamoExecutionStore;
let repository: DynamoExecutionRepository;
let queueCount = 0;

beforeAll(async () => {
  dynamo = await startDynamo();
  sqs = await startLocalStack();
  store = new DynamoExecutionStore(dynamo.documents, dynamo.tables, { currentTraceparent: () => undefined });
  repository = new DynamoExecutionRepository(dynamo.documents, dynamo.tables.executions);
});

afterAll(async () => {
  await stopLocalStack();
  await stopDynamo();
});

function command(messageId: string, serviceOrderId: string, type = 'EnqueueDiagnosis'): MessageEnvelope {
  return { messageId, type, serviceOrderId, occurredAt: new Date().toISOString(), payload: {} };
}

async function deliver(queue: FifoQueue, message: MessageEnvelope, deduplicationId = message.messageId): Promise<void> {
  await sqs.send(new SendMessageCommand({
    QueueUrl: queue.url,
    MessageBody: JSON.stringify(message),
    MessageGroupId: message.serviceOrderId,
    MessageDeduplicationId: deduplicationId,
  }));
}

/** Queues a diagnosis the way the real command will, recording the command in the same write. */
const enqueueDiagnosis = new ExecutionCommandHandler({
  EnqueueDiagnosis: (message) => store.save({
    execution: queueDiagnosis(message.serviceOrderId, new Date()),
    expectedVersion: null,
    messages: [],
    processedMessage: { messageId: message.messageId, type: message.type },
  }),
});

async function newQueue(options?: { maxReceiveCount?: number; visibilityTimeoutSeconds?: number }): Promise<FifoQueue> {
  queueCount += 1;
  return createFifoQueue(sqs, `execution-consumer-test-${queueCount}`, options);
}

describe('Execution command consumer', () => {
  it('GIVEN the same command delivered twice WHEN both are handled THEN the effect happens once and both are confirmed', async () => {
    // GIVEN
    const queue = await newQueue();
    const serviceOrderId = 'a0000000-0000-4000-8000-000000000001';
    const repeated = command('b0000000-0000-4000-8000-000000000001', serviceOrderId);
    await deliver(queue, repeated, 'first-send');
    await deliver(queue, repeated, 'second-send');
    const poller = new SqsQueuePoller(sqs, { name: 'execution-commands', url: queue.url }, enqueueDiagnosis, silentLog, { waitTimeSeconds: 1 });

    // WHEN
    const handled = (await poller.pollOnce()) + (await poller.pollOnce());

    // THEN
    expect(handled).toBe(2);
    expect(await repository.findById(serviceOrderId)).toMatchObject({ status: 'QUEUED', version: 0 });
    expect(await receiveAll(sqs, queue.url)).toHaveLength(0);
  });

  it('GIVEN a command with an unknown type WHEN it is received five times THEN it lands in the dead-letter queue', async () => {
    // GIVEN
    const queue = await newQueue({ maxReceiveCount: 5, visibilityTimeoutSeconds: 1 });
    await deliver(queue, command('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'ShipParts'));
    const poller = new SqsQueuePoller(sqs, { name: 'execution-commands', url: queue.url }, enqueueDiagnosis, silentLog, { waitTimeSeconds: 2 });

    // WHEN
    for (let attempt = 0; attempt < 7; attempt++) {
      await poller.pollOnce();
    }

    // THEN
    const deadLetters = await receiveAll(sqs, queue.deadLetterUrl, 2);
    expect(deadLetters.map((m) => JSON.parse(m.Body ?? '{}').messageId)).toEqual(['b0000000-0000-4000-8000-000000000002']);
  });
});
