import { readTableNames } from '../../../src/frameworks/database/tableNames';

describe('readTableNames', () => {
  it('uses the names the Terraform creates when nothing is set', () => {
    expect(readTableNames({})).toEqual({
      executions: 'car-repair-shop-executions',
      outbox: 'car-repair-shop-execution-outbox',
      processedMessages: 'car-repair-shop-execution-processed-messages',
    });
  });

  it('takes each name from its variable when set', () => {
    expect(readTableNames({
      EXECUTIONS_TABLE: 'a', EXECUTION_OUTBOX_TABLE: 'b', PROCESSED_MESSAGES_TABLE: 'c',
    })).toEqual({ executions: 'a', outbox: 'b', processedMessages: 'c' });
  });
});
