import { Execution } from '../../entities/Execution';
import { IExecutionRepository } from '../ports/IExecutionRepository';

export class ListQueueUseCase {
  constructor(private readonly executions: IExecutionRepository) {}

  /** What the mechanic sees: the work in progress first, then the queue, each oldest first. */
  async execute(): Promise<Execution[]> {
    const [inProgress, queued] = await Promise.all([
      this.executions.listByStatus('IN_PROGRESS'),
      this.executions.listByStatus('QUEUED'),
    ]);
    return [...inProgress, ...queued];
  }
}
