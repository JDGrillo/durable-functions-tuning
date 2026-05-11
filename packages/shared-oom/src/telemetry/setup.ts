import { useAzureMonitor } from "applicationinsights";

export interface TelemetrySetupConfig {
  connectionString: string;
  appName: "inline-payloads" | "externalized-payloads";
}

let initialized = false;

/**
 * Initializes OpenTelemetry tracing and metrics with Azure Monitor export.
 * Uses the applicationinsights SDK v3 which configures the full OTel pipeline
 * (NodeTracerProvider, MeterProvider, Azure Monitor exporters) under the hood.
 *
 * Must be called once at app startup (before any function executions).
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function initializeTelemetry(config: TelemetrySetupConfig): void {
  if (initialized) return;
  initialized = true;

  // Set OTel resource attributes via env vars before SDK init
  process.env.OTEL_SERVICE_NAME = config.appName;
  process.env.OTEL_RESOURCE_ATTRIBUTES = `cloud.role.name=${config.appName}`;

  useAzureMonitor({
    azureMonitorExporterOptions: {
      connectionString: config.connectionString,
    },
    // Disable trace rate limiting (default: 5 spans/sec) so all spans are retained.
    // samplingRatio 1 = keep 100%, tracesPerSecond 0 = disable RateLimitedSampler.
    samplingRatio: 1,
    tracesPerSecond: 0,
  });
}
