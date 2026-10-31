import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { SqsMessageSender } from '../../../../src/adapters/messaging/SqsMessageSender';

const queueUrls = { 'saga-replies': 'http://queues/saga-replies.fifo' };

const envelope = {
  messageId: 'm-1',
  type: 'DiagnosisStarted',
  serviceOrderId: 'os-1',
  occurredAt: '2026-10-31T10:00:00.000Z',
  payload: {},
};

describe('SqsMessageSender', () => {
  it('sends to the queue of the destination with the order as group and the message id as deduplication id', async () => {
    const sqs = { send: jest.fn().mockResolvedValue({}) };
    const failures = { record: jest.fn() };

    await new SqsMessageSender(sqs as unknown as SQSClient, queueUrls, failures).send('saga-replies', envelope);

    const command = sqs.send.mock.calls[0][0];
    expect(command).toBeInstanceOf(SendMessageCommand);
    expect(command.input).toEqual({
      QueueUrl: 'http://queues/saga-replies.fifo',
      MessageBody: JSON.stringify(envelope),
      MessageGroupId: 'os-1',
      MessageDeduplicationId: 'm-1',
    });
    expect(failures.record).not.toHaveBeenCalled();
  });

  it('records an integration failure and rethrows when the queue refuses the message', async () => {
    const sqs = { send: jest.fn().mockRejectedValue(new Error('throttled')) };
    const failures = { record: jest.fn() };

    await expect(
      new SqsMessageSender(sqs as unknown as SQSClient, queueUrls, failures).send('saga-replies', envelope),
    ).rejects.toThrow('throttled');

    expect(failures.record).toHaveBeenCalledWith('sqs', 'saga-replies');
  });
});
