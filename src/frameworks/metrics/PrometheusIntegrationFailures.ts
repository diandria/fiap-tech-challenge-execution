import { IIntegrationFailures } from '../../use-cases/ports/IIntegrationFailures';
import { integrationFailures } from './integrationMetrics';

/** Prometheus-backed implementation of the integration failures port. */
export class PrometheusIntegrationFailures implements IIntegrationFailures {
  record(integration: string, operation: string): void {
    integrationFailures.inc({ integration, operation });
  }
}
