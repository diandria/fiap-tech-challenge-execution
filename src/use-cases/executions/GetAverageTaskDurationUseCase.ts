import { IExecutionRepository } from '../ports/IExecutionRepository';

export interface TaskDurationAverage {
  serviceId: string;
  name: string;
  avgMinutes: number;
  count: number;
}

const MINUTE_MS = 60_000;

export class GetAverageTaskDurationUseCase {
  constructor(private readonly executions: IExecutionRepository) {}

  /**
   * Mean time between start and finish of each service, over the finished
   * repairs. A service that was never started or never finished says nothing
   * about how long it takes, so it is left out.
   */
  async execute(): Promise<TaskDurationAverage[]> {
    const totals = new Map<string, { name: string; minutes: number; count: number }>();

    for (const repair of await this.executions.listFinishedRepairs()) {
      for (const task of repair.tasks) {
        if (!task.startedAt || !task.finishedAt) continue;
        const total = totals.get(task.serviceId) ?? { name: task.name, minutes: 0, count: 0 };
        total.minutes += (task.finishedAt.getTime() - task.startedAt.getTime()) / MINUTE_MS;
        total.count += 1;
        totals.set(task.serviceId, total);
      }
    }

    return [...totals].map(([serviceId, { name, minutes, count }]) => ({
      serviceId,
      name,
      avgMinutes: Math.round((minutes / count) * 10) / 10,
      count,
    }));
  }
}
