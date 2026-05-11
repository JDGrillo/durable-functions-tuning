import { InvocationContext } from "@azure/functions";
import { ResolverInput, ResolverOutput } from "../types.js";
import { BlobPayloadManager } from "../blobPayloadManager.js";

/**
 * expressionResolver — iterates over expression fields in the data, resolves/evaluates them.
 * Simulates a real-world pattern where data contains expression placeholders that must
 * be resolved by evaluating them against the data context.
 * Payload size stays roughly the same or grows slightly.
 */
export async function expressionResolver(
  input: ResolverInput,
  context: InvocationContext
): Promise<ResolverOutput> {
  context.log(`expressionResolver: resolving expressions`);

  // Resolve input data: either inline or from blob reference
  let data: Record<string, unknown>;
  if (input.data) {
    data = input.data;
  } else if (input.blobRef) {
    const manager = new BlobPayloadManager(input.storageAccount, input.blobRef.container);
    data = (await manager.retrieve(input.blobRef)) as Record<string, unknown>;
  } else {
    throw new Error("expressionResolver: either data or blobRef must be provided");
  }

  const inputJson = JSON.stringify(data);
  const inputSizeBytes = Buffer.byteLength(inputJson, "utf-8");

  // Resolve "expressions" — simulate evaluating template/expression fields
  const resolved = resolveExpressions(data);
  const expressionsResolved = countResolved(data, resolved);

  const outputJson = JSON.stringify(resolved);
  const outputSizeBytes = Buffer.byteLength(outputJson, "utf-8");

  return {
    data: resolved,
    inputSizeBytes,
    outputSizeBytes,
    expressionsResolved,
  };
}

/**
 * Simulates resolving expressions in the data.
 * Walks the object tree and "resolves" string values that look like expressions
 * (e.g., template strings, computed values) by expanding them.
 */
function resolveExpressions(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string" && (value.startsWith("${") || value.includes("{{") || key.startsWith("_"))) {
      // "Resolve" expression by expanding it with metadata
      result[key] = value;
      result[`${key}_resolved`] = true;
      result[`${key}_resolvedAt`] = new Date().toISOString();
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      result[key] = resolveExpressions(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) => {
        if (typeof item === "object" && item !== null) {
          return resolveExpressions(item as Record<string, unknown>);
        }
        return item;
      });
    } else {
      result[key] = value;
    }
  }

  // Add resolution summary
  result["_resolutionSummary"] = {
    totalFields: Object.keys(obj).length,
    resolvedFields: Object.keys(result).length,
    timestamp: Date.now(),
  };

  return result;
}

function countResolved(original: Record<string, unknown>, resolved: Record<string, unknown>): number {
  return Object.keys(resolved).length - Object.keys(original).length;
}
