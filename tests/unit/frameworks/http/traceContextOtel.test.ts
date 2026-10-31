import request from 'supertest';
import express from 'express';
import { context, trace } from '@opentelemetry/api';
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { traceContextMiddleware } from '../../../../src/frameworks/http/middlewares/traceContextMiddleware';
import { getTraceContext } from '../../../../src/frameworks/logging/context';

const HEX32 = /^[0-9a-f]{32}$/;

function appCapturing(seen: { traceId?: string; spanId?: string }): express.Application {
  const app = express();
  app.use(traceContextMiddleware);
  app.get('/x', (_req, res) => {
    const ctx = getTraceContext();
    seen.traceId = ctx?.traceId;
    seen.spanId = ctx?.spanId;
    res.status(200).json({});
  });
  return app;
}

describe('traceContextMiddleware with an active OpenTelemetry span', () => {
  const exporter = new InMemorySpanExporter();
  const provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
  const contextManager = new AsyncLocalStorageContextManager();

  beforeAll(() => {
    contextManager.enable();
    context.setGlobalContextManager(contextManager);
    trace.setGlobalTracerProvider(provider);
  });

  afterAll(async () => {
    context.disable();
    trace.disable();
    await provider.shutdown();
  });

  // The log and Tempo must carry the same trace id; diverging identifiers
  // break the correlation between them.
  it('should adopt the active span ids GIVEN the sdk is running WHEN a request arrives', async () => {
    const seen: { traceId?: string; spanId?: string } = {};
    const app = appCapturing(seen);
    const span = provider.getTracer('test').startSpan('outer');
    const spanCtx = span.spanContext();

    await context.with(trace.setSpan(context.active(), span), async () => {
      await request(app).get('/x');
    });
    span.end();

    expect(seen.traceId).toBe(spanCtx.traceId);
    expect(seen.spanId).toBe(spanCtx.spanId);
  });
});

describe('traceContextMiddleware without an active span', () => {
  // Local development and the test suite run with no collector, and the
  // middleware still has to produce ids there.
  it('should generate its own ids GIVEN no active span WHEN a request arrives', async () => {
    const seen: { traceId?: string; spanId?: string } = {};

    await request(appCapturing(seen)).get('/x');

    expect(seen.traceId).toMatch(HEX32);
    expect(seen.spanId).toMatch(/^[0-9a-f]{16}$/);
  });

  it('should still honour an incoming traceparent GIVEN no active span WHEN a request arrives', async () => {
    const seen: { traceId?: string; spanId?: string } = {};
    const incoming = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

    await request(appCapturing(seen))
      .get('/x')
      .set('traceparent', `00-${incoming}-1111111111111111-01`);

    expect(seen.traceId).toBe(incoming);
  });
});
