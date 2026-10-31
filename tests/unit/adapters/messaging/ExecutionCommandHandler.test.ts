import { ExecutionCommandHandler } from '../../../../src/adapters/messaging/ExecutionCommandHandler';
import { MessageEnvelope } from '../../../../src/use-cases/messaging/MessageEnvelope';
import { DuplicateMessageError } from '../../../../src/use-cases/messaging/DuplicateMessageError';

function command(type: string): MessageEnvelope {
  return { messageId: 'm-1', type, serviceOrderId: 'os-1', occurredAt: '2026-10-31T10:00:00.000Z', payload: {} };
}

describe('ExecutionCommandHandler', () => {
  it('routes each command type and throws for an unknown one', async () => {
    const enqueueDiagnosis = jest.fn().mockResolvedValue(undefined);
    const enqueueRepair = jest.fn().mockResolvedValue(undefined);
    const cancelExecution = jest.fn().mockResolvedValue(undefined);
    const handler = new ExecutionCommandHandler({
      EnqueueDiagnosis: enqueueDiagnosis,
      EnqueueRepair: enqueueRepair,
      CancelExecution: cancelExecution,
    });

    await handler.handle(command('EnqueueDiagnosis'));
    await handler.handle(command('EnqueueRepair'));
    await handler.handle(command('CancelExecution'));

    expect(enqueueDiagnosis).toHaveBeenCalledWith(command('EnqueueDiagnosis'));
    expect(enqueueRepair).toHaveBeenCalledWith(command('EnqueueRepair'));
    expect(cancelExecution).toHaveBeenCalledWith(command('CancelExecution'));
    await expect(handler.handle(command('GenerateBudget'))).rejects.toThrow('GenerateBudget');
  });

  it('throws for a known command type with no handler registered', async () => {
    await expect(new ExecutionCommandHandler({}).handle(command('EnqueueRepair'))).rejects.toThrow('EnqueueRepair');
  });

  it('confirms a command that was already processed instead of failing it', async () => {
    const handler = new ExecutionCommandHandler({
      EnqueueDiagnosis: jest.fn().mockRejectedValue(new DuplicateMessageError('m-1')),
    });

    await expect(handler.handle(command('EnqueueDiagnosis'))).resolves.toBeUndefined();
  });

  it('propagates any other failure, so the message is delivered again', async () => {
    const handler = new ExecutionCommandHandler({
      EnqueueDiagnosis: jest.fn().mockRejectedValue(new Error('table unavailable')),
    });

    await expect(handler.handle(command('EnqueueDiagnosis'))).rejects.toThrow('table unavailable');
  });
});
