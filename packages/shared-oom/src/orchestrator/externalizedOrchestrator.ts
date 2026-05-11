import * as df from "durable-functions";
import {
  OomOrchestratorInput,
  OomOrchestratorOutput,
  BatchOrchestratorInput,
  BatchOrchestratorOutput,
  EnricherInput,
  EnricherOutput,
  ResolverInput,
  ResolverOutput,
  TransformerInput,
  TransformerOutput,
  BlobReference,
} from "../types.js";

/**
 * Externalized orchestrator — same 3-activity chain as inline, but wraps payloads.
 *
 * BEST PRACTICE PATTERN:
 * - Activities return BlobReference objects (~200 bytes) instead of full data
 * - Activities internally store results to blob and return only the reference
 * - Orchestration history stays small regardless of payload size
 * - Combined with reduced concurrency and continueAsNew for long-running scenarios
 */
export function* externalizedOrchestratorHandler(
  context: df.OrchestrationContext
): Generator<df.Task, OomOrchestratorOutput, unknown> {
  const input = context.df.getInput() as OomOrchestratorInput;
  const instanceId = context.df.instanceId;
  const intermediateContainer = input.intermediateContainer ?? "intermediate-payloads";

  // Activity 1: Enrich data — reads from blob, stores enriched result in intermediate blob,
  // returns BlobReference (~200 bytes) through orchestration I/O
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

  // Store enricher output to blob, get reference
  const enricherBlobRef: BlobReference = (yield context.df.callActivity(
    "storePayload",
    {
      storageAccount: input.storageAccount,
      containerName: intermediateContainer,
      instanceId,
      label: "enriched",
      data: enricherResult.data,
    }
  )) as BlobReference;

  // Activity 2: Resolve expressions — receives BlobReference, not full data
  const resolverInput: ResolverInput = {
    blobRef: enricherBlobRef, // ← BLOB REFERENCE ONLY (~200 bytes)
    storageAccount: input.storageAccount,
    containerName: intermediateContainer,
    _scheduledTimeUtc: context.df.currentUtcDateTime.toISOString(),
    _orchestrationInstanceId: instanceId,
  };
  const resolverResult = (yield context.df.callActivity(
    "expressionResolver",
    resolverInput
  )) as ResolverOutput;

  // Store resolver output to blob, get reference
  const resolverBlobRef: BlobReference = (yield context.df.callActivity(
    "storePayload",
    {
      storageAccount: input.storageAccount,
      containerName: intermediateContainer,
      instanceId,
      label: "resolved",
      data: resolverResult.data,
    }
  )) as BlobReference;

  // Activity 3: Transform data — receives BlobReference, not full data
  const transformerInput: TransformerInput = {
    blobRef: resolverBlobRef, // ← BLOB REFERENCE ONLY (~200 bytes)
    storageAccount: input.storageAccount,
    containerName: intermediateContainer,
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
    enricherResult: { ...enricherResult, data: {} }, // Don't return full data in orchestration output
    resolverResult: { ...resolverResult, data: {} },
    transformerResult: { ...transformerResult, data: {} },
  };
}

/**
 * Batch sub-orchestrator with continueAsNew — processes items in batches,
 * then calls continueAsNew to reset orchestration history.
 *
 * This prevents unbounded event history accumulation in long-running orchestrations.
 * Each batch processes batchSize items, then continues as new with updated state.
 */
export function* batchSubOrchestratorHandler(
  context: df.OrchestrationContext
): Generator<df.Task, BatchOrchestratorOutput, unknown> {
  const input = context.df.getInput() as BatchOrchestratorInput;
  const instanceId = context.df.instanceId;

  const results: OomOrchestratorOutput[] = [];
  const endIndex = Math.min(input.startIndex + input.batchSize, input.blobNames.length);

  // Process current batch
  for (let i = input.startIndex; i < endIndex; i++) {
    const blobName = input.blobNames[i];
    const orchestratorInput: OomOrchestratorInput = {
      storageAccount: input.storageAccount,
      inputContainer: input.inputContainer,
      outputContainer: input.outputContainer,
      blobName,
      intermediateContainer: input.intermediateContainer,
    };

    // Call the externalized orchestrator as a sub-orchestration for each item
    const result = (yield context.df.callSubOrchestrator(
      "externalizedOrchestrator",
      orchestratorInput,
      `${instanceId}-item-${i}`
    )) as OomOrchestratorOutput;

    results.push(result);
  }

  const totalProcessed = input.processedCount + results.length;

  // If more items remain, continueAsNew to reset history
  if (endIndex < input.blobNames.length) {
    const continuationInput: BatchOrchestratorInput = {
      ...input,
      startIndex: endIndex,
      processedCount: totalProcessed,
    };
    context.df.continueAsNew(continuationInput);
    // This return is unreachable but satisfies TypeScript
    return { instanceId, totalProcessed, results };
  }

  // All items processed
  return {
    instanceId,
    totalProcessed,
    results,
  };
}
