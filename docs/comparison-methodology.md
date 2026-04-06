# Comparison Methodology

How to run a fair performance comparison and interpret results.

## Experiment Design

Both apps run **identical business logic** (3 sequential Blob Storage I/O activities) imported from a shared npm package. Only the configuration layer differs:

- **Baseline**: Default host.json, default app settings, default EP3 scaling
- **Tuned**: Optimized host.json (concurrency, partitions, queue batch size), tuned app settings (`FUNCTIONS_WORKER_PROCESS_COUNT=4`, `NODE_OPTIONS=--max-old-space-size=10240`), EP3 scaling (always-ready=2, max-burst=10)

## Isolation

Each app uses fully isolated infrastructure:
- Separate EP3 App Service Plan (no resource contention)
- Separate task hub storage account (no queue/table contention)
- Separate workload blob storage account (no I/O contention)
- **Shared** Application Insights (distinguished by `cloud_RoleName`)

## Test Procedure

### 1. Warm-Up Phase (Critical)

Before measuring, warm up both apps:
- Send 10-20 manual requests to each app
- Wait 2-3 minutes for instances to stabilize
- EP3 always-ready instances ensure the tuned app is pre-warmed
- The baseline app may need manual warm-up requests

### 2. Steady-State Measurement

Run the load test with these parameters:
- **Ramp-up**: 30 seconds (gradual increase to target concurrency)
- **Duration**: 5 minutes minimum (300 seconds)
- **Threads**: Start with 10, increase to 25, 50, 100 in separate runs
- **Both apps hit simultaneously** (JMeter thread groups run in parallel)

### 3. Cool-Down

After each test run:
- Wait 5 minutes before the next run
- Allow scaling to normalize
- Let telemetry pipeline flush

## Key Metrics

| Metric | What It Measures | Where to Find |
|--------|-----------------|---------------|
| `df.orchestration.duration` | Total time from orchestration start to completion | Workbook → Duration Analysis |
| `df.activity.duration` | Individual activity execution time | Workbook → Duration Analysis |
| `df.activity.queue_delay` | Time between activity being scheduled and starting | Workbook → Queue & Scaling |
| `df.orchestration.completed` | Number of successful orchestrations | Workbook → Throughput & Errors |
| `df.orchestration.failed` | Number of failed orchestrations | Workbook → Throughput & Errors |
| Instance count | Number of running instances over time | Workbook → Queue & Scaling |

## Interpreting Results

### What Good Tuning Looks Like

- **Lower P95/P99 orchestration duration** — tuned app handles tail latency better
- **Lower queue delays** — faster polling interval picks up work sooner
- **Higher throughput** — more orchestrations completed per minute under same load
- **Similar P50** — median latency may be similar (I/O bound work)
- **Faster scale-out** — pre-warmed instances + always-ready reduce cold start impact

### What to Watch For

- **Storage throttling** — if tuned app has too-high concurrency, check for HTTP 429/503 in blob operations
- **Memory pressure** — `NODE_OPTIONS --max-old-space-size=10240` should prevent OOM on EP3; monitor heap usage
- **Worker process overhead** — `FUNCTIONS_WORKER_PROCESS_COUNT=4` increases startup time; verify warm-up mitigates this

### Statistical Considerations

- Use **percentiles** (P50, P95, P99) not averages — averages hide distribution
- Run at least **3 repetitions** of each load level for reproducibility
- Exclude the **first 60 seconds** (ramp-up period) from analysis
- Ensure **minimum 100 samples** per metric for statistical relevance
- Compare using the **same time window** — App Insights timestamps should align

## Limitations

- Both apps use Azure Storage provider (not Netherite/MSSQL) — results are storage-provider-specific
- EP3 SKU is fixed — results don't apply to consumption or different premium SKUs
- `extendedSessionsEnabled` is not available for Node.js (only .NET in-process) — cannot test this optimization
- Blob I/O is the workload — results may differ for CPU-bound or external API workloads
