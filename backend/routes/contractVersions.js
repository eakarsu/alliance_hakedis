// contractVersions.js — pass-5 NEEDS-SCHEMA backlog (additive CLM).
const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', async (req, res) => {
  try {
    const { agreement_id } = req.query;
    const r = await pool.query(
      `SELECT * FROM contract_versions
       WHERE ($1::int IS NULL OR agreement_id = $1)
       ORDER BY created_at DESC LIMIT 200`,
      [agreement_id ? parseInt(agreement_id) : null]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  const { agreement_id, version_number, diff_summary, file_url, status = 'redlined', counterparty_signed = false } = req.body || {};
  if (!version_number) return res.status(400).json({ error: 'version_number required' });
  try {
    const r = await pool.query(
      `INSERT INTO contract_versions (agreement_id, version_number, diff_summary, file_url, submitted_by, status, counterparty_signed)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [agreement_id || null, version_number, diff_summary || null, file_url || null, req.user.id || null, status, !!counterparty_signed]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
