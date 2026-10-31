import { MessageDestination, MessageEnvelope } from '../messaging/MessageEnvelope';

export interface PendingMessage extends MessageEnvelope {
  destination: MessageDestination;
}

/** Read side of the outbox, used only by the relay that publishes it. */
export interface IOutboxStore {
  /** Unpublished messages, oldest first. */
  findPending(limit: number): Promise<PendingMessage[]>;
  markPublished(messageId: string): Promise<void>;
}
