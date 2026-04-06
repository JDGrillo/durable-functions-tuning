import { InvocationContext } from "@azure/functions";
import { TelemetryHelper } from "./telemetryHelper.js";
import {
  BlobReadInput,
  BlobReadOutput,
  BlobTransformInput,
  BlobTransformOutput,
  BlobWriteInput,
  BlobWriteOutput,
} from "../types.js";
import { activity1BlobRead } from "../activities/activity1BlobRead.js";
import { activity2BlobTransform } from "../activities/activity2BlobTransform.js";
import { activity3BlobWrite } from "../activities/activity3BlobWrite.js";

/**
 * Wraps activity1BlobRead with telemetry instrumentation.
 * Activities do NOT replay, so no isReplaying guard needed.
 */
export async function instrumentedActivity1BlobRead(
  input: BlobReadInput,
  context: InvocationContext,
  telemetry: TelemetryHelper
): Promise<BlobReadOutput> {
  const instanceId = input._orchestrationInstanceId ?? (context.triggerMetadata?.instanceId as string) ?? "unknown";
  const span = telemetry.createActivitySpan("activity1BlobRead", instanceId);
  const startTime = Date.now();

  if (input._scheduledTimeUtc) {
    telemetry.recordQueueDelay("activity1BlobRead", new Date(input._scheduledTimeUtc), new Date(startTime));
  }

  try {
    const result = await activity1BlobRead(input, context);
    const durationMs = Date.now() - startTime;

    telemetry.recordActivityCompletion(span, "activity1BlobRead", durationMs, {
      "df.blob_size": result.contentLength,
      "df.operation_type": "read",
      "df.blob_name": input.blobName,
    });

    return result;
  } catch (error) {
    telemetry.recordActivityFailure(span, "activity1BlobRead", error as Error);
    throw error;
  }
}

/**
 * Wraps activity2BlobTransform with telemetry instrumentation.
 */
export async function instrumentedActivity2BlobTransform(
  input: BlobTransformInput,
  context: InvocationContext,
  telemetry: TelemetryHelper
): Promise<BlobTransformOutput> {
  const instanceId = input._orchestrationInstanceId ?? (context.triggerMetadata?.instanceId as string) ?? "unknown";
  const span = telemetry.createActivitySpan("activity2BlobTransform", instanceId);
  const startTime = Date.now();

  if (input._scheduledTimeUtc) {
    telemetry.recordQueueDelay("activity2BlobTransform", new Date(input._scheduledTimeUtc), new Date(startTime));
  }

  try {
    const result = await activity2BlobTransform(input, context);
    const durationMs = Date.now() - startTime;

    telemetry.recordActivityCompletion(span, "activity2BlobTransform", durationMs, {
      "df.blob_size": result.transformedSize,
      "df.operation_type": "transform",
      "df.fields_processed": result.fieldsProcessed,
    });

    return result;
  } catch (error) {
    telemetry.recordActivityFailure(span, "activity2BlobTransform", error as Error);
    throw error;
  }
}

/**
 * Wraps activity3BlobWrite with telemetry instrumentation.
 */
export async function instrumentedActivity3BlobWrite(
  input: BlobWriteInput,
  context: InvocationContext,
  telemetry: TelemetryHelper
): Promise<BlobWriteOutput> {
  const instanceId = input._orchestrationInstanceId ?? (context.triggerMetadata?.instanceId as string) ?? "unknown";
  const span = telemetry.createActivitySpan("activity3BlobWrite", instanceId);
  const startTime = Date.now();

  if (input._scheduledTimeUtc) {
    telemetry.recordQueueDelay("activity3BlobWrite", new Date(input._scheduledTimeUtc), new Date(startTime));
  }

  try {
    const result = await activity3BlobWrite(input, context);
    const durationMs = Date.now() - startTime;

    telemetry.recordActivityCompletion(span, "activity3BlobWrite", durationMs, {
      "df.blob_size": result.contentLength,
      "df.operation_type": "write",
      "df.blob_name": input.blobName,
    });

    return result;
  } catch (error) {
    telemetry.recordActivityFailure(span, "activity3BlobWrite", error as Error);
    throw error;
  }
}
