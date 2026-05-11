import * as df from "durable-functions";
import { TelemetryHelper } from "./telemetryHelper.js";
import { inlineOrchestratorHandler } from "../orchestrator/inlineOrchestrator.js";
import { externalizedOrchestratorHandler } from "../orchestrator/externalizedOrchestrator.js";
import { OomOrchestratorOutput } from "../types.js";

/**
 * Creates an instrumented inline orchestrator that wraps the raw orchestrator
 * with telemetry span creation and metrics recording.
 *
 * Uses context.df.isReplaying to guard telemetry emission.
 */
export function createInstrumentedInlineOrchestrator(
  telemetry: TelemetryHelper
): (context: df.OrchestrationContext) => Generator<df.Task, OomOrchestratorOutput, unknown> {
  return function* (context: df.OrchestrationContext): Generator<df.Task, OomOrchestratorOutput, unknown> {
    const instanceId = context.df.instanceId;
    const startTime = context.df.currentUtcDateTime.getTime();

    const span = !context.df.isReplaying
      ? telemetry.createOrchestrationSpan("inlineOrchestrator", instanceId)
      : null;

    try {
      const result: OomOrchestratorOutput = yield* inlineOrchestratorHandler(context);

      if (!context.df.isReplaying) {
        const durationMs = context.df.currentUtcDateTime.getTime() - startTime;
        const completionSpan = span ?? telemetry.createOrchestrationSpan("inlineOrchestrator", instanceId);
        telemetry.recordOrchestrationCompletion(completionSpan, durationMs, 3);
      }

      return result;
    } catch (error) {
      if (!context.df.isReplaying) {
        const failureSpan = span ?? telemetry.createOrchestrationSpan("inlineOrchestrator", instanceId);
        telemetry.recordOrchestrationFailure(failureSpan, error as Error);
      }
      throw error;
    }
  };
}

/**
 * Creates an instrumented externalized orchestrator that wraps the raw orchestrator
 * with telemetry span creation and metrics recording.
 *
 * Uses context.df.isReplaying to guard telemetry emission.
 */
export function createInstrumentedExternalizedOrchestrator(
  telemetry: TelemetryHelper
): (context: df.OrchestrationContext) => Generator<df.Task, OomOrchestratorOutput, unknown> {
  return function* (context: df.OrchestrationContext): Generator<df.Task, OomOrchestratorOutput, unknown> {
    const instanceId = context.df.instanceId;
    const startTime = context.df.currentUtcDateTime.getTime();

    const span = !context.df.isReplaying
      ? telemetry.createOrchestrationSpan("externalizedOrchestrator", instanceId)
      : null;

    try {
      const result: OomOrchestratorOutput = yield* externalizedOrchestratorHandler(context);

      if (!context.df.isReplaying) {
        const durationMs = context.df.currentUtcDateTime.getTime() - startTime;
        const completionSpan = span ?? telemetry.createOrchestrationSpan("externalizedOrchestrator", instanceId);
        telemetry.recordOrchestrationCompletion(completionSpan, durationMs, 3);
      }

      return result;
    } catch (error) {
      if (!context.df.isReplaying) {
        const failureSpan = span ?? telemetry.createOrchestrationSpan("externalizedOrchestrator", instanceId);
        telemetry.recordOrchestrationFailure(failureSpan, error as Error);
      }
      throw error;
    }
  };
}
