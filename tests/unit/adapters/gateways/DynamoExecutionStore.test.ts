import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import { DynamoExecutionStore } from '../../../../src/adapters/gateways/DynamoExecutionStore';
import { ConflictError } from '../../../../src/entities/errors/AppError';
import { DuplicateMessageError } from '../../../../src/use-cases/messaging/DuplicateMessageError';
import { queuedDiagnosis } from '../../fixtures/execution';

const tables = {
  executions: 'executions',
  outbox: 'outbox',
  processedMessages: 'processed',
};

const reply = {
  destination: 'saga-replies' as const,
  type: 'DiagnosisStarted',
  serviceOrderId: queuedDiagnosis.serviceOrderId,
  payload: {},
};

function makeStore(send: jest.Mock, traceparent?: string) {
  const now = () => new Date('2026-10-31T10:00:00.000Z');
  return new DynamoExecutionStore({ send } as never, tables, { currentTraceparent: () => traceparent }, now);
}

function cancelled(codes: string[]): TransactionCanceledException {
  return new TransactionCanceledException({
    message: 'Transaction cancelled',
    $metadata: {},
    CancellationReasons: codes.map((Code) => ({ Code })),
  });
}

describe('DynamoExecutionStore', () => {
  it('builds one transaction with the execution, the outbox messages and the processed marker', async () => {
    const send = jest.fn().mockResolvedValue({});

    await makeStore(send, '00-abc-def-01').save({
      execution: { state: queuedDiagnosis, expectedVersion: 0 },
      messages: [reply],
      processedMessage: { messageId: 'm-1', type: 'StartDiagnosis' },
    });

    const command = send.mock.calls[0][0];
    expect(command).toBeInstanceOf(TransactWriteCommand);
    const [execution, outbox, processed] = command.input.TransactItems;
    expect(execution.Put).toMatchObject({
      TableName: 'executions',
      Item: expect.objectContaining({ serviceOrderId: queuedDiagnosis.serviceOrderId, version: 1 }),
      ConditionExpression: 'version = :expected',
      ExpressionAttributeValues: { ':expected': 0 },
    });
    expect(outbox.Put).toMatchObject({
      TableName: 'outbox',
      Item: {
        messageId: expect.stringMatching(/^[0-9a-f-]{36}$/),
        destination: 'saga-replies',
        type: 'DiagnosisStarted',
        serviceOrderId: queuedDiagnosis.serviceOrderId,
        payload: {},
        traceparent: '00-abc-def-01',
        createdAt: '2026-10-31T10:00:00.000Z',
      },
    });
    expect(processed.Put).toMatchObject({
      TableName: 'processed',
      Item: { messageId: 'm-1', type: 'StartDiagnosis', expiresAt: Math.floor(Date.parse('2026-11-30T10:00:00.000Z') / 1000) },
      ConditionExpression: 'attribute_not_exists(messageId)',
    });
  });

  it('requires the execution not to exist when there is no expected version', async () => {
    const send = jest.fn().mockResolvedValue({});

    await makeStore(send).save({ execution: { state: queuedDiagnosis, expectedVersion: null }, messages: [] });

    const [execution] = send.mock.calls[0][0].input.TransactItems;
    expect(execution.Put.ConditionExpression).toBe('attribute_not_exists(serviceOrderId)');
    expect(execution.Put.Item.version).toBe(0);
    expect(execution.Put.Item).not.toHaveProperty('traceparent');
  });

  it('maps a version condition failure to ConflictError', async () => {
    const send = jest.fn().mockRejectedValue(cancelled(['ConditionalCheckFailed', 'None', 'None']));

    await expect(makeStore(send).save({
      execution: { state: queuedDiagnosis, expectedVersion: 3 },
      messages: [reply],
      processedMessage: { messageId: 'm-1', type: 'StartDiagnosis' },
    })).rejects.toThrow(ConflictError);
  });

  it('maps a processed-message condition failure to DuplicateMessageError', async () => {
    const send = jest.fn().mockRejectedValue(cancelled(['None', 'None', 'ConditionalCheckFailed']));

    await expect(makeStore(send).save({
      execution: { state: queuedDiagnosis, expectedVersion: 0 },
      messages: [reply],
      processedMessage: { messageId: 'm-1', type: 'StartDiagnosis' },
    })).rejects.toThrow(DuplicateMessageError);
  });

  it('rethrows any other failure as it is', async () => {
    const send = jest.fn().mockRejectedValue(cancelled(['ThrottlingError', 'None']));

    await expect(makeStore(send).save({ execution: { state: queuedDiagnosis, expectedVersion: 0 }, messages: [reply] }))
      .rejects.toBeInstanceOf(TransactionCanceledException);
  });

  it('writes only the replies and the processed marker when the change has no execution', async () => {
    const send = jest.fn().mockResolvedValue({});

    await makeStore(send).save({ messages: [reply], processedMessage: { messageId: 'm-1', type: 'CancelExecution' } });

    const items = send.mock.calls[0][0].input.TransactItems;
    expect(items.map((item: { Put: { TableName: string } }) => item.Put.TableName)).toEqual(['outbox', 'processed']);
  });

  it('maps a processed-message failure to DuplicateMessageError when the change has no execution', async () => {
    const send = jest.fn().mockRejectedValue(cancelled(['None', 'ConditionalCheckFailed']));

    await expect(makeStore(send).save({ messages: [reply], processedMessage: { messageId: 'm-1', type: 'CancelExecution' } }))
      .rejects.toThrow(DuplicateMessageError);
  });
});
