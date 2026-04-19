#!/usr/bin/env bash
set -euo pipefail

# Try to find the local Postgres container started by docker compose in this repo.
# Preference:
# 1) docker compose service name contains "postgres"
# 2) running container publishing 5432 with postgres image

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

container_name=""
if command -v docker >/dev/null 2>&1; then
  if docker compose version >/dev/null 2>&1; then
    cd "$ROOT_DIR"
    # Example output: due-due-local-postgres-1
    container_name="$(docker compose ps --status running --format json 2>/dev/null \
      | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{try{const lines=s.trim().split(/\n/).filter(Boolean);const objs=lines.map(l=>JSON.parse(l));const hit=objs.find(o=>String(o.Service||'').includes('postgres')||String(o.Image||'').includes('postgres'));console.log(hit?hit.Name:'');}catch{console.log('')}})" \
      || true)"
  fi

  if [[ -z "${container_name}" ]]; then
    container_name="$(
      docker ps --format '{{.Names}}\t{{.Image}}\t{{.Ports}}' \
        | awk '$2 ~ /postgres/ && $3 ~ /5432->5432/ {print $1; exit}'
    )"
  fi
fi

if [[ -z "${container_name}" ]]; then
  echo "error: could not detect running postgres docker container (expected compose service publishing 5432)" >&2
  exit 2
fi

echo "$container_name"
