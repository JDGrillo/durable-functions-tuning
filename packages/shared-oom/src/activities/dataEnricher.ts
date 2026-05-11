import { InvocationContext } from "@azure/functions";
import { EnricherInput, EnricherOutput, BlobReference } from "../types.js";
import { BlobPayloadManager } from "../blobPayloadManager.js";
import { getBlobServiceClient } from "../blobClient.js";

/**
 * dataEnricher — reads input data, adds enrichment fields (timestamps, computed fields,
 * cross-references), increasing payload size by ~50%.
 * Accepts either inline data or a blob reference (externalized pattern).
 */
export async function dataEnricher(
  input: EnricherInput,
  context: InvocationContext
): Promise<EnricherOutput> {
  context.log(`dataEnricher: processing blob ${input.blobName}`);

  // Resolve input data: either inline or from blob reference
  let data: Record<string, unknown>;
  if (input.data) {
    data = input.data;
  } else if (input.blobRef) {
    const manager = new BlobPayloadManager(input.storageAccount, input.blobRef.container);
    data = (await manager.retrieve(input.blobRef)) as Record<string, unknown>;
  } else {
    // Read from blob storage directly (initial read)
    const blobServiceClient = getBlobServiceClient(input.storageAccount);
    const containerClient = blobServiceClient.getContainerClient(input.containerName);
    const blobClient = containerClient.getBlobClient(input.blobName);
    const downloadResponse = await blobClient.download(0);
    const content = await streamToString(downloadResponse.readableStreamBody!);
    data = JSON.parse(content);
  }

  const inputJson = JSON.stringify(data);
  const inputSizeBytes = Buffer.byteLength(inputJson, "utf-8");

  // Enrichment: add computed fields, timestamps, cross-references to grow payload
  const enriched: Record<string, unknown> = {
    ...data,
    _enrichedAt: new Date().toISOString(),
    _enrichmentVersion: "1.0.0",
    _sourceBlob: input.blobName,
    _correlationId: input._orchestrationInstanceId ?? "unknown",
    _fieldCount: Object.keys(data).length,
    _checksums: generateChecksums(data),
    _crossReferences: generateCrossReferences(data),
    _enrichmentMetadata: {
      processor: "dataEnricher",
      timestamp: Date.now(),
      inputFields: Object.keys(data).length,
      nestedDepth: calculateDepth(data),
    },
  };

  const outputJson = JSON.stringify(enriched);
  const outputSizeBytes = Buffer.byteLength(outputJson, "utf-8");
  const fieldsAdded = Object.keys(enriched).length - Object.keys(data).length;

  return {
    data: enriched,
    inputSizeBytes,
    outputSizeBytes,
    fieldsAdded,
  };
}

function generateChecksums(data: Record<string, unknown>): Record<string, number> {
  const checksums: Record<string, number> = {};
  for (const [key, value] of Object.entries(data)) {
    const str = JSON.stringify(value);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    checksums[key] = hash;
  }
  return checksums;
}

function generateCrossReferences(data: Record<string, unknown>): Record<string, string[]> {
  const refs: Record<string, string[]> = {};
  const keys = Object.keys(data);
  for (const key of keys) {
    // For each field, track which other fields reference similar types
    const value = data[key];
    const type = Array.isArray(value) ? "array" : typeof value;
    if (!refs[type]) refs[type] = [];
    refs[type].push(key);
  }
  return refs;
}

function calculateDepth(obj: unknown, current = 0): number {
  if (obj === null || typeof obj !== "object") return current;
  let maxDepth = current;
  for (const value of Object.values(obj as Record<string, unknown>)) {
    maxDepth = Math.max(maxDepth, calculateDepth(value, current + 1));
  }
  return maxDepth;
}

async function streamToString(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(new Uint8Array(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
  }
  return Buffer.concat(chunks).toString("utf-8");
}
