import request from 'supertest';
import express from 'express';
import { traceContextMiddleware } from '../../../../src/frameworks/http/middlewares/traceContextMiddleware';
import { getTraceContext } from '../../../../src/frameworks/logging/context';

const TRACEPARENT = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';

function appWithMiddleware() {
  const app = express();
  app.use(traceContextMiddleware);
  app.get('/x', (_req, res) => { res.json(getTraceContext()); });
  return app;
}

describe('traceContextMiddleware', () => {
  it('should reuse the incoming trace id GIVEN a valid traceparent WHEN handling a request', async () => {
    const res = await request(appWithMiddleware()).get('/x').set('traceparent', TRACEPARENT);

    expect(res.body.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
  });

  it('should start a new span GIVEN a valid traceparent WHEN handling a request', async () => {
    const res = await request(appWithMiddleware()).get('/x').set('traceparent', TRACEPARENT);

    expect(res.body.spanId).not.toBe('00f067aa0ba902b7');
    expect(res.body.spanId).toMatch(/^[0-9a-f]{16}$/);
  });

  it('should echo the traceparent GIVEN a request WHEN responding', async () => {
    const res = await request(appWithMiddleware()).get('/x').set('traceparent', TRACEPARENT);

    expect(res.headers.traceparent).toContain('4bf92f3577b34da6a3ce929d0e0e4736');
  });

  it('should generate a trace id GIVEN no traceparent WHEN handling a request', async () => {
    const res = await request(appWithMiddleware()).get('/x');

    expect(res.body.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(res.body.spanId).toMatch(/^[0-9a-f]{16}$/);
  });

  it('should generate a trace id GIVEN a malformed traceparent WHEN handling a request', async () => {
    const res = await request(appWithMiddleware()).get('/x').set('traceparent', 'lixo');

    expect(res.body.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(res.body.traceId).not.toBe('lixo');
  });

  it('should keep the business correlation id separate GIVEN x-correlation-id WHEN handling a request', async () => {
    const res = await request(appWithMiddleware()).get('/x').set('x-correlation-id', 'atendimento-42');

    expect(res.body.correlationId).toBe('atendimento-42');
    expect(res.body.traceId).not.toBe('atendimento-42');
    expect(res.body.traceId).toMatch(/^[0-9a-f]{32}$/);
  });

  it('should omit the correlation id GIVEN no business header WHEN handling a request', async () => {
    const res = await request(appWithMiddleware()).get('/x');

    expect(res.body.correlationId).toBeUndefined();
  });
});
