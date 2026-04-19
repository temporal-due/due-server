#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f ".env" ]]; then
  echo "error: .env not found at $ROOT_DIR/.env" >&2
  exit 1
fi

# Match Nest/ConfigModule behavior:
# - If JWT_SECRET exists in the process environment, it wins (dotenv won't override it).
# - Otherwise fall back to JWT_SECRET from .env
#
# Also detect mismatch between exported JWT_SECRET and .env (common cause of 401s).
JWT_SECRET="$(
  node -e "
const fs=require('fs');

function readDotEnvSecret() {
  const s=fs.readFileSync('.env','utf8');
  const line=s.split(/\\r?\\n/).find(l=>/^JWT_SECRET=/.test(l));
  if(!line){
    console.error('error: JWT_SECRET missing in .env');
    process.exit(2);
  }
  const raw=line.slice('JWT_SECRET='.length).trim();
  const unquoted = raw.startsWith('\"') && raw.endsWith('\"') && raw.length>=2
    ? raw.slice(1,-1)
    : (raw.startsWith(\"'\") && raw.endsWith(\"'\") && raw.length>=2 ? raw.slice(1,-1) : raw);
  return unquoted;
}

const fromEnv = process.env.JWT_SECRET;
const fromFile = readDotEnvSecret();

if (fromEnv && fromFile && fromEnv !== fromFile) {
  console.error([
    'error: JWT_SECRET mismatch between environment and .env.',
    'Fix one of:',
    '  - unset JWT_SECRET   (then Nest will use .env)',
    '  - export JWT_SECRET to match .env',
    '  - remove JWT_SECRET from your shell profile if it is stale',
  ].join('\\n'));
  process.exit(3);
}

const resolved = fromEnv || fromFile;
process.stdout.write(resolved);
"
)"

USER_ID="${USER_ID:-11111111-1111-4111-8111-111111111111}"
EXP="${JWT_DEV_EXP:-24h}"

export JWT_SECRET

ACCESS_TOKEN="$(
  JWT_SECRET="$JWT_SECRET" USER_ID="$USER_ID" EXP="$EXP" node -e "
const { SignJWT } = require('jose');

const secret = new TextEncoder().encode(process.env.JWT_SECRET);
const sub = process.env.USER_ID;
const exp = process.env.EXP || '24h';

(async () => {
  const jwt = await new SignJWT({ type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(secret);
  process.stdout.write(jwt);
})();
"
)"

echo "$ACCESS_TOKEN"
