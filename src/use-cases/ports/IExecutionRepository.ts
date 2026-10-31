import { Execution } from '../../entities/Execution';

/** Read side of the executions. Writes go through the store, together with their messages. */
export interface IExecutionRepository {
  findById(serviceOrderId: string): Promise<Execution | null>;
  /** The executions in a status, oldest in the queue first. */
  listByStatus(status: 'QUEUED' | 'IN_PROGRESS'): Promise<Execution[]>;
}
