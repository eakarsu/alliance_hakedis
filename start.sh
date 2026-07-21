#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mode="${1:-check}"

# Accept the conventional JWT_SECRET name used by local orchestrators while
# preserving HAKEDIS_JWT_SECRET as the production-facing setting.
if [[ -z "${HAKEDIS_JWT_SECRET:-}" && -n "${JWT_SECRET:-}" ]]; then
  export HAKEDIS_JWT_SECRET="$JWT_SECRET"
fi

require_runtime_env() {
  : "${DATABASE_URL:?Set DATABASE_URL to the PostgreSQL database to use}"
  : "${JWT_SECRET:?Set JWT_SECRET (at least 32 characters)}"
  : "${HAKEDIS_JWT_SECRET:?Set HAKEDIS_JWT_SECRET (at least 32 characters)}"
  if (( ${#JWT_SECRET} < 32 )); then echo "JWT_SECRET must contain at least 32 characters" >&2; exit 64; fi
  if (( ${#HAKEDIS_JWT_SECRET} < 32 )); then echo "HAKEDIS_JWT_SECRET must contain at least 32 characters" >&2; exit 64; fi
}
case "$mode" in
  check)
    npm --prefix "$project_dir/backend" run check
    npm --prefix "$project_dir/frontend" run build
    ;;
  migrate)
    require_runtime_env
    if [[ "${ALLOW_SCHEMA_MIGRATION:-}" != "1" ]]; then echo "Migration is disabled. Review the SQL and set ALLOW_SCHEMA_MIGRATION=1." >&2; exit 64; fi
    command -v psql >/dev/null || { echo "psql is required" >&2; exit 69; }
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$project_dir/backend/db/migration_012_governed_hakedis.sql"
    ;;
  start)
    require_runtime_env
    cd "$project_dir/backend"
    exec node server.js
    ;;
  *) echo "Usage: $0 {check|migrate|start}" >&2; exit 64 ;;
esac
