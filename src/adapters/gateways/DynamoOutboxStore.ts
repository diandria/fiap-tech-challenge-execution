import { DeleteCommand, DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { IOutboxStore, PendingMessage } from '../../use-cases/ports/IOutboxStore';
import { MessageDestination } from '../../use-cases/messaging/MessageEnvelope';

interface OutboxItem {
  messageId: string;
  destination: MessageDestination;
  type: string;
  serviceOrderId: string;
  payload: Record<string, unknown>;
  traceparent?: string;
  createdAt: string;
}

/**
 * The outbox holds only what is still pending: the relay deletes each
 * message after sending it. With the table almost always empty, a limited
 * scan is the simplest read, and the order is restored in memory. A single
 * change never writes two replies, so messages created in the same instant
 * never need ordering between them.
 */
export class DynamoOutboxStore implements IOutboxStore {
  constructor(
    private readonly documents: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async findPending(limit: number): Promise<PendingMessage[]> {
    const { Items = [] } = await this.documents.send(new ScanCommand({
      TableName: this.tableName,
      Limit: limit,
      ConsistentRead: true,
    }));

    return (Items as OutboxItem[])
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((item) => ({
        messageId: item.messageId,
        destination: item.destination,
        type: item.type,
        serviceOrderId: item.serviceOrderId,
        occurredAt: item.createdAt,
        ...(item.traceparent && { traceparent: item.traceparent }),
        payload: item.payload,
      }));
  }

  async markPublished(messageId: string): Promise<void> {
    await this.documents.send(new DeleteCommand({ TableName: this.tableName, Key: { messageId } }));
  }
}
