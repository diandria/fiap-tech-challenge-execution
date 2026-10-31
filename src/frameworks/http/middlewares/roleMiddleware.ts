import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../../../entities/errors/AppError';

/**
 * Authorises by employee role. The `type` check rejects customer tokens
 * explicitly, rather than relying on them having no `role`.
 */
export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (req.user?.type !== 'staff' || !roles.includes(req.user.role)) {
      return next(new ForbiddenError());
    }
    next();
  };
}
