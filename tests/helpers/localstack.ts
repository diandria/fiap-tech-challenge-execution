import { LocalstackContainer, StartedLocalStackContainer } from '@testcontainers/localstack';
import {
  SQSClient,
  CreateQueueCommand,
  GetQueueAttributesCommand,
  ReceiveMessageCommand,
  Message,
} from '@aws-sdk/client-sqs';

// The last community release: newer images refuse to start without a license token.
const LOCALSTACK_IMAGE = 'localstack/localstack:4.9.2';
const REGION = 'us-east-1';

// The queues this service touches: it consumes its commands and publishes replies.
export const SAGA_QUEUES = ['execution-commands', 'saga-replies'] as const;
export type SagaQueue = (typeof SAGA_QUEUES)[number];

export interface FifoQueue {
  url: string;
  deadLetterUrl: string;
}

let container: StartedLocalStackContainer | undefined;

export async function startLocalStack(): Promise<SQSClient> {
  container = await new LocalstackContainer(LOCALSTACK_IMAGE).withEnvironment({ SERVICES: 'sqs' }).start();
  return new SQSClient({
    endpoint: container.getConnectionUri(),
    region: REGION,
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  });
}

export async function stopLocalStack(): Promise<void> {
  await container?.stop();
}

/**
 * Creates a FIFO queue with its dead-letter queue, with the same settings as
 * on AWS. Tests that need a message to reach the dead-letter queue quickly can
 * lower the receive count and the visibility timeout.
 */
export async function createFifoQueue(
  client: SQSClient,
  name: string,
  options: { maxReceiveCount?: number; visibilityTimeoutSeconds?: number } = {},
): Promise<FifoQueue> {
  const deadLetter = await client.send(new CreateQueueCommand({
    QueueName: `${name}-dlq.fifo`,
    Attributes: { FifoQueue: 'true' },
  }));
  const deadLetterArn = await client.send(new GetQueueAttributesCommand({
    QueueUrl: deadLetter.QueueUrl,
    AttributeNames: ['QueueArn'],
  }));

  const queue = await client.send(new CreateQueueCommand({
    QueueName: `${name}.fifo`,
    Attributes: {
      FifoQueue: 'true',
      ContentBasedDeduplication: 'false',
      VisibilityTimeout: String(options.visibilityTimeoutSeconds ?? 30),
      RedrivePolicy: JSON.stringify({
        deadLetterTargetArn: deadLetterArn.Attributes?.QueueArn,
        maxReceiveCount: String(options.maxReceiveCount ?? 5),
      }),
    },
  }));

  return { url: queue.QueueUrl as string, deadLetterUrl: deadLetter.QueueUrl as string };
}

export async function createSagaQueues(client: SQSClient): Promise<Record<SagaQueue, FifoQueue>> {
  const queues = {} as Record<SagaQueue, FifoQueue>;
  for (const name of SAGA_QUEUES) {
    queues[name] = await createFifoQueue(client, `car-repair-shop-${name}`);
  }
  return queues;
}

/** Reads what is on the queue without deleting it. */
export async function receiveAll(client: SQSClient, queueUrl: string, waitTimeSeconds = 1): Promise<Message[]> {
  const result = await client.send(new ReceiveMessageCommand({
    QueueUrl: queueUrl,
    MaxNumberOfMessages: 10,
    WaitTimeSeconds: waitTimeSeconds,
    MessageSystemAttributeNames: ['All'],
  }));
  return result.Messages ?? [];
}

/**
 * Polls the source queue until its message is moved to the dead-letter queue.
 * SQS moves a message on a receive made after its visibility timeout, so a
 * fixed number of polls races the queue's timing and fails on a loaded
 * machine. This waits for the move itself, and counts the dead-letter queue
 * without receiving from it, so the message is still there for the test.
 */
export async function pollUntilDeadLettered(
  client: SQSClient,
  poller: { pollOnce(): Promise<number> },
  deadLetterUrl: string,
  timeoutMs = 30_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    await poller.pollOnce();
    const { Attributes } = await client.send(new GetQueueAttributesCommand({
      QueueUrl: deadLetterUrl,
      AttributeNames: ['ApproximateNumberOfMessages'],
    }));
    if (Number(Attributes?.ApproximateNumberOfMessages ?? 0) > 0) return;
    if (Date.now() >= deadline) throw new Error(`no message reached ${deadLetterUrl} within ${timeoutMs / 1000}s`);
  }
}
