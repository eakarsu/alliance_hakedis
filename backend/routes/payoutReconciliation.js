// payoutReconciliation.js — pass-5 NEEDS-SCHEMA backlog (additive).
const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', async (req, res) => {
  try {
    const { partner_id } = req.query;
    const r = await pool.query(
      `SELECT id, partner_id, period_start, period_end, expected_amount, actual_amount, variance, dispute_state, notes, created_at
       FROM payout_reconciliation
       WHERE ($1::int IS NULL OR partner_id = $1)
       ORDER BY period_end DESC NULLS LAST LIMIT 200`,
      [partner_id ? parseInt(partner_id) : null]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  const { partner_id, period_start, period_end, expected_amount, actual_amount, dispute_state = 'none', notes } = req.body || {};
  try {
    const r = await pool.query(
      `INSERT INTO payout_reconciliation (partner_id, period_start, period_end, expected_amount, actual_amount, dispute_state, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, partner_id, period_start, period_end, expected_amount, actual_amount, variance, dispute_state, notes, created_at`,
      [partner_id || null, period_start || null, period_end || null,
       expected_amount || null, actual_amount || null, dispute_state, notes || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id/dispute', async (req, res) => {
  const { dispute_state, notes } = req.body || {};
  if (!['none', 'open', 'resolved', 'escalated'].includes(dispute_state)) {
    return res.status(400).json({ error: 'dispute_state must be none|open|resolved|escalated' });
  }
  try {
    const r = await pool.query(
      `UPDATE payout_reconciliation SET dispute_state = $1, notes = COALESCE($2, notes)
       WHERE id = $3 RETURNING id, partner_id, dispute_state, notes`,
      [dispute_state, notes || null, parseInt(req.params.id)]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
