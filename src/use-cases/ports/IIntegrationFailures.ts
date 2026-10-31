/**
 * Output port for integration failures. A failed send is retried by the
 * relay, so from the outside nothing looks wrong; this counter is the signal
 * that an integration is broken.
 */
export interface IIntegrationFailures {
  record(integration: string, operation: string): void;
}
