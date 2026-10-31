import { queueDiagnosis } from '../../entities/Execution';
import { IExecutionRepository } from '../ports/IExecutionRepository';
import { IExecutionStore } from '../ports/IExecutionStore';
import { MessageEnvelope } from '../messaging/MessageEnvelope';

export class EnqueueDiagnosisUseCase {
  constructor(
    private readonly executions: IExecutionRepository,
    private readonly store: IExecutionStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /**
   * Puts the order in the mechanic's queue for diagnosis. Nothing is replied:
   * the next reply comes when the mechanic starts. An order that already has
   * an execution is left alone, so a repeated command with a new id is harmless too.
   */
  async execute(command: MessageEnvelope): Promise<void> {
    if (await this.executions.findById(command.serviceOrderId)) return;

    await this.store.save({
      execution: { state: queueDiagnosis(command.serviceOrderId, this.now()), expectedVersion: null },
      messages: [],
      processedMessage: { messageId: command.messageId, type: command.type },
    });
  }
}
