import 'dotenv/config';
// First runtime import: auto-instrumentation has to patch http and express
// before those modules load.
import './frameworks/tracing/start';
import { SQSClient } from '@aws-sdk/client-sqs';
import { createApp } from './app';
import { executionRoutes } from './frameworks/http/routes/executionRoutes';
import { ExecutionController } from './adapters/controllers/ExecutionController';
import { ListQueueUseCase } from './use-cases/executions/ListQueueUseCase';
import { GetExecutionUseCase } from './use-cases/executions/GetExecutionUseCase';
import { StartStageUseCase } from './use-cases/executions/StartStageUseCase';
import { FinishStageUseCase } from './use-cases/executions/FinishStageUseCase';
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
import { EnqueueDiagnosisUseCase } from './use-cases/executions/EnqueueDiagnosisUseCase';
import { EnqueueRepairUseCase } from './use-cases/executions/EnqueueRepairUseCase';
import { CancelExecutionUseCase } from './use-cases/executions/CancelExecutionUseCase';
import { IExecutionRepository } from './use-cases/ports/IExecutionRepository';
import { IExecutionStore } from './use-cases/ports/IExecutionStore';
import { DynamoExecutionRepository } from './adapters/gateways/DynamoExecutionRepository';
import { DynamoExecutionStore } from './adapters/gateways/DynamoExecutionStore';
import { AsyncLocalStorageTraceContext } from './frameworks/logging/AsyncLocalStorageTraceContext';

const PORT = process.env.PORT ?? 3000;

/** The outbox is scanned, not queried; a small page keeps each cycle cheap. */
const OUTBOX_BATCH_SIZE = 25;

interface Messaging {
  stop(): Promise<void>;
}

interface Persistence {
  executions: IExecutionRepository;
  store: IExecutionStore;
}

function startMessaging(queues: QueueConfig, tables: TableNames, { executions, store }: Persistence): Messaging {
  const sqs = new SQSClient({});
  const sender = new SqsMessageSender(sqs, queues.destinations, new PrometheusIntegrationFailures());
  const relay = new OutboxRelay(
    new PublishPendingMessagesUseCase(new DynamoOutboxStore(documentClient, tables.outbox), sender),
    logger,
    { batchSize: OUTBOX_BATCH_SIZE, idleDelayMs: 1000 },
  );
  const enqueueDiagnosis = new EnqueueDiagnosisUseCase(executions, store);
  const enqueueRepair = new EnqueueRepairUseCase(executions, store);
  const cancelExecution = new CancelExecutionUseCase(executions, store);
  const commands = new ExecutionCommandHandler({
    EnqueueDiagnosis: (command) => enqueueDiagnosis.execute(command),
    EnqueueRepair: (command) => enqueueRepair.execute(command),
    CancelExecution: (command) => cancelExecution.execute(command),
  });
  const poller = new SqsQueuePoller(sqs, { name: 'execution-commands', url: queues.executionCommands }, commands, logger);

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
  const persistence: Persistence = {
    executions: new DynamoExecutionRepository(documentClient, tables.executions),
    store: new DynamoExecutionStore(documentClient, tables, new AsyncLocalStorageTraceContext()),
  };
  const { executions, store } = persistence;
  const controller = new ExecutionController(
    new ListQueueUseCase(executions),
    new GetExecutionUseCase(executions),
    new StartStageUseCase(executions, store),
    new FinishStageUseCase(executions, store),
  );
  const app = createApp(tableReadiness(dynamoClient, tables.executions), { executions: executionRoutes(controller) });
  const messaging = queues ? startMessaging(queues, tables, persistence) : undefined;
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
