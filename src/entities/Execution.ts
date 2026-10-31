import { ValidationError } from './errors/AppError';

export type ExecutionStage = 'DIAGNOSIS' | 'REPAIR';
export type ExecutionStatus = 'QUEUED' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';

/** One service of the order, worked on during the repair. */
export interface ExecutionTask {
  serviceId: string;
  name: string;
  startedAt?: Date;
  finishedAt?: Date;
}

/**
 * The work on one service order, in the mechanic's queue. One document per
 * order, with its tasks embedded: it is always read whole and by its key.
 */
export interface Execution {
  serviceOrderId: string;
  stage: ExecutionStage;
  status: ExecutionStatus;
  queuedAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
  tasks: ExecutionTask[];
  /** Incremented on every write; lets a save detect that it read a stale execution. */
  version: number;
}

function refuse(execution: Execution, action: string): never {
  throw new ValidationError(`Cannot ${action} an execution in ${execution.stage} ${execution.status}`);
}

export function queueDiagnosis(serviceOrderId: string, now: Date): Execution {
  return { serviceOrderId, stage: 'DIAGNOSIS', status: 'QUEUED', queuedAt: now, tasks: [], version: 0 };
}

/** The repair reuses the order's document: the finished diagnosis goes back to the queue as a repair. */
export function queueRepair(execution: Execution, tasks: { serviceId: string; name: string }[], now: Date): Execution {
  if (execution.stage !== 'DIAGNOSIS' || execution.status !== 'DONE') refuse(execution, 'queue a repair for');
  return {
    serviceOrderId: execution.serviceOrderId,
    stage: 'REPAIR',
    status: 'QUEUED',
    queuedAt: now,
    tasks: tasks.map(({ serviceId, name }) => ({ serviceId, name })),
    version: execution.version,
  };
}

export function start(execution: Execution, now: Date): Execution {
  if (execution.status !== 'QUEUED') refuse(execution, 'start');
  return { ...execution, status: 'IN_PROGRESS', startedAt: now };
}

export function finish(execution: Execution, now: Date): Execution {
  if (execution.status !== 'IN_PROGRESS') refuse(execution, 'finish');
  return { ...execution, status: 'DONE', finishedAt: now };
}

/**
 * Compensation for a saga that will not reach payment. Only a diagnosis can
 * be cancelled: a repair exists only after payment, and there is no
 * compensation past that point. Anything else is returned as is, so the
 * compensation always succeeds.
 */
export function cancel(execution: Execution): Execution {
  if (execution.stage !== 'DIAGNOSIS' || execution.status === 'CANCELLED') return execution;
  return { ...execution, status: 'CANCELLED' };
}
