'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

test('persistent claim journey enforces exact money, approvals, provider receipt, tenant and audit', { skip: process.env.RUN_DB_TESTS !== '1' }, async (t) => {
  const jwt = require('jsonwebtoken'); const pool = require('../db/connection'); const app = require('../server');
  const tenant = '11111111-1111-4111-8111-111111111111'; const otherTenant = '22222222-2222-4222-8222-222222222222';
  await pool.query("INSERT INTO hakedis_memberships(tenant_id,actor_id,role) VALUES($1,'owner','enterprise_partner'),($1,'verifier','solution_architect'),($1,'finance','pmo_coordinator'),($2,'other','enterprise_partner')", [tenant, otherTenant]);
  const appServer = app.listen(Number(process.env.TEST_API_PORT || 0), '127.0.0.1'); await new Promise((resolve) => appServer.once('listening', resolve));
  const provider = http.createServer(async (req, res) => { let body = ''; for await (const chunk of req) body += chunk; const payload = JSON.parse(body); res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ id: 'payment-receipt-1', payloadHash: payload.payloadHash })); });
  provider.listen(Number(process.env.TEST_PROVIDER_PORT || 0), '127.0.0.1'); await new Promise((resolve) => provider.once('listening', resolve));
  t.after(async () => { await new Promise((resolve) => appServer.close(resolve)); await new Promise((resolve) => provider.close(resolve)); await pool.end(); });
  const base = `http://127.0.0.1:${appServer.address().port}/api/v1/hakedis`;
  const token = (sub, tenantId, role) => jwt.sign({ sub, tenantId, role }, process.env.HAKEDIS_JWT_SECRET, { algorithm: 'HS256', issuer: 'hakedis-identity', audience: 'hakedis-api', expiresIn: '5m' });
  const call = async (who, route, options = {}) => { const response = await fetch(`${base}${route}`, { method: options.method || 'GET', headers: { authorization: `Bearer ${who}`, 'content-type': 'application/json', ...(options.headers || {}) }, body: options.body === undefined ? undefined : JSON.stringify(options.body) }); return { status: response.status, body: await response.json() }; };
  const owner = token('owner', tenant, 'enterprise_partner'); const verifier = token('verifier', tenant, 'solution_architect'); const finance = token('finance', tenant, 'pmo_coordinator');
  const created = await call(owner, '/claims', { method: 'POST', body: { projectReference: 'BUILD-42', periodStart: '2026-07-01', periodEnd: '2026-07-31', claimedCents: 10000, retentionBps: 1000, currency: 'try', lineItems: [{ code: 'FOUNDATION', amountCents: 6000 }, { code: 'STEEL', amountCents: 4000 }], evidence: [{ uri: 'vault://measurements/1', sha256: 'a'.repeat(64) }] } }); assert.equal(created.status, 201, JSON.stringify(created.body)); assert.equal(created.body.payableCents, 9000); const claimId = created.body.id;
  assert.equal((await call(owner, `/claims/${claimId}/approvals`, { method: 'POST', body: { kind: 'measurement', rationale: 'Too early measurement' } })).status, 409);
  const submit = await call(owner, `/claims/${claimId}/commands`, { method: 'POST', headers: { 'Idempotency-Key': 'submit-claim-1' }, body: { command: 'submit' } }); assert.equal(submit.body.state, 'measurement_review');
  assert.equal((await call(owner, `/claims/${claimId}/commands`, { method: 'POST', headers: { 'Idempotency-Key': 'submit-claim-1' }, body: { command: 'submit' } })).body.duplicate, true);
  assert.equal((await call(owner, `/claims/${claimId}/commands`, { method: 'POST', headers: { 'Idempotency-Key': 'submit-claim-1' }, body: { command: 'submit', payload: { altered: true } } })).status, 409);
  for (const [kind, reviewer, command, expected] of [['measurement', verifier, 'approve_measurement', 'finance_review'], ['finance', finance, 'authorize_payment', 'payable']]) {
    const requested = await call(owner, `/claims/${claimId}/approvals`, { method: 'POST', body: { kind, rationale: `Independent ${kind} check` } }); assert.equal(requested.status, 201, JSON.stringify(requested.body));
    assert.equal((await call(reviewer, `/approvals/${requested.body.id}/decision`, { method: 'POST', body: { decision: 'approved' } })).status, 200);
    const changed = await call(reviewer, `/claims/${claimId}/commands`, { method: 'POST', headers: { 'Idempotency-Key': `command-${kind}-1` }, body: { command, approvalId: requested.body.id } }); assert.equal(changed.body.state, expected, JSON.stringify(changed.body));
  }
  const failedJob = await call(finance, `/claims/${claimId}/disbursements`, { method: 'POST', headers: { 'Idempotency-Key': 'payment-fail-1' }, body: { beneficiaryReference: 'contractor-iban-token' } }); assert.equal(failedJob.status, 202);
  assert.equal((await call(finance, `/disbursements/${failedJob.body.id}/dispatch`, { method: 'POST', body: {} })).status, 422);
  process.env.HAKEDIS_PAYMENT_PROVIDER_URL = `http://127.0.0.1:${provider.address().port}`; process.env.HAKEDIS_PAYMENT_PROVIDER_TOKEN = 'test-token'; process.env.ALLOW_INSECURE_PROVIDER_HTTP = 'true';
  const job = await call(finance, `/claims/${claimId}/disbursements`, { method: 'POST', headers: { 'Idempotency-Key': 'payment-success-1' }, body: { beneficiaryReference: 'contractor-iban-token' } }); assert.equal(job.status, 202);
  assert.equal((await call(finance, `/disbursements/${job.body.id}/dispatch`, { method: 'POST', body: {} })).status, 200);
  assert.equal((await call(owner, `/claims/${claimId}`)).body.state, 'paid');
  const other = token('other', otherTenant, 'enterprise_partner'); assert.equal((await call(other, `/claims/${claimId}`)).status, 404);
  const monitoring = await call(finance, '/monitoring'); assert.equal(monitoring.body.dead_letters, 1);
  const audit = await call(owner, `/claims/${claimId}/audit`); assert.equal(audit.body.events.length, 5);
  assert.equal(Number((await pool.query('SELECT COUNT(*) FROM hakedis_provider_receipts WHERE job_id=$1', [job.body.id])).rows[0].count), 1);
  assert.equal(Number((await pool.query('SELECT COUNT(*) FROM hakedis_approvals WHERE claim_id=$1 AND consumed_at IS NOT NULL', [claimId])).rows[0].count), 2);
  await assert.rejects(pool.query("UPDATE hakedis_claim_events SET actor_id='tampered' WHERE claim_id=$1", [claimId]), /append-only/);
  await pool.query("UPDATE hakedis_memberships SET status='suspended' WHERE tenant_id=$1 AND actor_id='owner'", [tenant]); assert.equal((await call(owner, `/claims/${claimId}`)).status, 403);
});
