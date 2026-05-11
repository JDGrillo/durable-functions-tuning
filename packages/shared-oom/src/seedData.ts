import { getBlobServiceClient } from "./blobClient.js";
import crypto from "crypto";

interface SeedResult {
  blobName: string;
  sizeKB: number;
  recordCount: number;
}

function randomString(length: number): string {
  return crypto.randomBytes(length).toString("hex").slice(0, length);
}

function generateRecord(index: number) {
  const regions = ["us-east", "us-west", "eu-west", "ap-southeast"];
  const tiers = ["free", "standard", "premium", "enterprise"];
  const currencies = ["USD", "EUR", "GBP", "JPY"];
  const statuses = ["pending", "completed", "failed", "refunded"];
  const locales = ["en-US", "de-DE", "fr-FR", "ja-JP"];
  const timezones = ["UTC", "America/New_York", "Europe/Berlin", "Asia/Tokyo"];

  const pick = <T>(arr: T[]): T => arr[index % arr.length];
  const amount = Math.round((10 + Math.random() * 9990) * 100) / 100;
  const itemCount = 1 + (index % 5);

  return {
    recordId: `rec-${String(index).padStart(6, "0")}`,
    timestamp: `2025-01-${String((index % 28) + 1).padStart(2, "0")}T${String(index % 24).padStart(2, "0")}:${String(index % 60).padStart(2, "0")}:00Z`,
    customer: {
      id: `cust-${randomString(12)}`,
      name: `Customer ${index}`,
      email: `user${index}@example.com`,
      region: pick(regions),
      tier: pick(tiers),
      metadata: {
        createdAt: `2024-${String((index % 12) + 1).padStart(2, "0")}-01T00:00:00Z`,
        lastActive: `2025-01-${String((index % 28) + 1).padStart(2, "0")}T12:00:00Z`,
        preferences: {
          locale: pick(locales),
          timezone: pick(timezones),
          notifications: index % 2 === 0,
        },
      },
    },
    transaction: {
      id: `txn-${randomString(16)}`,
      amount,
      currency: pick(currencies),
      status: pick(statuses),
      items: Array.from({ length: itemCount }, (_, j) => ({
        sku: `SKU-${randomString(8).toUpperCase()}`,
        name: `Product ${j}`,
        quantity: 1 + (j % 10),
        unitPrice: Math.round((5 + Math.random() * 495) * 100) / 100,
      })),
    },
    analytics: {
      sessionId: randomString(24),
      pageViews: 1 + (index % 50),
      duration_seconds: 30 + (index % 3570),
      events: Array.from({ length: 3 + (index % 8) }, () => randomString(10)),
    },
    expression_field_1: "${lookup.customer.scoring}",
    expression_field_2: "{{template.render.summary}}",
    _computed_risk_score: "${risk.calculate(transaction.amount)}",
    tags: Array.from({ length: 2 + (index % 7) }, () => randomString(6)),
  };
}

function generatePayload(targetKB: number): { json: string; recordCount: number } {
  const targetBytes = targetKB * 1024;
  const records: ReturnType<typeof generateRecord>[] = [];
  let index = 0;

  while (true) {
    records.push(generateRecord(index));
    const payload = {
      schemaVersion: "2.0",
      generatedAt: new Date().toISOString(),
      source: "seedData-function",
      recordCount: records.length,
      records,
    };
    const json = JSON.stringify(payload);
    if (json.length >= targetBytes) {
      return { json, recordCount: records.length };
    }
    index++;
  }
}

const BLOB_SIZES: Record<string, number> = {
  "large-200kb.json": 200,
  "large-500kb.json": 500,
  "large-1mb.json": 1024,
  "large-1600kb.json": 1600,
};

export async function seedTestData(
  storageAccount: string,
  containerName: string = "input"
): Promise<SeedResult[]> {
  const blobService = getBlobServiceClient(storageAccount);
  const container = blobService.getContainerClient(containerName);

  // Ensure the container exists
  await container.createIfNotExists();

  const results: SeedResult[] = [];

  for (const [blobName, targetKB] of Object.entries(BLOB_SIZES)) {
    const { json, recordCount } = generatePayload(targetKB);
    const blockBlob = container.getBlockBlobClient(blobName);
    await blockBlob.upload(json, json.length, {
      blobHTTPHeaders: { blobContentType: "application/json" },
    });
    results.push({ blobName, sizeKB: Math.round(json.length / 1024), recordCount });
  }

  // Also upload sample-large.json (copy of 1MB)
  const { json: sampleJson, recordCount: sampleCount } = generatePayload(1024);
  const sampleBlob = container.getBlockBlobClient("sample-large.json");
  await sampleBlob.upload(sampleJson, sampleJson.length, {
    blobHTTPHeaders: { blobContentType: "application/json" },
  });
  results.push({ blobName: "sample-large.json", sizeKB: Math.round(sampleJson.length / 1024), recordCount: sampleCount });

  return results;
}
