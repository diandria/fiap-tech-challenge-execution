import { CancelExecutionUseCase } from '../../../../src/use-cases/executions/CancelExecutionUseCase';
import { MessageEnvelope } from '../../../../src/use-cases/messaging/MessageEnvelope';
import { makeRepository, makeStore } from '../../fixtures/ports';
import { finishedDiagnosis, repairInProgress } from '../../fixtures/execution';

const command: MessageEnvelope = {
  messageId: 'm-9',
  type: 'CancelExecution',
  serviceOrderId: finishedDiagnosis.serviceOrderId,
  occurredAt: '2026-10-31T11:00:00.000Z',
  payload: { reason: 'BUDGET_REJECTED' },
};

const executionCancelled = {
  destination: 'saga-replies',
  type: 'ExecutionCancelled',
  serviceOrderId: finishedDiagnosis.serviceOrderId,
  payload: {},
};

describe('CancelExecutionUseCase', () => {
  it('cancels and replies ExecutionCancelled', async () => {
    const store = makeStore();

    await new CancelExecutionUseCase(makeRepository(finishedDiagnosis), store).execute(command);

    expect(store.save).toHaveBeenCalledWith({
      execution: { state: { ...finishedDiagnosis, status: 'CANCELLED' }, expectedVersion: finishedDiagnosis.version },
      messages: [executionCancelled],
      processedMessage: { messageId: 'm-9', type: 'CancelExecution' },
    });
  });

  it('replies ExecutionCancelled when there is no execution', async () => {
    const store = makeStore();

    await new CancelExecutionUseCase(makeRepository(null), store).execute(command);

    expect(store.save).toHaveBeenCalledWith({
      messages: [executionCancelled],
      processedMessage: { messageId: 'm-9', type: 'CancelExecution' },
    });
  });

  it('replies without touching a repair, which has no compensation', async () => {
    const store = makeStore();

    await new CancelExecutionUseCase(makeRepository(repairInProgress), store).execute(command);

    expect(store.save).toHaveBeenCalledWith(expect.not.objectContaining({ execution: expect.anything() }));
    expect(store.save.mock.calls[0][0].messages).toEqual([executionCancelled]);
  });
});
