import { Request, Response, NextFunction } from 'express';
import { Logger } from 'pino';
import { AppError } from '../../../entities/errors/AppError';
import { logger as defaultLogger } from '../../logging/logger';

/**
 * An expected operational error (4xx) is a warning; an unexpected one is an
 * error, with a stack. Without that distinction every "not found" becomes an
 * alert and the signal is lost.
 */
export function buildErrorMiddleware(log: Logger = defaultLogger) {
  return (err: Error, req: Request, res: Response, _next: NextFunction): void => {
    const where = { method: req.method, route: req.route?.path ?? req.path };

    if (err instanceof AppError) {
      log.warn({ ...where, statusCode: err.statusCode, err: err.message }, 'request rejected');
      res.status(err.statusCode).json({ error: err.message });
      return;
    }

    log.error({ ...where, err, stack: err.stack }, 'unhandled error');
    res.status(500).json({ error: 'Internal server error' });
  };
}

export const errorMiddleware = buildErrorMiddleware();
