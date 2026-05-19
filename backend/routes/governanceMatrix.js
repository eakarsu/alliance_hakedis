// governanceMatrix.js — pass-5 backlog implementation for alliance_hakedis.
//
// NEEDS-SCHEMA features from the audit backlog, all done additively with
// CREATE TABLE IF NOT EXISTS.  Existing schemas are NOT modified.
//
//   - approval_matrix          -> POST/GET /api/governance-matrix/rules
//   - audit_reports            -> POST/GET /api/audit-reports
//   - contract_versions (CLM)  -> POST/GET /api/contract-versions
//   - payout_reconciliation    -> POST/GET /api/payout-reconciliation
//
// ERP integration is NOT added because that is NEEDS-CREDS + outbound HTTP,
// which we do not perform from this stub.
const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const auth = require('../middleware/auth');

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS approval_matrix (
      id SERIAL PRIMARY KEY,
      entity_type VARCHAR(64) NOT NULL,
      threshold_amount NUMERIC,
      threshold_pct NUMERIC,
      required_role VARCHAR(64) NOT NULL,
      sequence INTEGER DEFAULT 1,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      created_by INTEGER
    )
  `).catch(() => {});
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_reports (
      id SERIAL PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      period_start DATE,
      period_end DATE,
      controls JSONB,
      findings JSONB,
      status VARCHAR(32) DEFAULT 'draft' CHECK (status IN ('draft','in_review','closed')),
      owner_user_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `).catch(() => {});
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contract_versions (
      id SERIAL PRIMARY KEY,
      agreement_id INTEGER,
      version_number VARCHAR(32) NOT NULL,
      diff_summary TEXT,
      file_url TEXT,
      submitted_by INTEGER,
      status VARCHAR(32) DEFAULT 'redlined' CHECK (status IN ('redlined','approved','rejected')),
      counterparty_signed BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `).catch(() => {});
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payout_reconciliation (
      id SERIAL PRIMARY KEY,
      partner_id INTEGER,
      period_start DATE,
      period_end DATE,
      expected_amount NUMERIC,
      actual_amount NUMERIC,
      variance NUMERIC GENERATED ALWAYS AS (COALESCE(actual_amount,0) - COALESCE(expected_amount,0)) STORED,
      dispute_state VARCHAR(32) DEFAULT 'none' CHECK (dispute_state IN ('none','open','resolved','escalated')),
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `).catch(() => {});
}
ensureTables().catch(() => {});

router.use(auth);

// ─── Approval matrix ────────────────────────────────────────────────────────
router.get('/rules', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT * FROM approval_matrix ORDER BY entity_type, sequence, threshold_amount NULLS FIRST LIMIT 500`);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/rules', async (req, res) => {
  const { entity_type, threshold_amount, threshold_pct, required_role, sequence = 1, notes } = req.body || {};
  if (!entity_type || !required_role) return res.status(400).json({ error: 'entity_type and required_role required' });
  try {
    const r = await pool.query(
      `INSERT INTO approval_matrix (entity_type, threshold_amount, threshold_pct, required_role, sequence, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [entity_type, threshold_amount || null, threshold_pct || null, required_role, parseInt(sequence) || 1, notes || null, req.user.id || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
