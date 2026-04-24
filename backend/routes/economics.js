const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const auth = require('../middleware/auth');
const { isFullAccess } = require('../middleware/dataFilter');

const toInt = v => (v === '' || v === null || v === undefined) ? null : parseInt(v, 10) || null;

// Valid lifecycle transitions
const COMMERCIAL_TRANSITIONS = {
  draft: ['proposed', 'cancelled'],
  proposed: ['reviewed', 'cancelled', 'disputed'],
  reviewed: ['approved', 'disputed'],
  approved: ['accrued', 'reversed', 'disputed'],
  accrued: ['payable', 'reversed'],
  payable: ['partially_paid', 'paid', 'reversed'],
  partially_paid: ['paid', 'reversed'],
  paid: ['reversed'],
  reversed: [],
  cancelled: [],
  disputed: ['reviewed', 'cancelled'],
};

const SHADOW_TRANSITIONS = {
  planned: ['in_progress', 'voided'],
  in_progress: ['actual_logged', 'voided'],
  actual_logged: ['reviewed', 'disputed', 'voided'],
  reviewed: ['deserved', 'disputed', 'voided'],
  deserved: ['approved', 'disputed'],
  approved: ['deferred', 'partially_paid', 'paid', 'converted'],
  deferred: ['partially_paid', 'paid', 'converted'],
  partially_paid: ['paid', 'converted'],
  paid: [],
  converted: [],
  disputed: ['reviewed', 'voided'],
  voided: [],
};

// GET /api/economics/entries?opportunity_id=X
router.get('/entries', auth, async (req, res) => {
  try {
    const { opportunity_id, entry_type } = req.query;
    let whereClause = 'WHERE 1=1';
    const params = [];
    let idx = 1;

    if (opportunity_id) {
      whereClause += ` AND ee.opportunity_id = $${idx}`;
      params.push(opportunity_id);
      idx++;
    }
    if (entry_type) {
      whereClause += ` AND ee.entry_type = $${idx}`;
      params.push(entry_type);
      idx++;
    }

    // Role-based: partners see entries on their opportunities or where they're a beneficiary/contributor
    if (!isFullAccess(req.user.role) && req.user.role !== 'pmo_coordinator' && req.user.role !== 'solution_architect') {
      whereClause += ` AND (
        ee.opportunity_id IN (SELECT id FROM opportunities WHERE deal_owner_user_id = $${idx} OR source_owner_user_id = $${idx} OR sponsor_user_id = $${idx})
        OR ee.opportunity_id IN (SELECT opportunity_id FROM opportunity_roles WHERE user_id = $${idx})
        OR ee.id IN (SELECT economic_entry_id FROM commercial_share_entries WHERE beneficiary_user_id = $${idx})
        OR ee.id IN (SELECT economic_entry_id FROM shadow_ledger_entries WHERE contributor_user_id = $${idx})
        OR ee.created_by_user_id = $${idx}
      )`;
      params.push(req.user.id);
      idx++;
    }

    const result = await pool.query(
      `SELECT ee.*, op.opportunity_name, u.full_name AS created_by_name,
       au.full_name AS approved_by_name, st.template_name
       FROM economic_entries ee
       LEFT JOIN opportunities op ON ee.opportunity_id = op.id
       LEFT JOIN users u ON ee.created_by_user_id = u.id
       LEFT JOIN users au ON ee.approved_by_user_id = au.id
       LEFT JOIN split_templates st ON ee.template_id = st.id
       ${whereClause}
       ORDER BY ee.created_at DESC`,
      params
    );

    res.json({ data: result.rows });
  } catch (err) {
    console.error('List economic entries error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/economics/entries/:id
router.get('/entries/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const entry = await pool.query(
      `SELECT ee.*, op.opportunity_name, u.full_name AS created_by_name,
       au.full_name AS approved_by_name, st.template_name
       FROM economic_entries ee
       LEFT JOIN opportunities op ON ee.opportunity_id = op.id
       LEFT JOIN users u ON ee.created_by_user_id = u.id
       LEFT JOIN users au ON ee.approved_by_user_id = au.id
       LEFT JOIN split_templates st ON ee.template_id = st.id
       WHERE ee.id = $1`,
      [id]
    );
    if (entry.rows.length === 0) return res.status(404).json({ error: 'Economic entry not found' });

    const shares = await pool.query(
      `SELECT cs.*, u.full_name AS beneficiary_name, pe.entity_name AS entity_name
       FROM commercial_share_entries cs
       LEFT JOIN users u ON cs.beneficiary_user_id = u.id
       LEFT JOIN partner_entities pe ON cs.beneficiary_entity_id = pe.id
       WHERE cs.economic_entry_id = $1
       ORDER BY cs.share_percent DESC`,
      [id]
    );

    const shadowEntries = await pool.query(
      `SELECT sl.*, u.full_name AS contributor_name, ru.full_name AS reviewer_name
       FROM shadow_ledger_entries sl
       LEFT JOIN users u ON sl.contributor_user_id = u.id
       LEFT JOIN users ru ON sl.reviewed_by_user_id = ru.id
       WHERE sl.economic_entry_id = $1
       ORDER BY sl.created_at DESC`,
      [id]
    );

    const history = await pool.query(
      `SELECT h.*, u.full_name AS changed_by_name
       FROM economic_entry_stage_history h
       LEFT JOIN users u ON h.changed_by_user_id = u.id
       WHERE h.economic_entry_id = $1
       ORDER BY h.created_at DESC`,
      [id]
    );

    res.json({
      ...entry.rows[0],
      commercial_shares: shares.rows,
      shadow_entries: shadowEntries.rows,
      stage_history: history.rows,
    });
  } catch (err) {
    console.error('Get economic entry error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/economics/entries
router.post('/entries', auth, async (req, res) => {
  try {
    const { opportunity_id, entry_type, template_id, total_basis_amount, basis_type, currency, effective_date, notes } = req.body;

    if (!opportunity_id || !entry_type) {
      return res.status(400).json({ error: 'opportunity_id and entry_type are required' });
    }
    if (!['commercial', 'shadow'].includes(entry_type)) {
      return res.status(400).json({ error: 'entry_type must be commercial or shadow' });
    }

    const result = await pool.query(
      `INSERT INTO economic_entries (opportunity_id, entry_type, lifecycle_stage, template_id, total_basis_amount, basis_type, currency, effective_date, notes, created_by_user_id)
       VALUES ($1, $2, 'draft', $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [toInt(opportunity_id), entry_type, toInt(template_id), total_basis_amount, basis_type || 'total_value', currency || 'USD', effective_date, notes, req.user.id]
    );

    const entryId = result.rows[0].id;

    // Record initial stage history
    await pool.query(
      `INSERT INTO economic_entry_stage_history (economic_entry_id, from_stage, to_stage, changed_by_user_id, reason)
       VALUES ($1, NULL, 'draft', $2, 'Entry created')`,
      [entryId, req.user.id]
    );

    // Auto-populate commercial shares from template if template_id provided
    if (template_id && entry_type === 'commercial') {
      const lines = await pool.query('SELECT * FROM split_template_lines WHERE template_id = $1', [template_id]);

      // Get opportunity roles to map role_type to actual users
      const oppRoles = await pool.query(
        'SELECT user_id, role_in_opportunity FROM opportunity_roles WHERE opportunity_id = $1',
        [opportunity_id]
      );
      const roleMap = {};
      for (const r of oppRoles.rows) {
        roleMap[r.role_in_opportunity] = r.user_id;
      }

      const basisAmount = total_basis_amount || 0;
      for (const line of lines.rows) {
        const userId = roleMap[line.role_type] || null;
        const calcAmount = Math.round((line.share_percent / 100) * basisAmount * 100) / 100;
        await pool.query(
          `INSERT INTO commercial_share_entries (economic_entry_id, beneficiary_user_id, role_type, share_percent, calculated_amount, final_amount, status)
           VALUES ($1, $2, $3, $4, $5, $5, 'pending')`,
          [entryId, userId, line.role_type, line.share_percent, calcAmount]
        );
      }
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create economic entry error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/economics/entries/:id
router.put('/entries/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { total_basis_amount, basis_type, currency, effective_date, notes } = req.body;

    const existing = await pool.query('SELECT lifecycle_stage FROM economic_entries WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    if (!['draft', 'proposed'].includes(existing.rows[0].lifecycle_stage)) {
      return res.status(400).json({ error: 'Can only edit entries in draft or proposed stage' });
    }

    const result = await pool.query(
      `UPDATE economic_entries SET total_basis_amount = COALESCE($1, total_basis_amount), basis_type = COALESCE($2, basis_type),
       currency = COALESCE($3, currency), effective_date = COALESCE($4, effective_date), notes = COALESCE($5, notes), updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [total_basis_amount, basis_type, currency, effective_date, notes, id]
    );

    // Recalculate share amounts if basis changed
    if (total_basis_amount) {
      await pool.query(
        `UPDATE commercial_share_entries SET calculated_amount = ROUND((share_percent / 100.0) * $1, 2),
         final_amount = COALESCE(override_amount, ROUND((share_percent / 100.0) * $1, 2))
         WHERE economic_entry_id = $2`,
        [total_basis_amount, id]
      );
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update economic entry error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/economics/entries/:id/transition
router.post('/entries/:id/transition', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { to_stage, reason } = req.body;

    if (!to_stage) return res.status(400).json({ error: 'to_stage is required' });

    const entry = await pool.query('SELECT * FROM economic_entries WHERE id = $1', [id]);
    if (entry.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const current = entry.rows[0];
    const transitions = current.entry_type === 'commercial' ? COMMERCIAL_TRANSITIONS : SHADOW_TRANSITIONS;
    const allowed = transitions[current.lifecycle_stage];

    if (!allowed || !allowed.includes(to_stage)) {
      return res.status(400).json({
        error: `Cannot transition from ${current.lifecycle_stage} to ${to_stage}`,
        allowed_transitions: allowed || [],
      });
    }

    // Governance check: only governance roles can approve
    if (['approved', 'accrued', 'payable'].includes(to_stage) && !isFullAccess(req.user.role) && req.user.role !== 'pmo_coordinator') {
      return res.status(403).json({ error: 'Only governance or PMO roles can approve economic entries' });
    }

    const updateFields = { lifecycle_stage: to_stage };
    if (['approved'].includes(to_stage)) {
      updateFields.approved_by_user_id = req.user.id;
      updateFields.approved_at = new Date().toISOString();
    }

    await pool.query(
      `UPDATE economic_entries SET lifecycle_stage = $1, approved_by_user_id = COALESCE($2, approved_by_user_id),
       approved_at = COALESCE($3, approved_at), updated_at = NOW() WHERE id = $4`,
      [to_stage, updateFields.approved_by_user_id || null, updateFields.approved_at || null, id]
    );

    // Record stage history
    await pool.query(
      `INSERT INTO economic_entry_stage_history (economic_entry_id, from_stage, to_stage, changed_by_user_id, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, current.lifecycle_stage, to_stage, req.user.id, reason || null]
    );

    // Notify opportunity stakeholders
    const { notifyUsers } = require('../utils/notify');
    const roleHolders = await pool.query(
      'SELECT DISTINCT user_id FROM opportunity_roles WHERE opportunity_id = $1',
      [current.opportunity_id]
    );
    const notifyIds = roleHolders.rows.map(r => r.user_id).filter(uid => uid !== req.user.id);
    if (notifyIds.length > 0) {
      await notifyUsers({
        userIds: notifyIds,
        type: 'economic_stage_change',
        title: `Economic Entry ${to_stage.replace(/_/g, ' ')}`,
        message: `${current.entry_type} entry #${id} moved to ${to_stage.replace(/_/g, ' ')}`,
        entityType: 'economic_entry',
        entityId: parseInt(id),
      });
    }

    res.json({ message: `Transitioned to ${to_stage}`, from: current.lifecycle_stage, to: to_stage });
  } catch (err) {
    console.error('Transition economic entry error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/economics/shares?user_id=X
router.get('/shares', auth, async (req, res) => {
  try {
    const userId = req.query.user_id || req.user.id;

    // Partners can only see their own shares
    if (!isFullAccess(req.user.role) && req.user.role !== 'pmo_coordinator' && parseInt(userId) !== req.user.id) {
      return res.status(403).json({ error: 'Can only view your own shares' });
    }

    const result = await pool.query(
      `SELECT cs.*, ee.opportunity_id, ee.entry_type, ee.lifecycle_stage AS entry_stage,
       ee.total_basis_amount, ee.currency, op.opportunity_name, u.full_name AS beneficiary_name
       FROM commercial_share_entries cs
       JOIN economic_entries ee ON cs.economic_entry_id = ee.id
       LEFT JOIN opportunities op ON ee.opportunity_id = op.id
       LEFT JOIN users u ON cs.beneficiary_user_id = u.id
       WHERE cs.beneficiary_user_id = $1
       ORDER BY cs.created_at DESC`,
      [userId]
    );

    // Totals
    const totals = await pool.query(
      `SELECT
       COALESCE(SUM(cs.final_amount), 0) AS total_amount,
       COALESCE(SUM(CASE WHEN cs.status = 'paid' THEN cs.final_amount ELSE 0 END), 0) AS total_paid,
       COALESCE(SUM(CASE WHEN cs.status = 'pending' THEN cs.final_amount ELSE 0 END), 0) AS total_pending
       FROM commercial_share_entries cs
       WHERE cs.beneficiary_user_id = $1`,
      [userId]
    );

    res.json({ data: result.rows, totals: totals.rows[0] });
  } catch (err) {
    console.error('List shares error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/economics/entries/:id/shares
router.post('/entries/:id/shares', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { beneficiary_user_id, beneficiary_entity_id, role_type, share_percent, override_amount, notes } = req.body;

    const entry = await pool.query('SELECT * FROM economic_entries WHERE id = $1', [id]);
    if (entry.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    if (!['draft', 'proposed'].includes(entry.rows[0].lifecycle_stage)) {
      return res.status(400).json({ error: 'Can only add shares to entries in draft or proposed stage' });
    }

    const basisAmount = entry.rows[0].total_basis_amount || 0;
    const calcAmount = share_percent ? Math.round((share_percent / 100) * basisAmount * 100) / 100 : 0;
    const finalAmount = override_amount || calcAmount;

    const result = await pool.query(
      `INSERT INTO commercial_share_entries (economic_entry_id, beneficiary_user_id, beneficiary_entity_id, role_type, share_percent, calculated_amount, override_amount, final_amount, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [id, toInt(beneficiary_user_id), toInt(beneficiary_entity_id), role_type, share_percent, calcAmount, override_amount, finalAmount, notes]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Add share error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/economics/shadow?user_id=X
router.get('/shadow', auth, async (req, res) => {
  try {
    const userId = req.query.user_id || req.user.id;

    if (!isFullAccess(req.user.role) && req.user.role !== 'pmo_coordinator' && parseInt(userId) !== req.user.id) {
      return res.status(403).json({ error: 'Can only view your own shadow contributions' });
    }

    const result = await pool.query(
      `SELECT sl.*, ee.opportunity_id, ee.entry_type, op.opportunity_name,
       u.full_name AS contributor_name, ru.full_name AS reviewer_name
       FROM shadow_ledger_entries sl
       JOIN economic_entries ee ON sl.economic_entry_id = ee.id
       LEFT JOIN opportunities op ON ee.opportunity_id = op.id
       LEFT JOIN users u ON sl.contributor_user_id = u.id
       LEFT JOIN users ru ON sl.reviewed_by_user_id = ru.id
       WHERE sl.contributor_user_id = $1
       ORDER BY sl.created_at DESC`,
      [userId]
    );

    res.json({ data: result.rows });
  } catch (err) {
    console.error('List shadow entries error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/economics/entries/:id/shadow
router.post('/entries/:id/shadow', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { contributor_user_id, contribution_type, description, estimated_value, actual_value, notes } = req.body;

    const entry = await pool.query('SELECT * FROM economic_entries WHERE id = $1', [id]);
    if (entry.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const result = await pool.query(
      `INSERT INTO shadow_ledger_entries (economic_entry_id, contributor_user_id, contribution_type, description, estimated_value, actual_value, lifecycle_stage, notes)
       VALUES ($1, $2, $3, $4, $5, $6, 'planned', $7) RETURNING *`,
      [id, toInt(contributor_user_id) || req.user.id, contribution_type, description, estimated_value, actual_value, notes]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Add shadow entry error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/economics/shadow/:id/transition
router.post('/shadow/:id/transition', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { to_stage, reason, deserved_amount } = req.body;

    const shadow = await pool.query('SELECT * FROM shadow_ledger_entries WHERE id = $1', [id]);
    if (shadow.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const current = shadow.rows[0];
    const allowed = SHADOW_TRANSITIONS[current.lifecycle_stage];
    if (!allowed || !allowed.includes(to_stage)) {
      return res.status(400).json({ error: `Cannot transition from ${current.lifecycle_stage} to ${to_stage}`, allowed_transitions: allowed || [] });
    }

    const updates = ['lifecycle_stage = $1', 'updated_at = NOW()'];
    const params = [to_stage];
    let idx = 2;

    if (['reviewed', 'deserved'].includes(to_stage)) {
      updates.push(`reviewed_by_user_id = $${idx}`);
      params.push(req.user.id);
      idx++;
      updates.push(`reviewed_at = $${idx}`);
      params.push(new Date().toISOString());
      idx++;
    }
    if (deserved_amount !== undefined) {
      updates.push(`deserved_amount = $${idx}`);
      params.push(deserved_amount);
      idx++;
    }

    params.push(id);
    await pool.query(`UPDATE shadow_ledger_entries SET ${updates.join(', ')} WHERE id = $${idx}`, params);

    // Record in economic entry stage history
    await pool.query(
      `INSERT INTO economic_entry_stage_history (economic_entry_id, from_stage, to_stage, changed_by_user_id, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [current.economic_entry_id, `shadow:${current.lifecycle_stage}`, `shadow:${to_stage}`, req.user.id, reason || null]
    );

    res.json({ message: `Shadow entry transitioned to ${to_stage}` });
  } catch (err) {
    console.error('Shadow transition error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/economics/shadow/:id/evidence
router.post('/shadow/:id/evidence', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { evidence_type, title, document_url, description } = req.body;

    const shadow = await pool.query('SELECT id FROM shadow_ledger_entries WHERE id = $1', [id]);
    if (shadow.rows.length === 0) return res.status(404).json({ error: 'Shadow entry not found' });

    const result = await pool.query(
      `INSERT INTO contribution_evidence (shadow_entry_id, evidence_type, title, document_url, description, submitted_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, evidence_type, title, document_url, description, req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Add evidence error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/economics/payouts?user_id=X
router.get('/payouts', auth, async (req, res) => {
  try {
    const userId = req.query.user_id || req.user.id;

    if (!isFullAccess(req.user.role) && req.user.role !== 'pmo_coordinator' && parseInt(userId) !== req.user.id) {
      return res.status(403).json({ error: 'Can only view your own payouts' });
    }

    const result = await pool.query(
      `SELECT pt.*, cs.beneficiary_user_id, cs.role_type, cs.final_amount AS share_amount,
       ee.opportunity_id, op.opportunity_name, u.full_name AS processed_by_name
       FROM payout_transactions pt
       LEFT JOIN commercial_share_entries cs ON pt.commercial_share_id = cs.id
       LEFT JOIN economic_entries ee ON cs.economic_entry_id = ee.id
       LEFT JOIN opportunities op ON ee.opportunity_id = op.id
       LEFT JOIN users u ON pt.processed_by_user_id = u.id
       WHERE cs.beneficiary_user_id = $1
       ORDER BY pt.created_at DESC`,
      [userId]
    );

    res.json({ data: result.rows });
  } catch (err) {
    console.error('List payouts error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/economics/payouts
router.post('/payouts', auth, async (req, res) => {
  try {
    // Only governance/PMO can record payouts
    if (!isFullAccess(req.user.role) && req.user.role !== 'pmo_coordinator') {
      return res.status(403).json({ error: 'Only governance or PMO roles can record payouts' });
    }

    const { commercial_share_id, shadow_entry_id, amount, currency, payment_method, payment_reference, payment_date, notes } = req.body;

    if (!amount || (!commercial_share_id && !shadow_entry_id)) {
      return res.status(400).json({ error: 'amount and either commercial_share_id or shadow_entry_id are required' });
    }

    const result = await pool.query(
      `INSERT INTO payout_transactions (commercial_share_id, shadow_entry_id, amount, currency, payment_method, payment_reference, payment_date, status, processed_by_user_id, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed', $8, $9) RETURNING *`,
      [toInt(commercial_share_id), toInt(shadow_entry_id), amount, currency || 'USD', payment_method, payment_reference, payment_date || new Date().toISOString(), req.user.id, notes]
    );

    // Update share status to paid
    if (commercial_share_id) {
      const totalPaid = await pool.query(
        'SELECT COALESCE(SUM(amount), 0) AS total FROM payout_transactions WHERE commercial_share_id = $1',
        [commercial_share_id]
      );
      const share = await pool.query('SELECT final_amount FROM commercial_share_entries WHERE id = $1', [commercial_share_id]);
      const newStatus = parseFloat(totalPaid.rows[0].total) >= parseFloat(share.rows[0]?.final_amount || 0) ? 'paid' : 'partially_paid';
      await pool.query('UPDATE commercial_share_entries SET status = $1 WHERE id = $2', [newStatus, commercial_share_id]);
    }

    if (shadow_entry_id) {
      await pool.query("UPDATE shadow_ledger_entries SET lifecycle_stage = 'paid', updated_at = NOW() WHERE id = $1", [shadow_entry_id]);
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Record payout error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
