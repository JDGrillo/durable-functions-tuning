import * as df from "durable-functions";
import { TelemetryHelper } from "./telemetryHelper.js";
import { blobProcessingOrchestratorHandler } from "../orchestrator/blobProcessingOrchestrator.js";
import { OrchestratorOutput } from "../types.js";

/**
 * Creates an instrumented orchestrator handler that wraps the raw orchestrator
 * with telemetry span creation and metrics recording.
 *
 * Uses context.df.isReplaying to guard telemetry emission — only emits on the
 * final (non-replay) execution to avoid duplicate spans/metrics.
 *
 * Usage in app index.ts:
 *   df.app.orchestration("blobProcessingOrchestrator",
 *     createInstrumentedOrchestrator(telemetry)
 *   );
 */
export function createInstrumentedOrchestrator(
  telemetry: TelemetryHelper
): (context: df.OrchestrationContext) => Generator<df.Task, OrchestratorOutput, unknown> {
  return function* (context: df.OrchestrationContext): Generator<df.Task, OrchestratorOutput, unknown> {
    const instanceId = context.df.instanceId;
    const startTime = context.df.currentUtcDateTime.getTime();

    // Create span only on non-replay to avoid duplicates
    const span = !context.df.isReplaying
      ? telemetry.createOrchestrationSpan("blobProcessingOrchestrator", instanceId)
      : null;

    try {
      // Delegate to the raw orchestrator handler
      const result: OrchestratorOutput = yield* blobProcessingOrchestratorHandler(context);

      // After all yields complete, isReplaying is false — record completion
      if (!context.df.isReplaying) {
        const durationMs = context.df.currentUtcDateTime.getTime() - startTime;
        const completionSpan = span ?? telemetry.createOrchestrationSpan("blobProcessingOrchestrator", instanceId);
        telemetry.recordOrchestrationCompletion(completionSpan, durationMs, 3);
      }

      return result;
    } catch (error) {
      if (!context.df.isReplaying) {
        const failureSpan = span ?? telemetry.createOrchestrationSpan("blobProcessingOrchestrator", instanceId);
        telemetry.recordOrchestrationFailure(failureSpan, error as Error);
      }
      throw error;
    }
  };
}
