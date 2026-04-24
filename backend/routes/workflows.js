const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const auth = require('../middleware/auth');
const { isFullAccess } = require('../middleware/dataFilter');

// ── GET /api/workflows/templates — list all workflow templates ──
router.get('/templates', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT wt.*,
        (SELECT count(*) FROM workflow_template_steps WHERE template_id = wt.id) AS step_count,
        (SELECT count(*) FROM workflow_instances WHERE template_id = wt.id AND status = 'active') AS active_instances
      FROM workflow_templates wt
      ORDER BY wt.code
    `);
    res.json({ data: result.rows });
  } catch (err) {
    console.error('List templates error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/workflows/templates/:id — template with steps ──
router.get('/templates/:id', auth, async (req, res) => {
  try {
    const tmpl = await pool.query('SELECT * FROM workflow_templates WHERE id = $1', [req.params.id]);
    if (tmpl.rows.length === 0) return res.status(404).json({ error: 'Template not found' });

    const steps = await pool.query(
      'SELECT * FROM workflow_template_steps WHERE template_id = $1 ORDER BY step_order',
      [req.params.id]
    );

    res.json({ ...tmpl.rows[0], steps: steps.rows });
  } catch (err) {
    console.error('Get template error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /api/workflows/templates/:id — update template settings ──
router.put('/templates/:id', auth, async (req, res) => {
  try {
    if (!isFullAccess(req.user.role) && req.user.role !== 'pmo_coordinator') {
      return res.status(403).json({ error: 'Only governance/PMO can edit templates' });
    }
    const { name, description, is_active, auto_trigger, trigger_event } = req.body;
    const result = await pool.query(
      `UPDATE workflow_templates SET name = COALESCE($1, name), description = COALESCE($2, description),
       is_active = COALESCE($3, is_active), auto_trigger = COALESCE($4, auto_trigger),
       trigger_event = COALESCE($5, trigger_event), updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [name, description, is_active, auto_trigger, trigger_event, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Template not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update template error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/workflows/templates/:id/steps — add step to template ──
router.post('/templates/:id/steps', auth, async (req, res) => {
  try {
    if (!isFullAccess(req.user.role) && req.user.role !== 'pmo_coordinator') {
      return res.status(403).json({ error: 'Only governance/PMO can edit template steps' });
    }
    const { name, description, required_role, is_optional, sla_hours, step_order } = req.body;
    if (!name) return res.status(400).json({ error: 'Step name is required' });

    // If step_order not provided, append at end
    let order = step_order;
    if (!order) {
      const maxRes = await pool.query(
        'SELECT COALESCE(MAX(step_order), 0) + 1 AS next_order FROM workflow_template_steps WHERE template_id = $1',
        [req.params.id]
      );
      order = maxRes.rows[0].next_order;
    } else {
      // Shift existing steps to make room
      await pool.query(
        'UPDATE workflow_template_steps SET step_order = step_order + 1 WHERE template_id = $1 AND step_order >= $2',
        [req.params.id, order]
      );
    }

    const result = await pool.query(
      `INSERT INTO workflow_template_steps (template_id, step_order, name, description, required_role, is_optional, sla_hours)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.params.id, order, name, description || null, required_role || null, is_optional || false, sla_hours || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Add template step error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /api/workflows/templates/:id/steps/:stepId — update step ──
router.put('/templates/:id/steps/:stepId', auth, async (req, res) => {
  try {
    if (!isFullAccess(req.user.role) && req.user.role !== 'pmo_coordinator') {
      return res.status(403).json({ error: 'Only governance/PMO can edit template steps' });
    }
    const { name, description, required_role, is_optional, sla_hours } = req.body;
    const result = await pool.query(
      `UPDATE workflow_template_steps SET name = COALESCE($1, name), description = COALESCE($2, description),
       required_role = $3, is_optional = COALESCE($4, is_optional), sla_hours = $5
       WHERE id = $6 AND template_id = $7 RETURNING *`,
      [name, description, required_role || null, is_optional, sla_hours || null, req.params.stepId, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Step not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update template step error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /api/workflows/templates/:id/steps/:stepId — remove step ──
router.delete('/templates/:id/steps/:stepId', auth, async (req, res) => {
  try {
    if (!isFullAccess(req.user.role) && req.user.role !== 'pmo_coordinator') {
      return res.status(403).json({ error: 'Only governance/PMO can edit template steps' });
    }
    const step = await pool.query('SELECT step_order FROM workflow_template_steps WHERE id = $1 AND template_id = $2', [req.params.stepId, req.params.id]);
    if (step.rows.length === 0) return res.status(404).json({ error: 'Step not found' });

    await pool.query('DELETE FROM workflow_template_steps WHERE id = $1', [req.params.stepId]);
    // Reorder remaining steps
    await pool.query(
      'UPDATE workflow_template_steps SET step_order = step_order - 1 WHERE template_id = $1 AND step_order > $2',
      [req.params.id, step.rows[0].step_order]
    );
    res.json({ message: 'Step removed' });
  } catch (err) {
    console.error('Delete template step error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/workflows/instances — list workflow instances ──
router.get('/instances', auth, async (req, res) => {
  try {
    const { template_id, status, entity_type } = req.query;
    const fullAccess = isFullAccess(req.user.role) || req.user.role === 'pmo_coordinator';

    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;

    if (template_id) { where += ` AND wi.template_id = $${idx}`; params.push(template_id); idx++; }
    if (status) { where += ` AND wi.status = $${idx}`; params.push(status); idx++; }
    if (entity_type) { where += ` AND wi.entity_type = $${idx}`; params.push(entity_type); idx++; }

    if (!fullAccess) {
      where += ` AND (wi.started_by_user_id = $${idx} OR EXISTS (
        SELECT 1 FROM workflow_instance_steps wis WHERE wis.instance_id = wi.id AND wis.assigned_to_user_id = $${idx}
      ))`;
      params.push(req.user.id);
      idx++;
    }

    const result = await pool.query(`
      SELECT wi.*,
        wt.code AS template_code, wt.name AS template_name, wt.icon, wt.color,
        (SELECT count(*) FROM workflow_instance_steps WHERE instance_id = wi.id) AS total_steps,
        (SELECT count(*) FROM workflow_instance_steps WHERE instance_id = wi.id AND status = 'completed') AS completed_steps,
        u.full_name AS started_by_name
      FROM workflow_instances wi
      JOIN workflow_templates wt ON wi.template_id = wt.id
      LEFT JOIN users u ON wi.started_by_user_id = u.id
      ${where}
      ORDER BY wi.updated_at DESC
    `, params);

    res.json({ data: result.rows });
  } catch (err) {
    console.error('List instances error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/workflows/instances/:id — instance detail with all steps ──
router.get('/instances/:id', auth, async (req, res) => {
  try {
    const inst = await pool.query(`
      SELECT wi.*,
        wt.code AS template_code, wt.name AS template_name, wt.icon, wt.color, wt.description AS template_description,
        u.full_name AS started_by_name
      FROM workflow_instances wi
      JOIN workflow_templates wt ON wi.template_id = wt.id
      LEFT JOIN users u ON wi.started_by_user_id = u.id
      WHERE wi.id = $1
    `, [req.params.id]);
    if (inst.rows.length === 0) return res.status(404).json({ error: 'Instance not found' });

    const steps = await pool.query(`
      SELECT wis.*,
        au.full_name AS assigned_to_name,
        cu.full_name AS completed_by_name
      FROM workflow_instance_steps wis
      LEFT JOIN users au ON wis.assigned_to_user_id = au.id
      LEFT JOIN users cu ON wis.completed_by_user_id = cu.id
      WHERE wis.instance_id = $1
      ORDER BY wis.step_order
    `, [req.params.id]);

    res.json({ ...inst.rows[0], steps: steps.rows });
  } catch (err) {
    console.error('Get instance error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/workflows/instances — create new workflow instance from template ──
router.post('/instances', auth, async (req, res) => {
  try {
    const { template_id, entity_type, entity_id, entity_label, notes } = req.body;
    if (!template_id) return res.status(400).json({ error: 'template_id is required' });

    const tmpl = await pool.query('SELECT * FROM workflow_templates WHERE id = $1', [template_id]);
    if (tmpl.rows.length === 0) return res.status(404).json({ error: 'Template not found' });

    const tmplSteps = await pool.query(
      'SELECT * FROM workflow_template_steps WHERE template_id = $1 ORDER BY step_order',
      [template_id]
    );

    const instRes = await pool.query(
      `INSERT INTO workflow_instances (template_id, entity_type, entity_id, entity_label, status, current_step_order, started_by_user_id, notes)
       VALUES ($1, $2, $3, $4, 'active', 1, $5, $6) RETURNING *`,
      [template_id, entity_type || tmpl.rows[0].entity_type, entity_id || null, entity_label || null, req.user.id, notes || null]
    );
    const instanceId = instRes.rows[0].id;

    // Create instance steps from template
    for (const s of tmplSteps.rows) {
      const dueAt = s.sla_hours ? new Date(Date.now() + s.sla_hours * 3600000) : null;
      await pool.query(
        `INSERT INTO workflow_instance_steps (instance_id, template_step_id, step_order, name, description, status, due_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [instanceId, s.id, s.step_order, s.name, s.description, s.step_order === 1 ? 'in_progress' : 'pending', s.step_order === 1 ? dueAt : null]
      );
    }

    // Return full instance
    const full = await pool.query(`
      SELECT wi.*, wt.code AS template_code, wt.name AS template_name
      FROM workflow_instances wi JOIN workflow_templates wt ON wi.template_id = wt.id
      WHERE wi.id = $1
    `, [instanceId]);
    const steps = await pool.query('SELECT * FROM workflow_instance_steps WHERE instance_id = $1 ORDER BY step_order', [instanceId]);

    res.status(201).json({ ...full.rows[0], steps: steps.rows });
  } catch (err) {
    console.error('Create instance error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /api/workflows/instances/:id/steps/:stepId/complete — complete a step ──
router.put('/instances/:id/steps/:stepId/complete', auth, async (req, res) => {
  try {
    const { notes } = req.body;
    const step = await pool.query('SELECT * FROM workflow_instance_steps WHERE id = $1 AND instance_id = $2', [req.params.stepId, req.params.id]);
    if (step.rows.length === 0) return res.status(404).json({ error: 'Step not found' });
    if (step.rows[0].status === 'completed') return res.status(400).json({ error: 'Step already completed' });

    // Complete the step
    await pool.query(
      `UPDATE workflow_instance_steps SET status = 'completed', completed_by_user_id = $1, completed_at = NOW(),
       notes = COALESCE(notes, '') || CASE WHEN $2 != '' THEN E'\n' || $2 ELSE '' END, updated_at = NOW()
       WHERE id = $3`,
      [req.user.id, notes || '', req.params.stepId]
    );

    // Find next step
    const nextStep = await pool.query(
      `SELECT * FROM workflow_instance_steps WHERE instance_id = $1 AND step_order = $2`,
      [req.params.id, step.rows[0].step_order + 1]
    );

    if (nextStep.rows.length > 0) {
      // Activate next step
      const tmplStep = await pool.query('SELECT sla_hours FROM workflow_template_steps WHERE id = $1', [nextStep.rows[0].template_step_id]);
      const slaHours = tmplStep.rows[0]?.sla_hours;
      const dueAt = slaHours ? new Date(Date.now() + slaHours * 3600000) : null;

      await pool.query(
        `UPDATE workflow_instance_steps SET status = 'in_progress', started_at = NOW(), due_at = $1, updated_at = NOW() WHERE id = $2`,
        [dueAt, nextStep.rows[0].id]
      );
      await pool.query(
        'UPDATE workflow_instances SET current_step_order = $1, updated_at = NOW() WHERE id = $2',
        [step.rows[0].step_order + 1, req.params.id]
      );
    } else {
      // All steps done — complete the workflow
      await pool.query(
        `UPDATE workflow_instances SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [req.params.id]
      );
    }

    // Return updated instance
    const inst = await pool.query(`
      SELECT wi.*, wt.code AS template_code, wt.name AS template_name, wt.icon, wt.color
      FROM workflow_instances wi JOIN workflow_templates wt ON wi.template_id = wt.id WHERE wi.id = $1
    `, [req.params.id]);
    const steps = await pool.query(`
      SELECT wis.*, au.full_name AS assigned_to_name, cu.full_name AS completed_by_name
      FROM workflow_instance_steps wis
      LEFT JOIN users au ON wis.assigned_to_user_id = au.id
      LEFT JOIN users cu ON wis.completed_by_user_id = cu.id
      WHERE wis.instance_id = $1 ORDER BY wis.step_order
    `, [req.params.id]);

    res.json({ ...inst.rows[0], steps: steps.rows });
  } catch (err) {
    console.error('Complete step error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /api/workflows/instances/:id/steps/:stepId/assign — assign user to step ──
router.put('/instances/:id/steps/:stepId/assign', auth, async (req, res) => {
  try {
    const { assigned_to_user_id } = req.body;
    const result = await pool.query(
      `UPDATE workflow_instance_steps SET assigned_to_user_id = $1, updated_at = NOW() WHERE id = $2 AND instance_id = $3 RETURNING *`,
      [assigned_to_user_id || null, req.params.stepId, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Step not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Assign step error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /api/workflows/instances/:id/steps/:stepId/skip — skip an optional step ──
router.put('/instances/:id/steps/:stepId/skip', auth, async (req, res) => {
  try {
    const { notes } = req.body;
    const step = await pool.query('SELECT * FROM workflow_instance_steps WHERE id = $1 AND instance_id = $2', [req.params.stepId, req.params.id]);
    if (step.rows.length === 0) return res.status(404).json({ error: 'Step not found' });

    await pool.query(
      `UPDATE workflow_instance_steps SET status = 'skipped', notes = $1, updated_at = NOW() WHERE id = $2`,
      [notes || 'Skipped', req.params.stepId]
    );

    // Activate next step (same logic as complete)
    const nextStep = await pool.query(
      `SELECT * FROM workflow_instance_steps WHERE instance_id = $1 AND step_order = $2`,
      [req.params.id, step.rows[0].step_order + 1]
    );

    if (nextStep.rows.length > 0) {
      await pool.query(
        `UPDATE workflow_instance_steps SET status = 'in_progress', started_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [nextStep.rows[0].id]
      );
      await pool.query(
        'UPDATE workflow_instances SET current_step_order = $1, updated_at = NOW() WHERE id = $2',
        [step.rows[0].step_order + 1, req.params.id]
      );
    } else {
      await pool.query(
        `UPDATE workflow_instances SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [req.params.id]
      );
    }

    res.json({ message: 'Step skipped' });
  } catch (err) {
    console.error('Skip step error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /api/workflows/instances/:id/cancel — cancel a workflow instance ──
router.put('/instances/:id/cancel', auth, async (req, res) => {
  try {
    const { reason } = req.body;
    const result = await pool.query(
      `UPDATE workflow_instances SET status = 'cancelled', cancelled_at = NOW(), cancel_reason = $1, updated_at = NOW()
       WHERE id = $2 AND status = 'active' RETURNING *`,
      [reason || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Active instance not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Cancel instance error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/workflows/stats — dashboard summary ──
router.get('/stats', auth, async (req, res) => {
  try {
    const fullAccess = isFullAccess(req.user.role) || req.user.role === 'pmo_coordinator';
    const userId = req.user.id;

    const userFilter = fullAccess ? '' : `AND (wi.started_by_user_id = $1 OR EXISTS (
      SELECT 1 FROM workflow_instance_steps wis WHERE wis.instance_id = wi.id AND wis.assigned_to_user_id = $1
    ))`;
    const params = fullAccess ? [] : [userId];

    const [byTemplate, byStatus, mySteps] = await Promise.all([
      pool.query(`
        SELECT wt.id, wt.code, wt.name, wt.icon, wt.color,
          count(wi.id) FILTER (WHERE wi.status = 'active') AS active_count,
          count(wi.id) FILTER (WHERE wi.status = 'completed') AS completed_count,
          count(wi.id) AS total_count
        FROM workflow_templates wt
        LEFT JOIN workflow_instances wi ON wi.template_id = wt.id ${userFilter.replace(/wi\./g, 'wi.')}
        GROUP BY wt.id ORDER BY wt.code
      `, params),

      pool.query(`
        SELECT wi.status, count(*) AS count
        FROM workflow_instances wi WHERE 1=1 ${userFilter}
        GROUP BY wi.status
      `, params),

      pool.query(`
        SELECT count(*) FILTER (WHERE wis.status = 'in_progress') AS my_active_steps,
          count(*) FILTER (WHERE wis.due_at < NOW() AND wis.status = 'in_progress') AS my_overdue_steps
        FROM workflow_instance_steps wis
        WHERE wis.assigned_to_user_id = $1
      `, [userId]),
    ]);

    res.json({
      by_template: byTemplate.rows,
      by_status: byStatus.rows,
      my_steps: mySteps.rows[0],
    });
  } catch (err) {
    console.error('Workflow stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/workflows/my-actions — pending steps for current user ──
router.get('/my-actions', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT wis.*, wi.entity_label, wi.entity_type, wi.entity_id,
        wt.code AS template_code, wt.name AS template_name, wt.icon, wt.color
      FROM workflow_instance_steps wis
      JOIN workflow_instances wi ON wis.instance_id = wi.id
      JOIN workflow_templates wt ON wi.template_id = wt.id
      WHERE wis.assigned_to_user_id = $1 AND wis.status = 'in_progress' AND wi.status = 'active'
      ORDER BY wis.due_at NULLS LAST, wis.created_at
    `, [req.user.id]);
    res.json({ data: result.rows });
  } catch (err) {
    console.error('My actions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
