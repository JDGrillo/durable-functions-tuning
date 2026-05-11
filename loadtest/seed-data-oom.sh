#!/usr/bin/env bash
# seed-data-oom.sh — Creates large test blobs (200KB, 500KB, 1MB, 1.6MB) in both
# inline-payloads and externalized-payloads workload storage accounts.
#
# Usage: ./seed-data-oom.sh <inline_storage_account> <externalized_storage_account>
#
# Requires: Azure CLI (az) logged in with appropriate permissions.
# Uses --auth-mode login (no connection strings needed — uses managed identity / az login).

set -euo pipefail

# Use python3 if available, otherwise fall back to python (Windows)
PYTHON=$(command -v python3 2>/dev/null || command -v python 2>/dev/null || { echo "ERROR: python not found"; exit 1; })

INLINE_ACCOUNT="${1:?Usage: $0 <inline_storage_account> <externalized_storage_account>}"
EXTERNALIZED_ACCOUNT="${2:?Usage: $0 <inline_storage_account> <externalized_storage_account>}"

INPUT_CONTAINER="input"
TEMP_DIR=$(mktemp -d)

# Sizes in approximate kilobytes (actual JSON will be slightly larger due to structure)
declare -A SIZES=(
  ["200kb"]=200
  ["500kb"]=500
  ["1mb"]=1024
  ["1600kb"]=1600
)

# Generate a realistic nested JSON structure of approximately the target size.
# Uses arrays of objects to reach the desired file size.
generate_large_json() {
  local target_kb=$1
  local output_file=$2
  local target_bytes=$((target_kb * 1024))

  $PYTHON - "$target_bytes" "$output_file" <<'PYTHON'
import json
import sys
import random
import string
import hashlib

target_bytes = int(sys.argv[1])
output_file = sys.argv[2]

def random_string(length):
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))

def generate_record(index):
    """Generate a realistic nested record simulating customer data."""
    return {
        "recordId": f"rec-{index:06d}",
        "timestamp": f"2025-01-{(index % 28) + 1:02d}T{index % 24:02d}:{index % 60:02d}:00Z",
        "customer": {
            "id": f"cust-{random_string(12)}",
            "name": f"Customer {index}",
            "email": f"user{index}@example.com",
            "region": random.choice(["us-east", "us-west", "eu-west", "ap-southeast"]),
            "tier": random.choice(["free", "standard", "premium", "enterprise"]),
            "metadata": {
                "createdAt": f"2024-{(index % 12) + 1:02d}-01T00:00:00Z",
                "lastActive": f"2025-01-{(index % 28) + 1:02d}T12:00:00Z",
                "preferences": {
                    "locale": random.choice(["en-US", "de-DE", "fr-FR", "ja-JP"]),
                    "timezone": random.choice(["UTC", "America/New_York", "Europe/Berlin", "Asia/Tokyo"]),
                    "notifications": random.choice([True, False])
                }
            }
        },
        "transaction": {
            "id": f"txn-{random_string(16)}",
            "amount": round(random.uniform(10.0, 9999.99), 2),
            "currency": random.choice(["USD", "EUR", "GBP", "JPY"]),
            "status": random.choice(["pending", "completed", "failed", "refunded"]),
            "items": [
                {
                    "sku": f"SKU-{random_string(8).upper()}",
                    "name": f"Product {j}",
                    "quantity": random.randint(1, 10),
                    "unitPrice": round(random.uniform(5.0, 500.0), 2)
                }
                for j in range(random.randint(1, 5))
            ]
        },
        "analytics": {
            "sessionId": random_string(24),
            "pageViews": random.randint(1, 50),
            "duration_seconds": random.randint(30, 3600),
            "events": [random_string(10) for _ in range(random.randint(3, 10))],
            "checksum": hashlib.md5(f"rec-{index}".encode()).hexdigest()
        },
        "expression_field_1": "${lookup.customer.scoring}",
        "expression_field_2": "{{template.render.summary}}",
        "_computed_risk_score": "${risk.calculate(transaction.amount)}",
        "tags": [random_string(6) for _ in range(random.randint(2, 8))]
    }

# Build up records until we exceed target size
records = []
current_size = 0
index = 0
while current_size < target_bytes:
    record = generate_record(index)
    records.append(record)
    # Estimate size (actual JSON will vary slightly)
    current_size = len(json.dumps(records, separators=(',', ':')))
    index += 1

payload = {
    "schemaVersion": "2.0",
    "generatedAt": "2025-01-15T00:00:00Z",
    "source": "seed-data-oom",
    "recordCount": len(records),
    "records": records
}

with open(output_file, 'w') as f:
    json.dump(payload, f, indent=None, separators=(',', ':'))

actual_size = len(json.dumps(payload, separators=(',', ':')))
print(f"  Generated {len(records)} records, actual size: {actual_size / 1024:.1f} KB")
PYTHON
}

echo "=== Generating large test blobs for OOM scenario ==="

for size_label in "${!SIZES[@]}"; do
  target_kb=${SIZES[$size_label]}
  blob_name="large-${size_label}.json"
  file_path="${TEMP_DIR}/${blob_name}"

  echo ""
  echo "--- Generating ${blob_name} (target: ${target_kb}KB) ---"
  generate_large_json "$target_kb" "$file_path"

  actual_size=$(wc -c < "$file_path")
  echo "  Actual file size: $((actual_size / 1024)) KB"

  echo "  Uploading to inline-payloads storage (${INLINE_ACCOUNT})..."
  az storage blob upload \
    --account-name "$INLINE_ACCOUNT" \
    --container-name "$INPUT_CONTAINER" \
    --name "$blob_name" \
    --file "$file_path" \
    --overwrite \
    --auth-mode login \
    --only-show-errors

  echo "  Uploading to externalized-payloads storage (${EXTERNALIZED_ACCOUNT})..."
  az storage blob upload \
    --account-name "$EXTERNALIZED_ACCOUNT" \
    --container-name "$INPUT_CONTAINER" \
    --name "$blob_name" \
    --file "$file_path" \
    --overwrite \
    --auth-mode login \
    --only-show-errors
done

# Upload a default sample-large.json (1MB) for quick manual testing
cp "${TEMP_DIR}/large-1mb.json" "${TEMP_DIR}/sample-large.json"
for account in "$INLINE_ACCOUNT" "$EXTERNALIZED_ACCOUNT"; do
  az storage blob upload \
    --account-name "$account" \
    --container-name "$INPUT_CONTAINER" \
    --name "sample-large.json" \
    --file "${TEMP_DIR}/sample-large.json" \
    --overwrite \
    --auth-mode login \
    --only-show-errors
done

rm -rf "$TEMP_DIR"
echo ""
echo "=== OOM seed data complete ==="
echo "Blobs uploaded: large-200kb.json, large-500kb.json, large-1mb.json, large-1600kb.json, sample-large.json"
echo "Storage accounts: ${INLINE_ACCOUNT}, ${EXTERNALIZED_ACCOUNT}"
