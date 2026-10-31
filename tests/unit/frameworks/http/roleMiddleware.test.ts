import { Request, Response, NextFunction } from 'express';
import { requireRole } from '../../../../src/frameworks/http/middlewares/roleMiddleware';
import { ForbiddenError } from '../../../../src/entities/errors/AppError';
import { JwtPayload } from '../../../../src/frameworks/http/middlewares/authMiddleware';

const staff = (role: string): JwtPayload => ({ type: 'staff', userId: 'u1', role });
const customer: JwtPayload = { type: 'customer', sub: 'c1', cpf: '52998224725', name: 'Ana' };

function reqAs(user?: JwtPayload): Request {
  return { user } as Request;
}

describe('requireRole', () => {
  it.each(['mechanic', 'admin'])('should allow GIVEN a %s token on a mechanic route WHEN authorizing', (role) => {
    const next = jest.fn() as NextFunction;

    requireRole('mechanic', 'admin')(reqAs(staff(role)), {} as Response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should reject GIVEN a staff token with another role WHEN authorizing', () => {
    const next = jest.fn() as NextFunction;

    requireRole('mechanic', 'admin')(reqAs(staff('attendant')), {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('should reject a customer token GIVEN a staff-only route WHEN authorizing', () => {
    const next = jest.fn() as NextFunction;

    requireRole('mechanic')(reqAs(customer), {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('should reject GIVEN no authenticated user WHEN authorizing', () => {
    const next = jest.fn() as NextFunction;

    requireRole('mechanic')(reqAs(undefined), {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });
});
