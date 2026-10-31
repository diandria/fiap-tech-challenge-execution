import { EnqueueRepairUseCase } from '../../../../src/use-cases/executions/EnqueueRepairUseCase';
import { MessageEnvelope } from '../../../../src/use-cases/messaging/MessageEnvelope';
import { NotFoundError, ValidationError } from '../../../../src/entities/errors/AppError';
import { makeRepository, makeStore } from '../../fixtures/ports';
import { finishedDiagnosis, queuedDiagnosis, repairInProgress } from '../../fixtures/execution';

const now = new Date('2026-10-31T12:00:00.000Z');
const tasks = [{ serviceId: 's-1', name: 'Oil change' }, { serviceId: 's-2', name: 'Brake check' }];

function command(payload: Record<string, unknown> = { tasks }): MessageEnvelope {
  return {
    messageId: 'm-2',
    type: 'EnqueueRepair',
    serviceOrderId: finishedDiagnosis.serviceOrderId,
    occurredAt: '2026-10-31T12:00:00.000Z',
    payload,
  };
}

describe('EnqueueRepairUseCase', () => {
  it('moves the finished diagnosis to a queued repair', async () => {
    const store = makeStore();

    await new EnqueueRepairUseCase(makeRepository(finishedDiagnosis), store, () => now).execute(command());

    expect(store.save).toHaveBeenCalledWith({
      execution: {
        state: expect.objectContaining({ stage: 'REPAIR', status: 'QUEUED', queuedAt: now, tasks }),
        expectedVersion: finishedDiagnosis.version,
      },
      messages: [],
      processedMessage: { messageId: 'm-2', type: 'EnqueueRepair' },
    });
  });

  it('does nothing when the order is already in repair', async () => {
    const store = makeStore();

    await new EnqueueRepairUseCase(makeRepository(repairInProgress), store, () => now).execute(command());

    expect(store.save).not.toHaveBeenCalled();
  });

  it('throws ValidationError when the diagnosis is not done, because the saga is out of step', async () => {
    await expect(
      new EnqueueRepairUseCase(makeRepository(queuedDiagnosis), makeStore(), () => now).execute(command()),
    ).rejects.toThrow(ValidationError);
  });

  it('throws NotFoundError when the order has no execution', async () => {
    await expect(
      new EnqueueRepairUseCase(makeRepository(null), makeStore(), () => now).execute(command()),
    ).rejects.toThrow(NotFoundError);
  });

  it.each([
    ['tasks that are not a list', { tasks: 'oil' }],
    ['a task without a name', { tasks: [{ serviceId: 's-1' }] }],
    ['a task without a service id', { tasks: [{ name: 'Oil change' }] }],
  ])('rejects a payload with %s', async (_case, payload) => {
    await expect(
      new EnqueueRepairUseCase(makeRepository(finishedDiagnosis), makeStore(), () => now).execute(command(payload)),
    ).rejects.toThrow(ValidationError);
  });
});
