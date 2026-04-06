import * as df from "durable-functions";
import {
  OrchestratorInput,
  OrchestratorOutput,
  BlobReadInput,
  BlobReadOutput,
  BlobTransformInput,
  BlobTransformOutput,
  BlobWriteInput,
  BlobWriteOutput,
} from "../types.js";

/**
 * Raw orchestrator handler — chains 3 sequential blob activities.
 * Exported as a standalone generator so apps can wrap it with telemetry.
 *
 * Registration is done by the consuming app via df.app.orchestration().
 */
export function* blobProcessingOrchestratorHandler(context: df.OrchestrationContext): Generator<df.Task, OrchestratorOutput, unknown> {
  const input = context.df.getInput() as OrchestratorInput;
  const instanceId = context.df.instanceId;

  // Activity 1: Read blob
  const readInput: BlobReadInput = {
    storageAccount: input.storageAccount,
    containerName: input.inputContainer,
    blobName: input.blobName,
    _scheduledTimeUtc: context.df.currentUtcDateTime.toISOString(),
    _orchestrationInstanceId: instanceId,
  };
  const readResult = (yield context.df.callActivity(
    "activity1BlobRead",
    readInput
  )) as BlobReadOutput;

  // Activity 2: Transform blob content
  const transformInput: BlobTransformInput = {
    content: readResult.content,
    blobName: readResult.blobName,
    metadata: readResult.metadata,
    _scheduledTimeUtc: context.df.currentUtcDateTime.toISOString(),
    _orchestrationInstanceId: instanceId,
  };
  const transformResult = (yield context.df.callActivity(
    "activity2BlobTransform",
    transformInput
  )) as BlobTransformOutput;

  // Activity 3: Write transformed content
  const outputBlobName = `processed-${input.blobName}`;
  const writeInput: BlobWriteInput = {
    storageAccount: input.storageAccount,
    containerName: input.outputContainer,
    blobName: outputBlobName,
    content: transformResult.transformedContent,
    metadata: {
      originalBlob: input.blobName,
      processedBy: instanceId,
    },
    _scheduledTimeUtc: context.df.currentUtcDateTime.toISOString(),
    _orchestrationInstanceId: instanceId,
  };
  const writeResult = (yield context.df.callActivity(
    "activity3BlobWrite",
    writeInput
  )) as BlobWriteOutput;

  const output: OrchestratorOutput = {
    instanceId,
    blobName: input.blobName,
    readResult,
    transformResult,
    writeResult,
  };

  return output;
}
