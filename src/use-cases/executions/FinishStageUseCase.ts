import { Execution, finish } from '../../entities/Execution';
import { IExecutionRepository } from '../ports/IExecutionRepository';
import { IExecutionStore } from '../ports/IExecutionStore';
import { advanceStage } from './advanceStage';

const COMPLETED = { DIAGNOSIS: 'DiagnosisCompleted', REPAIR: 'RepairCompleted' } as const;

export class FinishStageUseCase {
  constructor(
    private readonly executions: IExecutionRepository,
    private readonly store: IExecutionStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  execute(serviceOrderId: string): Promise<Execution> {
    return advanceStage(this.executions, this.store, serviceOrderId, (execution) => finish(execution, this.now()), COMPLETED);
  }
}
