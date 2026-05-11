// Type definitions for OOM payload comparison activities and orchestrators

// ─── Blob reference for externalized payload pattern ─────────────────────
export interface BlobReference {
  uri: string;
  container: string;
  blobName: string;
  sizeBytes: number;
}

// ─── Activity input/output types ─────────────────────────────────────────

export interface EnricherInput {
  storageAccount: string;
  containerName: string;
  blobName: string;
  /** When provided, activity reads data from blob. When data is inline, this is the raw payload. */
  data?: Record<string, unknown>;
  /** Blob reference for externalized pattern — activity retrieves data from blob */
  blobRef?: BlobReference;
  _scheduledTimeUtc?: string;
  _orchestrationInstanceId?: string;
}

export interface EnricherOutput {
  data: Record<string, unknown>;
  inputSizeBytes: number;
  outputSizeBytes: number;
  fieldsAdded: number;
}

export interface ResolverInput {
  data?: Record<string, unknown>;
  blobRef?: BlobReference;
  storageAccount: string;
  containerName: string;
  _scheduledTimeUtc?: string;
  _orchestrationInstanceId?: string;
}

export interface ResolverOutput {
  data: Record<string, unknown>;
  inputSizeBytes: number;
  outputSizeBytes: number;
  expressionsResolved: number;
}

export interface TransformerInput {
  data?: Record<string, unknown>;
  blobRef?: BlobReference;
  storageAccount: string;
  containerName: string;
  outputBlobName: string;
  _scheduledTimeUtc?: string;
  _orchestrationInstanceId?: string;
}

export interface TransformerOutput {
  data: Record<string, unknown>;
  inputSizeBytes: number;
  outputSizeBytes: number;
  fieldsTransformed: number;
  outputBlobName: string;
}

// ─── Orchestrator types ──────────────────────────────────────────────────

export interface OomOrchestratorInput {
  storageAccount: string;
  inputContainer: string;
  outputContainer: string;
  blobName: string;
  /** For externalized pattern: container for intermediate payloads */
  intermediateContainer?: string;
}

export interface OomOrchestratorOutput {
  instanceId: string;
  blobName: string;
  enricherResult: EnricherOutput;
  resolverResult: ResolverOutput;
  transformerResult: TransformerOutput;
}

// ─── ContinueAsNew sub-orchestrator types ────────────────────────────────

export interface BatchOrchestratorInput {
  storageAccount: string;
  inputContainer: string;
  outputContainer: string;
  intermediateContainer: string;
  blobNames: string[];
  batchSize: number;
  /** Index into blobNames where this continuation starts */
  startIndex: number;
  processedCount: number;
}

export interface BatchOrchestratorOutput {
  instanceId: string;
  totalProcessed: number;
  results: OomOrchestratorOutput[];
}
