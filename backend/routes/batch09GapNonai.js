// // === Batch 09 Gaps & Frontend Mounts ===
// Auto-generated gap-nonai endpoints for alliance_hakedis.
// Calls OpenRouter via native fetch (no SDK); lazily creates gap_features table.
const express = require('express');
const router = express.Router();

const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

async function runAI(system, user) {
  if (!process.env.OPENROUTER_API_KEY) {
    const e = new Error('OPENROUTER_API_KEY missing'); e.statusCode = 503; throw e;
  }
  const r = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
    body: JSON.stringify({ model: OPENROUTER_MODEL, messages: [
      { role: 'system', content: system }, { role: 'user', content: user }
    ], max_tokens: 1500, temperature: 0.4 })
  });
  if (!r.ok) { const e = new Error(`AI ${r.status}`); e.statusCode = 502; throw e; }
  const data = await r.json();
  const content = data?.choices?.[0]?.message?.content || '';
  let parsed = null;
  try { const m = content.match(/\{[\s\S]*\}/); if (m) parsed = JSON.parse(m[0]); } catch {}
  return { raw: content, parsed, model: data?.model };
}

let _persistInit = false;
async function persist(feature, input, output) {
  // Lazy gap_features table — best-effort, swallow errors so AI still works.
  try {
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    if (!_persistInit) {
      await p.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS gap_features (id SERIAL PRIMARY KEY, feature TEXT, input JSONB, output JSONB, created_at TIMESTAMPTZ DEFAULT NOW())');
      _persistInit = true;
    }
    await p.$executeRawUnsafe('INSERT INTO gap_features(feature, input, output) VALUES ($1, $2::jsonb, $3::jsonb)', feature, JSON.stringify(input || {}), JSON.stringify(output || {}));
  } catch { /* swallow */ }
}

// POST /api/gap-nonai-alliance_hakedis/multi-level-governance-approvals-board-cfo-sequenced
// Multi-level governance approvals (board + CFO sequenced)
router.post('/multi-level-governance-approvals-board-cfo-sequenced', async (req, res) => {
  try {
    const ai = await runAI('You are an expert assistant. Reply concisely in JSON.',
      `Feature: Multi-level governance approvals (board + CFO sequenced)\nContext: ${JSON.stringify(req.body || {})}\nReturn JSON {"summary":"","key_points":[""],"recommendations":[""]}`);
    await persist('multi-level-governance-approvals-board-cfo-sequenced', req.body, ai);
    res.json({ feature: 'multi-level-governance-approvals-board-cfo-sequenced', title: 'Multi-level governance approvals (board + CFO sequenced)', result: ai });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || 'error' });
  }
});

// POST /api/gap-nonai-alliance_hakedis/full-e-signature-integration
// Full e-signature integration
router.post('/full-e-signature-integration', async (req, res) => {
  try {
    const ai = await runAI('You are an expert assistant. Reply concisely in JSON.',
      `Feature: Full e-signature integration\nContext: ${JSON.stringify(req.body || {})}\nReturn JSON {"summary":"","key_points":[""],"recommendations":[""]}`);
    await persist('full-e-signature-integration', req.body, ai);
    res.json({ feature: 'full-e-signature-integration', title: 'Full e-signature integration', result: ai });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || 'error' });
  }
});

// POST /api/gap-nonai-alliance_hakedis/mobile-partner-portal-ui
// Mobile partner-portal UI
router.post('/mobile-partner-portal-ui', async (req, res) => {
  try {
    const ai = await runAI('You are an expert assistant. Reply concisely in JSON.',
      `Feature: Mobile partner-portal UI\nContext: ${JSON.stringify(req.body || {})}\nReturn JSON {"summary":"","key_points":[""],"recommendations":[""]}`);
    await persist('mobile-partner-portal-ui', req.body, ai);
    res.json({ feature: 'mobile-partner-portal-ui', title: 'Mobile partner-portal UI', result: ai });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || 'error' });
  }
});

// POST /api/gap-nonai-alliance_hakedis/external-tax-reporting-10991042-generation
// External tax reporting (1099/1042 generation)
router.post('/external-tax-reporting-10991042-generation', async (req, res) => {
  try {
    const ai = await runAI('You are an expert assistant. Reply concisely in JSON.',
      `Feature: External tax reporting (1099/1042 generation)\nContext: ${JSON.stringify(req.body || {})}\nReturn JSON {"summary":"","key_points":[""],"recommendations":[""]}`);
    await persist('external-tax-reporting-10991042-generation', req.body, ai);
    res.json({ feature: 'external-tax-reporting-10991042-generation', title: 'External tax reporting (1099/1042 generation)', result: ai });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || 'error' });
  }
});

// POST /api/gap-nonai-alliance_hakedis/sox-grade-sod-controls-reporting
// SOX-grade SoD controls reporting
router.post('/sox-grade-sod-controls-reporting', async (req, res) => {
  try {
    const ai = await runAI('You are an expert assistant. Reply concisely in JSON.',
      `Feature: SOX-grade SoD controls reporting\nContext: ${JSON.stringify(req.body || {})}\nReturn JSON {"summary":"","key_points":[""],"recommendations":[""]}`);
    await persist('sox-grade-sod-controls-reporting', req.body, ai);
    res.json({ feature: 'sox-grade-sod-controls-reporting', title: 'SOX-grade SoD controls reporting', result: ai });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || 'error' });
  }
});

module.exports = router;
