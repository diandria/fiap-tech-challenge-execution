import { queueRepair } from '../../entities/Execution';
import { NotFoundError, ValidationError } from '../../entities/errors/AppError';
import { IExecutionRepository } from '../ports/IExecutionRepository';
import { IExecutionStore } from '../ports/IExecutionStore';
import { MessageEnvelope } from '../messaging/MessageEnvelope';

interface RepairTask {
  serviceId: string;
  name: string;
}

function isTask(value: unknown): value is RepairTask {
  if (typeof value !== 'object' || value === null) return false;
  const { serviceId, name } = value as Record<string, unknown>;
  return typeof serviceId === 'string' && serviceId !== '' && typeof name === 'string' && name !== '';
}

/** A command outside the contract is a permanent error and ends in the dead-letter queue. */
function readTasks(payload: Record<string, unknown>): RepairTask[] {
  const { tasks } = payload;
  if (!Array.isArray(tasks) || !tasks.every(isTask)) {
    throw new ValidationError('tasks must be a list of { serviceId, name }');
  }
  return tasks;
}

export class EnqueueRepairUseCase {
  constructor(
    private readonly executions: IExecutionRepository,
    private readonly store: IExecutionStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /**
   * Puts the paid order back in the queue, now for repair, with one task per
   * service. An order already in repair is left alone. A diagnosis that is not
   * done means the saga is out of step, and the command must fail.
   */
  async execute(command: MessageEnvelope): Promise<void> {
    const tasks = readTasks(command.payload);
    const execution = await this.executions.findById(command.serviceOrderId);
    if (!execution) throw new NotFoundError('Execution');
    if (execution.stage === 'REPAIR') return;

    await this.store.save({
      execution: { state: queueRepair(execution, tasks, this.now()), expectedVersion: execution.version },
      messages: [],
      processedMessage: { messageId: command.messageId, type: command.type },
    });
  }
}
