import { Execution } from '../../entities/Execution';

/** The version is a concurrency detail of the store; it stays out of the API. */
function toView(execution: Execution) {
  return {
    serviceOrderId: execution.serviceOrderId,
    stage: execution.stage,
    status: execution.status,
    queuedAt: execution.queuedAt,
    ...(execution.startedAt && { startedAt: execution.startedAt }),
    ...(execution.finishedAt && { finishedAt: execution.finishedAt }),
    tasks: execution.tasks,
  };
}

export const ExecutionPresenter = {
  ok(execution: Execution) {
    return { status: 200, body: toView(execution) };
  },

  list(executions: Execution[]) {
    return { status: 200, body: executions.map(toView) };
  },
};
