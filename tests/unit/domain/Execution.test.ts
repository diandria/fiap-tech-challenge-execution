import { cancel, finish, queueDiagnosis, queueRepair, start } from '../../../src/entities/Execution';
import { ValidationError } from '../../../src/entities/errors/AppError';
import { finishedDiagnosis, queuedDiagnosis, repairInProgress } from '../fixtures/execution';

const now = new Date('2026-10-31T13:00:00.000Z');
const tasks = [{ serviceId: 's-1', name: 'Oil change' }, { serviceId: 's-2', name: 'Brake check' }];

describe('queueDiagnosis', () => {
  it('creates a queued diagnosis with version zero', () => {
    expect(queueDiagnosis('os-1', now)).toEqual({
      serviceOrderId: 'os-1',
      stage: 'DIAGNOSIS',
      status: 'QUEUED',
      queuedAt: now,
      tasks: [],
      version: 0,
    });
  });
});

describe('queueRepair', () => {
  it('moves a finished diagnosis to a queued repair with the given tasks', () => {
    const repair = queueRepair(finishedDiagnosis, tasks, now);

    expect(repair).toEqual({
      serviceOrderId: finishedDiagnosis.serviceOrderId,
      stage: 'REPAIR',
      status: 'QUEUED',
      queuedAt: now,
      tasks,
      version: finishedDiagnosis.version,
    });
  });

  it('throws when the diagnosis is not done', () => {
    expect(() => queueRepair(queuedDiagnosis, tasks, now)).toThrow(ValidationError);
    expect(() => queueRepair(queuedDiagnosis, tasks, now)).toThrow('DIAGNOSIS QUEUED');
  });

  it('throws for an execution already in repair', () => {
    expect(() => queueRepair(repairInProgress, tasks, now)).toThrow(ValidationError);
  });
});

describe('start', () => {
  it('moves a queued execution to in progress and records startedAt', () => {
    expect(start(queuedDiagnosis, now)).toMatchObject({ status: 'IN_PROGRESS', startedAt: now });
  });

  it.each([finishedDiagnosis, repairInProgress])('refuses to start an execution that is not queued (%#)', (execution) => {
    expect(() => start(execution, now)).toThrow(ValidationError);
  });
});

describe('finish', () => {
  it('moves an in-progress execution to done and records finishedAt', () => {
    expect(finish(repairInProgress, now)).toMatchObject({ status: 'DONE', finishedAt: now });
  });

  it.each([queuedDiagnosis, finishedDiagnosis])('refuses to finish an execution that is not in progress (%#)', (execution) => {
    expect(() => finish(execution, now)).toThrow(ValidationError);
  });
});

describe('cancel', () => {
  it.each([
    queuedDiagnosis,
    { ...queuedDiagnosis, status: 'IN_PROGRESS' as const },
    finishedDiagnosis,
  ])('cancels a diagnosis in any status (%#)', (diagnosis) => {
    expect(cancel(diagnosis).status).toBe('CANCELLED');
  });

  it('leaves a repair unchanged, because there is no compensation after payment', () => {
    expect(cancel(repairInProgress)).toBe(repairInProgress);
  });

  it('leaves a cancelled diagnosis unchanged', () => {
    const cancelled = { ...queuedDiagnosis, status: 'CANCELLED' as const };

    expect(cancel(cancelled)).toBe(cancelled);
  });
});
