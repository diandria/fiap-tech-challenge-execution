import { Request, Response, NextFunction } from 'express';
import { Logger } from 'pino';
import { logger as defaultLogger } from '../../logging/logger';
import { getTraceContext } from '../../logging/context';
import { httpRequestDuration } from '../../metrics/httpMetrics';

/**
 * Probes and metric scrapes are called every few seconds. At info level they
 * would drown the useful log.
 */
const QUIET_PATHS = new Set(['/health', '/ready', '/metrics']);

/**
 * Route template, including the mount prefix. `req.route.path` carries only
 * the fragment declared inside the router, so without `req.baseUrl` different
 * routers would collapse into the same label. Undefined when no route matched.
 */
function routeTemplate(req: Request): string | undefined {
  if (!req.route) return undefined;
  const path = req.route.path === '/' ? '' : req.route.path;
  return `${req.baseUrl}${path}` || '/';
}

export function requestLoggerMiddleware(log: Logger = defaultLogger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = process.hrtime.bigint();

    res.on('finish', () => {
      const ctx = getTraceContext();
      const template = routeTemplate(req);
      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;

      const event = {
        method: req.method,
        // The log keeps the concrete path of unmatched routes.
        route: template ?? req.path,
        statusCode: res.statusCode,
        durationMs,
        ...(ctx ? { trace_id: ctx.traceId, span_id: ctx.spanId } : {}),
        ...(ctx?.correlationId ? { correlationId: ctx.correlationId } : {}),
      };

      // The metric uses only the route template: one label per concrete path
      // would create unbounded cardinality in Prometheus.
      httpRequestDuration.observe(
        { method: req.method, route: template ?? 'unmatched', status_code: res.statusCode },
        durationMs / 1000,
      );

      if (QUIET_PATHS.has(req.path)) log.debug(event);
      else log.info(event);
    });

    next();
  };
}
