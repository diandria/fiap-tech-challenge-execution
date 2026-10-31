import { DynamoDBClient, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { ReadinessCheck } from '../http/routes/healthRoutes';

/**
 * Describing the executions table proves the credentials work and the table
 * exists, without reading or writing any item.
 */
export function tableReadiness(client: DynamoDBClient, tableName: string): ReadinessCheck {
  return () => client.send(new DescribeTableCommand({ TableName: tableName }));
}
