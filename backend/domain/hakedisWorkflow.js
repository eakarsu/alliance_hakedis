'use strict';

const crypto = require('crypto');

const canonical = (value) => Array.isArray(value)
  ? `[${value.map(canonical).join(',')}]`
  : value && typeof value === 'object'
    ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
    : JSON.stringify(value);
const digest = (value) => crypto.createHash('sha256').update(canonical(value)).digest('hex');

const ROLE_ALIASES = {
  founding_orchestrator: 'admin', pmo_coordinator: 'finance', solution_architect: 'verifier',
  enterprise_partner: 'contractor', product_partner: 'contractor', product_experience_lead: 'contractor',
  restricted_external: 'viewer', us_market_bridge: 'viewer',
};
const COMMANDS = {
  submit: { from: ['draft', 'exception'], to: 'measurement_review', roles: ['contractor', 'admin'] },
  approve_measurement: { from: ['measurement_review'], to: 'finance_review', roles: ['verifier', 'admin'], approval: 'measurement' },
  authorize_payment: { from: ['finance_review'], to: 'payable', roles: ['finance', 'admin'], approval: 'finance' },
  reject: { from: ['measurement_review', 'finance_review'], to: 'rejected', roles: ['verifier', 'finance', 'admin'] },
  recover: { from: ['rejected', 'exception'], to: null, roles: ['admin'] },
};

function roleOf(actor) { return ROLE_ALIASES[actor.role] || actor.role; }
function validateClaim(input) {
  const date = /^\d{4}-\d{2}-\d{2}$/;
  if (!input.projectReference || String(input.projectReference).trim().length > 120) throw new Error('projectReference is required and limited to 120 characters');
  if (!date.test(input.periodStart || '') || !date.test(input.periodEnd || '') || input.periodStart > input.periodEnd) throw new Error('a valid ordered claim period is required');
  if (!Number.isSafeInteger(input.claimedCents) || input.claimedCents <= 0) throw new Error('claimedCents must be a positive safe integer');
  if (!Number.isInteger(input.retentionBps) || input.retentionBps < 0 || input.retentionBps > 10000) throw new Error('retentionBps must be 0-10000');
  if (!/^[A-Z]{3}$/.test(input.currency || '')) throw new Error('currency must be a three-letter uppercase code');
  if (!Array.isArray(input.lineItems) || !input.lineItems.length || input.lineItems.length > 500) throw new Error('1-500 line items are required');
  const lineTotal = input.lineItems.reduce((sum, item) => {
    if (!item.code || String(item.code).length > 80 || !Number.isSafeInteger(item.amountCents) || item.amountCents <= 0) throw new Error('each line item requires a code and positive exact amount');
    return sum + item.amountCents;
  }, 0);
  if (!Number.isSafeInteger(lineTotal) || lineTotal !== input.claimedCents) throw new Error('line items must equal claimedCents exactly');
  if (!Array.isArray(input.evidence) || !input.evidence.length || input.evidence.length > 100 || input.evidence.some((item) => !/^(https:\/\/|vault:\/\/)/.test(item.uri || '') || !/^[a-f0-9]{64}$/.test(item.sha256 || ''))) throw new Error('checksum-bound HTTPS or vault evidence is required');
  const payableCents = input.claimedCents - Math.floor((input.claimedCents * input.retentionBps) / 10000);
  return { ...input, projectReference: String(input.projectReference).trim(), payableCents };
}
function applyCommand(current, actor, command, payload = {}, approval = null) {
  const rule = COMMANDS[command]; const role = roleOf(actor);
  if (!rule) throw new Error('unknown command');
  if (!rule.roles.includes(role)) throw new Error('role is not permitted for command');
  if (!rule.from.includes(current.state)) throw new Error(`invalid transition from ${current.state}`);
  if (rule.approval) {
    if (!approval || approval.kind !== rule.approval || approval.decision !== 'approved') throw new Error(`${rule.approval} approval is required`);
    if (String(approval.requestedBy) === String(approval.decidedBy)) throw new Error('approval must be independent');
    if (String(approval.requestedBy) !== String(current.ownerId) && role !== 'admin') throw new Error('approval does not bind the claim owner');
  }
  let state = rule.to;
  if (command === 'recover') {
    if (!['draft', 'measurement_review', 'finance_review'].includes(payload.targetState)) throw new Error('invalid recovery target');
    state = payload.targetState;
  }
  if (command === 'reject' && String(payload.reason || '').trim().length < 5) throw new Error('rejection reason is required');
  return { ...current, state, version: current.version + 1 };
}
function authorizeScope(actor, claim) {
  if (actor.tenantId !== claim.tenantId) throw new Error('cross-tenant access denied');
  if (['admin', 'finance', 'verifier'].includes(roleOf(actor)) || String(actor.id) === String(claim.ownerId) || claim.participantIds?.map(String).includes(String(actor.id))) return true;
  throw new Error('claim is outside actor scope');
}
function nextDelivery(attempts, retryable, maxAttempts = 5) {
  const next = attempts + 1;
  if (!retryable || next >= maxAttempts) return { status: 'dead_letter', attempts: next, delaySeconds: 0 };
  return { status: 'retry', attempts: next, delaySeconds: Math.min(900, 2 ** next) };
}

module.exports = { canonical, digest, roleOf, validateClaim, applyCommand, authorizeScope, nextDelivery, COMMANDS };
