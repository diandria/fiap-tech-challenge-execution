import { Counter } from '@prometheus-io/client';
import { registry } from './registry';

export const outboxPublished = new Counter({
  name: 'outbox_published_total',
  help: 'Outbox messages published to their queue',
  registers: [registry],
});
