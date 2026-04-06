# Setup Guide

Step-by-step instructions to deploy and run the performance comparison.

## 1. Prerequisites

- **Node.js 20 LTS** — `node --version` should show v20.x
- **Azure Functions Core Tools v4** — `func --version` should show 4.x
- **Terraform >= 1.5** — `terraform --version`
- **Azure CLI** — `az --version`
- **Azure subscription** with permissions to create:
  - Elastic Premium EP3 App Service Plans
  - Storage Accounts
  - Application Insights
  - Azure Load Testing resource

## 2. Install Dependencies

```bash
# From repo root
npm install
npx tsc --build
```

## 3. Deploy Azure Infrastructure

```bash
cd infra

# Initialize Terraform
terraform init

# Review the plan
terraform plan \
  -var="subscription_id=<YOUR_SUBSCRIPTION_ID>" \
  -var="resource_prefix=dfcompare" \
  -var="location=eastus2"

# Apply (creates ~15 resources)
terraform apply \
  -var="subscription_id=<YOUR_SUBSCRIPTION_ID>" \
  -var="resource_prefix=dfcompare" \
  -var="location=eastus2"

# Save outputs for later steps
terraform output -json > ../terraform-outputs.json
```

### Resources Created

| # | Resource | Name Pattern |
|---|----------|-------------|
| 1 | Resource Group | `rg-dfcompare` |
| 2 | Log Analytics Workspace | `law-dfcompare` |
| 3 | Application Insights | `ai-dfcompare` |
| 4 | Storage Account (baseline task hub) | `dfcomparebltask` |
| 5 | Storage Account (tuned task hub) | `dfcomparetntask` |
| 6 | Storage Account (baseline blobs) | `dfcompareblblob` |
| 7 | Storage Account (tuned blobs) | `dfcompareblblob` |
| 8 | EP3 App Service Plan (baseline) | `plan-dfcompare-baseline` |
| 9 | EP3 App Service Plan (tuned) | `plan-dfcompare-tuned` |
| 10 | Function App (baseline) | `func-dfcompare-baseline` |
| 11 | Function App (tuned) | `func-dfcompare-tuned` |
| 12 | Azure Load Testing | `alt-dfcompare` |

## 4. Seed Test Data

Upload identical test blobs to both workload storage accounts:

```bash
cd loadtest

# Get connection strings from Terraform
BASELINE_CONN=$(cd ../infra && terraform output -raw baseline_blobs_connection_string)
TUNED_CONN=$(cd ../infra && terraform output -raw tuned_blobs_connection_string)

# Upload 5 test blobs + sample.json
bash seed-data.sh "$BASELINE_CONN" "$TUNED_CONN" 5
```

## 5. Deploy Function Apps

```bash
# Deploy baseline
cd apps/baseline
npm run build
func azure functionapp publish func-dfcompare-baseline

# Deploy tuned
cd ../tuned
npm run build
func azure functionapp publish func-dfcompare-tuned
```

## 6. Verify Deployment

```bash
# Test baseline
curl -X POST https://func-dfcompare-baseline.azurewebsites.net/api/orchestrators/blobProcessingOrchestrator \
  -H "Content-Type: application/json" \
  -d '{"blobName": "sample.json"}'

# Test tuned
curl -X POST https://func-dfcompare-tuned.azurewebsites.net/api/orchestrators/blobProcessingOrchestrator \
  -H "Content-Type: application/json" \
  -d '{"blobName": "sample.json"}'
```

Both should return a JSON response with `statusQueryGetUri` for checking orchestration status.

## 7. Run Load Test

### Option A: Azure Load Testing (Recommended)

```bash
# Upload JMeter plan
az load test create \
  --test-id df-comparison \
  --load-test-resource alt-dfcompare \
  --resource-group rg-dfcompare \
  --test-plan loadtest/loadtest.jmx \
  --env baseline_host=func-dfcompare-baseline.azurewebsites.net \
  --env tuned_host=func-dfcompare-tuned.azurewebsites.net \
  --env threads=10 \
  --env ramp_up=30 \
  --env duration=300

# Run the test
az load test-run create \
  --test-id df-comparison \
  --test-run-id run-$(date +%Y%m%d%H%M%S) \
  --load-test-resource alt-dfcompare \
  --resource-group rg-dfcompare
```

### Option B: Manual Testing

```powershell
# PowerShell — fire rapid requests
1..50 | ForEach-Object -Parallel {
    Invoke-RestMethod -Uri "https://func-dfcompare-baseline.azurewebsites.net/api/orchestrators/blobProcessingOrchestrator" `
        -Method POST -ContentType "application/json" -Body '{"blobName": "sample.json"}'
} -ThrottleLimit 10
```

## 8. Analyze Results

1. Open Azure Portal → Application Insights (`ai-dfcompare`)
2. Navigate to **Workbooks** → Import `analytics/workbook.json`
3. Select the time range covering your load test
4. Compare baseline vs tuned across all 4 tabs

Or run individual KQL queries from `analytics/queries/*.kql` in Log Analytics.

## Cleanup

```bash
cd infra
terraform destroy -var="subscription_id=<YOUR_SUBSCRIPTION_ID>"
```
