import 'dotenv/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { createExecutionTables } from './tables';

// Local only: on AWS the tables come from terraform/.
const client = new DynamoDBClient({ endpoint: process.env.AWS_ENDPOINT_URL ?? 'http://localhost:8000' });

createExecutionTables(client)
  .then(() => console.info('execution tables ready'))
  .catch((err) => {
    console.error('could not create the execution tables', err);
    process.exit(1);
  });
