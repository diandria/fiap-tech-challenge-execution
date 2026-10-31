import {
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
} from '../../../src/entities/errors/AppError';

describe('AppError subclasses', () => {
  it('ForbiddenError uses default message when none provided', () => {
    const err = new ForbiddenError();
    expect(err.message).toBe('Forbidden');
    expect(err.statusCode).toBe(403);
  });

  it('ForbiddenError accepts custom message', () => {
    const err = new ForbiddenError('Custom forbidden');
    expect(err.message).toBe('Custom forbidden');
  });

  it('UnauthorizedError uses default message when none provided', () => {
    const err = new UnauthorizedError();
    expect(err.message).toBe('Unauthorized');
    expect(err.statusCode).toBe(401);
  });

  it('NotFoundError formats resource name', () => {
    const err = new NotFoundError('Customer');
    expect(err.message).toBe('Customer not found');
    expect(err.statusCode).toBe(404);
  });

  it('ValidationError preserves message', () => {
    const err = new ValidationError('Invalid input');
    expect(err.statusCode).toBe(400);
  });

  it('ConflictError preserves message', () => {
    const err = new ConflictError('Already exists');
    expect(err.statusCode).toBe(409);
  });
});
