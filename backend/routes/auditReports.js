// auditReports.js — pass-5 NEEDS-SCHEMA backlog (additive).
const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', async (req, res) => {
  try {
    const r = await pool.query(`SELECT * FROM audit_reports ORDER BY created_at DESC LIMIT 200`);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  const { title, period_start, period_end, controls, findings, status = 'draft' } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title required' });
  try {
    const r = await pool.query(
      `INSERT INTO audit_reports (title, period_start, period_end, controls, findings, status, owner_user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [title, period_start || null, period_end || null,
       controls ? JSON.stringify(controls) : null,
       findings ? JSON.stringify(findings) : null,
       status, req.user.id || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
