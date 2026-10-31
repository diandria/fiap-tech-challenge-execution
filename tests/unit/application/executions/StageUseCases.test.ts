import { StartStageUseCase } from '../../../../src/use-cases/executions/StartStageUseCase';
import { FinishStageUseCase } from '../../../../src/use-cases/executions/FinishStageUseCase';
import { NotFoundError, ValidationError } from '../../../../src/entities/errors/AppError';
import { makeRepository, makeStore } from '../../fixtures/ports';
import { finishedDiagnosis, queuedDiagnosis, repairInProgress } from '../../fixtures/execution';

const now = new Date('2026-10-31T14:00:00.000Z');
const queuedRepair = { ...repairInProgress, status: 'QUEUED' as const, startedAt: undefined };
const diagnosisInProgress = { ...queuedDiagnosis, status: 'IN_PROGRESS' as const, startedAt: now, version: 1 };

function reply(type: string) {
  return { destination: 'saga-replies', type, serviceOrderId: queuedDiagnosis.serviceOrderId, payload: {} };
}

describe('StartStageUseCase', () => {
  it('replies DiagnosisStarted when starting a diagnosis', async () => {
    const store = makeStore();

    const started = await new StartStageUseCase(makeRepository(queuedDiagnosis), store, () => now).execute(queuedDiagnosis.serviceOrderId);

    expect(store.save).toHaveBeenCalledWith({
      execution: { state: expect.objectContaining({ status: 'IN_PROGRESS', startedAt: now }), expectedVersion: queuedDiagnosis.version },
      messages: [reply('DiagnosisStarted')],
    });
    expect(started).toMatchObject({ status: 'IN_PROGRESS', version: queuedDiagnosis.version + 1 });
  });

  it('replies RepairStarted when starting a repair', async () => {
    const store = makeStore();

    await new StartStageUseCase(makeRepository(queuedRepair), store, () => now).execute(queuedRepair.serviceOrderId);

    expect(store.save.mock.calls[0][0].messages).toEqual([reply('RepairStarted')]);
  });

  it('throws ValidationError when the execution is not queued', async () => {
    const store = makeStore();

    await expect(
      new StartStageUseCase(makeRepository(finishedDiagnosis), store, () => now).execute(finishedDiagnosis.serviceOrderId),
    ).rejects.toThrow(ValidationError);
    expect(store.save).not.toHaveBeenCalled();
  });

  it('throws NotFoundError for an order with no execution', async () => {
    await expect(new StartStageUseCase(makeRepository(null), makeStore(), () => now).execute('os-x')).rejects.toThrow(NotFoundError);
  });
});

describe('FinishStageUseCase', () => {
  it('replies DiagnosisCompleted and RepairCompleted for each stage', async () => {
    const diagnosisStore = makeStore();
    const repairStore = makeStore();

    await new FinishStageUseCase(makeRepository(diagnosisInProgress), diagnosisStore, () => now).execute(diagnosisInProgress.serviceOrderId);
    await new FinishStageUseCase(makeRepository(repairInProgress), repairStore, () => now).execute(repairInProgress.serviceOrderId);

    expect(diagnosisStore.save).toHaveBeenCalledWith({
      execution: { state: expect.objectContaining({ status: 'DONE', finishedAt: now }), expectedVersion: diagnosisInProgress.version },
      messages: [reply('DiagnosisCompleted')],
    });
    expect(repairStore.save.mock.calls[0][0].messages).toEqual([reply('RepairCompleted')]);
  });

  it('throws ValidationError when the execution is not in progress', async () => {
    await expect(
      new FinishStageUseCase(makeRepository(queuedDiagnosis), makeStore(), () => now).execute(queuedDiagnosis.serviceOrderId),
    ).rejects.toThrow(ValidationError);
  });
});
