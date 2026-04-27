#!/usr/bin/env bash
# Smoke-test the deployed API (read-only, no auth). Override base URL if needed.
set -euo pipefail
BASE="${1:-https://ubcab-task-production.up.railway.app}"

echo "=== GET /api/health ==="
curl -sS -w "\nhttp_code=%{http_code} time_namelookup=%{time_namelookup}s time_total=%{time_total}s\n" \
	"$BASE/api/health"
echo

echo "=== GET /api/benchmark (trimmed) ==="
curl -sS "$BASE/api/benchmark" | head -c 500
echo
echo

echo "=== OpenAPI: schema keys sample (first 20 model names) ==="
curl -sS "$BASE/openapi/json" | bun -e '
const j = JSON.parse(require("fs").readFileSync(0, "utf8"));
const names = Object.keys(j.components?.schemas || {}).sort();
console.log(names.slice(0, 20).join(", ") + (names.length > 20 ? " ..." : ""));
console.log("total models:", names.length);
'

echo "=== GET / (root) ==="
curl -sS -o /dev/null -w "http_code=%{http_code}\n" "$BASE/"

echo "Done."
