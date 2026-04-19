#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f ".env" ]]; then
  echo "error: missing .env at $ROOT_DIR/.env" >&2
  exit 2
fi

CONTAINER="$(bash scripts/dev-docker-pg.sh)"

DB_USER="${DB_USERNAME:-postgres}"
DB_NAME="${DB_DATABASE:-postgres}"

# Fixed dev user (deterministic across machines)
USER_ID="${DEV_USER_ID:-11111111-1111-4111-8111-111111111111}"

echo "using container: ${CONTAINER}"
echo "resetting tables + seeding dev user: ${USER_ID}"

docker exec -i "${CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" -v ON_ERROR_STOP=1 <<SQL
BEGIN;

TRUNCATE TABLE
  tasks,
  phases,
  projects,
  users
RESTART IDENTITY CASCADE;

INSERT INTO users (
  id,
  "authProvider",
  "oauthSub",
  nickname,
  email
) VALUES (
  '${USER_ID}'::uuid,
  'google',
  'dev-bootstrap-sub',
  'dev_user',
  'dev@example.com'
);

COMMIT;

SELECT id, "authProvider", "oauthSub", nickname, email FROM users;
SQL

echo ""
echo "=== access token (copy this) ==="
USER_ID="${USER_ID}" bash scripts/mint-dev-access-token.sh

echo ""
echo "=== GET /auth/me (smoke) ==="
TOKEN="$(USER_ID="${USER_ID}" bash scripts/mint-dev-access-token.sh)"
curl -sS --max-time 5 -H "Authorization: Bearer ${TOKEN}" "http://localhost:${PORT:-3000}/auth/me" || true
echo ""
