#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mode="${1:-start}"
set -a
source "$project_dir/.env"
set +a

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${JWT_SECRET:?JWT_SECRET is required}"
: "${OPENROUTER_API_KEY:?OPENROUTER_API_KEY is required}"
: "${OPENROUTER_MODEL:?OPENROUTER_MODEL is required}"
: "${OPENROUTER_BASE_URL:?OPENROUTER_BASE_URL is required}"
case "$mode" in
  check) npm --prefix "$project_dir/backend" run check; npm --prefix "$project_dir/frontend" run build; exit ;;
  migrate)
    [[ "${ALLOW_SCHEMA_MIGRATION:-0}" == "1" ]] || { echo 'Set ALLOW_SCHEMA_MIGRATION=1' >&2; exit 1; }
    npm --prefix "$project_dir/backend" run db:migrate
    exit ;;
  start) ;;
  *) echo 'usage: ./start.sh check|migrate|start' >&2; exit 2 ;;
esac
[[ "${#JWT_SECRET}" -ge 32 ]] || { echo 'JWT_SECRET must contain at least 32 characters' >&2; exit 1; }
export HAKEDIS_JWT_SECRET="${HAKEDIS_JWT_SECRET:-$JWT_SECRET}"
api_port="${BACKEND_PORT:?BACKEND_PORT is required}"
ui_port="${FRONTEND_PORT:?FRONTEND_PORT is required}"
[[ "$api_port" != "$ui_port" ]] || { echo 'BACKEND_PORT and FRONTEND_PORT must differ' >&2; exit 1; }
for port in "$api_port" "$ui_port"; do
  ! lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1 || { echo "port $port is already in use" >&2; exit 1; }
done

if [[ "${MIGRATE_ON_START:-false}" == "true" ]]; then npm --prefix "$project_dir/backend" run db:migrate; fi
export BOOTSTRAP_ACKNOWLEDGEMENT=create-initial-admin
export PROVISION_ADMIN_EMAIL="${ADMIN_EMAIL:?ADMIN_EMAIL is required}"
export PROVISION_ADMIN_PASSWORD="${ADMIN_PASSWORD:?ADMIN_PASSWORD is required}"
npm --prefix "$project_dir/backend" run create-admin

cleanup() {
  trap - INT TERM EXIT
  [[ -z "${proxy_pid:-}" ]] || kill "$proxy_pid" 2>/dev/null || true
  [[ -z "${api_pid:-}" ]] || kill "$api_pid" 2>/dev/null || true
  [[ -z "${proxy_pid:-}" ]] || wait "$proxy_pid" 2>/dev/null || true
  [[ -z "${api_pid:-}" ]] || wait "$api_pid" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

PORT="$api_port" BACKEND_PORT="$api_port" NODE_ENV=development npm --prefix "$project_dir/backend" start &
api_pid=$!
for ((attempt=0; attempt<60; attempt++)); do
  curl -fsS "http://127.0.0.1:$api_port/api/health/ready" >/dev/null 2>&1 && break
  kill -0 "$api_pid" 2>/dev/null || { wait "$api_pid"; exit $?; }
  sleep 1
done
curl -fsS "http://127.0.0.1:$api_port/api/health/ready" >/dev/null
RUNTIME_PROXY_PORT="$ui_port" RUNTIME_PROXY_TARGET_PORT="$api_port" node "$project_dir/_runtime-proxy.mjs" &
proxy_pid=$!
wait "$api_pid" "$proxy_pid"
