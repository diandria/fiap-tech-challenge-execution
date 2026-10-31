import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

/**
 * One client for the process. AWS_ENDPOINT_URL points it at DynamoDB local;
 * unset, it talks to AWS with the pod's credentials.
 */
export const dynamoClient = new DynamoDBClient(
  process.env.AWS_ENDPOINT_URL ? { endpoint: process.env.AWS_ENDPOINT_URL } : {},
);

export const documentClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: { removeUndefinedValues: true },
});
