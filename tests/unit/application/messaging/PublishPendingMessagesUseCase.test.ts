import { PublishPendingMessagesUseCase } from '../../../../src/use-cases/messaging/PublishPendingMessagesUseCase';
import { IOutboxStore, PendingMessage } from '../../../../src/use-cases/ports/IOutboxStore';
import { IMessageSender } from '../../../../src/use-cases/ports/IMessageSender';

const pending = (messageId: string): PendingMessage => ({
  messageId,
  destination: 'saga-replies',
  type: 'DiagnosisStarted',
  serviceOrderId: 'os-1',
  occurredAt: '2026-10-31T10:00:00.000Z',
  payload: {},
});

function makeStore(messages: PendingMessage[]): IOutboxStore & { markPublished: jest.Mock } {
  return {
    findPending: jest.fn().mockResolvedValue(messages),
    markPublished: jest.fn().mockResolvedValue(undefined),
    countPending: jest.fn().mockResolvedValue(messages.length),
  };
}

describe('PublishPendingMessagesUseCase', () => {
  it('sends pending messages in creation order and marks each one as published', async () => {
    const store = makeStore([pending('m-1'), pending('m-2')]);
    const sent: string[] = [];
    const sender: IMessageSender = { send: jest.fn(async (_destination, envelope) => { sent.push(envelope.messageId); }) };

    const count = await new PublishPendingMessagesUseCase(store, sender).execute(10);

    expect(count).toBe(2);
    expect(sent).toEqual(['m-1', 'm-2']);
    expect(store.markPublished.mock.calls).toEqual([['m-1'], ['m-2']]);
    expect(sender.send).toHaveBeenCalledWith('saga-replies', expect.not.objectContaining({ destination: expect.anything() }));
  });

  it('stops at the first send failure and leaves the rest pending', async () => {
    const store = makeStore([pending('m-1'), pending('m-2'), pending('m-3')]);
    const sender: IMessageSender = {
      send: jest.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('queue unavailable')),
    };

    await expect(new PublishPendingMessagesUseCase(store, sender).execute(10)).rejects.toThrow('queue unavailable');

    expect(store.markPublished.mock.calls).toEqual([['m-1']]);
    expect(sender.send).toHaveBeenCalledTimes(2);
  });

  it('returns zero when nothing is pending', async () => {
    const store = makeStore([]);
    const sender: IMessageSender = { send: jest.fn() };

    expect(await new PublishPendingMessagesUseCase(store, sender).execute(10)).toBe(0);
    expect(sender.send).not.toHaveBeenCalled();
  });
});
