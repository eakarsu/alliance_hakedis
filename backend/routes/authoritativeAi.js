'use strict';

const express = require('express');
const pool = require('../db/connection');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/analyze', auth, async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || '').trim();
    const feature = String(req.body?.feature || 'general');
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_MODEL;
    const baseUrl = process.env.OPENROUTER_BASE_URL;
    if (!apiKey || !model || !baseUrl) throw new Error('OpenRouter runtime is not configured');
    const providerResponse = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are an alliance operations reviewer. Return concise risks, evidence gaps, next actions, uncertainty, and required human review.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
      }),
    });
    if (!providerResponse.ok) throw new Error(`OpenRouter returned ${providerResponse.status}`);
    const body = await providerResponse.json();
    const output = String(body?.choices?.[0]?.message?.content || '').trim();
    if (!output) throw new Error('OpenRouter returned an empty response');
    const saved = await pool.query(
      `INSERT INTO hakedis_ai_results(user_id,feature,input,output,model)
       VALUES($1,$2,$3::jsonb,$4,$5) RETURNING id`,
      [req.user.id, feature, JSON.stringify({ prompt }), output, model],
    );
    return res.json({ id: saved.rows[0].id, response: output, model, provider: 'openrouter' });
  } catch (error) {
    console.error('Authoritative AI analysis failed:', error.message);
    return res.status(502).json({ error: 'OpenRouter request failed' });
  }
});

module.exports = router;
