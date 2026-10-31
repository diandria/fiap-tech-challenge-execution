import { GetAverageTaskDurationUseCase } from '../../../../src/use-cases/executions/GetAverageTaskDurationUseCase';
import { Execution } from '../../../../src/entities/Execution';
import { makeRepository } from '../../fixtures/ports';

const at = (minutes: number) => new Date(Date.UTC(2026, 9, 31, 12, minutes));

function finishedRepair(serviceOrderId: string, tasks: Execution['tasks']): Execution {
  return { serviceOrderId, stage: 'REPAIR', status: 'DONE', queuedAt: at(0), startedAt: at(0), finishedAt: at(59), tasks, version: 5 };
}

describe('GetAverageTaskDurationUseCase', () => {
  it('averages finished tasks per service and ignores unfinished ones', async () => {
    const executions = makeRepository();
    executions.listFinishedRepairs.mockResolvedValue([
      finishedRepair('os-1', [
        { serviceId: 's-1', name: 'Oil change', startedAt: at(0), finishedAt: at(30) },
        { serviceId: 's-2', name: 'Brake check', startedAt: at(0), finishedAt: at(10) },
      ]),
      finishedRepair('os-2', [
        { serviceId: 's-1', name: 'Oil change', startedAt: at(0), finishedAt: at(45) },
        { serviceId: 's-2', name: 'Brake check', startedAt: at(0) },
        { serviceId: 's-3', name: 'Alignment' },
      ]),
    ]);

    const averages = await new GetAverageTaskDurationUseCase(executions).execute();

    expect(averages).toEqual([
      { serviceId: 's-1', name: 'Oil change', avgMinutes: 37.5, count: 2 },
      { serviceId: 's-2', name: 'Brake check', avgMinutes: 10, count: 1 },
    ]);
  });

  it('rounds the average to one decimal place', async () => {
    const executions = makeRepository();
    executions.listFinishedRepairs.mockResolvedValue([
      finishedRepair('os-1', [{ serviceId: 's-1', name: 'Oil change', startedAt: at(0), finishedAt: at(10) }]),
      finishedRepair('os-2', [{ serviceId: 's-1', name: 'Oil change', startedAt: at(0), finishedAt: at(10) }]),
      finishedRepair('os-3', [{ serviceId: 's-1', name: 'Oil change', startedAt: at(0), finishedAt: at(11) }]),
    ]);

    const [average] = await new GetAverageTaskDurationUseCase(executions).execute();

    expect(average.avgMinutes).toBe(10.3);
  });

  it('returns nothing when no repair has finished', async () => {
    expect(await new GetAverageTaskDurationUseCase(makeRepository()).execute()).toEqual([]);
  });
});
