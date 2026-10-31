import jwt from 'jsonwebtoken';
import request from 'supertest';
import { Application } from 'express';
import { SQSClient } from '@aws-sdk/client-sqs';
import { startDynamo, stopDynamo, TestDynamo } from '../helpers/dynamodb';
import { startLocalStack, stopLocalStack, createSagaQueues, receiveAll, SagaQueue, FifoQueue } from '../helpers/localstack';
import { createApp } from '../../src/app';
import { tableReadiness } from '../../src/frameworks/database/readinessProbe';
import { executionRoutes } from '../../src/frameworks/http/routes/executionRoutes';
import { ExecutionController } from '../../src/adapters/controllers/ExecutionController';
import { DynamoExecutionStore } from '../../src/adapters/gateways/DynamoExecutionStore';
import { DynamoExecutionRepository } from '../../src/adapters/gateways/DynamoExecutionRepository';
import { DynamoOutboxStore } from '../../src/adapters/gateways/DynamoOutboxStore';
import { SqsMessageSender } from '../../src/adapters/messaging/SqsMessageSender';
import { ListQueueUseCase } from '../../src/use-cases/executions/ListQueueUseCase';
import { GetExecutionUseCase } from '../../src/use-cases/executions/GetExecutionUseCase';
import { StartStageUseCase } from '../../src/use-cases/executions/StartStageUseCase';
import { FinishStageUseCase } from '../../src/use-cases/executions/FinishStageUseCase';
import { UpdateTaskUseCase } from '../../src/use-cases/executions/UpdateTaskUseCase';
import { GetAverageTaskDurationUseCase } from '../../src/use-cases/executions/GetAverageTaskDurationUseCase';
import { PublishPendingMessagesUseCase } from '../../src/use-cases/messaging/PublishPendingMessagesUseCase';
import { Execution, finish, finishTask, queueDiagnosis, queueRepair, start, startTask } from '../../src/entities/Execution';

let dynamo: TestDynamo;
let sqs: SQSClient;
let queues: Record<SagaQueue, FifoQueue>;
let store: DynamoExecutionStore;
let app: Application;
let publish: PublishPendingMessagesUseCase;
let orderSequence = 0;

beforeAll(async () => {
  process.env.JWT_SECRET = 'execution-api-secret';
  dynamo = await startDynamo();
  sqs = await startLocalStack();
  queues = await createSagaQueues(sqs);

  const executions = new DynamoExecutionRepository(dynamo.documents, dynamo.tables.executions);
  store = new DynamoExecutionStore(dynamo.documents, dynamo.tables, { currentTraceparent: () => undefined });
  const controller = new ExecutionController(
    new ListQueueUseCase(executions),
    new GetExecutionUseCase(executions),
    new StartStageUseCase(executions, store),
    new FinishStageUseCase(executions, store),
    new UpdateTaskUseCase(executions, store),
    new GetAverageTaskDurationUseCase(executions),
  );
  app = createApp(tableReadiness(dynamo.client, dynamo.tables.executions), { executions: executionRoutes(controller) });

  const sender = new SqsMessageSender(sqs, { 'saga-replies': queues['saga-replies'].url }, { record: jest.fn() });
  publish = new PublishPendingMessagesUseCase(new DynamoOutboxStore(dynamo.documents, dynamo.tables.outbox), sender);
});

afterAll(async () => {
  await stopLocalStack();
  await stopDynamo();
});

function staffToken(role: string): string {
  return jwt.sign({ type: 'staff', userId: 'u-1', role }, process.env.JWT_SECRET as string, { expiresIn: '1h' });
}

function nextOrderId(): string {
  orderSequence += 1;
  return `11111111-1111-4111-8111-${String(orderSequence).padStart(12, '0')}`;
}

/** Stores an execution as it would be after the given transitions, without going through the API. */
async function seed(execution: Execution): Promise<void> {
  await store.save({ execution: { state: execution, expectedVersion: null }, messages: [] });
}

async function repliesFor(serviceOrderId: string): Promise<string[]> {
  await publish.execute(25);
  const replies = await receiveAll(sqs, queues['saga-replies'].url);
  return replies.map((m) => JSON.parse(m.Body ?? '{}')).filter((m) => m.serviceOrderId === serviceOrderId).map((m) => m.type);
}

describe('Mechanic queue API', () => {
  it('GIVEN a queued diagnosis WHEN a mechanic POSTs start THEN returns 200 and DiagnosisStarted reaches the replies queue', async () => {
    // GIVEN
    const serviceOrderId = nextOrderId();
    await seed(queueDiagnosis(serviceOrderId, new Date()));

    // WHEN
    const res = await request(app).post(`/executions/${serviceOrderId}/start`).set('Authorization', `Bearer ${staffToken('mechanic')}`);

    // THEN
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ serviceOrderId, stage: 'DIAGNOSIS', status: 'IN_PROGRESS' });
    expect(await repliesFor(serviceOrderId)).toEqual(['DiagnosisStarted']);
  });

  it('GIVEN a diagnosis in progress WHEN a mechanic POSTs finish THEN returns 200 and DiagnosisCompleted reaches the replies queue', async () => {
    // GIVEN
    const serviceOrderId = nextOrderId();
    await seed(start(queueDiagnosis(serviceOrderId, new Date()), new Date()));

    // WHEN
    const res = await request(app).post(`/executions/${serviceOrderId}/finish`).set('Authorization', `Bearer ${staffToken('mechanic')}`);

    // THEN
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'DONE' });
    expect(await repliesFor(serviceOrderId)).toEqual(['DiagnosisCompleted']);
  });

  it('GIVEN a queued diagnosis WHEN an attendant POSTs start THEN returns 403', async () => {
    // GIVEN
    const serviceOrderId = nextOrderId();
    await seed(queueDiagnosis(serviceOrderId, new Date()));

    // WHEN
    const res = await request(app).post(`/executions/${serviceOrderId}/start`).set('Authorization', `Bearer ${staffToken('attendant')}`);

    // THEN
    expect(res.status).toBe(403);
  });

  it('GIVEN a done diagnosis WHEN a mechanic POSTs start THEN returns 400', async () => {
    // GIVEN
    const serviceOrderId = nextOrderId();
    await seed(finish(start(queueDiagnosis(serviceOrderId, new Date()), new Date()), new Date()));

    // WHEN
    const res = await request(app).post(`/executions/${serviceOrderId}/start`).set('Authorization', `Bearer ${staffToken('mechanic')}`);

    // THEN
    expect(res.status).toBe(400);
    expect(await repliesFor(serviceOrderId)).toEqual([]);
  });

  it('GIVEN two queued executions and one in progress WHEN GET /executions THEN the in-progress one comes first', async () => {
    // GIVEN
    const olderQueued = nextOrderId();
    const newerQueued = nextOrderId();
    const inProgress = nextOrderId();
    await seed(queueDiagnosis(olderQueued, new Date('2026-10-31T08:00:00.000Z')));
    await seed(queueDiagnosis(newerQueued, new Date('2026-10-31T09:00:00.000Z')));
    await seed(start(queueDiagnosis(inProgress, new Date('2026-10-31T10:00:00.000Z')), new Date()));

    // WHEN
    const res = await request(app).get('/executions').set('Authorization', `Bearer ${staffToken('admin')}`);

    // THEN
    expect(res.status).toBe(200);
    const ids: string[] = res.body.map((execution: { serviceOrderId: string }) => execution.serviceOrderId);
    expect(ids[0]).toBe(inProgress);
    expect(ids.indexOf(olderQueued)).toBeLessThan(ids.indexOf(newerQueued));
  });

  it('GIVEN no execution for the order WHEN GET /executions/:id THEN returns 404', async () => {
    // GIVEN
    const serviceOrderId = nextOrderId();

    // WHEN
    const res = await request(app).get(`/executions/${serviceOrderId}`).set('Authorization', `Bearer ${staffToken('mechanic')}`);

    // THEN
    expect(res.status).toBe(404);
  });

  it('GIVEN a repair in progress with a started service WHEN PATCH task COMPLETED THEN both timestamps are stored', async () => {
    // GIVEN
    const serviceOrderId = nextOrderId();
    const serviceId = 'c0000000-0000-4000-8000-000000000001';
    const diagnosed = finish(start(queueDiagnosis(serviceOrderId, new Date()), new Date()), new Date());
    const repair = start(queueRepair(diagnosed, [{ serviceId, name: 'Oil change' }], new Date()), new Date());
    await seed(startTask(repair, serviceId, new Date('2026-10-31T12:00:00.000Z')));

    // WHEN
    const res = await request(app)
      .patch(`/executions/${serviceOrderId}/tasks/${serviceId}`)
      .set('Authorization', `Bearer ${staffToken('mechanic')}`)
      .send({ status: 'COMPLETED' });

    // THEN
    expect(res.status).toBe(200);
    expect(res.body.tasks).toEqual([
      { serviceId, name: 'Oil change', startedAt: '2026-10-31T12:00:00.000Z', finishedAt: expect.any(String) },
    ]);
  });

  it('GIVEN a repair in progress WHEN PATCH a service that is not part of it THEN returns 404', async () => {
    // GIVEN
    const serviceOrderId = nextOrderId();
    const diagnosed = finish(start(queueDiagnosis(serviceOrderId, new Date()), new Date()), new Date());
    await seed(start(queueRepair(diagnosed, [{ serviceId: 'c0000000-0000-4000-8000-000000000001', name: 'Oil change' }], new Date()), new Date()));

    // WHEN
    const res = await request(app)
      .patch(`/executions/${serviceOrderId}/tasks/c0000000-0000-4000-8000-000000000099`)
      .set('Authorization', `Bearer ${staffToken('mechanic')}`)
      .send({ status: 'IN_PROGRESS' });

    // THEN
    expect(res.status).toBe(404);
  });

  it('GIVEN two finished repairs sharing a service WHEN GET average-task-duration THEN returns the mean for that service', async () => {
    // GIVEN
    const serviceId = 'c0000000-0000-4000-8000-000000000042';
    for (const minutes of [20, 40]) {
      const serviceOrderId = nextOrderId();
      const diagnosed = finish(start(queueDiagnosis(serviceOrderId, new Date()), new Date()), new Date());
      const repair = start(queueRepair(diagnosed, [{ serviceId, name: 'Suspension check' }], new Date()), new Date());
      const started = startTask(repair, serviceId, new Date('2026-10-31T12:00:00.000Z'));
      const worked = finishTask(started, serviceId, new Date(Date.parse('2026-10-31T12:00:00.000Z') + minutes * 60_000));
      await seed(finish(worked, new Date()));
    }

    // WHEN
    const res = await request(app).get('/executions/stats/average-task-duration').set('Authorization', `Bearer ${staffToken('attendant')}`);

    // THEN
    expect(res.status).toBe(200);
    expect(res.body).toContainEqual({ serviceId, name: 'Suspension check', avgMinutes: 30, count: 2 });
  });

  it('GIVEN a mechanic token WHEN GET average-task-duration THEN returns 403', async () => {
    // GIVEN
    const token = staffToken('mechanic');

    // WHEN
    const res = await request(app).get('/executions/stats/average-task-duration').set('Authorization', `Bearer ${token}`);

    // THEN
    expect(res.status).toBe(403);
  });
});
