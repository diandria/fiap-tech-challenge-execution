import { MessageDestination, MessageEnvelope } from '../messaging/MessageEnvelope';

export interface PendingMessage extends MessageEnvelope {
  destination: MessageDestination;
}

/** Read side of the outbox: the relay that publishes it and the backlog metric. */
export interface IOutboxStore {
  /** Unpublished messages, oldest first. */
  findPending(limit: number): Promise<PendingMessage[]>;
  markPublished(messageId: string): Promise<void>;
  /** How many messages are still waiting to be published. */
  countPending(): Promise<number>;
}
