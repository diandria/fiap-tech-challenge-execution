import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../../../src/frameworks/http/middlewares/authMiddleware';
import { UnauthorizedError } from '../../../../src/entities/errors/AppError';

const SECRET = 'unit-test-secret';

function reqWithToken(payload: object): Request {
  const token = jwt.sign(payload, SECRET);
  return { headers: { authorization: `Bearer ${token}` } } as unknown as Request;
}

describe('authMiddleware', () => {
  const original = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
  });

  afterAll(() => {
    if (original === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = original;
  });

  it('should populate a staff payload GIVEN a staff token WHEN authenticating', () => {
    const req = reqWithToken({ type: 'staff', userId: 'u1', role: 'admin' });

    authMiddleware(req, {} as Response, jest.fn() as NextFunction);

    expect(req.user).toEqual({ type: 'staff', userId: 'u1', role: 'admin' });
  });

  it('should populate a customer payload GIVEN a customer token WHEN authenticating', () => {
    const req = reqWithToken({ type: 'customer', sub: 'c1', cpf: '52998224725', name: 'Ana' });

    authMiddleware(req, {} as Response, jest.fn() as NextFunction);

    expect(req.user).toEqual({ type: 'customer', sub: 'c1', cpf: '52998224725', name: 'Ana' });
  });

  it('should reject GIVEN no authorization header WHEN authenticating', () => {
    const next = jest.fn() as NextFunction;

    authMiddleware({ headers: {} } as Request, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('should reject GIVEN a token signed with another secret WHEN authenticating', () => {
    const token = jwt.sign({ type: 'staff', userId: 'u1', role: 'admin' }, 'another-secret');
    const next = jest.fn() as NextFunction;

    authMiddleware({ headers: { authorization: `Bearer ${token}` } } as unknown as Request, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  // Without `sub` the ownership check would compare against undefined.
  it('should reject GIVEN a customer token without sub WHEN authenticating', () => {
    const next = jest.fn() as NextFunction;

    authMiddleware(reqWithToken({ type: 'customer', cpf: '52998224725' }), {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('should reject GIVEN a staff token without userId WHEN authenticating', () => {
    const next = jest.fn() as NextFunction;

    authMiddleware(reqWithToken({ type: 'staff', role: 'admin' }), {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  // The OS Service always signs `type`; a token without it was not issued by
  // either of the two issuers this service trusts.
  it('should reject GIVEN a token without type WHEN authenticating', () => {
    const next = jest.fn() as NextFunction;

    authMiddleware(reqWithToken({ userId: 'u1', role: 'admin' }), {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });
});
