import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'node:crypto';
import { context, trace, isSpanContextValid } from '@opentelemetry/api';
import { runWithTraceContext, toTraceparent, TraceContext } from '../../logging/context';

const TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$/;

/**
 * Identifiers of the span the SDK already opened for this request, when there
 * is one. Adopting them makes the log and the trace point at the same thing.
 */
function activeSpanIds(): { traceId: string; spanId: string } | undefined {
  const spanContext = trace.getSpan(context.active())?.spanContext();
  if (!spanContext || !isSpanContextValid(spanContext)) return undefined;
  return { traceId: spanContext.traceId, spanId: spanContext.spanId };
}

/**
 * Correlation uses the standard `traceparent` header (ADR-007), which
 * libraries propagate across service boundaries. With no collector configured
 * the SDK does not start, and the ids are minted here instead.
 */
export function traceContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const active = activeSpanIds();
  const incoming = TRACEPARENT.exec(String(req.headers.traceparent ?? ''));
  const businessId = req.headers['x-correlation-id'];

  const ctx: TraceContext = {
    traceId: active?.traceId ?? (incoming ? incoming[1] : randomBytes(16).toString('hex')),
    spanId: active?.spanId ?? randomBytes(8).toString('hex'),
    ...(businessId ? { correlationId: String(businessId) } : {}),
  };

  res.setHeader('traceparent', toTraceparent(ctx));
  runWithTraceContext(ctx, () => next());
}
