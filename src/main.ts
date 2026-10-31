import 'dotenv/config';
// First runtime import: auto-instrumentation has to patch http and express
// before those modules load.
import './frameworks/tracing/start';
import { createApp } from './app';
import { dynamoClient } from './frameworks/database/dynamoClient';
import { tableReadiness } from './frameworks/database/readinessProbe';
import { readTableNames } from './frameworks/database/tableNames';
import { logger } from './frameworks/logging/logger';

const PORT = process.env.PORT ?? 3000;

function main(): void {
  const tables = readTableNames();
  const app = createApp(tableReadiness(dynamoClient, tables.executions));

  const server = app.listen(PORT, () => { logger.info({ port: PORT }, 'server started'); });
  process.on('SIGTERM', () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 25_000).unref();
  });
}

main();
