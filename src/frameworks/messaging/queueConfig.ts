import { QueueUrls } from '../../adapters/messaging/SqsMessageSender';

export interface QueueConfig {
  /** Where this service takes its commands from. */
  executionCommands: string;
  /** Where each outgoing message is published. */
  destinations: QueueUrls;
}

const VARIABLES = ['QUEUE_URL_EXECUTION_COMMANDS', 'QUEUE_URL_SAGA_REPLIES'] as const;

/**
 * Reads the saga queue urls. None set means messaging is off, which is the
 * case for local runs without queues; only one of them set is a mistake, and
 * failing at startup beats failing at the first message.
 */
export function readQueueConfig(env: Record<string, string | undefined> = process.env): QueueConfig | undefined {
  const missing = VARIABLES.filter((name) => !env[name]);
  if (missing.length === VARIABLES.length) return undefined;
  if (missing.length > 0) {
    throw new Error(`Saga messaging is partially configured; missing ${missing.join(', ')}`);
  }

  return {
    executionCommands: env.QUEUE_URL_EXECUTION_COMMANDS as string,
    destinations: { 'saga-replies': env.QUEUE_URL_SAGA_REPLIES as string },
  };
}
