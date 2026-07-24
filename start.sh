#!/usr/bin/env bash
set -euo pipefail

# Local demo credential bridge (managed by tools/fix_demo_autofill.mjs)
demo_credentials_project_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
if [ -f "$demo_credentials_project_dir/.env" ]; then
  while IFS= read -r demo_credentials_line || [ -n "$demo_credentials_line" ]; do
    case "$demo_credentials_line" in ''|'#'*) continue ;; esac
    demo_credentials_line="${demo_credentials_line#export }"
    demo_credentials_key="${demo_credentials_line%%=*}"
    demo_credentials_value="${demo_credentials_line#*=}"
    case "$demo_credentials_key" in
      NODE_ENV|ENABLE_DEMO_CREDENTIAL_AUTOFILL|DEMO_EMAIL|DEMO_PASSWORD|SEED_ADMIN_EMAIL|SEED_ADMIN_PASSWORD|ADMIN_EMAIL|ADMIN_PASSWORD|DEFAULT_EMAIL|DEFAULT_PASSWORD) ;;
      *) continue ;;
    esac
    [ -n "${!demo_credentials_key+x}" ] && continue
    demo_credentials_first="${demo_credentials_value:0:1}"
    demo_credentials_last="${demo_credentials_value: -1}"
    if { [ "$demo_credentials_first" = '"' ] && [ "$demo_credentials_last" = '"' ]; } || { [ "$demo_credentials_first" = "'" ] && [ "$demo_credentials_last" = "'" ]; }; then
      demo_credentials_value="${demo_credentials_value:1:${#demo_credentials_value}-2}"
    fi
    export "$demo_credentials_key=$demo_credentials_value"
  done < "$demo_credentials_project_dir/.env"
fi
demo_credentials_email=""
demo_credentials_password=""
if [ -n "${DEMO_EMAIL:-}" ] && [ -n "${DEMO_PASSWORD:-}" ]; then
  demo_credentials_email="$DEMO_EMAIL"
  demo_credentials_password="$DEMO_PASSWORD"
elif [ -n "${SEED_ADMIN_EMAIL:-}" ] && [ -n "${SEED_ADMIN_PASSWORD:-}" ]; then
  demo_credentials_email="$SEED_ADMIN_EMAIL"
  demo_credentials_password="$SEED_ADMIN_PASSWORD"
elif [ -n "${ADMIN_EMAIL:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
  demo_credentials_email="$ADMIN_EMAIL"
  demo_credentials_password="$ADMIN_PASSWORD"
elif [ -n "${DEFAULT_EMAIL:-}" ] && [ -n "${DEFAULT_PASSWORD:-}" ]; then
  demo_credentials_email="$DEFAULT_EMAIL"
  demo_credentials_password="$DEFAULT_PASSWORD"
fi
if [ "${NODE_ENV:-development}" != production ] && [ "${ENABLE_DEMO_CREDENTIAL_AUTOFILL:-true}" = true ] && [ -n "$demo_credentials_email" ] && [ -n "$demo_credentials_password" ]; then
  export VITE_ENABLE_DEMO_CREDENTIAL_AUTOFILL=true
  export VITE_DEMO_EMAIL="$demo_credentials_email"
  export VITE_DEMO_PASSWORD="$demo_credentials_password"
  export REACT_APP_ENABLE_DEMO_CREDENTIAL_AUTOFILL=true
  export REACT_APP_DEMO_EMAIL="$demo_credentials_email"
  export REACT_APP_DEMO_PASSWORD="$demo_credentials_password"
  export NEXT_PUBLIC_ENABLE_DEMO_CREDENTIAL_AUTOFILL=true
  export NEXT_PUBLIC_DEMO_EMAIL="$demo_credentials_email"
  export NEXT_PUBLIC_DEMO_PASSWORD="$demo_credentials_password"
else
  export VITE_ENABLE_DEMO_CREDENTIAL_AUTOFILL=false
  export REACT_APP_ENABLE_DEMO_CREDENTIAL_AUTOFILL=false
  export NEXT_PUBLIC_ENABLE_DEMO_CREDENTIAL_AUTOFILL=false
  unset VITE_DEMO_EMAIL VITE_DEMO_PASSWORD REACT_APP_DEMO_EMAIL REACT_APP_DEMO_PASSWORD NEXT_PUBLIC_DEMO_EMAIL NEXT_PUBLIC_DEMO_PASSWORD
fi
unset demo_credentials_email demo_credentials_password demo_credentials_project_dir demo_credentials_line demo_credentials_key demo_credentials_value demo_credentials_first demo_credentials_last

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
npm --prefix "$project_dir/backend" run provision-demo-users

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
