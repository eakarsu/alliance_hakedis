BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS hakedis_memberships (
  tenant_id UUID NOT NULL, actor_id TEXT NOT NULL, role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(tenant_id,actor_id)
);
CREATE TABLE IF NOT EXISTS hakedis_claims (
  id UUID PRIMARY KEY, tenant_id UUID NOT NULL, owner_id TEXT NOT NULL, project_reference TEXT NOT NULL,
  period_start DATE NOT NULL, period_end DATE NOT NULL CHECK(period_end>=period_start),
  claimed_cents BIGINT NOT NULL CHECK(claimed_cents>0), retention_bps INTEGER NOT NULL CHECK(retention_bps BETWEEN 0 AND 10000),
  payable_cents BIGINT NOT NULL CHECK(payable_cents>=0 AND payable_cents<=claimed_cents), currency CHAR(3) NOT NULL,
  line_items JSONB NOT NULL, evidence JSONB NOT NULL, participant_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  input_hash CHAR(64) NOT NULL, state TEXT NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','measurement_review','finance_review','payable','paid','rejected','exception')),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS hakedis_claim_scope_idx ON hakedis_claims(tenant_id,owner_id,state,updated_at DESC);
CREATE TABLE IF NOT EXISTS hakedis_approvals (
  id UUID PRIMARY KEY, tenant_id UUID NOT NULL, claim_id UUID NOT NULL REFERENCES hakedis_claims(id),
  kind TEXT NOT NULL CHECK(kind IN ('measurement','finance')), requested_by TEXT NOT NULL,
  decision TEXT NOT NULL DEFAULT 'pending' CHECK(decision IN ('pending','approved','rejected')), decided_by TEXT,
  rationale TEXT NOT NULL, requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), decided_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ, consumed_claim_version INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS hakedis_one_pending_approval_idx ON hakedis_approvals(claim_id,kind) WHERE decision='pending';
CREATE TABLE IF NOT EXISTS hakedis_claim_events (
  sequence BIGSERIAL PRIMARY KEY, tenant_id UUID NOT NULL, claim_id UUID NOT NULL REFERENCES hakedis_claims(id),
  actor_id TEXT NOT NULL, actor_role TEXT NOT NULL, command TEXT NOT NULL, from_state TEXT NOT NULL, to_state TEXT NOT NULL,
  idempotency_key TEXT NOT NULL, payload JSONB NOT NULL, approval_id UUID REFERENCES hakedis_approvals(id),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(claim_id,idempotency_key)
);
CREATE TABLE IF NOT EXISTS hakedis_delivery_jobs (
  id UUID PRIMARY KEY, tenant_id UUID NOT NULL, claim_id UUID NOT NULL REFERENCES hakedis_claims(id),
  connector TEXT NOT NULL CHECK(connector IN ('payment','notification')), operation TEXT NOT NULL,
  idempotency_key TEXT NOT NULL, payload JSONB NOT NULL, payload_hash CHAR(64) NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','retry','confirmed','dead_letter')),
  attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  provider_reference TEXT, last_error TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id,connector,idempotency_key)
);
CREATE TABLE IF NOT EXISTS hakedis_provider_receipts (
  id BIGSERIAL PRIMARY KEY, tenant_id UUID NOT NULL, job_id UUID NOT NULL REFERENCES hakedis_delivery_jobs(id),
  provider_reference TEXT NOT NULL, payload_hash CHAR(64) NOT NULL, receipt JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(job_id,provider_reference)
);
CREATE TABLE IF NOT EXISTS hakedis_audit (
  id BIGSERIAL PRIMARY KEY, tenant_id UUID NOT NULL, actor_id TEXT NOT NULL, actor_role TEXT NOT NULL,
  action TEXT NOT NULL, target_type TEXT NOT NULL, target_id TEXT NOT NULL, details JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE OR REPLACE FUNCTION hakedis_append_only() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'hakedis record is append-only'; END $$;
DROP TRIGGER IF EXISTS hakedis_event_immutable_trigger ON hakedis_claim_events;
CREATE TRIGGER hakedis_event_immutable_trigger BEFORE UPDATE OR DELETE ON hakedis_claim_events FOR EACH ROW EXECUTE FUNCTION hakedis_append_only();
DROP TRIGGER IF EXISTS hakedis_audit_immutable_trigger ON hakedis_audit;
CREATE TRIGGER hakedis_audit_immutable_trigger BEFORE UPDATE OR DELETE ON hakedis_audit FOR EACH ROW EXECUTE FUNCTION hakedis_append_only();
COMMIT;
