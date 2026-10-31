import { Execution, start } from '../../entities/Execution';
import { IExecutionRepository } from '../ports/IExecutionRepository';
import { IExecutionStore } from '../ports/IExecutionStore';
import { advanceStage } from './advanceStage';

const STARTED = { DIAGNOSIS: 'DiagnosisStarted', REPAIR: 'RepairStarted' } as const;

export class StartStageUseCase {
  constructor(
    private readonly executions: IExecutionRepository,
    private readonly store: IExecutionStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  execute(serviceOrderId: string): Promise<Execution> {
    return advanceStage(this.executions, this.store, serviceOrderId, (execution) => start(execution, this.now()), STARTED);
  }
}
