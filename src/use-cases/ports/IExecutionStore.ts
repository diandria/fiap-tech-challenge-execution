import { Execution } from '../../entities/Execution';
import { OutgoingMessage } from '../messaging/MessageEnvelope';

/** Everything one change writes, saved together or not at all. */
export interface ExecutionChanges {
  execution: {
    state: Execution;
    /** The version the state was computed from; null when the execution must not exist yet. */
    expectedVersion: number | null;
  };
  /** Replies to the saga. */
  messages: OutgoingMessage[];
  /** The command that caused the change, recorded so a redelivery has no effect. */
  processedMessage?: { messageId: string; type: string };
}

/**
 * Output port for writing executions. DynamoDB has no interactive
 * transaction, so instead of a unit of work the use case computes the whole
 * change and the store writes it in one go.
 */
export interface IExecutionStore {
  /**
   * Writes everything atomically, with the version incremented. Throws
   * ConflictError on a version mismatch and DuplicateMessageError when the
   * command was already processed.
   */
  save(changes: ExecutionChanges): Promise<void>;
}
