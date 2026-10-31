import request from 'supertest';
import express from 'express';
import { Logger } from 'pino';
import { requestLoggerMiddleware } from '../../../../src/frameworks/http/middlewares/requestLoggerMiddleware';
import { traceContextMiddleware } from '../../../../src/frameworks/http/middlewares/traceContextMiddleware';

function fakeLogger() {
  const info: Record<string, unknown>[] = [];
  const debug: Record<string, unknown>[] = [];
  const logger = {
    info: (o: Record<string, unknown>) => { info.push(o); },
    debug: (o: Record<string, unknown>) => { debug.push(o); },
  } as unknown as Logger;
  return { info, debug, logger };
}

function appWith(logger: Logger, path: string, status = 200) {
  const app = express();
  app.use(traceContextMiddleware);
  app.use(requestLoggerMiddleware(logger));
  app.get(path, (_req, res) => { res.status(status).json({}); });
  return app;
}

describe('requestLoggerMiddleware', () => {
  it('should log the route template GIVEN a parametrized route WHEN the request finishes', async () => {
    const { info, logger } = fakeLogger();
    await request(appWith(logger, '/service-orders/:id')).get('/service-orders/abc-123');

    expect(info).toHaveLength(1);
    expect(info[0].route).toBe('/service-orders/:id');
  });

  it('should not leak the concrete id GIVEN a parametrized route WHEN the request finishes', async () => {
    const { info, logger } = fakeLogger();
    await request(appWith(logger, '/service-orders/:id')).get('/service-orders/abc-123');

    expect(JSON.stringify(info[0])).not.toContain('abc-123');
  });

  it('should record the status code GIVEN a 404 WHEN the request finishes', async () => {
    const { info, logger } = fakeLogger();
    await request(appWith(logger, '/x', 404)).get('/x');

    expect(info[0].statusCode).toBe(404);
  });

  it('should record the duration GIVEN any request WHEN it finishes', async () => {
    const { info, logger } = fakeLogger();
    await request(appWith(logger, '/x')).get('/x');

    expect(typeof info[0].durationMs).toBe('number');
    expect(info[0].durationMs as number).toBeGreaterThanOrEqual(0);
  });

  it('should carry the trace identifiers GIVEN an active context WHEN the request finishes', async () => {
    const { info, logger } = fakeLogger();
    await request(appWith(logger, '/x')).get('/x');

    expect(info[0].trace_id).toMatch(/^[0-9a-f]{32}$/);
    expect(info[0].span_id).toMatch(/^[0-9a-f]{16}$/);
  });

  it('should carry the business correlation id GIVEN the header WHEN the request finishes', async () => {
    const { info, logger } = fakeLogger();
    await request(appWith(logger, '/x')).get('/x').set('x-correlation-id', 'atendimento-42');

    expect(info[0].correlationId).toBe('atendimento-42');
  });

  it('should log probes at debug level GIVEN /health WHEN the request finishes', async () => {
    const { info, debug, logger } = fakeLogger();
    await request(appWith(logger, '/health')).get('/health');

    expect(info).toHaveLength(0);
    expect(debug).toHaveLength(1);
  });

  it('should log the metrics endpoint at debug level GIVEN /metrics WHEN the request finishes', async () => {
    const { info, debug, logger } = fakeLogger();
    await request(appWith(logger, '/metrics')).get('/metrics');

    expect(info).toHaveLength(0);
    expect(debug).toHaveLength(1);
  });
});
