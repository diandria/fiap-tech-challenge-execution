import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { startDynamo, stopDynamo, TestDynamo } from '../helpers/dynamodb';
import { DynamoExecutionStore } from '../../src/adapters/gateways/DynamoExecutionStore';
import { DynamoExecutionRepository } from '../../src/adapters/gateways/DynamoExecutionRepository';
import { queueDiagnosis, start } from '../../src/entities/Execution';
import { ConflictError } from '../../src/entities/errors/AppError';
import { DuplicateMessageError } from '../../src/use-cases/messaging/DuplicateMessageError';

const noTrace = { currentTraceparent: () => undefined };

let dynamo: TestDynamo;
let store: DynamoExecutionStore;
let repository: DynamoExecutionRepository;

beforeAll(async () => {
  dynamo = await startDynamo();
  store = new DynamoExecutionStore(dynamo.documents, dynamo.tables, noTrace);
  repository = new DynamoExecutionRepository(dynamo.documents, dynamo.tables.executions);
});
afterAll(async () => { await stopDynamo(); });

async function outboxCount(): Promise<number> {
  const { Count } = await dynamo.documents.send(new ScanCommand({ TableName: dynamo.tables.outbox, Select: 'COUNT' }));
  return Count ?? 0;
}

function reply(serviceOrderId: string, type: string) {
  return { destination: 'saga-replies' as const, type, serviceOrderId, payload: {} };
}

describe('Execution store', () => {
  it('GIVEN a stale version WHEN saving THEN nothing is written', async () => {
    // GIVEN
    const serviceOrderId = 'a0000000-0000-4000-8000-000000000001';
    const queued = queueDiagnosis(serviceOrderId, new Date('2026-10-31T10:00:00.000Z'));
    await store.save({ execution: queued, expectedVersion: null, messages: [] });
    const stored = await repository.findById(serviceOrderId);
    await store.save({ execution: start(stored!, new Date()), expectedVersion: stored!.version, messages: [] });
    const outboxBefore = await outboxCount();

    // WHEN
    const stale = store.save({
      execution: start(stored!, new Date()),
      expectedVersion: stored!.version,
      messages: [reply(serviceOrderId, 'DiagnosisStarted')],
      processedMessage: { messageId: 'b0000000-0000-4000-8000-000000000001', type: 'StartDiagnosis' },
    });

    // THEN
    await expect(stale).rejects.toThrow(ConflictError);
    expect(await repository.findById(serviceOrderId)).toMatchObject({ status: 'IN_PROGRESS', version: 1 });
    expect(await outboxCount()).toBe(outboxBefore);
  });

  it('GIVEN the same command processed twice WHEN saving the second time THEN DuplicateMessageError is raised and nothing changes', async () => {
    // GIVEN
    const serviceOrderId = 'a0000000-0000-4000-8000-000000000002';
    const command = { messageId: 'b0000000-0000-4000-8000-000000000002', type: 'EnqueueDiagnosis' };
    const queued = queueDiagnosis(serviceOrderId, new Date('2026-10-31T10:00:00.000Z'));
    await store.save({ execution: queued, expectedVersion: null, messages: [reply(serviceOrderId, 'DiagnosisQueued')], processedMessage: command });
    const outboxBefore = await outboxCount();

    // WHEN
    const repeat = store.save({
      execution: queued,
      expectedVersion: 0,
      messages: [reply(serviceOrderId, 'DiagnosisQueued')],
      processedMessage: command,
    });

    // THEN
    await expect(repeat).rejects.toThrow(DuplicateMessageError);
    expect(await repository.findById(serviceOrderId)).toMatchObject({ status: 'QUEUED', version: 0 });
    expect(await outboxCount()).toBe(outboxBefore);
  });

  it('GIVEN a new execution WHEN saving it with a reply THEN the execution and the reply are both stored', async () => {
    // GIVEN
    const serviceOrderId = 'a0000000-0000-4000-8000-000000000003';
    const outboxBefore = await outboxCount();

    // WHEN
    await store.save({
      execution: queueDiagnosis(serviceOrderId, new Date()),
      expectedVersion: null,
      messages: [reply(serviceOrderId, 'DiagnosisQueued')],
    });

    // THEN
    expect(await repository.findById(serviceOrderId)).toMatchObject({ status: 'QUEUED', version: 0 });
    expect(await outboxCount()).toBe(outboxBefore + 1);
  });
});
