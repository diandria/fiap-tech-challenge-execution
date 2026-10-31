import { Logger } from 'pino';
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand, Message } from '@aws-sdk/client-sqs';
import { IMessageHandler } from '../../use-cases/ports/IMessageHandler';
import { parseEnvelope } from '../../adapters/messaging/parseEnvelope';
import { runInMessageTrace } from './messageTrace';
import { messagesConsumed } from '../metrics/messagingMetrics';

export interface QueueToPoll {
  /** Short name used in logs, spans and metrics. */
  name: string;
  url: string;
}

export interface QueuePollerOptions {
  waitTimeSeconds: number;
  maxMessages: number;
  /** Pause after a failed receive, so a broken queue is not hammered. */
  errorDelayMs: number;
}

const DEFAULT_OPTIONS: QueuePollerOptions = { waitTimeSeconds: 20, maxMessages: 10, errorDelayMs: 5000 };

/**
 * Takes messages from one queue and hands each to the handler. A message is
 * deleted only after the handler resolves; anything else leaves it on the
 * queue, to come back after the visibility timeout and, after the last
 * attempt, to land in the dead-letter queue.
 */
export class SqsQueuePoller {
  private stopped = true;
  private loop: Promise<void> = Promise.resolve();
  private abort = new AbortController();
  private readonly options: QueuePollerOptions;

  constructor(
    private readonly sqs: SQSClient,
    private readonly queue: QueueToPoll,
    private readonly handler: IMessageHandler,
    private readonly log: Logger,
    options: Partial<QueuePollerOptions> = {},
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  start(): void {
    this.stopped = false;
    this.abort = new AbortController();
    this.loop = this.run();
  }

  /** Cancels the receive in progress and waits for the message being handled. */
  async stop(): Promise<void> {
    this.stopped = true;
    this.abort.abort();
    await this.loop;
  }

  /** Receives one batch and handles it; returns how many messages were handled. */
  async pollOnce(): Promise<number> {
    const { Messages = [] } = await this.sqs.send(
      new ReceiveMessageCommand({
        QueueUrl: this.queue.url,
        MaxNumberOfMessages: this.options.maxMessages,
        WaitTimeSeconds: this.options.waitTimeSeconds,
      }),
      { abortSignal: this.abort.signal },
    );

    let handled = 0;
    for (const message of Messages) {
      // A failure stops the batch: the next message may belong to the same
      // order, and handling it first would break the order of the FIFO group.
      if (!(await this.handle(message))) break;
      handled++;
    }
    return handled;
  }

  private async run(): Promise<void> {
    while (!this.stopped) {
      try {
        await this.pollOnce();
      } catch (err) {
        if (this.stopped) return;
        this.log.error({ err, queue: this.queue.name }, 'receiving from the queue failed');
        await new Promise((resolve) => setTimeout(resolve, this.options.errorDelayMs));
      }
    }
  }

  private async handle(message: Message): Promise<boolean> {
    const envelope = parseEnvelope(message.Body ?? '');
    if (!envelope) {
      messagesConsumed.inc({ queue: this.queue.name, type: 'unknown', outcome: 'failed' });
      this.log.error(
        { queue: this.queue.name, sqsMessageId: message.MessageId },
        'message is not a valid envelope; it stays on the queue until it reaches the dead-letter queue',
      );
      return false;
    }

    try {
      await runInMessageTrace(envelope, this.queue.name, () => this.handler.handle(envelope));
      await this.sqs.send(new DeleteMessageCommand({ QueueUrl: this.queue.url, ReceiptHandle: message.ReceiptHandle }));
      messagesConsumed.inc({ queue: this.queue.name, type: envelope.type, outcome: 'processed' });
      return true;
    } catch (err) {
      messagesConsumed.inc({ queue: this.queue.name, type: envelope.type, outcome: 'failed' });
      this.log.error(
        { err, queue: this.queue.name, messageId: envelope.messageId, type: envelope.type, serviceOrderId: envelope.serviceOrderId },
        'message handling failed; it will be delivered again',
      );
      return false;
    }
  }
}
