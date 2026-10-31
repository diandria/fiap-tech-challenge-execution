import { ExecutionPresenter } from '../../../../src/adapters/presenters/ExecutionPresenter';
import { queuedDiagnosis, repairInProgress } from '../../fixtures/execution';

describe('ExecutionPresenter', () => {
  it('maps an execution with its tasks and leaves the internal version out', () => {
    const { status, body } = ExecutionPresenter.ok(repairInProgress);

    expect(status).toBe(200);
    expect(body).toEqual({
      serviceOrderId: repairInProgress.serviceOrderId,
      stage: 'REPAIR',
      status: 'IN_PROGRESS',
      queuedAt: repairInProgress.queuedAt,
      startedAt: repairInProgress.startedAt,
      tasks: repairInProgress.tasks,
    });
  });

  it('maps the queue in the given order', () => {
    const { body } = ExecutionPresenter.list([repairInProgress, queuedDiagnosis]);

    expect(body.map((execution) => execution.status)).toEqual(['IN_PROGRESS', 'QUEUED']);
  });
});
