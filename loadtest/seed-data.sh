#!/usr/bin/env bash
# seed-data.sh — Creates identical test blobs in both workload storage accounts.
# Usage: ./seed-data.sh <baseline_connection_string> <tuned_connection_string> [blob_count]
#
# Requires: Azure CLI (az) with storage extension

set -euo pipefail

BASELINE_CONN="${1:?Usage: $0 <baseline_conn_string> <tuned_conn_string> [blob_count]}"
TUNED_CONN="${2:?Usage: $0 <baseline_conn_string> <tuned_conn_string> [blob_count]}"
BLOB_COUNT="${3:-5}"

INPUT_CONTAINER="input"
TEMP_DIR=$(mktemp -d)

echo "=== Creating $BLOB_COUNT test blobs ==="

for i in $(seq 1 "$BLOB_COUNT"); do
  BLOB_NAME="sample-${i}.json"
  FILE_PATH="${TEMP_DIR}/${BLOB_NAME}"

  # Generate a sample JSON blob (~1KB)
  cat > "$FILE_PATH" <<EOF
{
  "id": "test-${i}",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "data": {
    "field1": "value-${i}",
    "field2": $((RANDOM % 1000)),
    "field3": $(python3 -c "import random; print(random.random())" 2>/dev/null || echo "0.${RANDOM}"),
    "tags": ["performance", "test", "blob-${i}"],
    "nested": {
      "alpha": "Lorem ipsum dolor sit amet",
      "beta": $((RANDOM % 100)),
      "gamma": true
    }
  },
  "metadata": {
    "source": "seed-script",
    "version": "1.0"
  }
}
EOF

  echo "Uploading ${BLOB_NAME} to baseline storage..."
  az storage blob upload \
    --connection-string "$BASELINE_CONN" \
    --container-name "$INPUT_CONTAINER" \
    --name "$BLOB_NAME" \
    --file "$FILE_PATH" \
    --overwrite \
    --only-show-errors

  echo "Uploading ${BLOB_NAME} to tuned storage..."
  az storage blob upload \
    --connection-string "$TUNED_CONN" \
    --container-name "$INPUT_CONTAINER" \
    --name "$BLOB_NAME" \
    --file "$FILE_PATH" \
    --overwrite \
    --only-show-errors
done

# Also upload a default "sample.json" for quick manual testing
cp "${TEMP_DIR}/sample-1.json" "${TEMP_DIR}/sample.json"
az storage blob upload --connection-string "$BASELINE_CONN" --container-name "$INPUT_CONTAINER" --name "sample.json" --file "${TEMP_DIR}/sample.json" --overwrite --only-show-errors
az storage blob upload --connection-string "$TUNED_CONN" --container-name "$INPUT_CONTAINER" --name "sample.json" --file "${TEMP_DIR}/sample.json" --overwrite --only-show-errors

rm -rf "$TEMP_DIR"
echo "=== Seed data complete: $BLOB_COUNT blobs + sample.json uploaded to both storage accounts ==="
