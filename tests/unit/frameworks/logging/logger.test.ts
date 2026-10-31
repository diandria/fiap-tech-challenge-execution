import { buildLogger } from '../../../../src/frameworks/logging/logger';
import { runWithTraceContext } from '../../../../src/frameworks/logging/context';

function capture() {
  const lines: string[] = [];
  return {
    lines,
    stream: { write: (line: string) => { lines.push(line); } },
  };
}

describe('logger', () => {
  it('should emit the semantic resource attributes GIVEN any event WHEN logging', () => {
    const { lines, stream } = capture();
    buildLogger({ stream }).info('hello');

    const event = JSON.parse(lines[0]);
    expect(event['service.name']).toBe('execution-service');
    expect(event['service.version']).toBeDefined();
    expect(event['deployment.environment']).toBeDefined();
    expect(event.msg).toBe('hello');
  });

  it('should emit one valid json object per line GIVEN an event WHEN logging', () => {
    const { lines, stream } = capture();
    buildLogger({ stream }).info('linha unica');

    expect(lines).toHaveLength(1);
    expect(lines[0].trimEnd().split('\n')).toHaveLength(1);
    expect(() => JSON.parse(lines[0])).not.toThrow();
  });

  it('should redact the authorization header GIVEN a request payload WHEN logging', () => {
    const { lines, stream } = capture();
    buildLogger({ stream }).info({ req: { headers: { authorization: 'Bearer abc' } } }, 'request');

    expect(JSON.parse(lines[0]).req.headers.authorization).toBe('[Redacted]');
  });

  it('should honour LOG_LEVEL GIVEN the variable is set WHEN building', () => {
    const previous = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'warn';


    const { lines, stream } = capture();
    const logger = buildLogger({ stream });
    logger.info('must not appear');
    logger.warn('deve aparecer');

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]).msg).toBe('deve aparecer');

    // Assigning undefined to an environment variable stores the string
    // "undefined", which poisons the tests that follow. It has to be deleted.
    if (previous === undefined) delete process.env.LOG_LEVEL;
    else process.env.LOG_LEVEL = previous;
  });
});

describe('logger trace correlation', () => {
  it('should attach the trace identifiers GIVEN an active scope WHEN logging', () => {
    const { lines, stream } = capture();
    const logger = buildLogger({ stream });

    runWithTraceContext({ traceId: 'e'.repeat(32), spanId: 'f'.repeat(16) }, () => {
      logger.info('inside the scope');
    });

    const event = JSON.parse(lines[0]);
    expect(event.trace_id).toBe('e'.repeat(32));
    expect(event.span_id).toBe('f'.repeat(16));
  });

  it('should omit the trace identifiers GIVEN no active scope WHEN logging', () => {
    const { lines, stream } = capture();
    buildLogger({ stream }).info('fora do escopo');

    const event = JSON.parse(lines[0]);
    expect(event.trace_id).toBeUndefined();
  });
});
