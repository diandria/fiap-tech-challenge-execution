import { Logger } from 'pino';
import { PublishPendingMessagesUseCase } from '../../use-cases/messaging/PublishPendingMessagesUseCase';
import { outboxPublished } from '../metrics/messagingMetrics';

export interface OutboxRelayOptions {
  batchSize: number;
  /** Wait between cycles when the last one did not fill a batch. */
  idleDelayMs: number;
}

/** Publishes the outbox continuously, one cycle at a time, until stopped. */
export class OutboxRelay {
  private timer?: NodeJS.Timeout;
  private cycle: Promise<void> = Promise.resolve();
  private stopped = false;

  constructor(
    private readonly publish: PublishPendingMessagesUseCase,
    private readonly log: Logger,
    private readonly options: OutboxRelayOptions = { batchSize: 10, idleDelayMs: 1000 },
  ) {}

  start(): void {
    this.stopped = false;
    this.schedule(0);
  }

  /** Stops scheduling and waits for the cycle in progress, so shutdown never cuts a send in half. */
  async stop(): Promise<void> {
    this.stopped = true;
    clearTimeout(this.timer);
    await this.cycle;
  }

  /** Runs one cycle and returns how many messages it published. Never throws. */
  async runOnce(): Promise<number> {
    try {
      const sent = await this.publish.execute(this.options.batchSize);
      if (sent > 0) outboxPublished.inc(sent);
      return sent;
    } catch (err) {
      this.log.error({ err }, 'outbox publishing failed; pending messages stay for the next cycle');
      return 0;
    }
  }

  private schedule(delayMs: number): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      this.cycle = this.runOnce().then((sent) => {
        // A full batch means more may be waiting, so the next cycle starts at once.
        this.schedule(sent === this.options.batchSize ? 0 : this.options.idleDelayMs);
      });
    }, delayMs);
  }
}
