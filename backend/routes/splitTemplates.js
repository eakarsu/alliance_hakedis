const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const auth = require('../middleware/auth');
const { isFullAccess } = require('../middleware/dataFilter');

// GET /api/split-templates
router.get('/', auth, async (req, res) => {
  try {
    const templates = await pool.query(
      `SELECT st.*, u.full_name AS created_by_name
       FROM split_templates st
       LEFT JOIN users u ON st.created_by_user_id = u.id
       WHERE st.is_active = true
       ORDER BY st.template_name`
    );

    // Fetch lines for each template
    const result = [];
    for (const t of templates.rows) {
      const lines = await pool.query(
        'SELECT * FROM split_template_lines WHERE template_id = $1 ORDER BY share_percent DESC',
        [t.id]
      );
      result.push({ ...t, lines: lines.rows });
    }

    res.json({ data: result });
  } catch (err) {
    console.error('List templates error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/split-templates/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const template = await pool.query(
      `SELECT st.*, u.full_name AS created_by_name
       FROM split_templates st LEFT JOIN users u ON st.created_by_user_id = u.id WHERE st.id = $1`,
      [id]
    );
    if (template.rows.length === 0) return res.status(404).json({ error: 'Template not found' });

    const lines = await pool.query('SELECT * FROM split_template_lines WHERE template_id = $1 ORDER BY share_percent DESC', [id]);

    res.json({ ...template.rows[0], lines: lines.rows });
  } catch (err) {
    console.error('Get template error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/split-templates
router.post('/', auth, async (req, res) => {
  try {
    if (!isFullAccess(req.user.role) && req.user.role !== 'pmo_coordinator') {
      return res.status(403).json({ error: 'Only governance or PMO roles can create templates' });
    }

    const { template_name, deal_path_type, description, lines } = req.body;
    if (!template_name) return res.status(400).json({ error: 'template_name is required' });

    const result = await pool.query(
      `INSERT INTO split_templates (template_name, deal_path_type, description, created_by_user_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [template_name, deal_path_type, description, req.user.id]
    );

    if (lines && Array.isArray(lines)) {
      for (const line of lines) {
        await pool.query(
          `INSERT INTO split_template_lines (template_id, role_type, share_percent, share_basis, notes)
           VALUES ($1, $2, $3, $4, $5)`,
          [result.rows[0].id, line.role_type, line.share_percent, line.share_basis || 'total_value', line.notes]
        );
      }
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create template error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/split-templates/:id
router.put('/:id', auth, async (req, res) => {
  try {
    if (!isFullAccess(req.user.role) && req.user.role !== 'pmo_coordinator') {
      return res.status(403).json({ error: 'Only governance or PMO roles can update templates' });
    }

    const { id } = req.params;
    const { template_name, deal_path_type, description, lines } = req.body;

    const result = await pool.query(
      `UPDATE split_templates SET template_name = COALESCE($1, template_name), deal_path_type = COALESCE($2, deal_path_type),
       description = COALESCE($3, description), updated_at = NOW() WHERE id = $4 RETURNING *`,
      [template_name, deal_path_type, description, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Template not found' });

    // Replace lines if provided
    if (lines && Array.isArray(lines)) {
      await pool.query('DELETE FROM split_template_lines WHERE template_id = $1', [id]);
      for (const line of lines) {
        await pool.query(
          `INSERT INTO split_template_lines (template_id, role_type, share_percent, share_basis, notes)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, line.role_type, line.share_percent, line.share_basis || 'total_value', line.notes]
        );
      }
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update template error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/split-templates/:id (soft delete)
router.delete('/:id', auth, async (req, res) => {
  try {
    if (!isFullAccess(req.user.role)) {
      return res.status(403).json({ error: 'Only governance can delete templates' });
    }

    await pool.query('UPDATE split_templates SET is_active = false, updated_at = NOW() WHERE id = $1', [req.params.id]);
    res.json({ message: 'Template deactivated' });
  } catch (err) {
    console.error('Delete template error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
