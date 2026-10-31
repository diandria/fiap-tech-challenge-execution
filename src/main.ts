import 'dotenv/config';
// First runtime import: auto-instrumentation has to patch http and express
// before those modules load.
import './frameworks/tracing/start';
import { SQSClient } from '@aws-sdk/client-sqs';
import { createApp } from './app';
import { documentClient, dynamoClient } from './frameworks/database/dynamoClient';
import { tableReadiness } from './frameworks/database/readinessProbe';
import { readTableNames, TableNames } from './frameworks/database/tableNames';
import { logger } from './frameworks/logging/logger';
import { readQueueConfig, QueueConfig } from './frameworks/messaging/queueConfig';
import { OutboxRelay } from './frameworks/messaging/OutboxRelay';
import { SqsQueuePoller } from './frameworks/messaging/SqsQueuePoller';
import { PrometheusIntegrationFailures } from './frameworks/metrics/PrometheusIntegrationFailures';
import { DynamoOutboxStore } from './adapters/gateways/DynamoOutboxStore';
import { SqsMessageSender } from './adapters/messaging/SqsMessageSender';
import { ExecutionCommandHandler } from './adapters/messaging/ExecutionCommandHandler';
import { PublishPendingMessagesUseCase } from './use-cases/messaging/PublishPendingMessagesUseCase';

const PORT = process.env.PORT ?? 3000;

/** The outbox is scanned, not queried; a small page keeps each cycle cheap. */
const OUTBOX_BATCH_SIZE = 25;

interface Messaging {
  stop(): Promise<void>;
}

function startMessaging(queues: QueueConfig, tables: TableNames): Messaging {
  const sqs = new SQSClient({});
  const sender = new SqsMessageSender(sqs, queues.destinations, new PrometheusIntegrationFailures());
  const relay = new OutboxRelay(
    new PublishPendingMessagesUseCase(new DynamoOutboxStore(documentClient, tables.outbox), sender),
    logger,
    { batchSize: OUTBOX_BATCH_SIZE, idleDelayMs: 1000 },
  );
  const poller = new SqsQueuePoller(
    sqs,
    { name: 'execution-commands', url: queues.executionCommands },
    new ExecutionCommandHandler({}),
    logger,
  );

  relay.start();
  poller.start();
  logger.info('saga messaging started');

  return {
    async stop() {
      await poller.stop();
      await relay.stop();
    },
  };
}

function main(): void {
  const tables = readTableNames();
  const queues = readQueueConfig();
  const app = createApp(tableReadiness(dynamoClient, tables.executions));
  const messaging = queues ? startMessaging(queues, tables) : undefined;
  if (!messaging) logger.warn('saga queues are not configured; the service runs without messaging');

  const server = app.listen(PORT, () => { logger.info({ port: PORT }, 'server started'); });
  process.on('SIGTERM', () => {
    server.close(async () => {
      await messaging?.stop();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 25_000).unref();
  });
}

main();
