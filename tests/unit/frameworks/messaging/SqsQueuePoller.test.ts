import pino from 'pino';
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand, Message } from '@aws-sdk/client-sqs';
import { SqsQueuePoller } from '../../../../src/frameworks/messaging/SqsQueuePoller';
import { IMessageHandler } from '../../../../src/use-cases/ports/IMessageHandler';

const queue = { name: 'execution-commands', url: 'http://queues/execution.fifo' };
const silentLog = pino({ level: 'silent' });

function body(messageId: string): string {
  return JSON.stringify({
    messageId,
    type: 'EnqueueDiagnosis',
    serviceOrderId: 'os-1',
    occurredAt: '2026-10-31T10:00:00.000Z',
    payload: {},
  });
}

function sqsWith(messages: Message[]) {
  const deleted: string[] = [];
  const send = jest.fn(async (command: unknown) => {
    if (command instanceof ReceiveMessageCommand) return { Messages: messages };
    if (command instanceof DeleteMessageCommand) deleted.push(command.input.ReceiptHandle as string);
    return {};
  });
  return { client: { send } as unknown as SQSClient, deleted };
}

describe('SqsQueuePoller', () => {
  it('deletes the message after the handler resolves', async () => {
    const sqs = sqsWith([{ Body: body('m-1'), ReceiptHandle: 'r-1' }]);
    const handler: IMessageHandler = { handle: jest.fn().mockResolvedValue(undefined) };

    const handled = await new SqsQueuePoller(sqs.client, queue, handler, silentLog).pollOnce();

    expect(handled).toBe(1);
    expect(handler.handle).toHaveBeenCalledWith(expect.objectContaining({ messageId: 'm-1' }));
    expect(sqs.deleted).toEqual(['r-1']);
  });

  it('keeps the message when the handler throws', async () => {
    const sqs = sqsWith([{ Body: body('m-1'), ReceiptHandle: 'r-1' }]);
    const handler: IMessageHandler = { handle: jest.fn().mockRejectedValue(new Error('database down')) };

    const handled = await new SqsQueuePoller(sqs.client, queue, handler, silentLog).pollOnce();

    expect(handled).toBe(0);
    expect(sqs.deleted).toEqual([]);
  });

  it('keeps a message whose body is not a valid envelope, so it ends in the dead-letter queue', async () => {
    const sqs = sqsWith([{ Body: '{"unexpected":true}', ReceiptHandle: 'r-1' }]);
    const handler: IMessageHandler = { handle: jest.fn() };

    await new SqsQueuePoller(sqs.client, queue, handler, silentLog).pollOnce();

    expect(handler.handle).not.toHaveBeenCalled();
    expect(sqs.deleted).toEqual([]);
  });

  it('stops the batch at the first failure, so a later message of the same order never overtakes it', async () => {
    const sqs = sqsWith([
      { Body: body('m-1'), ReceiptHandle: 'r-1' },
      { Body: body('m-2'), ReceiptHandle: 'r-2' },
      { Body: body('m-3'), ReceiptHandle: 'r-3' },
    ]);
    const handler: IMessageHandler = {
      handle: jest.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('conflict')),
    };

    const handled = await new SqsQueuePoller(sqs.client, queue, handler, silentLog).pollOnce();

    expect(handled).toBe(1);
    expect(handler.handle).toHaveBeenCalledTimes(2);
    expect(sqs.deleted).toEqual(['r-1']);
  });
});
