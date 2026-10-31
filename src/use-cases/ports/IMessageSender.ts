import { MessageDestination, MessageEnvelope } from '../messaging/MessageEnvelope';

/** Output port that delivers one envelope to the queue of a destination. */
export interface IMessageSender {
  send(destination: MessageDestination, envelope: MessageEnvelope): Promise<void>;
}
