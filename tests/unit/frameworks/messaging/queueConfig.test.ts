import { readQueueConfig } from '../../../../src/frameworks/messaging/queueConfig';

const complete = {
  QUEUE_URL_EXECUTION_COMMANDS: 'http://queues/execution.fifo',
  QUEUE_URL_SAGA_REPLIES: 'http://queues/replies.fifo',
};

describe('readQueueConfig', () => {
  it('returns undefined when no queue url is set', () => {
    expect(readQueueConfig({})).toBeUndefined();
  });

  it('returns the command queue and the reply destination when both urls are set', () => {
    expect(readQueueConfig(complete)).toEqual({
      executionCommands: 'http://queues/execution.fifo',
      destinations: { 'saga-replies': 'http://queues/replies.fifo' },
    });
  });

  it('throws naming the missing variable when only one url is set', () => {
    const { QUEUE_URL_SAGA_REPLIES: _ignored, ...partial } = complete;

    expect(() => readQueueConfig(partial)).toThrow('QUEUE_URL_SAGA_REPLIES');
  });
});
