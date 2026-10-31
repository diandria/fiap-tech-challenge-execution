import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { IMessageSender } from '../../use-cases/ports/IMessageSender';
import { IIntegrationFailures } from '../../use-cases/ports/IIntegrationFailures';
import { MessageDestination, MessageEnvelope } from '../../use-cases/messaging/MessageEnvelope';

export type QueueUrls = Record<MessageDestination, string>;

export class SqsMessageSender implements IMessageSender {
  constructor(
    private readonly sqs: SQSClient,
    private readonly queueUrls: QueueUrls,
    private readonly failures: IIntegrationFailures,
  ) {}

  async send(destination: MessageDestination, envelope: MessageEnvelope): Promise<void> {
    try {
      await this.sqs.send(new SendMessageCommand({
        QueueUrl: this.queueUrls[destination],
        MessageBody: JSON.stringify(envelope),
        // One group per order keeps that order's messages in sequence; the
        // message id makes a repeated send inside the dedup window a no-op.
        MessageGroupId: envelope.serviceOrderId,
        MessageDeduplicationId: envelope.messageId,
      }));
    } catch (err) {
      this.failures.record('sqs', destination);
      throw err;
    }
  }
}
