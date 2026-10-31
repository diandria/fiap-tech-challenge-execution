import { ListQueueUseCase } from '../../../../src/use-cases/executions/ListQueueUseCase';
import { GetExecutionUseCase } from '../../../../src/use-cases/executions/GetExecutionUseCase';
import { NotFoundError } from '../../../../src/entities/errors/AppError';
import { makeRepository } from '../../fixtures/ports';
import { queuedDiagnosis, repairInProgress } from '../../fixtures/execution';

describe('ListQueueUseCase', () => {
  it('returns in-progress before queued, each oldest first', async () => {
    const executions = makeRepository();
    const olderQueued = { ...queuedDiagnosis, serviceOrderId: 'os-1' };
    const newerQueued = { ...queuedDiagnosis, serviceOrderId: 'os-2' };
    executions.listByStatus.mockImplementation(async (status) =>
      status === 'IN_PROGRESS' ? [repairInProgress] : [olderQueued, newerQueued]);

    const queue = await new ListQueueUseCase(executions).execute();

    expect(queue.map((execution) => execution.serviceOrderId)).toEqual([repairInProgress.serviceOrderId, 'os-1', 'os-2']);
  });
});

describe('GetExecutionUseCase', () => {
  it('returns the execution of the order', async () => {
    expect(await new GetExecutionUseCase(makeRepository(queuedDiagnosis)).execute('os-1')).toBe(queuedDiagnosis);
  });

  it('throws NotFoundError for an order with no execution', async () => {
    await expect(new GetExecutionUseCase(makeRepository(null)).execute('os-x')).rejects.toThrow(NotFoundError);
  });
});
