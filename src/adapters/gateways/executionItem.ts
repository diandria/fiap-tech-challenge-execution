import { Execution, ExecutionStage, ExecutionStatus, ExecutionTask } from '../../entities/Execution';

interface TaskItem {
  serviceId: string;
  name: string;
  startedAt?: string;
  finishedAt?: string;
}

/**
 * The execution as stored in DynamoDB. Dates are ISO-8601 text, so the
 * `status-queuedAt` index sorts the queue in time order. Dates not yet set
 * are left out of the item rather than stored empty.
 */
export interface ExecutionItem {
  serviceOrderId: string;
  stage: ExecutionStage;
  status: ExecutionStatus;
  queuedAt: string;
  startedAt?: string;
  finishedAt?: string;
  tasks: TaskItem[];
  version: number;
}

function taskToItem(task: ExecutionTask): TaskItem {
  return {
    serviceId: task.serviceId,
    name: task.name,
    ...(task.startedAt && { startedAt: task.startedAt.toISOString() }),
    ...(task.finishedAt && { finishedAt: task.finishedAt.toISOString() }),
  };
}

function taskFromItem(item: TaskItem): ExecutionTask {
  return {
    serviceId: item.serviceId,
    name: item.name,
    ...(item.startedAt && { startedAt: new Date(item.startedAt) }),
    ...(item.finishedAt && { finishedAt: new Date(item.finishedAt) }),
  };
}

export function toItem(execution: Execution): ExecutionItem {
  return {
    serviceOrderId: execution.serviceOrderId,
    stage: execution.stage,
    status: execution.status,
    queuedAt: execution.queuedAt.toISOString(),
    ...(execution.startedAt && { startedAt: execution.startedAt.toISOString() }),
    ...(execution.finishedAt && { finishedAt: execution.finishedAt.toISOString() }),
    tasks: execution.tasks.map(taskToItem),
    version: execution.version,
  };
}

export function fromItem(item: ExecutionItem): Execution {
  return {
    serviceOrderId: item.serviceOrderId,
    stage: item.stage,
    status: item.status,
    queuedAt: new Date(item.queuedAt),
    ...(item.startedAt && { startedAt: new Date(item.startedAt) }),
    ...(item.finishedAt && { finishedAt: new Date(item.finishedAt) }),
    tasks: item.tasks.map(taskFromItem),
    version: item.version,
  };
}
