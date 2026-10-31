import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { createExecutionTables, DEFAULT_TABLE_NAMES, ExecutionTableNames } from '../../scripts/dynamodb/tables';

const DYNAMODB_LOCAL_IMAGE = 'amazon/dynamodb-local:3.3.1';

let container: StartedTestContainer | undefined;

export interface TestDynamo {
  client: DynamoDBClient;
  documents: DynamoDBDocumentClient;
  tables: ExecutionTableNames;
}

export async function startDynamo(options: { createTables?: boolean } = {}): Promise<TestDynamo> {
  container = await new GenericContainer(DYNAMODB_LOCAL_IMAGE).withExposedPorts(8000).start();
  const client = new DynamoDBClient({
    endpoint: `http://${container.getHost()}:${container.getMappedPort(8000)}`,
    region: 'us-east-1',
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  });
  if (options.createTables ?? true) await createExecutionTables(client);

  return {
    client,
    documents: DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } }),
    tables: DEFAULT_TABLE_NAMES,
  };
}

export async function stopDynamo(): Promise<void> {
  await container?.stop();
}
