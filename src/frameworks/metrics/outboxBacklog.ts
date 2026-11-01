import { Gauge } from '@prometheus-io/client';
import { Logger } from 'pino';
import { registry } from './registry';

const NAME = 'outbox_pending_messages';

/**
 * Messages written to the outbox and not yet published. Counted when
 * Prometheus scrapes rather than on every relay cycle: the value only matters
 * then, and the query runs once per scrape instead of once a second.
 *
 * A failed count keeps the last value instead of failing the scrape, which
 * would mark the whole service as down when only the database is slow.
 */
export function registerOutboxBacklog(countPending: () => Promise<number>, logger: Logger): Gauge {
  // Building the messaging twice (tests do) would otherwise fail on the
  // duplicate name; the latest registration is the one that counts.
  registry.removeSingleMetric(NAME);

  return new Gauge({
    name: NAME,
    help: 'Outbox messages waiting to be published',
    registers: [registry],
    async collect() {
      try {
        this.set(await countPending());
      } catch (err) {
        logger.warn({ err }, 'outbox backlog could not be counted; the gauge keeps its last value');
      }
    },
  });
}
