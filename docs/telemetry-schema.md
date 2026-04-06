# Telemetry Schema

Custom OpenTelemetry spans, metrics, and dimensions emitted by the shared telemetry module.

All telemetry is created via `@opentelemetry/api` and exported to Azure Monitor (Application Insights) via the `applicationinsights` SDK.

## Custom Metrics

Recorded via `@opentelemetry/api` Meter instruments. Appear in the `customMetrics` table in Log Analytics.

| Metric Name | Type | Unit | Description | Dimensions |
|-------------|------|------|-------------|------------|
| `df.activity.duration` | Histogram | ms | Execution duration of an individual activity function | `app_name`, `activity_name` |
| `df.activity.queue_delay` | Histogram | ms | Time between activity being scheduled and starting execution | `app_name`, `activity_name` |
| `df.orchestration.duration` | Histogram | ms | Total orchestration duration (start to completion) | `app_name` |
| `df.activity.completed` | Counter | count | Number of completed activity executions | `app_name`, `activity_name` |
| `df.orchestration.completed` | Counter | count | Number of completed orchestrations | `app_name` |
| `df.orchestration.failed` | Counter | count | Number of failed orchestrations | `app_name` |

## Custom Spans

Created via `@opentelemetry/api` Tracer. Appear in the `traces` or `dependencies` table in Log Analytics.

### Activity Spans

Name pattern: `activity:{activityName}`

| Attribute | Type | Description |
|-----------|------|-------------|
| `df.app_name` | string | `"baseline"` or `"tuned"` |
| `df.activity_name` | string | Name of the activity function |
| `df.orchestration_instance_id` | string | Parent orchestration instance ID |
| `df.function_type` | string | `"activity"` |
| `df.execution_duration_ms` | number | Execution duration in milliseconds |
| `df.blob_size` | number | Size of blob processed (bytes) |
| `df.operation_type` | string | `"read"`, `"transform"`, or `"write"` |
| `df.blob_name` | string | Name of the blob processed |
| `df.fields_processed` | number | Number of JSON fields processed (transform only) |
| `cloud.role_name` | string | Same as `df.app_name` |

### Orchestration Spans

Name pattern: `orchestration:blobProcessingOrchestrator`

| Attribute | Type | Description |
|-----------|------|-------------|
| `df.app_name` | string | `"baseline"` or `"tuned"` |
| `df.orchestration_name` | string | `"blobProcessingOrchestrator"` |
| `df.orchestration_instance_id` | string | Orchestration instance ID |
| `df.function_type` | string | `"orchestrator"` |
| `df.orchestration_duration_ms` | number | Total duration in milliseconds |
| `df.activities_completed` | number | Count of activities completed (always 3) |
| `cloud.role_name` | string | Same as `df.app_name` |

## Replay Safety

Orchestrator telemetry uses the `context.df.isReplaying` guard:
- Spans and metrics are **only emitted on non-replay executions**
- Activities **never replay**, so no guard is needed for activity telemetry
- This prevents duplicate spans/metrics from Durable Functions orchestrator replay behavior

## cloud_RoleName

Used to distinguish baseline vs tuned in shared Application Insights:
- Set via `OTEL_SERVICE_NAME` and `OTEL_RESOURCE_ATTRIBUTES` environment variables at startup
- All telemetry from baseline app has `cloud_RoleName = "baseline"`
- All telemetry from tuned app has `cloud_RoleName = "tuned"`

## KQL Query Patterns

### Filter by app
```kql
customMetrics
| where name == "df.orchestration.duration"
| extend app_name = tostring(customDimensions.app_name)
| where app_name == "baseline"
```

### Compare both apps
```kql
customMetrics
| where name == "df.orchestration.duration"
| extend app_name = tostring(customDimensions.app_name)
| summarize P50 = percentile(value, 50) by app_name
```

## Source Files

| File | Purpose |
|------|---------|
| `packages/shared/src/telemetry/telemetryHelper.ts` | `TelemetryHelper` class — creates all spans and records all metrics |
| `packages/shared/src/telemetry/setup.ts` | Initializes OTel SDK with Azure Monitor export via `applicationinsights` |
| `packages/shared/src/telemetry/instrumentedActivities.ts` | Activity function wrappers with telemetry |
| `packages/shared/src/telemetry/instrumentedOrchestrator.ts` | Orchestrator wrapper with isReplaying guard |
