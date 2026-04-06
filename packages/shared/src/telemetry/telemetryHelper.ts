import { trace, metrics, context as otelContext, SpanStatusCode, Span, SpanKind } from "@opentelemetry/api";
import type { Histogram, Counter } from "@opentelemetry/api";

const TRACER_NAME = "df-comparison";
const METER_NAME = "df-comparison";

export interface TelemetryConfig {
  appName: "baseline" | "tuned";
}

export class TelemetryHelper {
  private readonly appName: string;
  private readonly tracer;
  private readonly meter;

  // Metrics instruments
  private readonly activityDurationHistogram: Histogram;
  private readonly queueDelayHistogram: Histogram;
  private readonly orchestrationDurationHistogram: Histogram;
  private readonly activityCompletedCounter: Counter;
  private readonly orchestrationCompletedCounter: Counter;
  private readonly orchestrationFailedCounter: Counter;

  constructor(config: TelemetryConfig) {
    this.appName = config.appName;
    this.tracer = trace.getTracer(TRACER_NAME);
    this.meter = metrics.getMeter(METER_NAME);

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
  }

  /**
   * Creates a span for an activity function execution.
   * Activities do NOT replay, so no replay guard needed.
   */
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

  /**
   * Records the completion of an activity with duration and custom dimensions.
   */
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

  /**
   * Records an activity failure.
   */
  recordActivityFailure(span: Span, activityName: string, error: Error): void {
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    span.recordException(error);
    span.end();
  }

  /**
   * Records queue delay — time between activity being scheduled and starting execution.
   */
  recordQueueDelay(activityName: string, scheduledTime: Date, startTime: Date): void {
    const delayMs = startTime.getTime() - scheduledTime.getTime();
    this.queueDelayHistogram.record(Math.max(0, delayMs), {
      app_name: this.appName,
      activity_name: activityName,
    });
  }

  /**
   * Creates a parent span for an entire orchestration.
   * MUST be called with isReplaying guard — only on non-replay executions.
   */
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

  /**
   * Records orchestration completion.
   */
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

  /**
   * Records orchestration failure.
   */
  recordOrchestrationFailure(span: Span, error: Error): void {
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    span.recordException(error);
    span.end();

    this.orchestrationFailedCounter.add(1, {
      app_name: this.appName,
    });
  }
}

/**
 * Factory function to create a TelemetryHelper instance.
 */
export function createTelemetryHelper(appName: "baseline" | "tuned"): TelemetryHelper {
  return new TelemetryHelper({ appName });
}
