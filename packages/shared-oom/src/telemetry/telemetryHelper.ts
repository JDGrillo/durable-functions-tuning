import { trace, metrics, SpanStatusCode, Span, SpanKind } from "@opentelemetry/api";
import type { Histogram, Counter } from "@opentelemetry/api";

const TRACER_NAME = "df-comparison-oom";
const METER_NAME = "df-comparison-oom";

export interface TelemetryConfig {
  appName: "inline-payloads" | "externalized-payloads";
}

export class TelemetryHelper {
  private readonly appName: string;
  private readonly tracer;
  private readonly meter;

  // ─── Existing instruments (replicated from packages/shared) ────────────
  private readonly activityDurationHistogram: Histogram;
  private readonly queueDelayHistogram: Histogram;
  private readonly orchestrationDurationHistogram: Histogram;
  private readonly activityCompletedCounter: Counter;
  private readonly orchestrationCompletedCounter: Counter;
  private readonly orchestrationFailedCounter: Counter;

  // ─── NEW memory instruments ────────────────────────────────────────────
  private readonly heapUsedHistogram: Histogram;
  private readonly heapTotalHistogram: Histogram;
  private readonly rssHistogram: Histogram;
  private readonly externalHistogram: Histogram;

  // ─── NEW payload instruments ───────────────────────────────────────────
  private readonly payloadInputBytesHistogram: Histogram;
  private readonly payloadOutputBytesHistogram: Histogram;

  constructor(config: TelemetryConfig) {
    this.appName = config.appName;
    this.tracer = trace.getTracer(TRACER_NAME);
    this.meter = metrics.getMeter(METER_NAME);

    // ─── Existing instruments ──────────────────────────────────────────
    this.activityDurationHistogram = this.meter.createHistogram(
      "df.activity.duration",
      { description: "Duration of activity function execution in ms", unit: "ms" }
    );

    this.queueDelayHistogram = this.meter.createHistogram(
      "df.activity.queue_delay",
      { description: "Time between activity scheduled and activity started in ms", unit: "ms" }
    );

    this.orchestrationDurationHistogram = this.meter.createHistogram(
      "df.orchestration.duration",
      { description: "Total orchestration duration in ms", unit: "ms" }
    );

    this.activityCompletedCounter = this.meter.createCounter(
      "df.activity.completed",
      { description: "Number of completed activity executions" }
    );

    this.orchestrationCompletedCounter = this.meter.createCounter(
      "df.orchestration.completed",
      { description: "Number of completed orchestrations" }
    );

    this.orchestrationFailedCounter = this.meter.createCounter(
      "df.orchestration.failed",
      { description: "Number of failed orchestrations" }
    );

    // ─── NEW memory instruments ──────────────────────────────────────────
    this.heapUsedHistogram = this.meter.createHistogram(
      "df.memory.heap_used_mb",
      { description: "Heap used memory in MB from process.memoryUsage()", unit: "MB" }
    );

    this.heapTotalHistogram = this.meter.createHistogram(
      "df.memory.heap_total_mb",
      { description: "Total heap memory in MB from process.memoryUsage()", unit: "MB" }
    );

    this.rssHistogram = this.meter.createHistogram(
      "df.memory.rss_mb",
      { description: "RSS memory in MB from process.memoryUsage()", unit: "MB" }
    );

    this.externalHistogram = this.meter.createHistogram(
      "df.memory.external_mb",
      { description: "External memory in MB from process.memoryUsage()", unit: "MB" }
    );

    // ─── NEW payload instruments ─────────────────────────────────────────
    this.payloadInputBytesHistogram = this.meter.createHistogram(
      "df.payload.input_bytes",
      { description: "Size of activity input payload in bytes", unit: "bytes" }
    );

    this.payloadOutputBytesHistogram = this.meter.createHistogram(
      "df.payload.output_bytes",
      { description: "Size of activity output payload in bytes", unit: "bytes" }
    );
  }

  // ─── Existing methods (replicated from packages/shared) ─────────────────

  createActivitySpan(activityName: string, orchestrationInstanceId: string): Span {
    const span = this.tracer.startSpan(`activity:${activityName}`, {
      kind: SpanKind.INTERNAL,
      attributes: {
        "df.app_name": this.appName,
        "df.activity_name": activityName,
        "df.orchestration_instance_id": orchestrationInstanceId,
        "df.function_type": "activity",
        "cloud.role_name": this.appName,
      },
    });
    return span;
  }

  recordActivityCompletion(
    span: Span,
    activityName: string,
    durationMs: number,
    additionalAttributes?: Record<string, string | number>
  ): void {
    span.setAttributes({
      "df.execution_duration_ms": durationMs,
      ...additionalAttributes,
    });
    span.setStatus({ code: SpanStatusCode.OK });
    span.end();

    const attributes = {
      app_name: this.appName,
      activity_name: activityName,
    };

    this.activityDurationHistogram.record(durationMs, attributes);
    this.activityCompletedCounter.add(1, attributes);
  }

  recordActivityFailure(span: Span, activityName: string, error: Error): void {
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    span.recordException(error);
    span.end();
  }

  recordQueueDelay(activityName: string, scheduledTime: Date, startTime: Date): void {
    const delayMs = startTime.getTime() - scheduledTime.getTime();
    this.queueDelayHistogram.record(Math.max(0, delayMs), {
      app_name: this.appName,
      activity_name: activityName,
    });
  }

  createOrchestrationSpan(orchestrationName: string, instanceId: string): Span {
    const span = this.tracer.startSpan(`orchestration:${orchestrationName}`, {
      kind: SpanKind.INTERNAL,
      attributes: {
        "df.app_name": this.appName,
        "df.orchestration_name": orchestrationName,
        "df.orchestration_instance_id": instanceId,
        "df.function_type": "orchestrator",
        "cloud.role_name": this.appName,
      },
    });
    return span;
  }

  recordOrchestrationCompletion(
    span: Span,
    durationMs: number,
    activitiesCompleted: number
  ): void {
    span.setAttributes({
      "df.orchestration_duration_ms": durationMs,
      "df.activities_completed": activitiesCompleted,
    });
    span.setStatus({ code: SpanStatusCode.OK });
    span.end();

    this.orchestrationDurationHistogram.record(durationMs, {
      app_name: this.appName,
    });
    this.orchestrationCompletedCounter.add(1, {
      app_name: this.appName,
    });
  }

  recordOrchestrationFailure(span: Span, error: Error): void {
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    span.recordException(error);
    span.end();

    this.orchestrationFailedCounter.add(1, {
      app_name: this.appName,
    });
  }

  // ─── NEW method: memory and payload tracking ────────────────────────────

  /**
   * Records process.memoryUsage() and payload sizes after each activity execution.
   * This is the key metric for demonstrating OOM pressure in the inline pattern.
   */
  recordMemoryAndPayload(
    activityName: string,
    inputSizeBytes: number,
    outputSizeBytes: number,
    isExternalized: boolean
  ): void {
    const mem = process.memoryUsage();
    const attributes = {
      app_name: this.appName,
      activity_name: activityName,
      "df.payload_is_externalized": isExternalized ? "true" : "false",
    };

    // Record memory metrics
    this.heapUsedHistogram.record(mem.heapUsed / 1024 / 1024, attributes);
    this.heapTotalHistogram.record(mem.heapTotal / 1024 / 1024, attributes);
    this.rssHistogram.record(mem.rss / 1024 / 1024, attributes);
    this.externalHistogram.record(mem.external / 1024 / 1024, attributes);

    // Record payload size metrics
    this.payloadInputBytesHistogram.record(inputSizeBytes, attributes);
    this.payloadOutputBytesHistogram.record(outputSizeBytes, attributes);
  }
}

/**
 * Factory function to create a TelemetryHelper instance.
 */
export function createTelemetryHelper(appName: "inline-payloads" | "externalized-payloads"): TelemetryHelper {
  return new TelemetryHelper({ appName });
}
