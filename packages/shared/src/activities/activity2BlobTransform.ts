import { InvocationContext } from "@azure/functions";
import { BlobTransformInput, BlobTransformOutput } from "../types.js";

export async function activity2BlobTransform(
  input: BlobTransformInput,
  context: InvocationContext
): Promise<BlobTransformOutput> {
  context.log(`activity2BlobTransform: transforming blob ${input.blobName}`);

  const originalSize = Buffer.byteLength(input.content, "utf-8");

  // Parse, enrich, and re-serialize the content
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(input.content);
  } catch {
    // If content is not JSON, wrap it
    parsed = { rawContent: input.content };
  }

  // Enrichment: add processing metadata
  const enriched: Record<string, unknown> = {
    ...parsed,
    _processed: true,
    _processedAt: new Date().toISOString(),
    _originalBlobName: input.blobName,
    _originalMetadata: input.metadata,
    _fieldCount: Object.keys(parsed).length,
  };

  // Simulate a compute step: sort keys and re-serialize
  const sortedKeys = Object.keys(enriched).sort();
  const sorted: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    sorted[key] = enriched[key];
  }

  const transformedContent = JSON.stringify(sorted, null, 2);
  const transformedSize = Buffer.byteLength(transformedContent, "utf-8");

  return {
    transformedContent,
    originalSize,
    transformedSize,
    blobName: input.blobName,
    fieldsProcessed: sortedKeys.length,
  };
}
