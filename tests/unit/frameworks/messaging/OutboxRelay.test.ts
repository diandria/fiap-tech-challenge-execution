import pino from 'pino';
import { OutboxRelay } from '../../../../src/frameworks/messaging/OutboxRelay';
import { PublishPendingMessagesUseCase } from '../../../../src/use-cases/messaging/PublishPendingMessagesUseCase';

function makePublish(execute: jest.Mock): PublishPendingMessagesUseCase {
  return { execute } as unknown as PublishPendingMessagesUseCase;
}

const silentLog = pino({ level: 'silent' });

describe('OutboxRelay', () => {
  it('returns how many messages one cycle published', async () => {
    const relay = new OutboxRelay(makePublish(jest.fn().mockResolvedValue(3)), silentLog);

    expect(await relay.runOnce()).toBe(3);
  });

  it('logs and returns zero when publishing fails, so the next cycle retries', async () => {
    const log = pino({ level: 'silent' });
    const errorSpy = jest.spyOn(log, 'error');
    const relay = new OutboxRelay(makePublish(jest.fn().mockRejectedValue(new Error('queue unavailable'))), log);

    expect(await relay.runOnce()).toBe(0);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('stops scheduling cycles once stopped', async () => {
    const execute = jest.fn().mockResolvedValue(0);
    const relay = new OutboxRelay(makePublish(execute), silentLog, { batchSize: 10, idleDelayMs: 5 });

    relay.start();
    await new Promise((resolve) => setTimeout(resolve, 30));
    await relay.stop();
    const callsAtStop = execute.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(callsAtStop).toBeGreaterThan(0);
    expect(execute.mock.calls.length).toBe(callsAtStop);
  });
});
