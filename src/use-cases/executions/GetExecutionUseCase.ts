import { Execution } from '../../entities/Execution';
import { NotFoundError } from '../../entities/errors/AppError';
import { IExecutionRepository } from '../ports/IExecutionRepository';

export class GetExecutionUseCase {
  constructor(private readonly executions: IExecutionRepository) {}

  async execute(serviceOrderId: string): Promise<Execution> {
    const execution = await this.executions.findById(serviceOrderId);
    if (!execution) throw new NotFoundError('Execution');
    return execution;
  }
}
