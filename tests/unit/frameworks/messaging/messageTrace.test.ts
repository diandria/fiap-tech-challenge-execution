import { runInMessageTrace } from '../../../../src/frameworks/messaging/messageTrace';
import { getTraceContext } from '../../../../src/frameworks/logging/context';

const envelope = {
  messageId: 'm-1',
  type: 'EnqueueDiagnosis',
  serviceOrderId: 'os-1',
  occurredAt: '2026-10-31T10:00:00.000Z',
  payload: {},
};

describe('runInMessageTrace', () => {
  it('continues the trace of the publisher GIVEN an envelope with traceparent', async () => {
    const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';

    const seen = await runInMessageTrace({ ...envelope, traceparent }, 'execution-commands', async () => getTraceContext());

    expect(seen?.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
    expect(seen?.spanId).not.toBe('00f067aa0ba902b7');
  });

  it('starts a new trace GIVEN an envelope without traceparent', async () => {
    const seen = await runInMessageTrace(envelope, 'execution-commands', async () => getTraceContext());

    expect(seen?.traceId).toMatch(/^[0-9a-f]{32}$/);
  });

  it('rethrows what the work throws', async () => {
    await expect(
      runInMessageTrace(envelope, 'execution-commands', async () => { throw new Error('handler failed'); }),
    ).rejects.toThrow('handler failed');
  });
});
