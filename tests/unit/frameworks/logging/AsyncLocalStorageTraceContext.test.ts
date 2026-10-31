import { AsyncLocalStorageTraceContext } from '../../../../src/frameworks/logging/AsyncLocalStorageTraceContext';
import { runWithTraceContext } from '../../../../src/frameworks/logging/context';

describe('AsyncLocalStorageTraceContext', () => {
  it('should return the traceparent of the active scope GIVEN a traced request', () => {
    const ctx = { traceId: 'a'.repeat(32), spanId: 'b'.repeat(16) };

    const traceparent = runWithTraceContext(ctx, () => new AsyncLocalStorageTraceContext().currentTraceparent());

    expect(traceparent).toBe(`00-${'a'.repeat(32)}-${'b'.repeat(16)}-01`);
  });

  it('should return undefined GIVEN no active scope', () => {
    expect(new AsyncLocalStorageTraceContext().currentTraceparent()).toBeUndefined();
  });
});
