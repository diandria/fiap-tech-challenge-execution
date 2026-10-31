import { Execution } from '../../../src/entities/Execution';

export const queuedDiagnosis: Execution = {
  serviceOrderId: '11111111-1111-4111-8111-111111111111',
  stage: 'DIAGNOSIS',
  status: 'QUEUED',
  queuedAt: new Date('2026-10-31T10:00:00.000Z'),
  tasks: [],
  version: 0,
};

export const finishedDiagnosis: Execution = {
  ...queuedDiagnosis,
  status: 'DONE',
  startedAt: new Date('2026-10-31T10:05:00.000Z'),
  finishedAt: new Date('2026-10-31T10:35:00.000Z'),
  version: 2,
};

export const repairInProgress: Execution = {
  serviceOrderId: '11111111-1111-4111-8111-111111111111',
  stage: 'REPAIR',
  status: 'IN_PROGRESS',
  queuedAt: new Date('2026-10-31T12:00:00.000Z'),
  startedAt: new Date('2026-10-31T12:10:00.000Z'),
  tasks: [
    { serviceId: 's-1', name: 'Oil change', startedAt: new Date('2026-10-31T12:10:00.000Z'), finishedAt: new Date('2026-10-31T12:40:00.000Z') },
    { serviceId: 's-2', name: 'Brake check' },
  ],
  version: 4,
};
