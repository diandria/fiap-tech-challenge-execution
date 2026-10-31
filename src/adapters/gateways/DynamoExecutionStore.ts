import { randomUUID } from 'node:crypto';
import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { ConflictError } from '../../entities/errors/AppError';
import { ExecutionChanges, IExecutionStore } from '../../use-cases/ports/IExecutionStore';
import { ITraceContext } from '../../use-cases/ports/ITraceContext';
import { DuplicateMessageError } from '../../use-cases/messaging/DuplicateMessageError';
import { OutgoingMessage } from '../../use-cases/messaging/MessageEnvelope';
import { toItem } from './executionItem';

export interface StoreTables {
  executions: string;
  outbox: string;
  processedMessages: string;
}

/** Far beyond the five-minute deduplication window of the FIFO queues. */
const PROCESSED_MESSAGE_TTL_DAYS = 30;
const CONDITION_FAILED = 'ConditionalCheckFailed';

type TransactItem = NonNullable<ConstructorParameters<typeof TransactWriteCommand>[0]['TransactItems']>[number];

export class DynamoExecutionStore implements IExecutionStore {
  constructor(
    private readonly documents: DynamoDBDocumentClient,
    private readonly tables: StoreTables,
    private readonly traceContext: ITraceContext,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /**
   * One TransactWriteItems: the execution, conditioned on its version; one
   * item per outgoing message; and the processed-message marker, conditioned
   * on not existing yet. Any condition that fails cancels the whole write.
   */
  async save(changes: ExecutionChanges): Promise<void> {
    const now = this.now();
    const items: TransactItem[] = [
      ...(changes.execution ? [this.executionPut(changes.execution)] : []),
      ...changes.messages.map((message) => this.outboxPut(message, now)),
    ];
    // The marker goes last, so its cancellation reason is the last one.
    if (changes.processedMessage) items.push(this.processedPut(changes.processedMessage, now));

    try {
      await this.documents.send(new TransactWriteCommand({ TransactItems: items }));
    } catch (err) {
      throw this.explain(err, changes);
    }
  }

  private executionPut({ state, expectedVersion }: NonNullable<ExecutionChanges['execution']>): TransactItem {
    const isNew = expectedVersion === null;
    return {
      Put: {
        TableName: this.tables.executions,
        Item: toItem({ ...state, version: isNew ? 0 : expectedVersion + 1 }),
        ConditionExpression: isNew ? 'attribute_not_exists(serviceOrderId)' : 'version = :expected',
        ...(!isNew && { ExpressionAttributeValues: { ':expected': expectedVersion } }),
      },
    };
  }

  private outboxPut(message: OutgoingMessage, now: Date): TransactItem {
    const traceparent = this.traceContext.currentTraceparent();
    return {
      Put: {
        TableName: this.tables.outbox,
        Item: {
          messageId: randomUUID(),
          destination: message.destination,
          type: message.type,
          serviceOrderId: message.serviceOrderId,
          payload: message.payload,
          // The consumer continues this trace across the queue.
          ...(traceparent && { traceparent }),
          createdAt: now.toISOString(),
        },
      },
    };
  }

  private processedPut(processed: { messageId: string; type: string }, now: Date): TransactItem {
    const expiresAt = Math.floor(now.getTime() / 1000) + PROCESSED_MESSAGE_TTL_DAYS * 24 * 60 * 60;
    return {
      Put: {
        TableName: this.tables.processedMessages,
        Item: { messageId: processed.messageId, type: processed.type, expiresAt },
        ConditionExpression: 'attribute_not_exists(messageId)',
      },
    };
  }

  /**
   * DynamoDB reports why a transaction was cancelled in one reason per item,
   * in the order the items were sent: the execution first, the marker last.
   * A repeat is checked first, because when a command was already processed
   * the version has usually moved as well.
   */
  private explain(err: unknown, changes: ExecutionChanges): unknown {
    if (!(err instanceof TransactionCanceledException)) return err;
    const reasons = err.CancellationReasons ?? [];
    const failed = (index: number) => reasons[index]?.Code === CONDITION_FAILED;

    if (changes.processedMessage && failed(reasons.length - 1)) {
      return new DuplicateMessageError(changes.processedMessage.messageId);
    }
    if (changes.execution && failed(0)) {
      return new ConflictError('Execution was changed by another request; read it again');
    }
    return err;
  }
}
