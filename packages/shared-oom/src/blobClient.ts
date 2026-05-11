import { BlobServiceClient } from "@azure/storage-blob";
import { DefaultAzureCredential } from "@azure/identity";

let clientCache: Map<string, BlobServiceClient> = new Map();

export function getBlobServiceClient(storageAccount: string): BlobServiceClient {
  let client = clientCache.get(storageAccount);
  if (!client) {
    if (isConnectionString(storageAccount)) {
      client = BlobServiceClient.fromConnectionString(storageAccount);
    } else {
      const url = `https://${storageAccount}.blob.core.windows.net`;
      client = new BlobServiceClient(url, new DefaultAzureCredential());
    }
    clientCache.set(storageAccount, client);
  }
  return client;
}

function isConnectionString(value: string): boolean {
  return value.includes("AccountName=") ||
    value.includes("UseDevelopmentStorage=") ||
    value.includes("DefaultEndpointsProtocol=");
}
