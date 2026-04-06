# Tuning Reference

All configuration parameters used in the tuned app, with rationale and defaults.

## host.json — Durable Task Settings

Located in `apps/tuned/host.json` under `extensions.durableTask`.

### Storage Provider Settings

| Parameter | Default | Tuned Value | Rationale |
|-----------|---------|-------------|-----------|
| `partitionCount` | 4 | **8** | More partitions = more parallelism for orchestrations. Each partition has its own control queue. Cannot be changed after task hub creation. |
| `controlQueueBatchSize` | 32 | **64** | Larger batch size reduces Azure Storage polling frequency. Each poll dequeues up to this many messages. Better for high-throughput scenarios. |
| `controlQueueBufferThreshold` | 256 (Premium) | **512** | Higher threshold keeps more messages buffered in memory for faster dispatch. Reduces round-trips to queue storage. |
| `maxQueuePollingInterval` | 00:00:30 | **00:00:05** | Lower polling interval reduces latency between activity completion and orchestrator pickup. Trades more Storage transactions for lower latency. |
| `useTablePartitionManagement` | true (v3+) | **true** | Reduces costs for Azure Storage v2 accounts by using improved table partitioning. |

### Concurrency Settings

| Parameter | Default (EP3) | Tuned Value | Rationale |
|-----------|---------------|-------------|-----------|
| `maxConcurrentActivityFunctions` | 40 (10 × 4 vCPU) | **80** | I/O-bound activities spend most time waiting on Blob Storage. Doubling allows better utilization of available CPU while activities are blocked on I/O. |
| `maxConcurrentOrchestratorFunctions` | 40 (10 × 4 vCPU) | **80** | Orchestrators are lightweight dispatchers (generator yield/resume). Higher concurrency reduces queuing when many orchestrations are active. |

### Not Used

| Parameter | Reason |
|-----------|--------|
| `extendedSessionsEnabled` | **Not supported for Node.js** — only available for .NET in-process worker. Attempting to set this will be ignored. |

## App Settings

Set as environment variables on the Function App.

| Setting | Default | Tuned Value | Rationale |
|---------|---------|-------------|-----------|
| `FUNCTIONS_WORKER_PROCESS_COUNT` | 1 | **4** | Runs 4 Node.js worker processes per instance. EP3 has 4 vCPU, so one worker per core. Increases throughput for I/O-bound workloads. Tradeoff: slower cold starts (4 processes to initialize). |
| `NODE_OPTIONS` | (none) | **`--max-old-space-size=10240`** | Sets Node.js V8 heap limit to 10 GB. EP3 has 14 GB RAM — 10 GB for heap leaves 4 GB for OS, runtime, and buffers. Prevents OOM for in-memory blob processing. |

## EP3 Scaling Configuration

Set via Terraform on the App Service Plan / Function App.

| Parameter | Baseline (default) | Tuned Value | Rationale |
|-----------|-------------------|-------------|-----------|
| `elastic_instance_minimum` (always-ready) | platform default | **2** | Eliminates cold starts for baseline load. Two instances always running = 8 worker processes ready. |
| `app_scale_limit` (max burst) | platform default | **10** | Allows burst to 10 instances under heavy load. 10 instances × 4 workers = 40 worker processes max. |
| `pre_warmed_instance_count` | platform default | **1** | Keeps 1 additional instance pre-warmed for faster scale-out. Reduces latency of first scale-out event. |

## Configuration File Locations

- **host.json**: `apps/tuned/host.json`
- **App settings**: `apps/tuned/local.settings.json.example` (for local dev) and Terraform `infra/main.tf` (for deployed)
- **EP3 scaling**: `infra/main.tf` → `azurerm_linux_function_app.tuned` resource
- **Scaling variables**: `infra/variables.tf` → `ep3_*` variables
