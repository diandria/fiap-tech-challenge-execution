import { ITraceContext } from '../../use-cases/ports/ITraceContext';
import { getTraceContext, toTraceparent } from './context';

/**
 * Reads the trace context from the request-scoped AsyncLocalStorage. Returns
 * undefined outside an HTTP request: an invalid `traceparent` would stitch
 * unrelated events into one trace.
 */
export class AsyncLocalStorageTraceContext implements ITraceContext {
  currentTraceparent(): string | undefined {
    const ctx = getTraceContext();
    return ctx ? toTraceparent(ctx) : undefined;
  }
}
