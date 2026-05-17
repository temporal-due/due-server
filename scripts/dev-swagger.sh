#!/bin/bash
set -euo pipefail

BASE_URL="${API_URL:-http://localhost:3000}"
SWAGGER_URL="${BASE_URL}/api-docs"

echo "Swagger UI: ${SWAGGER_URL}"
echo "OpenAPI JSON: ${BASE_URL}/api-docs-json"
echo ""

if ! curl -sf "${BASE_URL}/api-docs-json" > /dev/null 2>&1; then
  echo "서버가 실행 중이지 않습니다. 먼저 서버를 띄워주세요:"
  echo "  make dev-local"
  exit 1
fi

open "${SWAGGER_URL}"
