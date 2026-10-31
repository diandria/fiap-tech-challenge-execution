import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { Execution } from '../../entities/Execution';
import { IExecutionRepository } from '../../use-cases/ports/IExecutionRepository';
import { ExecutionItem, fromItem } from './executionItem';

const QUEUE_INDEX = 'status-queuedAt';

export class DynamoExecutionRepository implements IExecutionRepository {
  constructor(
    private readonly documents: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async findById(serviceOrderId: string): Promise<Execution | null> {
    const { Item } = await this.documents.send(new GetCommand({
      TableName: this.tableName,
      Key: { serviceOrderId },
      // The execution may have just been written by the same request.
      ConsistentRead: true,
    }));
    return Item ? fromItem(Item as ExecutionItem) : null;
  }

  async listByStatus(status: 'QUEUED' | 'IN_PROGRESS'): Promise<Execution[]> {
    return this.queryByStatus(status);
  }

  /**
   * DynamoDB does not aggregate, so the statistics are computed from the
   * finished repairs themselves. The status index narrows the read to DONE,
   * and the filter drops finished diagnoses. At the volume of a workshop this
   * stays small; a larger one would keep a running total per service instead.
   */
  async listFinishedRepairs(): Promise<Execution[]> {
    return this.queryByStatus('DONE', 'REPAIR');
  }

  private async queryByStatus(status: string, stage?: string): Promise<Execution[]> {
    const executions: Execution[] = [];
    let startKey: Record<string, unknown> | undefined;

    // A query page holds up to 1 MB; the queue is small, but reading every
    // page keeps a long queue from being cut silently.
    do {
      const page = await this.documents.send(new QueryCommand({
        TableName: this.tableName,
        IndexName: QUEUE_INDEX,
        KeyConditionExpression: '#status = :status',
        ...(stage && { FilterExpression: 'stage = :stage' }),
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':status': status, ...(stage && { ':stage': stage }) },
        ScanIndexForward: true,
        ExclusiveStartKey: startKey,
      }));
      executions.push(...(page.Items ?? []).map((item) => fromItem(item as ExecutionItem)));
      startKey = page.LastEvaluatedKey;
    } while (startKey);

    return executions;
  }
}
