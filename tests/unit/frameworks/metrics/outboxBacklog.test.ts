import pino from 'pino';
import { registry } from '../../../../src/frameworks/metrics/registry';
import { registerOutboxBacklog } from '../../../../src/frameworks/metrics/outboxBacklog';

describe('registerOutboxBacklog', () => {
  it('exposes the pending count read when Prometheus scrapes', async () => {
    registerOutboxBacklog(jest.fn().mockResolvedValue(7), pino({ level: 'silent' }));

    expect(await registry.metrics()).toMatch(/outbox_pending_messages\{[^}]*\} 7/);
  });

  it('keeps the scrape answering and logs when the count cannot be read', async () => {
    const logger = pino({ level: 'silent' });
    const warn = jest.spyOn(logger, 'warn');
    registerOutboxBacklog(jest.fn().mockRejectedValue(new Error('database unavailable')), logger);

    await expect(registry.metrics()).resolves.toContain('outbox_pending_messages');
    expect(warn).toHaveBeenCalled();
  });

  it('replaces an earlier registration instead of failing on the duplicate name', async () => {
    registerOutboxBacklog(jest.fn().mockResolvedValue(1), pino({ level: 'silent' }));
    registerOutboxBacklog(jest.fn().mockResolvedValue(4), pino({ level: 'silent' }));

    expect(await registry.metrics()).toMatch(/outbox_pending_messages\{[^}]*\} 4/);
  });
});
