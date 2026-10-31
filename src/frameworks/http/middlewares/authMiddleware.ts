import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../../../entities/errors/AppError';

/** Shop employee, authenticated with e-mail and password on the OS Service. */
export interface StaffJwtPayload {
  type: 'staff';
  userId: string;
  role: string;
}

/**
 * Customer, authenticated by CPF in the issuing function. `sub` is the
 * `customerId`, and it is the only accepted source for it: taken from the
 * body or the query string, the ownership check would be decorative.
 */
export interface CustomerJwtPayload {
  type: 'customer';
  sub: string;
  cpf: string;
  name: string;
}

/**
 * Union discriminated by `type`, so the compiler demands narrowing before any
 * access: there is no way to read `sub` off a staff token by mistake.
 */
export type JwtPayload = StaffJwtPayload | CustomerJwtPayload;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/** Normalises whatever was signed into the union, or returns null when the token describes neither actor. */
function toPayload(raw: Record<string, unknown>): JwtPayload | null {
  if (raw.type === 'staff') {
    if (typeof raw.userId !== 'string' || typeof raw.role !== 'string') return null;
    return { type: 'staff', userId: raw.userId, role: raw.role };
  }

  if (raw.type === 'customer') {
    if (typeof raw.sub !== 'string') return null;
    return {
      type: 'customer',
      sub: raw.sub,
      cpf: typeof raw.cpf === 'string' ? raw.cpf : '',
      name: typeof raw.name === 'string' ? raw.name : '',
    };
  }

  return null;
}

/**
 * Validates staff and customer tokens with the secret shared with the OS
 * Service and the authentication function, so no call to another service is
 * needed to know who is calling.
 */
export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new UnauthorizedError());
  }
  const token = header.split(' ')[1];
  let raw: Record<string, unknown>;
  try {
    raw = jwt.verify(token, process.env.JWT_SECRET!) as Record<string, unknown>;
  } catch {
    return next(new UnauthorizedError('Invalid or expired token'));
  }

  const payload = toPayload(raw);
  if (!payload) {
    return next(new UnauthorizedError('Invalid or expired token'));
  }

  req.user = payload;
  next();
}
