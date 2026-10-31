import { IMessageHandler } from '../../use-cases/ports/IMessageHandler';
import { MessageEnvelope } from '../../use-cases/messaging/MessageEnvelope';
import { DuplicateMessageError } from '../../use-cases/messaging/DuplicateMessageError';

/** Commands the OS Service sends to the execution commands queue. */
export type ExecutionCommandType = 'EnqueueDiagnosis' | 'EnqueueRepair' | 'CancelExecution';

export type CommandHandlers = Partial<Record<ExecutionCommandType, (envelope: MessageEnvelope) => Promise<void>>>;

/**
 * Hands each command to the handler of its type. A type with no handler
 * throws instead of being dropped: the message ends in the dead-letter queue,
 * where the saga sees the step as failed. A command already processed is
 * confirmed, because its effect and its replies are already stored.
 */
export class ExecutionCommandHandler implements IMessageHandler {
  constructor(private readonly handlers: CommandHandlers) {}

  async handle(envelope: MessageEnvelope): Promise<void> {
    const handler = this.handlers[envelope.type as ExecutionCommandType];
    if (!handler) {
      throw new Error(`No handler for execution command ${envelope.type}`);
    }

    try {
      await handler(envelope);
    } catch (err) {
      if (err instanceof DuplicateMessageError) return;
      throw err;
    }
  }
}
