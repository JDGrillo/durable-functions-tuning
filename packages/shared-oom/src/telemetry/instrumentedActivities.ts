import { InvocationContext } from "@azure/functions";
import { TelemetryHelper } from "./telemetryHelper.js";
import {
  EnricherInput,
  EnricherOutput,
  ResolverInput,
  ResolverOutput,
  TransformerInput,
  TransformerOutput,
} from "../types.js";
import { dataEnricher } from "../activities/dataEnricher.js";
import { expressionResolver } from "../activities/expressionResolver.js";
import { dataTransformer } from "../activities/dataTransformer.js";

/**
 * Wraps dataEnricher with telemetry instrumentation.
 * Pattern matches packages/shared/src/telemetry/instrumentedActivities.ts exactly.
 */
export async function instrumentedDataEnricher(
  input: EnricherInput,
  context: InvocationContext,
  telemetry: TelemetryHelper
): Promise<EnricherOutput> {
  const instanceId = input._orchestrationInstanceId ?? (context.triggerMetadata?.instanceId as string) ?? "unknown";
  const span = telemetry.createActivitySpan("dataEnricher", instanceId);
  const startTime = Date.now();

  if (input._scheduledTimeUtc) {
    telemetry.recordQueueDelay("dataEnricher", new Date(input._scheduledTimeUtc), new Date(startTime));
  }

  try {
    const result = await dataEnricher(input, context);
    const durationMs = Date.now() - startTime;

    telemetry.recordActivityCompletion(span, "dataEnricher", durationMs, {
      "df.input_size_bytes": result.inputSizeBytes,
      "df.output_size_bytes": result.outputSizeBytes,
      "df.fields_added": result.fieldsAdded,
    });

    // Record memory and payload metrics
    const isExternalized = !!input.blobRef;
    telemetry.recordMemoryAndPayload("dataEnricher", result.inputSizeBytes, result.outputSizeBytes, isExternalized);

    return result;
  } catch (error) {
    telemetry.recordActivityFailure(span, "dataEnricher", error as Error);
    throw error;
  }
}

/**
 * Wraps expressionResolver with telemetry instrumentation.
 */
export async function instrumentedExpressionResolver(
  input: ResolverInput,
  context: InvocationContext,
  telemetry: TelemetryHelper
): Promise<ResolverOutput> {
  const instanceId = input._orchestrationInstanceId ?? (context.triggerMetadata?.instanceId as string) ?? "unknown";
  const span = telemetry.createActivitySpan("expressionResolver", instanceId);
  const startTime = Date.now();

  if (input._scheduledTimeUtc) {
    telemetry.recordQueueDelay("expressionResolver", new Date(input._scheduledTimeUtc), new Date(startTime));
  }

  try {
    const result = await expressionResolver(input, context);
    const durationMs = Date.now() - startTime;

    telemetry.recordActivityCompletion(span, "expressionResolver", durationMs, {
      "df.input_size_bytes": result.inputSizeBytes,
      "df.output_size_bytes": result.outputSizeBytes,
      "df.expressions_resolved": result.expressionsResolved,
    });

    const isExternalized = !!input.blobRef;
    telemetry.recordMemoryAndPayload("expressionResolver", result.inputSizeBytes, result.outputSizeBytes, isExternalized);

    return result;
  } catch (error) {
    telemetry.recordActivityFailure(span, "expressionResolver", error as Error);
    throw error;
  }
}

/**
 * Wraps dataTransformer with telemetry instrumentation.
 */
export async function instrumentedDataTransformer(
  input: TransformerInput,
  context: InvocationContext,
  telemetry: TelemetryHelper
): Promise<TransformerOutput> {
  const instanceId = input._orchestrationInstanceId ?? (context.triggerMetadata?.instanceId as string) ?? "unknown";
  const span = telemetry.createActivitySpan("dataTransformer", instanceId);
  const startTime = Date.now();

  if (input._scheduledTimeUtc) {
    telemetry.recordQueueDelay("dataTransformer", new Date(input._scheduledTimeUtc), new Date(startTime));
  }

  try {
    const result = await dataTransformer(input, context);
    const durationMs = Date.now() - startTime;

    telemetry.recordActivityCompletion(span, "dataTransformer", durationMs, {
      "df.input_size_bytes": result.inputSizeBytes,
      "df.output_size_bytes": result.outputSizeBytes,
      "df.fields_transformed": result.fieldsTransformed,
    });

    const isExternalized = !!input.blobRef;
    telemetry.recordMemoryAndPayload("dataTransformer", result.inputSizeBytes, result.outputSizeBytes, isExternalized);

    return result;
  } catch (error) {
    telemetry.recordActivityFailure(span, "dataTransformer", error as Error);
    throw error;
  }
}
