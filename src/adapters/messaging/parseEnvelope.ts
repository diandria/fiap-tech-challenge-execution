import { MessageEnvelope } from '../../use-cases/messaging/MessageEnvelope';

const REQUIRED_TEXT_FIELDS = ['messageId', 'type', 'serviceOrderId', 'occurredAt'] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Returns the envelope, or null when the body is not one. A malformed message
 * is a permanent error: the caller must tell it apart from a failure that a
 * retry could fix.
 */
export function parseEnvelope(body: string): MessageEnvelope | null {
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    return null;
  }

  if (!isPlainObject(value)) return null;
  for (const field of REQUIRED_TEXT_FIELDS) {
    if (typeof value[field] !== 'string' || value[field] === '') return null;
  }
  if (!isPlainObject(value.payload)) return null;
  if (value.traceparent !== undefined && typeof value.traceparent !== 'string') return null;

  return {
    messageId: value.messageId as string,
    type: value.type as string,
    serviceOrderId: value.serviceOrderId as string,
    occurredAt: value.occurredAt as string,
    ...(value.traceparent ? { traceparent: value.traceparent as string } : {}),
    payload: value.payload,
  };
}
