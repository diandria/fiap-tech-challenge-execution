import { registry } from '../../../../src/frameworks/metrics/registry';
import { PrometheusIntegrationFailures } from '../../../../src/frameworks/metrics/PrometheusIntegrationFailures';

describe('PrometheusIntegrationFailures', () => {
  it('should count a failure by integration and operation GIVEN a failed send', async () => {
    new PrometheusIntegrationFailures().record('sqs', 'saga-replies');

    const text = await registry.metrics();
    expect(text).toMatch(/integration_failures_total\{[^}]*integration="sqs",operation="saga-replies"[^}]*\} 1/);
  });
});
