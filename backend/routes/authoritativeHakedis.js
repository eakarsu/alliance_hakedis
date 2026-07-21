'use strict';

const crypto = require('crypto');
const express = require('express');
const pool = require('../db/connection');
const identity = require('../middleware/hakedisIdentity');
const domain = require('../domain/hakedisWorkflow');
const providers = require('../domain/hakedisProviders');

const router = express.Router();
router.use(identity);
const APPROVAL_STATES = { measurement: 'measurement_review', finance: 'finance_review' };

function toClaim(row) {
  return { id: row.id, tenantId: String(row.tenant_id), ownerId: row.owner_id, projectReference: row.project_reference,
    periodStart: String(row.period_start).slice(0, 10), periodEnd: String(row.period_end).slice(0, 10),
    claimedCents: Number(row.claimed_cents), retentionBps: row.retention_bps, payableCents: Number(row.payable_cents),
    currency: row.currency.trim(), lineItems: row.line_items, evidence: row.evidence, participantIds: row.participant_ids,
    state: row.state, version: row.version, createdAt: row.created_at, updatedAt: row.updated_at };
}
async function transaction(work) {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const value = await work(client); await client.query('COMMIT'); return value; }
  catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
async function membership(client, actor) {
  const result = await client.query("SELECT role FROM hakedis_memberships WHERE tenant_id=$1 AND actor_id=$2 AND status='active'", [actor.tenantId, actor.id]);
  if (!result.rowCount || result.rows[0].role !== actor.role) throw Object.assign(new Error('Active tenant membership is required'), { status: 403 });
}
async function audit(client, actor, action, type, id, details = {}) {
  await client.query('INSERT INTO hakedis_audit(tenant_id,actor_id,actor_role,action,target_type,target_id,details) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)', [actor.tenantId, actor.id, actor.role, action, type, String(id), JSON.stringify(details)]);
}
function scoped(actor, claim) { try { domain.authorizeScope(actor, claim); } catch (error) { error.status = 403; throw error; } }

router.post('/claims', async (req, res, next) => {
  try {
    const actor = req.hakedisActor;
    if (!['contractor', 'admin'].includes(domain.roleOf(actor))) return res.status(403).json({ error: 'Contractor role is required' });
    const input = domain.validateClaim({ ...req.body, currency: String(req.body?.currency || '').toUpperCase(), retentionBps: req.body?.retentionBps ?? 0 });
    const result = await transaction(async (client) => {
      await membership(client, actor); const id = crypto.randomUUID(); const inputHash = domain.digest(input);
      const inserted = await client.query(
        `INSERT INTO hakedis_claims(id,tenant_id,owner_id,project_reference,period_start,period_end,claimed_cents,retention_bps,payable_cents,currency,line_items,evidence,participant_ids,input_hash)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14) RETURNING *`,
        [id, actor.tenantId, actor.id, input.projectReference, input.periodStart, input.periodEnd, input.claimedCents, input.retentionBps, input.payableCents, input.currency, JSON.stringify(input.lineItems), JSON.stringify(input.evidence), JSON.stringify((input.participantIds || []).map(String)), inputHash]);
      await client.query(`INSERT INTO hakedis_claim_events(tenant_id,claim_id,actor_id,actor_role,command,from_state,to_state,idempotency_key,payload) VALUES($1,$2,$3,$4,'create','none','draft',$5,$6::jsonb)`, [actor.tenantId, id, actor.id, actor.role, `create:${id}`, JSON.stringify({ inputHash })]);
      await audit(client, actor, 'claim.created', 'claim', id, { inputHash, payableCents: input.payableCents });
      return toClaim(inserted.rows[0]);
    });
    res.status(201).json(result);
  } catch (error) { next(error); }
});

router.get('/claims/:claimId', async (req, res, next) => {
  try {
    const actor = req.hakedisActor; await membership(pool, actor);
    const selected = await pool.query('SELECT * FROM hakedis_claims WHERE id=$1 AND tenant_id=$2', [req.params.claimId, actor.tenantId]);
    if (!selected.rowCount) return res.status(404).json({ error: 'Claim not found' });
    const claim = toClaim(selected.rows[0]); scoped(actor, claim); res.json(claim);
  } catch (error) { next(error); }
});

router.post('/claims/:claimId/approvals', async (req, res, next) => {
  try {
    const actor = req.hakedisActor; const kind = String(req.body?.kind || '');
    if (!APPROVAL_STATES[kind] || String(req.body?.rationale || '').trim().length < 5) return res.status(400).json({ error: 'Valid approval kind and rationale are required' });
    const result = await transaction(async (client) => {
      await membership(client, actor);
      const selected = await client.query('SELECT * FROM hakedis_claims WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [req.params.claimId, actor.tenantId]);
      if (!selected.rowCount) throw Object.assign(new Error('Claim not found'), { status: 404 });
      const claim = toClaim(selected.rows[0]); scoped(actor, claim);
      if (actor.id !== claim.ownerId && domain.roleOf(actor) !== 'admin') throw Object.assign(new Error('Only the claim owner can request approval'), { status: 403 });
      if (claim.state !== APPROVAL_STATES[kind]) throw Object.assign(new Error(`${kind} approval cannot be requested from ${claim.state}`), { status: 409 });
      const id = crypto.randomUUID();
      const inserted = await client.query('INSERT INTO hakedis_approvals(id,tenant_id,claim_id,kind,requested_by,rationale) VALUES($1,$2,$3,$4,$5,$6) RETURNING *', [id, actor.tenantId, claim.id, kind, actor.id, String(req.body.rationale).trim()]);
      await audit(client, actor, 'approval.requested', 'approval', id, { claimId: claim.id, kind }); return inserted.rows[0];
    });
    res.status(201).json(result);
  } catch (error) { next(error); }
});

router.post('/approvals/:approvalId/decision', async (req, res, next) => {
  try {
    const actor = req.hakedisActor;
    if (!['approved', 'rejected'].includes(req.body?.decision)) return res.status(400).json({ error: 'Decision must be approved or rejected' });
    if (!['verifier', 'finance', 'admin'].includes(domain.roleOf(actor))) return res.status(403).json({ error: 'Reviewer role is required' });
    const result = await transaction(async (client) => {
      await membership(client, actor);
      const selected = await client.query('SELECT * FROM hakedis_approvals WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [req.params.approvalId, actor.tenantId]);
      if (!selected.rowCount) throw Object.assign(new Error('Approval not found'), { status: 404 });
      if (selected.rows[0].decision !== 'pending') return { ...selected.rows[0], duplicate: true };
      if (String(selected.rows[0].requested_by) === actor.id) throw Object.assign(new Error('Self-approval is forbidden'), { status: 409 });
      const updated = await client.query('UPDATE hakedis_approvals SET decision=$1,decided_by=$2,decided_at=NOW() WHERE id=$3 RETURNING *', [req.body.decision, actor.id, req.params.approvalId]);
      await audit(client, actor, 'approval.decided', 'approval', req.params.approvalId, { decision: req.body.decision }); return updated.rows[0];
    });
    res.json(result);
  } catch (error) { next(error); }
});

router.post('/claims/:claimId/commands', async (req, res, next) => {
  try {
    const actor = req.hakedisActor; const key = String(req.get('idempotency-key') || '');
    if (key.length < 8 || key.length > 160) return res.status(400).json({ error: 'A stable Idempotency-Key is required' });
    const result = await transaction(async (client) => {
      await membership(client, actor);
      const selected = await client.query('SELECT * FROM hakedis_claims WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [req.params.claimId, actor.tenantId]);
      if (!selected.rowCount) throw Object.assign(new Error('Claim not found'), { status: 404 });
      const current = toClaim(selected.rows[0]); scoped(actor, current);
      const requestHash = domain.digest({ command: req.body?.command, payload: req.body?.payload || {}, approvalId: req.body?.approvalId || null });
      const duplicate = await client.query('SELECT to_state,payload FROM hakedis_claim_events WHERE claim_id=$1 AND idempotency_key=$2', [current.id, key]);
      if (duplicate.rowCount) {
        if (duplicate.rows[0].payload.requestHash !== requestHash) throw Object.assign(new Error('Idempotency conflict'), { status: 409 });
        return { id: current.id, state: duplicate.rows[0].to_state, duplicate: true };
      }
      let approval = null;
      if (req.body?.approvalId) {
        const approved = await client.query('SELECT kind,decision,requested_by AS "requestedBy",decided_by AS "decidedBy" FROM hakedis_approvals WHERE id=$1 AND tenant_id=$2 AND claim_id=$3 AND consumed_at IS NULL', [req.body.approvalId, actor.tenantId, current.id]); approval = approved.rows[0] || null;
      }
      let updated; try { updated = domain.applyCommand(current, actor, req.body?.command, req.body?.payload || {}, approval); }
      catch (error) { error.status = /role|scope|owner/.test(error.message) ? 403 : 409; throw error; }
      const saved = await client.query('UPDATE hakedis_claims SET state=$1,version=$2,updated_at=NOW() WHERE id=$3 AND version=$4 RETURNING *', [updated.state, updated.version, current.id, current.version]);
      if (!saved.rowCount) throw Object.assign(new Error('Version conflict'), { status: 409 });
      await client.query(`INSERT INTO hakedis_claim_events(tenant_id,claim_id,actor_id,actor_role,command,from_state,to_state,idempotency_key,payload,approval_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)`, [actor.tenantId, current.id, actor.id, actor.role, req.body.command, current.state, updated.state, key, JSON.stringify({ ...(req.body.payload || {}), requestHash }), req.body.approvalId || null]);
      if (req.body?.approvalId) await client.query('UPDATE hakedis_approvals SET consumed_at=NOW(),consumed_claim_version=$1 WHERE id=$2 AND consumed_at IS NULL', [updated.version, req.body.approvalId]);
      await audit(client, actor, 'claim.transitioned', 'claim', current.id, { command: req.body.command, from: current.state, to: updated.state, requestHash }); return { ...toClaim(saved.rows[0]), duplicate: false };
    });
    res.json(result);
  } catch (error) { next(error); }
});

router.post('/claims/:claimId/disbursements', async (req, res, next) => {
  try {
    const actor = req.hakedisActor; const key = String(req.get('idempotency-key') || '');
    if (!['finance', 'admin'].includes(domain.roleOf(actor))) return res.status(403).json({ error: 'Finance role is required' });
    if (key.length < 8) return res.status(400).json({ error: 'A stable Idempotency-Key is required' });
    const result = await transaction(async (client) => {
      await membership(client, actor);
      const selected = await client.query('SELECT * FROM hakedis_claims WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [req.params.claimId, actor.tenantId]);
      if (!selected.rowCount) throw Object.assign(new Error('Claim not found'), { status: 404 });
      const claim = toClaim(selected.rows[0]); scoped(actor, claim);
      if (claim.state !== 'payable') throw Object.assign(new Error('Only payable claims may be disbursed'), { status: 409 });
      const payload = { claimId: claim.id, claimVersion: claim.version, amountCents: claim.payableCents, currency: claim.currency, beneficiaryReference: String(req.body?.beneficiaryReference || '') };
      if (!payload.beneficiaryReference || payload.beneficiaryReference.length > 160) throw Object.assign(new Error('A bounded beneficiaryReference is required'), { status: 400 });
      const payloadHash = domain.digest(payload); payload.payloadHash = payloadHash;
      const inserted = await client.query(`INSERT INTO hakedis_delivery_jobs(id,tenant_id,claim_id,connector,operation,idempotency_key,payload,payload_hash) VALUES($1,$2,$3,'payment','payout.create',$4,$5::jsonb,$6) ON CONFLICT(tenant_id,connector,idempotency_key) DO NOTHING RETURNING *`, [crypto.randomUUID(), actor.tenantId, claim.id, key, JSON.stringify(payload), payloadHash]);
      if (!inserted.rowCount) {
        const existing = await client.query("SELECT * FROM hakedis_delivery_jobs WHERE tenant_id=$1 AND connector='payment' AND idempotency_key=$2", [actor.tenantId, key]);
        if (existing.rows[0].payload_hash !== payloadHash) throw Object.assign(new Error('Idempotency conflict'), { status: 409 });
        return { ...existing.rows[0], duplicate: true };
      }
      await audit(client, actor, 'disbursement.queued', 'delivery', inserted.rows[0].id, { claimId: claim.id, payloadHash }); return inserted.rows[0];
    });
    res.status(result.duplicate ? 200 : 202).json(result);
  } catch (error) { next(error); }
});

router.post('/disbursements/:jobId/dispatch', async (req, res, next) => {
  const actor = req.hakedisActor;
  if (!['finance', 'admin'].includes(domain.roleOf(actor))) return res.status(403).json({ error: 'Finance role is required' });
  try {
    await membership(pool, actor);
    const found = await pool.query("SELECT * FROM hakedis_delivery_jobs WHERE id=$1 AND tenant_id=$2 AND connector='payment'", [req.params.jobId, actor.tenantId]);
    if (!found.rowCount) return res.status(404).json({ error: 'Disbursement not found' }); const job = found.rows[0];
    if (job.status === 'confirmed') return res.json({ ...job, duplicate: true });
    const receipt = await providers.dispatch({ connector: job.connector, operation: job.operation, payload: job.payload, idempotencyKey: job.idempotency_key });
    const result = await transaction(async (client) => {
      const claim = await client.query("UPDATE hakedis_claims SET state='paid',version=version+1,updated_at=NOW() WHERE id=$1 AND tenant_id=$2 AND state='payable' RETURNING *", [job.claim_id, actor.tenantId]);
      if (!claim.rowCount) throw Object.assign(new Error('Claim is no longer payable'), { status: 409 });
      const updated = await client.query("UPDATE hakedis_delivery_jobs SET status='confirmed',attempts=attempts+1,provider_reference=$1,updated_at=NOW() WHERE id=$2 RETURNING *", [String(receipt.id), job.id]);
      await client.query('INSERT INTO hakedis_provider_receipts(tenant_id,job_id,provider_reference,payload_hash,receipt) VALUES($1,$2,$3,$4,$5::jsonb)', [actor.tenantId, job.id, String(receipt.id), job.payload_hash, JSON.stringify(receipt)]);
      await client.query(`INSERT INTO hakedis_claim_events(tenant_id,claim_id,actor_id,actor_role,command,from_state,to_state,idempotency_key,payload) VALUES($1,$2,$3,$4,'provider_confirmed','payable','paid',$5,$6::jsonb)`, [actor.tenantId, job.claim_id, actor.id, actor.role, `provider:${job.id}`, JSON.stringify({ providerReference: String(receipt.id), payloadHash: job.payload_hash })]);
      await audit(client, actor, 'disbursement.confirmed', 'delivery', job.id, { claimId: job.claim_id, providerReference: String(receipt.id), payloadHash: job.payload_hash }); return updated.rows[0];
    }); res.json(result);
  } catch (error) {
    const found = await pool.query('SELECT attempts FROM hakedis_delivery_jobs WHERE id=$1 AND tenant_id=$2', [req.params.jobId, actor.tenantId]);
    if (found.rowCount) await transaction(async (client) => {
      const decision = domain.nextDelivery(Number(found.rows[0].attempts), error.retryable !== false);
      await client.query("UPDATE hakedis_delivery_jobs SET status=$1,attempts=$2,next_attempt_at=NOW()+($3*INTERVAL '1 second'),last_error=$4,updated_at=NOW() WHERE id=$5 AND tenant_id=$6", [decision.status, decision.attempts, decision.delaySeconds, String(error.message).slice(0, 300), req.params.jobId, actor.tenantId]);
      await audit(client, actor, `disbursement.${decision.status}`, 'delivery', req.params.jobId, { attempts: decision.attempts, retryable: error.retryable !== false, error: String(error.message).slice(0, 300) });
    }); error.status = error.retryable === false ? 422 : (error.status || 503); next(error);
  }
});

router.get('/claims/:claimId/audit', async (req, res, next) => {
  try {
    const actor = req.hakedisActor; await membership(pool, actor);
    const selected = await pool.query('SELECT * FROM hakedis_claims WHERE id=$1 AND tenant_id=$2', [req.params.claimId, actor.tenantId]);
    if (!selected.rowCount) return res.status(404).json({ error: 'Claim not found' }); scoped(actor, toClaim(selected.rows[0]));
    const events = await pool.query('SELECT sequence,actor_id,actor_role,command,from_state,to_state,idempotency_key,payload,approval_id,occurred_at FROM hakedis_claim_events WHERE claim_id=$1 AND tenant_id=$2 ORDER BY sequence', [req.params.claimId, actor.tenantId]); res.json({ claimId: req.params.claimId, events: events.rows });
  } catch (error) { next(error); }
});

router.get('/monitoring', async (req, res, next) => {
  try {
    const actor = req.hakedisActor; await membership(pool, actor);
    const result = await pool.query(`SELECT (SELECT COUNT(*)::int FROM hakedis_claims WHERE tenant_id=$1) AS claims, (SELECT COUNT(*)::int FROM hakedis_approvals WHERE tenant_id=$1 AND decision='pending') AS pending_approvals, (SELECT COUNT(*)::int FROM hakedis_delivery_jobs WHERE tenant_id=$1 AND status IN('queued','retry')) AS queued_deliveries, (SELECT COUNT(*)::int FROM hakedis_delivery_jobs WHERE tenant_id=$1 AND status='dead_letter') AS dead_letters`, [actor.tenantId]); res.json(result.rows[0]);
  } catch (error) { next(error); }
});

module.exports = router;
