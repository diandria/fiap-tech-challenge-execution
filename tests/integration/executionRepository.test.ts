import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { startDynamo, stopDynamo, TestDynamo } from '../helpers/dynamodb';
import { DynamoExecutionRepository } from '../../src/adapters/gateways/DynamoExecutionRepository';
import { toItem } from '../../src/adapters/gateways/executionItem';
import { Execution, queueDiagnosis, start } from '../../src/entities/Execution';

let dynamo: TestDynamo;
let repository: DynamoExecutionRepository;

beforeAll(async () => {
  dynamo = await startDynamo();
  repository = new DynamoExecutionRepository(dynamo.documents, dynamo.tables.executions);
});
afterAll(async () => { await stopDynamo(); });

async function store(execution: Execution): Promise<void> {
  await dynamo.documents.send(new PutCommand({ TableName: dynamo.tables.executions, Item: toItem(execution) }));
}

describe('Execution repository', () => {
  it('GIVEN three queued executions WHEN listByStatus QUEUED THEN they come back oldest first', async () => {
    // GIVEN
    await store(queueDiagnosis('a0000000-0000-4000-8000-000000000003', new Date('2026-10-31T10:30:00.000Z')));
    await store(queueDiagnosis('a0000000-0000-4000-8000-000000000001', new Date('2026-10-31T09:00:00.000Z')));
    await store(queueDiagnosis('a0000000-0000-4000-8000-000000000002', new Date('2026-10-31T10:00:00.000Z')));
    await store(start(queueDiagnosis('a0000000-0000-4000-8000-000000000004', new Date('2026-10-31T08:00:00.000Z')), new Date()));

    // WHEN
    const queued = await repository.listByStatus('QUEUED');

    // THEN
    expect(queued.map((execution) => execution.serviceOrderId)).toEqual([
      'a0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000002',
      'a0000000-0000-4000-8000-000000000003',
    ]);
  });

  it('GIVEN a stored execution WHEN findById THEN it comes back as stored', async () => {
    // GIVEN
    const execution = queueDiagnosis('b0000000-0000-4000-8000-000000000001', new Date('2026-10-31T11:00:00.000Z'));
    await store(execution);

    // WHEN
    const found = await repository.findById(execution.serviceOrderId);

    // THEN
    expect(found).toEqual(execution);
  });

  it('GIVEN no execution for the order WHEN findById THEN returns null', async () => {
    // GIVEN
    const serviceOrderId = 'c0000000-0000-4000-8000-000000000001';

    // WHEN
    const found = await repository.findById(serviceOrderId);

    // THEN
    expect(found).toBeNull();
  });
});
