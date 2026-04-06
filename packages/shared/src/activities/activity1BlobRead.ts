import { InvocationContext } from "@azure/functions";
import { getBlobServiceClient } from "../blobClient.js";
import { BlobReadInput, BlobReadOutput } from "../types.js";

export async function activity1BlobRead(
  input: BlobReadInput,
  context: InvocationContext
): Promise<BlobReadOutput> {
  context.log(`activity1BlobRead: reading blob ${input.containerName}/${input.blobName}`);

  const blobServiceClient = getBlobServiceClient(input.storageAccount);
  const containerClient = blobServiceClient.getContainerClient(input.containerName);
  const blobClient = containerClient.getBlobClient(input.blobName);

  const downloadResponse = await blobClient.download(0);
  const content = await streamToString(downloadResponse.readableStreamBody!);

  const properties = await blobClient.getProperties();

  return {
    content,
    contentLength: properties.contentLength ?? content.length,
    contentType: properties.contentType ?? "application/octet-stream",
    blobName: input.blobName,
    metadata: properties.metadata ?? {},
  };
}

async function streamToString(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(new Uint8Array(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
  }
  return Buffer.concat(chunks).toString("utf-8");
}
