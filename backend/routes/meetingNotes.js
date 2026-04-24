const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const auth = require('../middleware/auth');

const toInt = v => (v === '' || v === null || v === undefined) ? null : parseInt(v, 10) || null;

// GET /api/meeting-notes
router.get('/', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIdx = 1;

    // Restricted users see only meeting notes shared with them or where they're an attendee
    const { isFullAccess, isRestricted } = require('../middleware/dataFilter');
    if (isRestricted(req.user.role)) {
      params.push(req.user.id);
      whereClause += ` AND (mn.created_by_user_id = $${paramIdx} OR mn.visibility_level = 'shared' OR mn.id IN (SELECT entity_id FROM shared_items WHERE shared_with_user_id = $${paramIdx} AND entity_type = 'meeting_note'))`;
      paramIdx++;
    } else if (!isFullAccess(req.user.role) && req.user.role !== 'pmo_coordinator' && req.user.role !== 'solution_architect') {
      params.push(req.user.id);
      whereClause += ` AND (mn.created_by_user_id = $${paramIdx} OR mn.visibility_level != 'private')`;
      paramIdx++;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM meeting_notes mn ${whereClause}`, params
    );

    params.push(limit, offset);
    const dataResult = await pool.query(
      `SELECT mn.*, u.full_name AS created_by_name
       FROM meeting_notes mn
       LEFT JOIN users u ON mn.created_by_user_id = u.id
       ${whereClause}
       ORDER BY mn.meeting_date DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      params
    );

    res.json({ data: dataResult.rows, total: parseInt(countResult.rows[0].count) });
  } catch (err) {
    console.error('List meeting notes error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/meeting-notes/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT mn.*, u.full_name AS created_by_name
       FROM meeting_notes mn LEFT JOIN users u ON mn.created_by_user_id = u.id
       WHERE mn.id = $1`, [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get meeting note error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/meeting-notes
router.post('/', auth, async (req, res) => {
  try {
    const { title, meeting_date, attendees, summary, action_items, related_type, related_id, visibility_level } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });
    const result = await pool.query(
      `INSERT INTO meeting_notes (title, meeting_date, attendees, summary, action_items, related_type, related_id, visibility_level, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [title, meeting_date || new Date(), attendees, summary, action_items, related_type, toInt(related_id), visibility_level || 'internal', req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create meeting note error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/meeting-notes/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const { title, meeting_date, attendees, summary, action_items, related_type, related_id, visibility_level } = req.body;
    const result = await pool.query(
      `UPDATE meeting_notes SET title = COALESCE($1, title), meeting_date = COALESCE($2, meeting_date),
       attendees = COALESCE($3, attendees), summary = COALESCE($4, summary), action_items = COALESCE($5, action_items),
       related_type = COALESCE($6, related_type), related_id = COALESCE($7, related_id),
       visibility_level = COALESCE($8, visibility_level), updated_at = NOW()
       WHERE id = $9 RETURNING *`,
      [title, meeting_date, attendees, summary, action_items, related_type, toInt(related_id), visibility_level, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update meeting note error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/meeting-notes/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM meeting_notes WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Delete meeting note error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
