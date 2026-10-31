import { Execution } from '../../../src/entities/Execution';
import { IExecutionRepository } from '../../../src/use-cases/ports/IExecutionRepository';
import { IExecutionStore } from '../../../src/use-cases/ports/IExecutionStore';

export function makeRepository(execution: Execution | null = null): jest.Mocked<IExecutionRepository> {
  return {
    findById: jest.fn().mockResolvedValue(execution),
    listByStatus: jest.fn().mockResolvedValue([]),
    listFinishedRepairs: jest.fn().mockResolvedValue([]),
  };
}

export function makeStore(): jest.Mocked<IExecutionStore> {
  return { save: jest.fn().mockResolvedValue(undefined) };
}
