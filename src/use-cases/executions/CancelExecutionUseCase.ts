import { cancel } from '../../entities/Execution';
import { IExecutionRepository } from '../ports/IExecutionRepository';
import { IExecutionStore } from '../ports/IExecutionStore';
import { MessageEnvelope } from '../messaging/MessageEnvelope';

export class CancelExecutionUseCase {
  constructor(
    private readonly executions: IExecutionRepository,
    private readonly store: IExecutionStore,
  ) {}

  /**
   * Takes the order out of the queue and always replies ExecutionCancelled,
   * even when there was nothing to cancel: the orchestrator waits for this
   * reply to close the saga, and a compensation that fails would hold it open.
   */
  async execute(command: MessageEnvelope): Promise<void> {
    const execution = await this.executions.findById(command.serviceOrderId);
    const cancelled = execution ? cancel(execution) : undefined;
    const changed = execution && cancelled && cancelled !== execution;

    await this.store.save({
      ...(changed && { execution: { state: cancelled, expectedVersion: execution.version } }),
      messages: [{ destination: 'saga-replies', type: 'ExecutionCancelled', serviceOrderId: command.serviceOrderId, payload: {} }],
      processedMessage: { messageId: command.messageId, type: command.type },
    });
  }
}
