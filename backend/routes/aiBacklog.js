// aiBacklog.js — pass-5 backlog implementation for alliance_hakedis.
//
// Adds the NEEDS-PRODUCT-DECISION AI endpoints from the audit backlog:
//   - POST /api/ai/workflow-automate          (workflow automation rules)
//   - POST /api/ai/deal-structure-recommend   (deal-structure recommendations)
//   - POST /api/ai/payout-predict             (payout / commission prediction)
//   - POST /api/ai/partner-recommend          (strategic partner recommendation)
//   - POST /api/ai/partner-dashboard          (partner performance + anomaly alerts)
//
// Each picks a reasonable PRODUCT-DECISION default — see inline comments.
// All endpoints emit `503 {"error":"AI provider not configured","missing":"OPENROUTER_API_KEY"}`
// when the OpenRouter key is absent (NEEDS-CREDS gate).
const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const auth = require('../middleware/auth');
const { isRestricted } = require('../middleware/dataFilter');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022';
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';

async function callOpenRouter(messages) {
  if (!OPENROUTER_API_KEY) {
    const err = new Error('OPENROUTER_API_KEY not configured');
    err.code = 'NO_API_KEY';
    throw err;
  }
  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'Alliance CRM',
    },
    body: JSON.stringify({ model: OPENROUTER_MODEL, messages, max_tokens: 3500, temperature: 0.6 }),
  });
  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${txt}`);
  }
  const data = await response.json();
  return data.choices[0].message.content;
}

function tryParse(s) {
  try { const m = String(s).match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; }
  catch { return null; }
}

function aiKeyGate(res) {
  if (!OPENROUTER_API_KEY) {
    res.status(503).json({ error: 'AI provider not configured', missing: 'OPENROUTER_API_KEY' });
    return true;
  }
  return false;
}

// ─── Workflow automation rules ─────────────────────────────────────────────
// PRODUCT-DECISION: scope is "suggest which steps in a given workflow
// instance can be auto-executed vs. require human-in-the-loop".  We do
// not actually flip switches in the DB — the FE shows recommendations and
// a future delivery worker may apply them with admin approval.
router.post('/workflow-automate', auth, async (req, res) => {
  if (aiKeyGate(res)) return;
  if (isRestricted(req.user.role)) return res.status(403).json({ error: 'Restricted role' });
  const { workflow_instance_id, workflow_template_id } = req.body || {};
  if (!workflow_instance_id && !workflow_template_id) {
    return res.status(400).json({ error: 'workflow_instance_id or workflow_template_id required' });
  }
  let inst = null, tmpl = null;
  try {
    if (workflow_instance_id) {
      const r = await pool.query('SELECT * FROM approval_workflow_instances WHERE id = $1', [workflow_instance_id]);
      inst = r.rows[0] || null;
    }
    const tid = workflow_template_id || (inst && inst.template_id);
    if (tid) {
      const r = await pool.query('SELECT * FROM approval_workflow_templates WHERE id = $1', [tid]);
      tmpl = r.rows[0] || null;
    }
  } catch (_) {}
  try {
    const messages = [
      { role: 'system', content: 'Classify each workflow step as auto-executable or human-in-the-loop. Strict JSON: {"steps":[{"step":"...","auto_safe":true,"reason":"...","preconditions":["..."],"rollback":"..."}],"overall_automation_score":N}.' },
      { role: 'user', content: `Instance:\n${JSON.stringify(inst, null, 2)}\nTemplate:\n${JSON.stringify(tmpl, null, 2)}` },
    ];
    const raw = await callOpenRouter(messages);
    res.json({ workflow_instance_id: workflow_instance_id || null, automation: tryParse(raw) || { raw }, model: OPENROUTER_MODEL });
  } catch (err) { res.status(500).json({ error: 'Workflow automation failed', message: err.message }); }
});

// ─── Deal-structure recommendation ─────────────────────────────────────────
// PRODUCT-DECISION: allowed structures = subscription | one-time | revshare |
// hybrid_subscription_revshare.  These four cover the existing pipeline types
// in the SYSTEM_PROMPT.  More structures can be added later by editing this
// list — the LLM picks from it.
const ALLOWED_DEAL_STRUCTURES = ['subscription', 'one_time', 'revshare', 'hybrid_subscription_revshare'];
router.post('/deal-structure-recommend', auth, async (req, res) => {
  if (aiKeyGate(res)) return;
  if (isRestricted(req.user.role)) return res.status(403).json({ error: 'Restricted role' });
  const { opportunity_id } = req.body || {};
  if (!opportunity_id) return res.status(400).json({ error: 'opportunity_id required' });

  let opp = null;
  try {
    const r = await pool.query(
      `SELECT o.*, p.pipeline_name, s.stage_name, org.org_name
       FROM opportunities o
       LEFT JOIN pipelines p ON o.pipeline_id = p.id
       LEFT JOIN stages s ON o.stage_id = s.id
       LEFT JOIN organizations org ON o.account_org_id = org.id
       WHERE o.id = $1`, [opportunity_id]);
    opp = r.rows[0] || null;
  } catch (_) {}
  if (!opp) return res.status(404).json({ error: 'Opportunity not found' });

  try {
    const messages = [
      { role: 'system', content: `Recommend a deal structure from this exact list: ${ALLOWED_DEAL_STRUCTURES.join(', ')}. Strict JSON: {"recommended_structure":"...","alt_structures":["..."],"rationale":"...","key_terms":["..."],"risks":["..."]}.` },
      { role: 'user', content: `Opportunity:\n${JSON.stringify(opp, null, 2)}` },
    ];
    const raw = await callOpenRouter(messages);
    res.json({ opportunity_id, recommendation: tryParse(raw) || { raw }, allowed_structures: ALLOWED_DEAL_STRUCTURES, model: OPENROUTER_MODEL });
  } catch (err) { res.status(500).json({ error: 'Deal-structure recommendation failed', message: err.message }); }
});

// ─── Payout prediction ─────────────────────────────────────────────────────
// PRODUCT-DECISION: forecasting horizon = 90 days; uses opportunities in
// "Closed Won" status + active economics rows as the only training signal.
// No external time-series model — LLM-as-estimator is intentional for v1.
router.post('/payout-predict', auth, async (req, res) => {
  if (aiKeyGate(res)) return;
  if (isRestricted(req.user.role)) return res.status(403).json({ error: 'Restricted role' });
  const { partner_id, horizon_days = 90 } = req.body || {};
  let opps = [];
  let economics = [];
  try {
    const r = await pool.query(
      `SELECT o.id, o.opportunity_name, o.amount, o.expected_close_date, s.stage_name
       FROM opportunities o LEFT JOIN stages s ON o.stage_id = s.id
       WHERE ($1::int IS NULL OR o.account_org_id = $1)
       ORDER BY o.expected_close_date NULLS LAST LIMIT 100`,
      [partner_id || null]
    );
    opps = r.rows;
  } catch (_) {}
  try {
    const r = await pool.query('SELECT * FROM economics LIMIT 100');
    economics = r.rows;
  } catch (_) {}

  try {
    const messages = [
      { role: 'system', content: 'Forecast partner payouts. Strict JSON: {"forecast_total":N,"by_month":[{"month":"YYYY-MM","amount":N,"confidence":"low|medium|high"}],"top_drivers":["..."],"warnings":["..."]}.' },
      { role: 'user', content: `Horizon: ${horizon_days} days\nOpportunities:\n${JSON.stringify(opps, null, 2)}\nEconomics rows:\n${JSON.stringify(economics, null, 2)}` },
    ];
    const raw = await callOpenRouter(messages);
    res.json({ partner_id: partner_id || null, horizon_days, forecast: tryParse(raw) || { raw }, model: OPENROUTER_MODEL });
  } catch (err) { res.status(500).json({ error: 'Payout prediction failed', message: err.message }); }
});

// ─── Strategic partner recommendation ──────────────────────────────────────
// PRODUCT-DECISION: capability-gap analysis input = current partner roster +
// a free-text `target_capability`.  Output is ranked candidate roles + why.
// No external partner directory; recommendations are descriptive (role +
// rationale) rather than naming specific firms.
router.post('/partner-recommend', auth, async (req, res) => {
  if (aiKeyGate(res)) return;
  if (isRestricted(req.user.role)) return res.status(403).json({ error: 'Restricted role' });
  const { target_capability, region } = req.body || {};
  if (!target_capability) return res.status(400).json({ error: 'target_capability required' });
  let partners = [];
  try {
    const r = await pool.query('SELECT id, partner_name, tier, capabilities, status FROM partners LIMIT 100');
    partners = r.rows;
  } catch (_) {}
  try {
    const messages = [
      { role: 'system', content: 'Recommend the role/profile of partners that close the capability gap. Strict JSON: {"gaps":["..."],"recommended_partner_profiles":[{"role":"...","why":"...","priority":"low|medium|high","example_capabilities":["..."]}],"existing_overlap":["..."]}.' },
      { role: 'user', content: `Target capability: ${target_capability}\nRegion: ${region || 'any'}\nExisting partners:\n${JSON.stringify(partners, null, 2)}` },
    ];
    const raw = await callOpenRouter(messages);
    res.json({ target_capability, region: region || null, recommendation: tryParse(raw) || { raw }, model: OPENROUTER_MODEL });
  } catch (err) { res.status(500).json({ error: 'Partner recommendation failed', message: err.message }); }
});

// ─── Partner performance dashboard + anomaly alerts ────────────────────────
// PRODUCT-DECISION: anomaly detection is qualitative (LLM-driven) for v1 —
// real ML feature pipelines remain on the deferred list.  Window = 90 days.
router.post('/partner-dashboard', auth, async (req, res) => {
  if (aiKeyGate(res)) return;
  if (isRestricted(req.user.role)) return res.status(403).json({ error: 'Restricted role' });
  const { partner_id, window_days = 90 } = req.body || {};
  let partner = null, opps = [], activities = [];
  try {
    if (partner_id) {
      const r = await pool.query('SELECT * FROM partners WHERE id = $1', [partner_id]);
      partner = r.rows[0] || null;
    }
  } catch (_) {}
  try {
    const days = Math.max(7, Math.min(365, parseInt(window_days)));
    const r = await pool.query(
      `SELECT o.id, o.opportunity_name, o.amount, o.expected_close_date, s.stage_name
       FROM opportunities o LEFT JOIN stages s ON o.stage_id = s.id
       WHERE o.created_at >= NOW() - ($1 || ' days')::INTERVAL LIMIT 100`,
      [String(days)]
    );
    opps = r.rows;
  } catch (_) {}
  try {
    const r = await pool.query('SELECT id, activity_type, subject, created_at FROM activities ORDER BY created_at DESC LIMIT 50');
    activities = r.rows;
  } catch (_) {}

  try {
    const messages = [
      { role: 'system', content: 'Build a partner performance summary with anomaly alerts. Strict JSON: {"kpis":{"deals_won":N,"avg_cycle_days":N,"win_rate_pct":N},"trends":["..."],"anomalies":[{"signal":"...","severity":"info|warning|critical","explanation":"..."}],"recommended_actions":["..."]}.' },
      { role: 'user', content: `Partner:\n${JSON.stringify(partner, null, 2)}\nOpportunities (window):\n${JSON.stringify(opps, null, 2)}\nRecent activities:\n${JSON.stringify(activities, null, 2)}` },
    ];
    const raw = await callOpenRouter(messages);
    res.json({ partner_id: partner_id || null, window_days, dashboard: tryParse(raw) || { raw }, model: OPENROUTER_MODEL });
  } catch (err) { res.status(500).json({ error: 'Partner dashboard failed', message: err.message }); }
});

module.exports = router;
