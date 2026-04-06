// Activity and orchestrator input/output type definitions

export interface BlobReadInput {
  storageAccount: string;
  containerName: string;
  blobName: string;
  _scheduledTimeUtc?: string;
  _orchestrationInstanceId?: string;
}

export interface BlobReadOutput {
  content: string;
  contentLength: number;
  contentType: string;
  blobName: string;
  metadata: Record<string, string>;
}

export interface BlobTransformInput {
  content: string;
  blobName: string;
  metadata: Record<string, string>;
  _scheduledTimeUtc?: string;
  _orchestrationInstanceId?: string;
}

export interface BlobTransformOutput {
  transformedContent: string;
  originalSize: number;
  transformedSize: number;
  blobName: string;
  fieldsProcessed: number;
}

export interface BlobWriteInput {
  storageAccount: string;
  containerName: string;
  blobName: string;
  content: string;
  metadata: Record<string, string>;
  _scheduledTimeUtc?: string;
  _orchestrationInstanceId?: string;
}

export interface BlobWriteOutput {
  blobName: string;
  containerName: string;
  contentLength: number;
  etag: string;
  written: boolean;
}

export interface OrchestratorInput {
  storageAccount: string;
  inputContainer: string;
  outputContainer: string;
  blobName: string;
}

export interface OrchestratorOutput {
  instanceId: string;
  blobName: string;
  readResult: BlobReadOutput;
  transformResult: BlobTransformOutput;
  writeResult: BlobWriteOutput;
}
