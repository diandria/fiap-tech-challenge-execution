import pino from 'pino';
import { Request, Response } from 'express';
import { buildErrorMiddleware } from '../../../../src/frameworks/http/middlewares/errorMiddleware';
import { NotFoundError } from '../../../../src/entities/errors/AppError';

function makeRes() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res as unknown as Response & { status: jest.Mock; json: jest.Mock };
}

const req = { method: 'GET', path: '/service-orders/x/budget' } as Request;

describe('errorMiddleware', () => {
  it('answers with the status and message of an expected error, logged as a warning', () => {
    const log = pino({ level: 'silent' });
    const warn = jest.spyOn(log, 'warn');
    const res = makeRes();

    buildErrorMiddleware(log)(new NotFoundError('Budget'), req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Budget not found' });
    expect(warn).toHaveBeenCalled();
  });

  it('answers 500 without details for an unexpected error, logged as an error', () => {
    const log = pino({ level: 'silent' });
    const error = jest.spyOn(log, 'error');
    const res = makeRes();

    buildErrorMiddleware(log)(new Error('connection reset'), req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    expect(error).toHaveBeenCalled();
  });
});
