import { randomBytes } from 'node:crypto';
import { context, propagation, trace, SpanKind, SpanStatusCode, isSpanContextValid, Span } from '@opentelemetry/api';
import { MessageEnvelope } from '../../use-cases/messaging/MessageEnvelope';
import { runWithTraceContext, TraceContext } from '../logging/context';

const tracer = trace.getTracer('car-repair-shop-messaging');
const TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$/;

/**
 * Handles a message as a continuation of the trace that published it, so a
 * hop through a queue does not split one flow into two traces. Logs written
 * inside carry the same trace id, and so does anything the work publishes.
 */
export function runInMessageTrace<T>(
  envelope: MessageEnvelope,
  queueName: string,
  work: () => Promise<T>,
): Promise<T> {
  const parent = envelope.traceparent
    ? propagation.extract(context.active(), { traceparent: envelope.traceparent })
    : context.active();

  const attributes = {
    'messaging.system': 'aws_sqs',
    'messaging.destination.name': queueName,
    'messaging.message.id': envelope.messageId,
    'messaging.message.type': envelope.type,
    'service_order.id': envelope.serviceOrderId,
  };

  return tracer.startActiveSpan(`${queueName} process`, { kind: SpanKind.CONSUMER, attributes }, parent, async (span) => {
    try {
      return await runWithTraceContext(traceContextFor(span, envelope), work);
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw err;
    } finally {
      span.end();
    }
  });
}

/**
 * The span's ids when the tracing SDK is running. Without it the span is a
 * no-op, so the ids come from the envelope's traceparent, or a new trace.
 */
function traceContextFor(span: Span, envelope: MessageEnvelope): TraceContext {
  const spanContext = span.spanContext();
  if (isSpanContextValid(spanContext)) {
    return { traceId: spanContext.traceId, spanId: spanContext.spanId };
  }

  const incoming = TRACEPARENT.exec(envelope.traceparent ?? '');
  return {
    traceId: incoming ? incoming[1] : randomBytes(16).toString('hex'),
    spanId: randomBytes(8).toString('hex'),
  };
}
