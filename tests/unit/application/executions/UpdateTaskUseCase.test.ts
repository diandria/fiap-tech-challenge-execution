import { UpdateTaskUseCase } from '../../../../src/use-cases/executions/UpdateTaskUseCase';
import { ValidationError } from '../../../../src/entities/errors/AppError';
import { makeRepository, makeStore } from '../../fixtures/ports';
import { repairInProgress } from '../../fixtures/execution';

const now = new Date('2026-10-31T13:00:00.000Z');

describe('UpdateTaskUseCase', () => {
  it('starts a task and saves the execution without replying to the saga', async () => {
    const store = makeStore();

    const updated = await new UpdateTaskUseCase(makeRepository(repairInProgress), store, () => now)
      .execute({ serviceOrderId: repairInProgress.serviceOrderId, serviceId: 's-2', status: 'IN_PROGRESS' });

    expect(store.save).toHaveBeenCalledWith({
      execution: { state: expect.objectContaining({ tasks: [repairInProgress.tasks[0], { serviceId: 's-2', name: 'Brake check', startedAt: now }] }), expectedVersion: repairInProgress.version },
      messages: [],
    });
    expect(updated.version).toBe(repairInProgress.version + 1);
  });

  it('finishes a started task', async () => {
    const store = makeStore();
    const started = { ...repairInProgress, tasks: [repairInProgress.tasks[0], { serviceId: 's-2', name: 'Brake check', startedAt: now }] };

    const updated = await new UpdateTaskUseCase(makeRepository(started), store, () => now)
      .execute({ serviceOrderId: started.serviceOrderId, serviceId: 's-2', status: 'COMPLETED' });

    expect(updated.tasks[1].finishedAt).toEqual(now);
  });

  it('rejects an unknown status', async () => {
    await expect(new UpdateTaskUseCase(makeRepository(repairInProgress), makeStore(), () => now)
      .execute({ serviceOrderId: repairInProgress.serviceOrderId, serviceId: 's-2', status: 'PAUSED' }))
      .rejects.toThrow(ValidationError);
  });

  it('throws NotFoundError for an order with no execution', async () => {
    await expect(new UpdateTaskUseCase(makeRepository(null), makeStore(), () => now)
      .execute({ serviceOrderId: 'os-x', serviceId: 's-2', status: 'IN_PROGRESS' }))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});
