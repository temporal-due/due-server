#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
README="$ROOT_DIR/README.md"
PKG="$ROOT_DIR/package.json"
ENV_EXAMPLE="$ROOT_DIR/.env.example"

# NestJS 기본 스크립트 + make 명령어로 이미 노출된 스크립트는 README 문서화 불필요
SKIP_SCRIPTS="build|format|start|start:dev|start:debug|start:prod|lint|test|test:watch|test:cov|test:debug|test:e2e|readme:check|dev:reset"

# 기본값이 있어 사용자가 직접 설정할 필요 없는 환경변수
SKIP_ENV="JWT_ACCESS_EXPIRES|JWT_REFRESH_EXPIRES_SEC"

errors=0

echo "=== pnpm 스크립트 체크 ==="
while IFS= read -r script; do
  if grep -q "pnpm ${script}" "$README"; then
    echo "  ✅ pnpm ${script}"
  else
    echo "  ❌ README 누락: pnpm ${script}"
    errors=$((errors + 1))
  fi
done < <(node -e "
const pkg = require('$PKG');
const skip = new Set('$SKIP_SCRIPTS'.split('|'));
Object.keys(pkg.scripts).filter(s => !skip.has(s)).forEach(s => console.log(s));
")

echo ""
echo "=== 환경 변수 체크 ==="
while IFS= read -r var; do
  # 기본값 있는 변수는 건너뜀
  if echo "$var" | grep -qE "^($SKIP_ENV)$"; then
    continue
  fi

  # 정확한 이름 체크, 또는 DB_HOST → `DB_* 같은 와일드카드 그룹 체크
  prefix="${var%%_*}"
  if grep -qF "\`${var}" "$README" || grep -qF "\`${prefix}_" "$README"; then
    echo "  ✅ ${var}"
  else
    echo "  ❌ README 누락: ${var}"
    errors=$((errors + 1))
  fi
done < <(grep -E '^[A-Z_]+=' "$ENV_EXAMPLE" | cut -d= -f1)

echo ""
if [ "$errors" -gt 0 ]; then
  echo "⚠️  README.md 싱크 불일치 ${errors}개 — README.md의 '주요 명령어'·'환경 변수' 섹션을 업데이트하세요."
  exit 1
else
  echo "✅ README.md 싱크 OK"
fi
