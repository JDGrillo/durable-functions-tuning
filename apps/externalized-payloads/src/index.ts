import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import * as df from "durable-functions";
import {
  initializeTelemetry,
  createTelemetryHelper,
  createInstrumentedExternalizedOrchestrator,
  instrumentedDataEnricher,
  instrumentedExpressionResolver,
  instrumentedDataTransformer,
  BlobPayloadManager,
  batchSubOrchestratorHandler,
  seedTestData,
  OomOrchestratorInput,
  BatchOrchestratorInput,
} from "@df-comparison/shared-oom";

// ─── Telemetry setup (must run before function registrations) ────────────
const APP_NAME = "externalized-payloads" as const;
const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
if (connectionString) {
  initializeTelemetry({ connectionString, appName: APP_NAME });
}
const telemetry = createTelemetryHelper(APP_NAME);

// ─── Register orchestrators ─────────────────────────────────────────────
df.app.orchestration(
  "externalizedOrchestrator",
  createInstrumentedExternalizedOrchestrator(telemetry)
);

df.app.orchestration("batchSubOrchestrator", batchSubOrchestratorHandler);

// ─── Register activity functions with telemetry instrumentation ──────────
df.app.activity("dataEnricher", {
  handler: (input, context) =>
    instrumentedDataEnricher(input, context, telemetry),
});

df.app.activity("expressionResolver", {
  handler: (input, context) =>
    instrumentedExpressionResolver(input, context, telemetry),
});

df.app.activity("dataTransformer", {
  handler: (input, context) =>
    instrumentedDataTransformer(input, context, telemetry),
});

// ─── storePayload activity — wraps BlobPayloadManager.store() ────────────
df.app.activity("storePayload", {
  handler: async (input: unknown) => {
    const { storageAccount, containerName, instanceId, label, data } = input as {
      storageAccount: string;
      containerName: string;
      instanceId: string;
      label: string;
      data: unknown;
    };
    const manager = new BlobPayloadManager(storageAccount, containerName);
    return manager.store(data, instanceId, label);
  },
});

// ─── HTTP starter function ───────────────────────────────────────────────
app.http("httpStart", {
  route: "orchestrators/{orchestratorName}",
  extraInputs: [df.input.durableClient()],
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const client = df.getClient(context);
    const orchestratorName = req.params.orchestratorName;

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const storageAccount = process.env.BLOB_STORAGE_ACCOUNT_NAME ?? "UseDevelopmentStorage=true";
    const inputContainer = (body.inputContainer as string) ?? process.env.BLOB_INPUT_CONTAINER ?? "input";
    const outputContainer = (body.outputContainer as string) ?? process.env.BLOB_OUTPUT_CONTAINER ?? "output";
    const intermediateContainer = process.env.BLOB_INTERMEDIATE_CONTAINER ?? "intermediate-payloads";

    let instanceId: string;

    if (orchestratorName === "batchSubOrchestrator") {
      // Batch mode: expects blobNames array
      const batchInput: BatchOrchestratorInput = {
        storageAccount,
        inputContainer,
        outputContainer,
        intermediateContainer,
        blobNames: (body.blobNames as string[]) ?? [],
        batchSize: (body.batchSize as number) ?? 5,
        startIndex: 0,
        processedCount: 0,
      };
      instanceId = await client.startNew(orchestratorName, { input: batchInput });
    } else {
      // Single orchestration mode
      const orchestratorInput: OomOrchestratorInput = {
        storageAccount,
        inputContainer,
        outputContainer,
        intermediateContainer,
        blobName: (body.blobName as string) ?? "sample-large.json",
      };
      instanceId = await client.startNew(orchestratorName, { input: orchestratorInput });
    }

    context.log(`Started orchestration '${orchestratorName}' with ID '${instanceId}'`);
    return client.createCheckStatusResponse(req, instanceId);
  },
});

// ─── Seed data function — generates test blobs inside Azure VNet ─────────
app.http("seedData", {
  methods: ["POST"],
  route: "seed",
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const storageAccount = process.env.BLOB_STORAGE_ACCOUNT_NAME;
    if (!storageAccount) {
      return { status: 500, jsonBody: { error: "BLOB_STORAGE_ACCOUNT_NAME not configured" } };
    }
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const container = (body.container as string) ?? process.env.BLOB_INPUT_CONTAINER ?? "input";

    context.log(`Seeding test data into ${storageAccount}/${container}...`);
    const results = await seedTestData(storageAccount, container);
    context.log(`Seeded ${results.length} blobs`);
    return { status: 200, jsonBody: { storageAccount, container, blobs: results } };
  },
});
