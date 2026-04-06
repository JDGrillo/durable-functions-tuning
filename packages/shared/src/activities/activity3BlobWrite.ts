import { InvocationContext } from "@azure/functions";
import { getBlobServiceClient } from "../blobClient.js";
import { BlobWriteInput, BlobWriteOutput } from "../types.js";

export async function activity3BlobWrite(
  input: BlobWriteInput,
  context: InvocationContext
): Promise<BlobWriteOutput> {
  context.log(`activity3BlobWrite: writing blob ${input.containerName}/${input.blobName}`);

  const blobServiceClient = getBlobServiceClient(input.storageAccount);
  const containerClient = blobServiceClient.getContainerClient(input.containerName);

  // Ensure the output container exists
  await containerClient.createIfNotExists();

  const blockBlobClient = containerClient.getBlockBlobClient(input.blobName);
  const contentBuffer = Buffer.from(input.content, "utf-8");

  const uploadResponse = await blockBlobClient.upload(
    contentBuffer,
    contentBuffer.length,
    {
      blobHTTPHeaders: { blobContentType: "application/json" },
      metadata: input.metadata,
    }
  );

  return {
    blobName: input.blobName,
    containerName: input.containerName,
    contentLength: contentBuffer.length,
    etag: uploadResponse.etag ?? "",
    written: true,
  };
}
