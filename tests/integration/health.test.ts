import request from 'supertest';
import { createApp } from '../../src/app';
import { tableReadiness } from '../../src/frameworks/database/readinessProbe';
import { startDynamo, stopDynamo, TestDynamo } from '../helpers/dynamodb';

let dynamo: TestDynamo;

beforeAll(async () => { dynamo = await startDynamo(); });
afterAll(async () => { await stopDynamo(); });

describe('Health and readiness', () => {
  it('GIVEN the executions table exists WHEN GET /ready THEN returns 200 with the database check up', async () => {
    // GIVEN
    const app = createApp(tableReadiness(dynamo.client, dynamo.tables.executions));

    // WHEN
    const res = await request(app).get('/ready');

    // THEN
    expect(res.status).toBe(200);
    expect(res.body.checks.database).toBe('up');
  });

  it('GIVEN the executions table is missing WHEN GET /ready THEN returns 503', async () => {
    // GIVEN
    const app = createApp(tableReadiness(dynamo.client, 'missing-table'));

    // WHEN
    const res = await request(app).get('/ready');

    // THEN
    expect(res.status).toBe(503);
    expect(res.body.checks.database).toBe('down');
  });

  it('GIVEN the database does not answer WHEN GET /health THEN still returns 200', async () => {
    // GIVEN
    const app = createApp(tableReadiness(dynamo.client, 'missing-table'));

    // WHEN
    const res = await request(app).get('/health');

    // THEN
    expect(res.status).toBe(200);
  });

  it('GIVEN a running service WHEN GET /metrics THEN exposes metrics labelled with the service name', async () => {
    // GIVEN
    const app = createApp(tableReadiness(dynamo.client, dynamo.tables.executions));

    // WHEN
    const res = await request(app).get('/metrics');

    // THEN
    expect(res.status).toBe(200);
    expect(res.text).toContain('service_name="execution-service"');
  });
});
