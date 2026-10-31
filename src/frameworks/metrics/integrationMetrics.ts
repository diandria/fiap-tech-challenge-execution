import { Counter } from '@prometheus-io/client';
import { registry } from './registry';

/** Failures in external integrations, by integration and operation. */
export const integrationFailures = new Counter({
  name: 'integration_failures_total',
  help: 'Failures in external integrations',
  labelNames: ['integration', 'operation'],
  registers: [registry],
});
