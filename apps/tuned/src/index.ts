import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import * as df from "durable-functions";
import {
  initializeTelemetry,
  createTelemetryHelper,
  createInstrumentedOrchestrator,
  instrumentedActivity1BlobRead,
  instrumentedActivity2BlobTransform,
  instrumentedActivity3BlobWrite,
  OrchestratorInput,
  getBlobServiceClient,
} from "@df-comparison/shared";

// ─── Telemetry setup (must run before function registrations) ────────────
const APP_NAME = "tuned" as const;
const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
if (connectionString) {
  initializeTelemetry({ connectionString, appName: APP_NAME });
}
const telemetry = createTelemetryHelper(APP_NAME);

// ─── Register orchestrator with telemetry instrumentation ────────────────
df.app.orchestration(
  "blobProcessingOrchestrator",
  createInstrumentedOrchestrator(telemetry)
);

// ─── Register activity functions with telemetry instrumentation ──────────
df.app.activity("activity1BlobRead", {
  handler: (input, context) =>
    instrumentedActivity1BlobRead(input, context, telemetry),
});

df.app.activity("activity2BlobTransform", {
  handler: (input, context) =>
    instrumentedActivity2BlobTransform(input, context, telemetry),
});

df.app.activity("activity3BlobWrite", {
  handler: (input, context) =>
    instrumentedActivity3BlobWrite(input, context, telemetry),
});

// ─── HTTP starter function ───────────────────────────────────────────────
app.http("httpStart", {
  route: "orchestrators/{orchestratorName}",
  extraInputs: [df.input.durableClient()],
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const client = df.getClient(context);
    const orchestratorName = req.params.orchestratorName;

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const orchestratorInput: OrchestratorInput = {
      storageAccount: process.env.BLOB_STORAGE_ACCOUNT_NAME ?? "UseDevelopmentStorage=true",
      inputContainer: (body.inputContainer as string) ?? process.env.BLOB_INPUT_CONTAINER ?? "input",
      outputContainer: (body.outputContainer as string) ?? process.env.BLOB_OUTPUT_CONTAINER ?? "output",
      blobName: (body.blobName as string) ?? "sample.json",
    };

    const instanceId = await client.startNew(orchestratorName, {
      input: orchestratorInput,
    });

    context.log(`Started orchestration '${orchestratorName}' with ID '${instanceId}'`);
    return client.createCheckStatusResponse(req, instanceId);
  },
});

// ─── Seed data function ──────────────────────────────────────────────────
const sampleData = {
  orderId: "ORD-2026-04-001",
  customer: { name: "Contoso Ltd", region: "westus", tier: "premium" },
  items: [
    { sku: "WIDGET-A", quantity: 50, unitPrice: 12.99 },
    { sku: "WIDGET-B", quantity: 25, unitPrice: 24.50 },
    { sku: "GADGET-X", quantity: 10, unitPrice: 99.95 },
  ],
  shipping: { method: "express", address: "1 Microsoft Way, Redmond WA 98052" },
  createdAt: "2026-04-01T12:00:00Z",
  notes: "Test payload for Durable Function config comparison",
};

app.http("seedData", {
  methods: ["POST"],
  authLevel: "function",
  route: "seed",
  handler: async (_req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const storageAccount = process.env.BLOB_STORAGE_ACCOUNT_NAME ?? "UseDevelopmentStorage=true";
    const containerName = process.env.BLOB_INPUT_CONTAINER ?? "input";
    const blobName = "sample.json";

    try {
      const blobServiceClient = getBlobServiceClient(storageAccount);
      const containerClient = blobServiceClient.getContainerClient(containerName);
      await containerClient.createIfNotExists();
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      const content = JSON.stringify(sampleData, null, 2);
      await blockBlobClient.upload(content, Buffer.byteLength(content), {
        blobHTTPHeaders: { blobContentType: "application/json" },
      });
      context.log(`Seeded ${containerName}/${blobName} (${Buffer.byteLength(content)} bytes)`);
      return { status: 200, jsonBody: { status: "ok", container: containerName, blob: blobName } };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      context.error(`Seed failed: ${message}`);
      return { status: 500, jsonBody: { status: "error", message } };
    }
  },
});
