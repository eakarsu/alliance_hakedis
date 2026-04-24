const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const auth = require('../middleware/auth');

const toInt = v => (v === '' || v === null || v === undefined) ? null : parseInt(v, 10) || null;

// GET /api/advisory-requests
router.get('/', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIdx = 1;

    const { isFullAccess, isRestricted } = require('../middleware/dataFilter');
    if (isRestricted(req.user.role)) {
      params.push(req.user.id);
      whereClause += ` AND (ar.requested_by_user_id = $${paramIdx} OR ar.assigned_to_user_id = $${paramIdx})`;
      paramIdx++;
    } else if (!isFullAccess(req.user.role) && req.user.role !== 'pmo_coordinator' && req.user.role !== 'solution_architect') {
      params.push(req.user.id);
      whereClause += ` AND (ar.requested_by_user_id = $${paramIdx} OR ar.assigned_to_user_id = $${paramIdx})`;
      paramIdx++;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM advisory_requests ar ${whereClause}`, params
    );

    params.push(limit, offset);
    const dataResult = await pool.query(
      `SELECT ar.*, u.full_name AS requested_by_name, au.full_name AS assigned_to_name
       FROM advisory_requests ar
       LEFT JOIN users u ON ar.requested_by_user_id = u.id
       LEFT JOIN users au ON ar.assigned_to_user_id = au.id
       ${whereClause}
       ORDER BY ar.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      params
    );

    res.json({ data: dataResult.rows, total: parseInt(countResult.rows[0].count) });
  } catch (err) {
    console.error('List advisory requests error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/advisory-requests/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ar.*, u.full_name AS requested_by_name, au.full_name AS assigned_to_name
       FROM advisory_requests ar
       LEFT JOIN users u ON ar.requested_by_user_id = u.id
       LEFT JOIN users au ON ar.assigned_to_user_id = au.id
       WHERE ar.id = $1`, [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get advisory request error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/advisory-requests
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, assigned_to_user_id, priority, related_type, related_id } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });
    const result = await pool.query(
      `INSERT INTO advisory_requests (title, description, requested_by_user_id, assigned_to_user_id, priority, related_type, related_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [title, description, req.user.id, toInt(assigned_to_user_id), priority || 'medium', related_type, toInt(related_id)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create advisory request error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/advisory-requests/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const { title, description, assigned_to_user_id, status, priority, response, related_type, related_id } = req.body;
    const updates = [];
    const params = [];
    let idx = 1;

    if (title) { updates.push(`title = $${idx}`); params.push(title); idx++; }
    if (description) { updates.push(`description = $${idx}`); params.push(description); idx++; }
    if (assigned_to_user_id !== undefined) { updates.push(`assigned_to_user_id = $${idx}`); params.push(toInt(assigned_to_user_id)); idx++; }
    if (status) { updates.push(`status = $${idx}`); params.push(status); idx++; }
    if (priority) { updates.push(`priority = $${idx}`); params.push(priority); idx++; }
    if (response) { updates.push(`response = $${idx}, responded_at = NOW()`); params.push(response); idx++; }
    updates.push('updated_at = NOW()');

    if (params.length === 0) return res.status(400).json({ error: 'No fields to update' });

    params.push(req.params.id);
    const result = await pool.query(
      `UPDATE advisory_requests SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`, params
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update advisory request error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/advisory-requests/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM advisory_requests WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Delete advisory request error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
