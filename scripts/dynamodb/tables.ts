import {
  DynamoDBClient,
  CreateTableCommand,
  CreateTableCommandInput,
  ResourceInUseException,
} from '@aws-sdk/client-dynamodb';

export interface ExecutionTableNames {
  executions: string;
  outbox: string;
  processedMessages: string;
}

export const DEFAULT_TABLE_NAMES: ExecutionTableNames = {
  executions: 'car-repair-shop-executions',
  outbox: 'car-repair-shop-execution-outbox',
  processedMessages: 'car-repair-shop-execution-processed-messages',
};

/**
 * The same tables the Terraform creates, for DynamoDB local and the tests.
 * The time-to-live of processed messages is left out: DynamoDB local does not
 * expire items, and nothing here depends on it.
 */
export function executionTables(names: ExecutionTableNames = DEFAULT_TABLE_NAMES): CreateTableCommandInput[] {
  return [
    {
      TableName: names.executions,
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: [
        { AttributeName: 'serviceOrderId', AttributeType: 'S' },
        { AttributeName: 'status', AttributeType: 'S' },
        { AttributeName: 'queuedAt', AttributeType: 'S' },
      ],
      KeySchema: [{ AttributeName: 'serviceOrderId', KeyType: 'HASH' }],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'status-queuedAt',
          KeySchema: [
            { AttributeName: 'status', KeyType: 'HASH' },
            { AttributeName: 'queuedAt', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
    },
    {
      TableName: names.outbox,
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: [{ AttributeName: 'messageId', AttributeType: 'S' }],
      KeySchema: [{ AttributeName: 'messageId', KeyType: 'HASH' }],
    },
    {
      TableName: names.processedMessages,
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: [{ AttributeName: 'messageId', AttributeType: 'S' }],
      KeySchema: [{ AttributeName: 'messageId', KeyType: 'HASH' }],
    },
  ];
}

/** Creates the tables that do not exist yet. */
export async function createExecutionTables(
  client: DynamoDBClient,
  names: ExecutionTableNames = DEFAULT_TABLE_NAMES,
): Promise<void> {
  for (const table of executionTables(names)) {
    try {
      await client.send(new CreateTableCommand(table));
    } catch (err) {
      if (!(err instanceof ResourceInUseException)) throw err;
    }
  }
}
