/**
 * Output port exposing the current trace context as a W3C `traceparent`. The
 * value is ambient, so the publishing adapter stays free of the storage
 * mechanism that carries it.
 */
export interface ITraceContext {
  /** The current `traceparent`, or `undefined` outside a traced request. */
  currentTraceparent(): string | undefined;
}
