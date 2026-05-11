import { InvocationContext } from "@azure/functions";
import { TransformerInput, TransformerOutput } from "../types.js";
import { BlobPayloadManager } from "../blobPayloadManager.js";

/**
 * dataTransformer — transforms data to final output format, re-serializes as JSON.
 * This is the final activity in the chain. It produces the output that gets written
 * back to blob storage (in a real scenario) or returned to the orchestrator.
 */
export async function dataTransformer(
  input: TransformerInput,
  context: InvocationContext
): Promise<TransformerOutput> {
  context.log(`dataTransformer: transforming data for output ${input.outputBlobName}`);

  // Resolve input data: either inline or from blob reference
  let data: Record<string, unknown>;
  if (input.data) {
    data = input.data;
  } else if (input.blobRef) {
    const manager = new BlobPayloadManager(input.storageAccount, input.blobRef.container);
    data = (await manager.retrieve(input.blobRef)) as Record<string, unknown>;
  } else {
    throw new Error("dataTransformer: either data or blobRef must be provided");
  }

  const inputJson = JSON.stringify(data);
  const inputSizeBytes = Buffer.byteLength(inputJson, "utf-8");

  // Transform: normalize, flatten certain fields, add output metadata
  const transformed = transformData(data);
  const fieldsTransformed = Object.keys(transformed).length;

  const outputJson = JSON.stringify(transformed);
  const outputSizeBytes = Buffer.byteLength(outputJson, "utf-8");

  return {
    data: transformed,
    inputSizeBytes,
    outputSizeBytes,
    fieldsTransformed,
    outputBlobName: input.outputBlobName,
  };
}

/**
 * Transforms data into final output format:
 * - Sorts keys alphabetically
 * - Flattens nested _enrichmentMetadata and _resolutionSummary into top level
 * - Adds final output metadata
 */
function transformData(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Sort keys for deterministic output
  const sortedKeys = Object.keys(data).sort();
  for (const key of sortedKeys) {
    const value = data[key];
    // Flatten specific metadata objects to top level with prefix
    if (key === "_enrichmentMetadata" && typeof value === "object" && value !== null) {
      for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
        result[`enrichment_${subKey}`] = subValue;
      }
    } else if (key === "_resolutionSummary" && typeof value === "object" && value !== null) {
      for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
        result[`resolution_${subKey}`] = subValue;
      }
    } else {
      result[key] = value;
    }
  }

  // Add final output metadata
  result["_transformedAt"] = new Date().toISOString();
  result["_transformVersion"] = "1.0.0";
  result["_outputFormat"] = "normalized-json-v1";
  result["_totalFields"] = Object.keys(result).length + 1;

  return result;
}
