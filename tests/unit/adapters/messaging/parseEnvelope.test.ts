import { parseEnvelope } from '../../../../src/adapters/messaging/parseEnvelope';

const valid = {
  messageId: '22222222-2222-4222-8222-222222222222',
  type: 'EnqueueDiagnosis',
  serviceOrderId: '11111111-1111-4111-8111-111111111111',
  occurredAt: '2026-10-31T10:00:00.000Z',
  traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
  payload: { tasks: [] },
};

describe('parseEnvelope', () => {
  it('returns the envelope for a valid body', () => {
    expect(parseEnvelope(JSON.stringify(valid))).toEqual(valid);
  });

  it('accepts an envelope without traceparent', () => {
    const { traceparent: _ignored, ...withoutTrace } = valid;
    expect(parseEnvelope(JSON.stringify(withoutTrace))).toEqual(withoutTrace);
  });

  it('returns null for a body that is not json', () => {
    expect(parseEnvelope('not json')).toBeNull();
  });

  it.each(['messageId', 'type', 'serviceOrderId', 'occurredAt'])('returns null when %s is missing', (field) => {
    const body: Record<string, unknown> = { ...valid };
    delete body[field];
    expect(parseEnvelope(JSON.stringify(body))).toBeNull();
  });

  it('returns null when the payload is not an object', () => {
    expect(parseEnvelope(JSON.stringify({ ...valid, payload: 'text' }))).toBeNull();
    expect(parseEnvelope(JSON.stringify({ ...valid, payload: [] }))).toBeNull();
  });
});
