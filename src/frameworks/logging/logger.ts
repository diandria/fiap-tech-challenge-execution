import pino, { Logger, DestinationStream } from 'pino';
import { getTraceContext } from './context';

/**
 * Fields redacted from every event, declared in one place. Requests carry
 * staff tokens.
 */
const REDACTED_PATHS = [
  'req.headers.authorization',
  'headers.authorization',
];

export interface LoggerOptions {
  /** Injectable for tests: without this seam, checking redaction would mean capturing process output. */
  stream?: DestinationStream;
}

export function buildLogger(opts: LoggerOptions = {}): Logger {
  const prettyInDevelopment =
    process.env.NODE_ENV !== 'production' && !opts.stream
      ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
      : {};

  return pino(
    {
      level: process.env.LOG_LEVEL ?? 'info',
      // Open semantic conventions (ADR-007): comparable telemetry across
      // services without a private agreement.
      base: {
        'service.name': process.env.OTEL_SERVICE_NAME ?? 'execution-service',
        'service.version': process.env.SERVICE_VERSION ?? '0.0.0',
        'deployment.environment': process.env.NODE_ENV ?? 'development',
      },
      redact: { paths: REDACTED_PATHS, censor: '[Redacted]' },
      // The mixin means no log call has to remember the trace.
      mixin() {
        const ctx = getTraceContext();
        return ctx ? { trace_id: ctx.traceId, span_id: ctx.spanId } : {};
      },
      ...prettyInDevelopment,
    },
    opts.stream,
  );
}

export const logger = buildLogger();
