import { Execution, finishTask, startTask } from '../../entities/Execution';
import { NotFoundError, ValidationError } from '../../entities/errors/AppError';
import { IExecutionRepository } from '../ports/IExecutionRepository';
import { IExecutionStore } from '../ports/IExecutionStore';

export interface UpdateTaskInput {
  serviceOrderId: string;
  serviceId: string;
  status: string;
}

const TRANSITIONS: Record<string, (execution: Execution, serviceId: string, now: Date) => Execution> = {
  IN_PROGRESS: startTask,
  COMPLETED: finishTask,
};

export class UpdateTaskUseCase {
  constructor(
    private readonly executions: IExecutionRepository,
    private readonly store: IExecutionStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /**
   * Records the start or the end of one service of the repair. Nothing goes
   * to the saga: the OS Service hears about the repair as a whole, when the
   * stage starts and finishes.
   */
  async execute(input: UpdateTaskInput): Promise<Execution> {
    const transition = TRANSITIONS[input.status];
    if (!transition) throw new ValidationError('status must be IN_PROGRESS or COMPLETED');

    const execution = await this.executions.findById(input.serviceOrderId);
    if (!execution) throw new NotFoundError('Execution');

    const updated = transition(execution, input.serviceId, this.now());
    await this.store.save({ execution: { state: updated, expectedVersion: execution.version }, messages: [] });
    return { ...updated, version: execution.version + 1 };
  }
}
