import { SQSClient } from '@aws-sdk/client-sqs';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { startDynamo, stopDynamo, TestDynamo } from '../helpers/dynamodb';
import { startLocalStack, stopLocalStack, createSagaQueues, receiveAll, SagaQueue, FifoQueue } from '../helpers/localstack';
import { DynamoExecutionStore } from '../../src/adapters/gateways/DynamoExecutionStore';
import { DynamoOutboxStore } from '../../src/adapters/gateways/DynamoOutboxStore';
import { SqsMessageSender } from '../../src/adapters/messaging/SqsMessageSender';
import { PublishPendingMessagesUseCase } from '../../src/use-cases/messaging/PublishPendingMessagesUseCase';
import { queueDiagnosis } from '../../src/entities/Execution';

const serviceOrderId = '11111111-1111-4111-8111-111111111111';

let dynamo: TestDynamo;
let sqs: SQSClient;
let queues: Record<SagaQueue, FifoQueue>;
let store: DynamoExecutionStore;
let publish: PublishPendingMessagesUseCase;

beforeAll(async () => {
  dynamo = await startDynamo();
  sqs = await startLocalStack();
  queues = await createSagaQueues(sqs);
  store = new DynamoExecutionStore(dynamo.documents, dynamo.tables, { currentTraceparent: () => undefined });
  const sender = new SqsMessageSender(sqs, { 'saga-replies': queues['saga-replies'].url }, { record: jest.fn() });
  publish = new PublishPendingMessagesUseCase(new DynamoOutboxStore(dynamo.documents, dynamo.tables.outbox), sender);
});

afterAll(async () => {
  await stopLocalStack();
  await stopDynamo();
});

describe('Outbox relay', () => {
  it('GIVEN a save with one reply WHEN the relay runs THEN the reply reaches the replies queue and the outbox is empty', async () => {
    // GIVEN
    await store.save({
      execution: { state: queueDiagnosis(serviceOrderId, new Date()), expectedVersion: null },
      messages: [{ destination: 'saga-replies', type: 'DiagnosisQueued', serviceOrderId, payload: {} }],
    });

    // WHEN
    const sent = await publish.execute(25);

    // THEN
    expect(sent).toBe(1);
    const replies = await receiveAll(sqs, queues['saga-replies'].url);
    expect(replies).toHaveLength(1);
    expect(JSON.parse(replies[0].Body ?? '{}')).toMatchObject({ type: 'DiagnosisQueued', serviceOrderId });
    expect(replies[0].Attributes?.MessageGroupId).toBe(serviceOrderId);
    const { Count } = await dynamo.documents.send(new ScanCommand({ TableName: dynamo.tables.outbox, Select: 'COUNT' }));
    expect(Count).toBe(0);
  });
});
