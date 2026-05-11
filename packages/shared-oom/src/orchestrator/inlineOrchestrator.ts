import * as df from "durable-functions";
import {
  OomOrchestratorInput,
  OomOrchestratorOutput,
  EnricherInput,
  EnricherOutput,
  ResolverInput,
  ResolverOutput,
  TransformerInput,
  TransformerOutput,
} from "../types.js";

/**
 * Inline orchestrator — chains dataEnricher → expressionResolver → dataTransformer,
 * passing FULL payload data inline as activity inputs/outputs.
 *
 * This is the OOM ANTI-PATTERN. Each activity receives the full data object, processes it,
 * and returns the full result inline. With 200KB-1.6MB payloads, each orchestration holds
 * 3x the payload in its history for replay, causing memory pressure under concurrency.
 */
export function* inlineOrchestratorHandler(
  context: df.OrchestrationContext
): Generator<df.Task, OomOrchestratorOutput, unknown> {
  const input = context.df.getInput() as OomOrchestratorInput;
  const instanceId = context.df.instanceId;

  // Activity 1: Enrich data — reads from blob, returns FULL enriched payload inline
  const enricherInput: EnricherInput = {
    storageAccount: input.storageAccount,
    containerName: input.inputContainer,
    blobName: input.blobName,
    _scheduledTimeUtc: context.df.currentUtcDateTime.toISOString(),
    _orchestrationInstanceId: instanceId,
  };
  const enricherResult = (yield context.df.callActivity(
    "dataEnricher",
    enricherInput
  )) as EnricherOutput;

  // Activity 2: Resolve expressions — takes FULL enriched data inline, returns FULL resolved data inline
  const resolverInput: ResolverInput = {
    data: enricherResult.data, // ← FULL PAYLOAD INLINE (anti-pattern)
    storageAccount: input.storageAccount,
    containerName: input.inputContainer,
    _scheduledTimeUtc: context.df.currentUtcDateTime.toISOString(),
    _orchestrationInstanceId: instanceId,
  };
  const resolverResult = (yield context.df.callActivity(
    "expressionResolver",
    resolverInput
  )) as ResolverOutput;

  // Activity 3: Transform data — takes FULL resolved data inline, returns FULL transformed data inline
  const transformerInput: TransformerInput = {
    data: resolverResult.data, // ← FULL PAYLOAD INLINE (anti-pattern)
    storageAccount: input.storageAccount,
    containerName: input.outputContainer,
    outputBlobName: `processed-${input.blobName}`,
    _scheduledTimeUtc: context.df.currentUtcDateTime.toISOString(),
    _orchestrationInstanceId: instanceId,
  };
  const transformerResult = (yield context.df.callActivity(
    "dataTransformer",
    transformerInput
  )) as TransformerOutput;

  return {
    instanceId,
    blobName: input.blobName,
    enricherResult,
    resolverResult,
    transformerResult,
  };
}
