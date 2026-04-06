import { BlobServiceClient } from "@azure/storage-blob";
import { DefaultAzureCredential } from "@azure/identity";

let clientCache: Map<string, BlobServiceClient> = new Map();

/**
 * Returns a singleton BlobServiceClient keyed by the storageAccount value.
 *
 * Accepts either:
 * - A connection string (for local dev with Azurite / "UseDevelopmentStorage=true")
 * - A storage account name (for deployed environments using managed identity)
 *
 * When a storage account name is provided, authenticates via DefaultAzureCredential
 * (system-assigned managed identity in Azure, az login locally).
 */
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
