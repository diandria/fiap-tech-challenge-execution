import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { errorMiddleware } from './frameworks/http/middlewares/errorMiddleware';
import { traceContextMiddleware } from './frameworks/http/middlewares/traceContextMiddleware';
import { requestLoggerMiddleware } from './frameworks/http/middlewares/requestLoggerMiddleware';
import { setupSwagger } from './frameworks/http/swagger/setup';
import { healthRoutes, ReadinessCheck } from './frameworks/http/routes/healthRoutes';

export function createApp(checkDatabase: ReadinessCheck): Application {
  const app = express();

  // How many proxies sit in front, so req.ip is the caller and not the gateway.
  // Off by default: local and test runs read the real socket address.
  const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 0);
  if (trustProxyHops > 0) app.set('trust proxy', trustProxyHops);

  // First of all: every later event, the error one included, needs the trace context.
  app.use(traceContextMiddleware);
  app.use(requestLoggerMiddleware());

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'script-src': ["'self'", "'unsafe-inline'"],
        },
      },
    }),
  );
  app.use(express.json());

  app.use((req: Request, res: Response, next: NextFunction) => {
    const allowedOrigins = (process.env.CORS_ORIGIN ?? '').split(',');
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  setupSwagger(app);

  app.use('/', healthRoutes(checkDatabase));

  app.use(errorMiddleware);

  return app;
}
