// Custom feature endpoints (batch_09 audit suggestions)
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5';
const BASE = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';

async function callLLM(system, user, { maxTokens = 1800, temperature = 0.4 } = {}) {
  if (!OPENROUTER_API_KEY) {
    const e = new Error('OPENROUTER_API_KEY missing'); e.statusCode = 503; throw e;
  }
  const r = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      max_tokens: maxTokens, temperature,
    }),
  });
  const data = await r.json();
  return { content: data?.choices?.[0]?.message?.content || '', model: data?.model };
}

function parseJSON(t) {
  if (!t) return null;
  const c = String(t).replace(/```(?:json)?/gi, '').replace(/```/g, '');
  const m = c.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

function err(res, e, label) {
  if (e.statusCode === 503) return res.status(503).json({ error: e.message });
  console.error(`${label} error:`, e.message);
  res.status(500).json({ error: e.message });
}

// 1. Split-structure optimization
router.post('/split-optimize', auth, async (req, res) => {
  try {
    const { deal, partners, margin_floor_pct } = req.body || {};
    if (!deal) return res.status(400).json({ error: 'deal required' });
    const ai = await callLLM(
      'You optimize partner revenue-share splits balancing satisfaction and margin floor. JSON only.',
      `DEAL: ${JSON.stringify(deal)}\nPARTNERS: ${JSON.stringify(partners || [])}\nMARGIN_FLOOR_PCT: ${margin_floor_pct || 15}\nReturn JSON {"recommended_split":[{"partner_id":"","share_pct":0,"rationale":""}],"projected_margin_pct":0,"satisfaction_score":0,"requires_negotiation":[""]}`
    );
    res.json({ type: 'split-optimize', result: parseJSON(ai.content) || { raw: ai.content }, model: ai.model });
  } catch (e) { err(res, e, 'split-optimize'); }
});

// 2. Approval workflow prediction (bottleneck likelihood)
router.post('/approval-bottleneck', auth, async (req, res) => {
  try {
    const { workflow_id, current_state, history } = req.body || {};
    if (!workflow_id) return res.status(400).json({ error: 'workflow_id required' });
    const ai = await callLLM(
      'You predict approval workflow bottlenecks. JSON only.',
      `WORKFLOW: ${workflow_id}\nSTATE: ${JSON.stringify(current_state || {})}\nHISTORY: ${JSON.stringify(history || []).slice(0,2500)}\nReturn JSON {"likely_bottleneck_step":"","probability":0,"est_delay_hours":0,"mitigation_actions":[""],"escalate_to":""}`
    );
    res.json({ type: 'approval-bottleneck', result: parseJSON(ai.content) || { raw: ai.content }, model: ai.model });
  } catch (e) { err(res, e, 'approval-bottleneck'); }
});

// 3. Economic scenario modeling (what-if on deal terms)
router.post('/scenario-model', auth, async (req, res) => {
  try {
    const { base_terms, scenarios } = req.body || {};
    if (!base_terms || !Array.isArray(scenarios)) return res.status(400).json({ error: 'base_terms and scenarios array required' });
    const ai = await callLLM(
      'You run what-if economic scenarios on deal terms. JSON only.',
      `BASE: ${JSON.stringify(base_terms)}\nSCENARIOS: ${JSON.stringify(scenarios.slice(0,10))}\nReturn JSON {"results":[{"scenario_name":"","npv_usd":0,"margin_pct":0,"risk":"low|med|high"}],"recommended_scenario":""}`
    );
    res.json({ type: 'scenario-model', result: parseJSON(ai.content) || { raw: ai.content }, model: ai.model });
  } catch (e) { err(res, e, 'scenario-model'); }
});

// 4. Partner performance dashboards with anomaly alerts
router.post('/partner-anomalies', auth, async (req, res) => {
  try {
    const { partner_id, kpi_series } = req.body || {};
    if (!partner_id) return res.status(400).json({ error: 'partner_id required' });
    const ai = await callLLM(
      'You spot anomalies in partner KPI time-series. JSON only.',
      `PARTNER: ${partner_id}\nKPIS: ${JSON.stringify(kpi_series || []).slice(0,3000)}\nReturn JSON {"anomalies":[{"kpi":"","at":"","deviation":0,"likely_cause":""}],"trend":"up|flat|down","alert_threshold_breaches":[""]}`
    );
    res.json({ type: 'partner-anomalies', result: parseJSON(ai.content) || { raw: ai.content }, model: ai.model });
  } catch (e) { err(res, e, 'partner-anomalies'); }
});

// 5. Automated payout reconciliation with dispute detection
router.post('/payout-reconcile', auth, async (req, res) => {
  try {
    const { period, computed_payouts, partner_invoices } = req.body || {};
    if (!period) return res.status(400).json({ error: 'period required' });
    const ai = await callLLM(
      'You reconcile computed payouts vs partner invoices and flag disputes. JSON only.',
      `PERIOD: ${period}\nCOMPUTED: ${JSON.stringify(computed_payouts || [])}\nINVOICES: ${JSON.stringify(partner_invoices || [])}\nReturn JSON {"matches":[{"line":"","status":"ok"}],"disputes":[{"line":"","computed":0,"invoiced":0,"delta":0,"likely_cause":""}],"net_settlement_usd":0}`
    );
    res.json({ type: 'payout-reconcile', result: parseJSON(ai.content) || { raw: ai.content }, model: ai.model });
  } catch (e) { err(res, e, 'payout-reconcile'); }
});

// 6. ERP integration for revenue recognition
// TODO: configure credentials for ERP_API_KEY.
router.post('/erp-revrec', auth, async (req, res) => {
  try {
    const { contract, performance_obligations } = req.body || {};
    if (!contract) return res.status(400).json({ error: 'contract required' });
    const ai = await callLLM(
      `You produce ASC 606 revenue recognition schedule for ERP push. ERP API set: ${Boolean(process.env.ERP_API_KEY)}. JSON only.`,
      `CONTRACT: ${JSON.stringify(contract)}\nOBLIGATIONS: ${JSON.stringify(performance_obligations || [])}\nReturn JSON {"schedule":[{"period":"","amount_usd":0,"obligation":""}],"deferred_revenue_start_usd":0,"deferred_revenue_end_usd":0,"erp_payload":{}}`
    );
    res.json({ type: 'erp-revrec', result: parseJSON(ai.content) || { raw: ai.content }, model: ai.model });
  } catch (e) { err(res, e, 'erp-revrec'); }
});

// 7. Governance exception management with AI routing
router.post('/governance-routing', auth, async (req, res) => {
  try {
    const { exception, escalation_paths } = req.body || {};
    if (!exception) return res.status(400).json({ error: 'exception required' });
    const ai = await callLLM(
      'You route a governance exception to the right reviewer chain. JSON only.',
      `EXCEPTION: ${JSON.stringify(exception)}\nPATHS: ${JSON.stringify(escalation_paths || [])}\nReturn JSON {"routed_to":[""],"sla_hours":0,"justification":"","auto_resolvable":false}`
    );
    res.json({ type: 'governance-routing', result: parseJSON(ai.content) || { raw: ai.content }, model: ai.model });
  } catch (e) { err(res, e, 'governance-routing'); }
});

// 8. Strategic partner recommendation based on capability gaps
router.post('/strategic-partner-recommend', auth, async (req, res) => {
  try {
    const { capability_gaps, target_market } = req.body || {};
    if (!Array.isArray(capability_gaps)) return res.status(400).json({ error: 'capability_gaps array required' });
    const ai = await callLLM(
      'You recommend strategic partners filling capability gaps. JSON only.',
      `GAPS: ${JSON.stringify(capability_gaps)}\nMARKET: ${target_market || 'EMEA'}\nReturn JSON {"candidates":[{"profile":"","gap_addressed":"","fit_score":0,"outreach_hook":""}],"top_pick":"","alternatives":[""]}`
    );
    res.json({ type: 'strategic-partner-recommend', result: parseJSON(ai.content) || { raw: ai.content }, model: ai.model });
  } catch (e) { err(res, e, 'strategic-partner-recommend'); }
});

module.exports = router;
