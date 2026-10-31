import { Registry, collectDefaultMetrics } from '@prometheus-io/client';

export const registry = new Registry();

// Service identity goes in a label, not the metric name (ADR-007), so the
// generic name compares across services. Underscore, not dot: a Prometheus
// label only accepts [a-zA-Z_][a-zA-Z0-9_]*, and service.name would break
// scrape parsing.
registry.setDefaultLabels({
  service_name: process.env.OTEL_SERVICE_NAME ?? 'execution-service',
});

collectDefaultMetrics({ register: registry });
