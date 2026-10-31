import { fromItem, toItem } from '../../../../src/adapters/gateways/executionItem';
import { queuedDiagnosis, repairInProgress } from '../../fixtures/execution';

describe('executionItem', () => {
  it('round-trips an execution with tasks', () => {
    expect(fromItem(toItem(repairInProgress))).toEqual(repairInProgress);
  });

  it('stores dates as ISO-8601 text, which keeps the queue index in time order', () => {
    const item = toItem(repairInProgress);

    expect(item).toMatchObject({
      serviceOrderId: repairInProgress.serviceOrderId,
      stage: 'REPAIR',
      status: 'IN_PROGRESS',
      queuedAt: '2026-10-31T12:00:00.000Z',
      startedAt: '2026-10-31T12:10:00.000Z',
      version: 4,
    });
    expect(item.tasks).toEqual([
      { serviceId: 's-1', name: 'Oil change', startedAt: '2026-10-31T12:10:00.000Z', finishedAt: '2026-10-31T12:40:00.000Z' },
      { serviceId: 's-2', name: 'Brake check' },
    ]);
  });

  it('leaves out the dates that are not set', () => {
    expect(Object.keys(toItem(queuedDiagnosis)).sort()).toEqual(['queuedAt', 'serviceOrderId', 'stage', 'status', 'tasks', 'version']);
  });
});
