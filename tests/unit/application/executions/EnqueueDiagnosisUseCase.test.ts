import { EnqueueDiagnosisUseCase } from '../../../../src/use-cases/executions/EnqueueDiagnosisUseCase';
import { MessageEnvelope } from '../../../../src/use-cases/messaging/MessageEnvelope';
import { makeRepository, makeStore } from '../../fixtures/ports';
import { queuedDiagnosis } from '../../fixtures/execution';

const now = new Date('2026-10-31T10:00:00.000Z');
const command: MessageEnvelope = {
  messageId: 'm-1',
  type: 'EnqueueDiagnosis',
  serviceOrderId: 'os-1',
  occurredAt: '2026-10-31T10:00:00.000Z',
  payload: {},
};

describe('EnqueueDiagnosisUseCase', () => {
  it('saves a queued diagnosis', async () => {
    const store = makeStore();

    await new EnqueueDiagnosisUseCase(makeRepository(), store, () => now).execute(command);

    expect(store.save).toHaveBeenCalledWith({
      execution: {
        state: { serviceOrderId: 'os-1', stage: 'DIAGNOSIS', status: 'QUEUED', queuedAt: now, tasks: [], version: 0 },
        expectedVersion: null,
      },
      messages: [],
      processedMessage: { messageId: 'm-1', type: 'EnqueueDiagnosis' },
    });
  });

  it('does nothing when the order already has an execution', async () => {
    const store = makeStore();

    await new EnqueueDiagnosisUseCase(makeRepository(queuedDiagnosis), store, () => now).execute(command);

    expect(store.save).not.toHaveBeenCalled();
  });
});
