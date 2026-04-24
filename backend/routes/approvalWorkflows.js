const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const auth = require('../middleware/auth');
const { isFullAccess } = require('../middleware/dataFilter');

// GET /api/approval-workflows?related_type=X&related_id=Y&status=Z
router.get('/', auth, async (req, res) => {
  try {
    const { related_type, related_id, status } = req.query;
    let whereClause = 'WHERE 1=1';
    const params = [];
    let idx = 1;

    if (related_type) { whereClause += ` AND aw.related_type = $${idx}`; params.push(related_type); idx++; }
    if (related_id) { whereClause += ` AND aw.related_id = $${idx}`; params.push(related_id); idx++; }
    if (status) { whereClause += ` AND aw.status = $${idx}`; params.push(status); idx++; }

    // Non-governance users see only workflows they're involved in
    if (!isFullAccess(req.user.role) && req.user.role !== 'pmo_coordinator') {
      whereClause += ` AND (aw.requested_by_user_id = $${idx} OR aw.assigned_to_user_id = $${idx})`;
      params.push(req.user.id);
      idx++;
    }

    const result = await pool.query(
      `SELECT aw.*, ru.full_name AS requested_by_name, au.full_name AS assigned_to_name, apu.full_name AS approved_by_name
       FROM approval_workflows aw
       LEFT JOIN users ru ON aw.requested_by_user_id = ru.id
       LEFT JOIN users au ON aw.assigned_to_user_id = au.id
       LEFT JOIN users apu ON aw.approved_by_user_id = apu.id
       ${whereClause}
       ORDER BY aw.created_at DESC`,
      params
    );

    res.json({ data: result.rows });
  } catch (err) {
    console.error('List workflows error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/approval-workflows
router.post('/', auth, async (req, res) => {
  try {
    const { related_type, related_id, workflow_type, total_steps, assigned_to_user_id, notes } = req.body;

    if (!related_type || !related_id || !workflow_type) {
      return res.status(400).json({ error: 'related_type, related_id, and workflow_type are required' });
    }

    const result = await pool.query(
      `INSERT INTO approval_workflows (related_type, related_id, workflow_type, total_steps, assigned_to_user_id, requested_by_user_id, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [related_type, related_id, workflow_type, total_steps || 1, assigned_to_user_id, req.user.id, notes]
    );

    // Notify assigned user
    if (assigned_to_user_id) {
      const { createNotification } = require('../utils/notify');
      await createNotification({
        userId: parseInt(assigned_to_user_id),
        type: 'approval_requested',
        title: 'Approval Requested',
        message: `A ${workflow_type} approval has been assigned to you for ${related_type} #${related_id}`,
        entityType: related_type,
        entityId: parseInt(related_id),
      });
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create workflow error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/approval-workflows/:id/approve
router.put('/:id/approve', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const wf = await pool.query('SELECT * FROM approval_workflows WHERE id = $1', [id]);
    if (wf.rows.length === 0) return res.status(404).json({ error: 'Workflow not found' });

    if (wf.rows[0].status !== 'pending') {
      return res.status(400).json({ error: 'Workflow is not pending' });
    }

    // Only assigned user or governance can approve
    if (!isFullAccess(req.user.role) && req.user.role !== 'pmo_coordinator' && wf.rows[0].assigned_to_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to approve this workflow' });
    }

    const newStep = wf.rows[0].current_step + 1;
    const isComplete = newStep > wf.rows[0].total_steps;

    await pool.query(
      `UPDATE approval_workflows SET current_step = $1, status = $2, approved_by_user_id = $3,
       approved_at = NOW(), notes = COALESCE(notes, '') || E'\n[Approved] ' || $4, updated_at = NOW() WHERE id = $5`,
      [newStep, isComplete ? 'approved' : 'pending', req.user.id, notes || '', id]
    );

    // Notify requester
    const { createNotification } = require('../utils/notify');
    await createNotification({
      userId: wf.rows[0].requested_by_user_id,
      type: 'approval_completed',
      title: isComplete ? 'Approval Granted' : 'Approval Step Completed',
      message: `Your ${wf.rows[0].workflow_type} approval for ${wf.rows[0].related_type} #${wf.rows[0].related_id} has been ${isComplete ? 'fully approved' : 'advanced to step ' + newStep}`,
      entityType: wf.rows[0].related_type,
      entityId: wf.rows[0].related_id,
    });

    res.json({ message: isComplete ? 'Workflow approved' : `Step ${wf.rows[0].current_step} approved, advancing to step ${newStep}` });
  } catch (err) {
    console.error('Approve workflow error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/approval-workflows/:id/reject
router.put('/:id/reject', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const wf = await pool.query('SELECT * FROM approval_workflows WHERE id = $1', [id]);
    if (wf.rows.length === 0) return res.status(404).json({ error: 'Workflow not found' });

    if (!isFullAccess(req.user.role) && req.user.role !== 'pmo_coordinator' && wf.rows[0].assigned_to_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to reject this workflow' });
    }

    await pool.query(
      `UPDATE approval_workflows SET status = 'rejected', approved_by_user_id = $1,
       notes = COALESCE(notes, '') || E'\n[Rejected] ' || $2, updated_at = NOW() WHERE id = $3`,
      [req.user.id, notes || '', id]
    );

    const { createNotification } = require('../utils/notify');
    await createNotification({
      userId: wf.rows[0].requested_by_user_id,
      type: 'approval_rejected',
      title: 'Approval Rejected',
      message: `Your ${wf.rows[0].workflow_type} approval for ${wf.rows[0].related_type} #${wf.rows[0].related_id} has been rejected`,
      entityType: wf.rows[0].related_type,
      entityId: wf.rows[0].related_id,
    });

    res.json({ message: 'Workflow rejected' });
  } catch (err) {
    console.error('Reject workflow error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
