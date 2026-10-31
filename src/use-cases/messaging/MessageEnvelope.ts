/** The Execution Service only replies; every message it sends goes to the saga replies queue. */
export type MessageDestination = 'saga-replies';

/** The envelope every message carries, on every queue (ADR-015 in the OS Service repository). */
export interface MessageEnvelope<TType extends string = string, TPayload = Record<string, unknown>> {
  messageId: string;
  type: TType;
  serviceOrderId: string;
  occurredAt: string;
  traceparent?: string;
  payload: TPayload;
}

/** What a use case asks to send; id, time and trace are filled when it is stored. */
export interface OutgoingMessage {
  destination: MessageDestination;
  type: string;
  serviceOrderId: string;
  payload: Record<string, unknown>;
}
