import { startTracing } from './otel';

/**
 * Imported for its side effect: auto-instrumentation has to patch http,
 * express and pg before those modules load, so this import comes first in
 * main.ts. Calling startTracing() later yields an empty trace with no error.
 */
startTracing();
