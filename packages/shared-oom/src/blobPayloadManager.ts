import { BlobServiceClient, ContainerClient } from "@azure/storage-blob";
import { BlobReference } from "./types.js";
import { getBlobServiceClient } from "./blobClient.js";

/**
 * Manages externalized payloads in Blob Storage.
 * Used by the externalized orchestrator to store/retrieve intermediate payloads
 * between activities, passing only BlobReference (~200 bytes) through orchestration history.
 */
export class BlobPayloadManager {
  private readonly containerClient: ContainerClient;
  private containerEnsured = false;

  constructor(storageAccount: string, containerName: string) {
    const blobServiceClient = getBlobServiceClient(storageAccount);
    this.containerClient = blobServiceClient.getContainerClient(containerName);
  }

  /**
   * Serializes data to JSON, uploads to blob, returns a BlobReference.
   * The BlobReference is small (~200 bytes) and safe to pass through orchestration I/O.
   */
  async store(data: unknown, instanceId: string, label: string): Promise<BlobReference> {
    await this.ensureContainer();

    const blobName = `${instanceId}/${label}-${Date.now()}.json`;
    const content = JSON.stringify(data);
    const contentBuffer = Buffer.from(content, "utf-8");

    const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.upload(contentBuffer, contentBuffer.length, {
      blobHTTPHeaders: { blobContentType: "application/json" },
    });

    return {
      uri: blockBlobClient.url,
      container: this.containerClient.containerName,
      blobName,
      sizeBytes: contentBuffer.length,
    };
  }

  /**
   * Downloads and deserializes a payload from blob using a BlobReference.
   */
  async retrieve(ref: BlobReference): Promise<unknown> {
    const blobClient = this.containerClient.getBlobClient(ref.blobName);
    const downloadResponse = await blobClient.download(0);
    const content = await streamToString(downloadResponse.readableStreamBody!);
    return JSON.parse(content);
  }

  private async ensureContainer(): Promise<void> {
    if (!this.containerEnsured) {
      await this.containerClient.createIfNotExists();
      this.containerEnsured = true;
    }
  }
}

async function streamToString(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(new Uint8Array(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
  }
  return Buffer.concat(chunks).toString("utf-8");
}
