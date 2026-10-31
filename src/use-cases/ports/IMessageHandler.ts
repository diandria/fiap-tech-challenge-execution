import { MessageEnvelope } from '../messaging/MessageEnvelope';

/**
 * Input port for a consumed message. Resolving means the message was handled
 * (or was a repeat) and can be removed from the queue; throwing leaves it for
 * another delivery.
 */
export interface IMessageHandler {
  handle(envelope: MessageEnvelope): Promise<void>;
}
