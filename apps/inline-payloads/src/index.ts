import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import * as df from "durable-functions";
import {
  initializeTelemetry,
  createTelemetryHelper,
  createInstrumentedInlineOrchestrator,
  instrumentedDataEnricher,
  instrumentedExpressionResolver,
  instrumentedDataTransformer,
  seedTestData,
  OomOrchestratorInput,
} from "@df-comparison/shared-oom";

// ─── Telemetry setup (must run before function registrations) ────────────
const APP_NAME = "inline-payloads" as const;
const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
if (connectionString) {
  initializeTelemetry({ connectionString, appName: APP_NAME });
}
const telemetry = createTelemetryHelper(APP_NAME);

// ─── Register orchestrator with telemetry instrumentation ────────────────
df.app.orchestration(
  "inlineOrchestrator",
  createInstrumentedInlineOrchestrator(telemetry)
);

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

// ─── HTTP starter function ───────────────────────────────────────────────
app.http("httpStart", {
  route: "orchestrators/{orchestratorName}",
  extraInputs: [df.input.durableClient()],
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const client = df.getClient(context);
    const orchestratorName = req.params.orchestratorName;

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const orchestratorInput: OomOrchestratorInput = {
      storageAccount: process.env.BLOB_STORAGE_ACCOUNT_NAME ?? "UseDevelopmentStorage=true",
      inputContainer: (body.inputContainer as string) ?? process.env.BLOB_INPUT_CONTAINER ?? "input",
      outputContainer: (body.outputContainer as string) ?? process.env.BLOB_OUTPUT_CONTAINER ?? "output",
      blobName: (body.blobName as string) ?? "sample-large.json",
    };

    const instanceId = await client.startNew(orchestratorName, {
      input: orchestratorInput,
    });

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
