import { DeleteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoOutboxStore } from '../../../../src/adapters/gateways/DynamoOutboxStore';

function item(messageId: string, createdAt: string, traceparent?: string) {
  return {
    messageId,
    destination: 'saga-replies',
    type: 'DiagnosisStarted',
    serviceOrderId: 'os-1',
    payload: { step: messageId },
    createdAt,
    ...(traceparent && { traceparent }),
  };
}

describe('DynamoOutboxStore', () => {
  it('returns the pending messages oldest first, as envelopes with their destination', async () => {
    const send = jest.fn().mockResolvedValue({
      Items: [
        item('m-2', '2026-10-31T10:00:02.000Z'),
        item('m-1', '2026-10-31T10:00:01.000Z', '00-abc-def-01'),
      ],
    });

    const pending = await new DynamoOutboxStore({ send } as never, 'outbox').findPending(10);

    const scan = send.mock.calls[0][0];
    expect(scan).toBeInstanceOf(ScanCommand);
    expect(scan.input).toMatchObject({ TableName: 'outbox', Limit: 10, ConsistentRead: true });
    expect(pending).toEqual([
      {
        messageId: 'm-1',
        destination: 'saga-replies',
        type: 'DiagnosisStarted',
        serviceOrderId: 'os-1',
        occurredAt: '2026-10-31T10:00:01.000Z',
        traceparent: '00-abc-def-01',
        payload: { step: 'm-1' },
      },
      expect.objectContaining({ messageId: 'm-2', occurredAt: '2026-10-31T10:00:02.000Z' }),
    ]);
    expect(pending[1]).not.toHaveProperty('traceparent');
  });

  it('returns nothing for an empty outbox', async () => {
    const send = jest.fn().mockResolvedValue({});

    expect(await new DynamoOutboxStore({ send } as never, 'outbox').findPending(10)).toEqual([]);
  });

  it('deletes a message once it is published, so the outbox holds only what is pending', async () => {
    const send = jest.fn().mockResolvedValue({});

    await new DynamoOutboxStore({ send } as never, 'outbox').markPublished('m-1');

    const command = send.mock.calls[0][0];
    expect(command).toBeInstanceOf(DeleteCommand);
    expect(command.input).toEqual({ TableName: 'outbox', Key: { messageId: 'm-1' } });
  });
});
