import { Execution, ExecutionStage } from '../../entities/Execution';
import { NotFoundError } from '../../entities/errors/AppError';
import { IExecutionRepository } from '../ports/IExecutionRepository';
import { IExecutionStore } from '../ports/IExecutionStore';

/**
 * Moves the current stage of an order forward and tells the saga. The stage
 * comes from the stored execution, never from the caller, so a mechanic
 * cannot skip one. The reply is saved with the change: both happen or neither.
 */
export async function advanceStage(
  executions: IExecutionRepository,
  store: IExecutionStore,
  serviceOrderId: string,
  advance: (execution: Execution) => Execution,
  replyType: Record<ExecutionStage, string>,
): Promise<Execution> {
  const execution = await executions.findById(serviceOrderId);
  if (!execution) throw new NotFoundError('Execution');

  const advanced = advance(execution);
  await store.save({
    execution: { state: advanced, expectedVersion: execution.version },
    messages: [{ destination: 'saga-replies', type: replyType[execution.stage], serviceOrderId, payload: {} }],
  });
  return { ...advanced, version: execution.version + 1 };
}
