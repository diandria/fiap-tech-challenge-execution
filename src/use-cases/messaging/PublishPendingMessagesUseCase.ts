import { IOutboxStore } from '../ports/IOutboxStore';
import { IMessageSender } from '../ports/IMessageSender';

export class PublishPendingMessagesUseCase {
  constructor(
    private readonly outbox: IOutboxStore,
    private readonly sender: IMessageSender,
  ) {}

  /**
   * Publishes up to `batchSize` pending messages in the order they were stored,
   * and returns how many were sent. Stops at the first failed send, so a later
   * message never overtakes an earlier one.
   *
   * A message is marked only after it was sent. If the process stops in
   * between, it is sent again on the next run: delivery is at least once, and
   * consumers discard the repeat by its id.
   */
  async execute(batchSize: number): Promise<number> {
    const pending = await this.outbox.findPending(batchSize);

    for (const { destination, ...envelope } of pending) {
      await this.sender.send(destination, envelope);
      await this.outbox.markPublished(envelope.messageId);
    }

    return pending.length;
  }
}
