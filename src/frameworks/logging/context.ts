import { AsyncLocalStorage } from 'node:async_hooks';

export interface TraceContext {
  /** Trace identifier, propagated between services by the standard header. */
  traceId: string;
  /** Identifier of this unit of work inside the trace. */
  spanId: string;
  /**
   * Business identifier, optional and distinct from the trace. It ties a
   * request to a service ticket, not services to each other.
   */
  correlationId?: string;
}

const storage = new AsyncLocalStorage<TraceContext>();

export function runWithTraceContext<T>(ctx: TraceContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function getTraceContext(): TraceContext | undefined {
  return storage.getStore();
}

export function toTraceparent(ctx: TraceContext): string {
  return `00-${ctx.traceId}-${ctx.spanId}-01`;
}
