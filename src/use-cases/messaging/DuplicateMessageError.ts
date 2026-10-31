/**
 * The command was already processed: its effect and its replies are stored.
 * Not a failure; the consumer confirms the message and moves on.
 */
export class DuplicateMessageError extends Error {
  constructor(public readonly messageId: string) {
    super(`Message ${messageId} was already processed`);
    this.name = 'DuplicateMessageError';
  }
}
