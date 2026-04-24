/**
 * Migration 011 — Workflow Engine
 * Creates workflow_templates, workflow_template_steps, workflow_instances, workflow_instance_steps
 * Seeds 10 workflow templates (WF1–WF10) with predefined steps
 * Auto-generates example workflow instances from existing data
 */

const pool = require('./connection');

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── 1. Workflow Templates ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS workflow_templates (
        id SERIAL PRIMARY KEY,
        code VARCHAR(10) NOT NULL UNIQUE,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        entity_type VARCHAR(50),
        icon VARCHAR(50),
        color VARCHAR(50),
        is_active BOOLEAN DEFAULT true,
        auto_trigger BOOLEAN DEFAULT false,
        trigger_event VARCHAR(100),
        created_by_user_id INT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // ── 2. Workflow Template Steps ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS workflow_template_steps (
        id SERIAL PRIMARY KEY,
        template_id INT NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,
        step_order INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        required_role VARCHAR(50),
        is_optional BOOLEAN DEFAULT false,
        auto_complete_condition VARCHAR(200),
        sla_hours INT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_wf_tmpl_steps_tmpl ON workflow_template_steps(template_id, step_order)`);

    // ── 3. Workflow Instances ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS workflow_instances (
        id SERIAL PRIMARY KEY,
        template_id INT NOT NULL REFERENCES workflow_templates(id),
        entity_type VARCHAR(50) NOT NULL,
        entity_id INT NOT NULL,
        entity_label VARCHAR(200),
        status VARCHAR(30) DEFAULT 'active',
        current_step_order INT DEFAULT 1,
        started_by_user_id INT REFERENCES users(id),
        completed_at TIMESTAMP,
        cancelled_at TIMESTAMP,
        cancel_reason TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_wf_inst_tmpl ON workflow_instances(template_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_wf_inst_entity ON workflow_instances(entity_type, entity_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_wf_inst_status ON workflow_instances(status)`);

    // ── 4. Workflow Instance Steps ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS workflow_instance_steps (
        id SERIAL PRIMARY KEY,
        instance_id INT NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
        template_step_id INT REFERENCES workflow_template_steps(id),
        step_order INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        status VARCHAR(30) DEFAULT 'pending',
        assigned_to_user_id INT REFERENCES users(id),
        completed_by_user_id INT REFERENCES users(id),
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        due_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_wf_inst_steps_inst ON workflow_instance_steps(instance_id, step_order)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_wf_inst_steps_assigned ON workflow_instance_steps(assigned_to_user_id, status)`);

    // ── 5. Seed 10 Workflow Templates ──
    const templates = [
      {
        code: 'WF-1', name: 'Lead Lifecycle', entity_type: 'lead',
        icon: 'Target', color: 'from-blue-500 to-blue-600',
        description: 'Track a lead from creation through qualification to conversion or rejection.',
        auto_trigger: true, trigger_event: 'lead.created',
        steps: [
          { name: 'Lead Created', description: 'New lead registered in the system', required_role: null },
          { name: 'Initial Assessment', description: 'Evaluate lead quality and fit', required_role: 'source_owner', sla_hours: 48 },
          { name: 'Conflict Check', description: 'Check for protected windows and duplicate leads', required_role: null },
          { name: 'Qualification', description: 'Determine if lead meets qualification criteria', required_role: 'source_owner', sla_hours: 120 },
          { name: 'Decision', description: 'Convert to opportunity, reject, or disqualify', required_role: 'source_owner' },
        ]
      },
      {
        code: 'WF-2', name: 'Lead Conversion', entity_type: 'lead',
        icon: 'Zap', color: 'from-indigo-500 to-indigo-600',
        description: 'Convert a qualified lead into a fully structured opportunity with roles and revenue setup.',
        auto_trigger: true, trigger_event: 'lead.qualified',
        steps: [
          { name: 'Verify Qualification', description: 'Confirm lead is qualified and ready for conversion', required_role: 'source_owner' },
          { name: 'Assign 6 Roles', description: 'Assign deal_owner, source_owner, sponsor, technical_partner, product_owner, delivery_owner', required_role: 'source_owner', sla_hours: 72 },
          { name: 'Select Deal Path', description: 'Choose deal path: Direct, Channel/Referral, Partnership, Government', required_role: 'deal_owner' },
          { name: 'Revenue Setup', description: 'Apply split template and configure revenue shares', required_role: 'deal_owner' },
          { name: 'Create Opportunity', description: 'Convert lead to opportunity record', required_role: 'source_owner' },
          { name: 'Stakeholder Notification', description: 'Notify all assigned role holders about the new opportunity', required_role: null },
        ]
      },
      {
        code: 'WF-3', name: 'Opportunity Pipeline', entity_type: 'opportunity',
        icon: 'TrendingUp', color: 'from-emerald-500 to-emerald-600',
        description: 'Progress a deal through pipeline stages from discovery to closed won.',
        auto_trigger: true, trigger_event: 'opportunity.created',
        steps: [
          { name: 'Discovery', description: 'Identify client needs and pain points', required_role: 'deal_owner', sla_hours: 168 },
          { name: 'Solution Design', description: 'Map products to client needs with technical partner', required_role: 'solution_architect', sla_hours: 240 },
          { name: 'Proposal', description: 'Prepare and submit commercial proposal', required_role: 'deal_owner', sla_hours: 168 },
          { name: 'Negotiation', description: 'Handle objections and negotiate terms', required_role: 'deal_owner' },
          { name: 'Compliance Check', description: 'Verify DPA, security, and regulatory compliance', required_role: 'solution_architect', sla_hours: 72 },
          { name: 'Close', description: 'Finalize deal — mark as Won or Lost', required_role: 'deal_owner' },
          { name: 'Post-Win Setup', description: 'Create project, link agreements, notify stakeholders', required_role: null, is_optional: true },
        ]
      },
      {
        code: 'WF-4', name: 'Conflict Resolution', entity_type: 'conflict',
        icon: 'Shield', color: 'from-red-500 to-red-600',
        description: 'Detect and resolve deal conflicts between partners with protected windows.',
        auto_trigger: true, trigger_event: 'conflict.detected',
        steps: [
          { name: 'Conflict Detected', description: 'System auto-detected a conflict on lead or opportunity', required_role: null },
          { name: 'Gather Context', description: 'Review protected windows, ownership history, and related entities', required_role: 'founding_orchestrator', sla_hours: 24 },
          { name: 'Notify Parties', description: 'Inform all affected stakeholders about the conflict', required_role: 'founding_orchestrator' },
          { name: 'Resolution Decision', description: 'Decide: co-sell, reassign, priority to protected owner, or other', required_role: 'founding_orchestrator', sla_hours: 72 },
          { name: 'Apply Resolution', description: 'Clear conflict flag, reassign ownership if needed, update records', required_role: 'founding_orchestrator' },
        ]
      },
      {
        code: 'WF-5', name: 'Visibility Approval', entity_type: 'visibility_request',
        icon: 'Eye', color: 'from-purple-500 to-purple-600',
        description: 'Manage visibility change requests for leads and opportunities.',
        auto_trigger: true, trigger_event: 'visibility.requested',
        steps: [
          { name: 'Request Submitted', description: 'User requests visibility level change for an entity', required_role: null },
          { name: 'Governance Review', description: 'Evaluate request against data sharing policies', required_role: 'founding_orchestrator', sla_hours: 48 },
          { name: 'Decision', description: 'Approve or reject the visibility change', required_role: 'founding_orchestrator' },
          { name: 'Apply Change', description: 'Update entity visibility level and notify requester', required_role: null },
        ]
      },
      {
        code: 'WF-6', name: 'Commercial Revenue', entity_type: 'economic_entry',
        icon: 'DollarSign', color: 'from-green-500 to-green-600',
        description: 'Track revenue shares from draft through approval to payment.',
        auto_trigger: false,
        steps: [
          { name: 'Draft Entry', description: 'Create economic entry with commercial shares from split template', required_role: 'deal_owner' },
          { name: 'Propose', description: 'Submit entry for review with calculated share amounts', required_role: 'deal_owner' },
          { name: 'Review', description: 'Review share percentages and calculated amounts', required_role: 'pmo_coordinator', sla_hours: 120 },
          { name: 'Approve', description: 'Governance approval of revenue distribution', required_role: 'founding_orchestrator', sla_hours: 72 },
          { name: 'Accrue', description: 'Mark entry as accrued in financial records', required_role: 'pmo_coordinator' },
          { name: 'Make Payable', description: 'Approve for payout processing', required_role: 'founding_orchestrator' },
          { name: 'Process Payment', description: 'Record actual payout transactions', required_role: 'pmo_coordinator' },
        ]
      },
      {
        code: 'WF-7', name: 'Shadow Ledger', entity_type: 'shadow_entry',
        icon: 'BookOpen', color: 'from-amber-500 to-amber-600',
        description: 'Track non-monetary contributions and effort-based fairness.',
        auto_trigger: false,
        steps: [
          { name: 'Plan Contribution', description: 'Log planned contribution with estimated value', required_role: null },
          { name: 'Work In Progress', description: 'Contributor actively working on deliverable', required_role: null },
          { name: 'Log Actual', description: 'Record actual work done with evidence', required_role: null },
          { name: 'Submit Evidence', description: 'Attach supporting documents, links, or descriptions', required_role: null },
          { name: 'Peer Review', description: 'Reviewer evaluates contribution and sets deserved amount', required_role: 'pmo_coordinator', sla_hours: 168 },
          { name: 'Approve', description: 'Governance approves deserved amount for payout or conversion', required_role: 'founding_orchestrator' },
          { name: 'Settle', description: 'Pay, defer, or convert to equity/credits', required_role: 'pmo_coordinator' },
        ]
      },
      {
        code: 'WF-8', name: 'Compliance Review', entity_type: 'compliance_review',
        icon: 'ShieldCheck', color: 'from-teal-500 to-teal-600',
        description: 'Review data privacy, security, and regulatory compliance for deals and products.',
        auto_trigger: true, trigger_event: 'compliance.requested',
        steps: [
          { name: 'Review Requested', description: 'Compliance review initiated for entity', required_role: null },
          { name: 'Data Classification', description: 'Check personal data, EU data, recording flags', required_role: 'solution_architect', sla_hours: 48 },
          { name: 'DPA Assessment', description: 'Verify Data Processing Agreement requirements', required_role: 'solution_architect', sla_hours: 48 },
          { name: 'Security Review', description: 'Evaluate security measures and IP licensing', required_role: 'solution_architect', sla_hours: 72 },
          { name: 'Final Decision', description: 'Approve, flag issues, or require remediation', required_role: 'solution_architect' },
        ]
      },
      {
        code: 'WF-9', name: 'General Approval', entity_type: 'approval',
        icon: 'CheckSquare', color: 'from-orange-500 to-orange-600',
        description: 'Generic multi-step approval chain for any entity — proposals, budgets, contracts.',
        auto_trigger: false,
        steps: [
          { name: 'Request Submitted', description: 'Approval request created with supporting details', required_role: null },
          { name: 'Initial Review', description: 'First-level reviewer examines the request', required_role: null, sla_hours: 72 },
          { name: 'Final Approval', description: 'Senior approver makes final decision', required_role: null, sla_hours: 48 },
        ]
      },
      {
        code: 'WF-10', name: 'Payout Processing', entity_type: 'payout',
        icon: 'Receipt', color: 'from-pink-500 to-pink-600',
        description: 'Process revenue share payouts and track payment status.',
        auto_trigger: true, trigger_event: 'economic_entry.payable',
        steps: [
          { name: 'Payout Eligible', description: 'Economic entry marked as payable, ready for processing', required_role: null },
          { name: 'Verify Amounts', description: 'Confirm final amounts and beneficiary details', required_role: 'pmo_coordinator', sla_hours: 48 },
          { name: 'Authorize Payment', description: 'Governance authorizes the actual payment', required_role: 'founding_orchestrator', sla_hours: 72 },
          { name: 'Process Transfer', description: 'Execute payment and record transaction', required_role: 'pmo_coordinator' },
          { name: 'Confirm Receipt', description: 'Beneficiary confirms receipt, close payout', required_role: null },
        ]
      },
    ];

    for (const t of templates) {
      const tmplRes = await client.query(
        `INSERT INTO workflow_templates (code, name, description, entity_type, icon, color, is_active, auto_trigger, trigger_event)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (code) DO NOTHING
         RETURNING id`,
        [t.code, t.name, t.description, t.entity_type, t.icon, t.color, true, t.auto_trigger || false, t.trigger_event || null]
      );

      if (tmplRes.rows.length === 0) continue;
      const templateId = tmplRes.rows[0].id;

      for (let i = 0; i < t.steps.length; i++) {
        const s = t.steps[i];
        await client.query(
          `INSERT INTO workflow_template_steps (template_id, step_order, name, description, required_role, is_optional, sla_hours)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [templateId, i + 1, s.name, s.description, s.required_role || null, s.is_optional || false, s.sla_hours || null]
        );
      }
    }

    // ── 6. Auto-generate example workflow instances ──
    // Get user IDs for assignment
    const usersRes = await client.query(`SELECT id, role, full_name FROM users WHERE status = 'active' ORDER BY id`);
    const usersMap = {};
    for (const u of usersRes.rows) {
      usersMap[u.role] = usersMap[u.role] || [];
      usersMap[u.role].push(u);
    }
    const getUserByRole = (role) => (usersMap[role] && usersMap[role][0]) ? usersMap[role][0].id : null;

    const governance = getUserByRole('founding_orchestrator');
    const pmo = getUserByRole('pmo_coordinator');
    const architect = getUserByRole('solution_architect');
    const partner1 = getUserByRole('enterprise_partner');

    // Get some real entities for instances
    const leads = await client.query(`SELECT id, COALESCE(lead_name, 'Lead #' || id) AS label, source_owner_user_id, status FROM leads ORDER BY id LIMIT 4`);
    const opps = await client.query(`SELECT id, opportunity_name AS name, deal_owner_user_id FROM opportunities ORDER BY id LIMIT 3`);
    const conflicts = await client.query(`SELECT id, COALESCE(opportunity_name, 'Opportunity #' || id) AS label FROM opportunities WHERE conflict_flag = true LIMIT 2`);
    // If no conflicts, use first opportunity as fallback
    const conflictRows = conflicts.rows.length > 0 ? conflicts.rows : opps.rows.map(o => ({ id: o.id, label: o.name }));

    // Helper: create instance with steps
    async function createInstance(templateCode, entityType, entityId, entityLabel, startedBy, stepOverrides) {
      const tmpl = await client.query(`SELECT id FROM workflow_templates WHERE code = $1`, [templateCode]);
      if (tmpl.rows.length === 0) return;
      const templateId = tmpl.rows[0].id;

      const steps = await client.query(
        `SELECT id, step_order, name, description, required_role, is_optional, sla_hours
         FROM workflow_template_steps WHERE template_id = $1 ORDER BY step_order`,
        [templateId]
      );

      // Determine current step and status
      const overrides = stepOverrides || {};
      let maxCompleted = 0;
      for (const key of Object.keys(overrides)) {
        if (overrides[key].status === 'completed' && parseInt(key) > maxCompleted) {
          maxCompleted = parseInt(key);
        }
      }
      const currentStep = maxCompleted + 1;
      const allDone = currentStep > steps.rows.length;
      const instanceStatus = allDone ? 'completed' : 'active';

      const instRes = await client.query(
        `INSERT INTO workflow_instances (template_id, entity_type, entity_id, entity_label, status, current_step_order, started_by_user_id, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [templateId, entityType, entityId, entityLabel, instanceStatus, currentStep, startedBy, allDone ? new Date() : null]
      );
      const instanceId = instRes.rows[0].id;

      for (const step of steps.rows) {
        const ov = overrides[step.step_order] || {};
        const stepStatus = ov.status || (step.step_order < currentStep ? 'completed' : step.step_order === currentStep ? 'in_progress' : 'pending');
        const assignedTo = ov.assigned_to || getUserByRole(step.required_role) || null;
        const completedBy = stepStatus === 'completed' ? (ov.completed_by || assignedTo) : null;
        const startedAt = step.step_order <= currentStep ? new Date(Date.now() - (steps.rows.length - step.step_order) * 86400000) : null;
        const completedAt = stepStatus === 'completed' ? new Date(Date.now() - (currentStep - step.step_order) * 86400000) : null;
        const dueAt = step.sla_hours && startedAt ? new Date(startedAt.getTime() + step.sla_hours * 3600000) : null;

        await client.query(
          `INSERT INTO workflow_instance_steps (instance_id, template_step_id, step_order, name, description, status, assigned_to_user_id, completed_by_user_id, started_at, completed_at, due_at, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [instanceId, step.id, step.step_order, step.name, step.description, stepStatus, assignedTo, completedBy, startedAt, completedAt, dueAt, ov.notes || null]
        );
      }
    }

    // Generate example instances
    // WF-1: Lead Lifecycle (2 examples — one in progress, one completed)
    if (leads.rows.length >= 2) {
      await createInstance('WF-1', 'lead', leads.rows[0].id, leads.rows[0].label,
        leads.rows[0].source_owner_user_id || partner1,
        { 1: { status: 'completed' }, 2: { status: 'completed' }, 3: { status: 'completed', notes: 'No conflicts found' } }
      );
      await createInstance('WF-1', 'lead', leads.rows[1].id, leads.rows[1].label,
        leads.rows[1].source_owner_user_id || partner1,
        { 1: { status: 'completed' }, 2: { status: 'completed' }, 3: { status: 'completed' }, 4: { status: 'completed' }, 5: { status: 'completed' } }
      );
    }

    // WF-2: Lead Conversion (1 in progress)
    if (leads.rows.length >= 3) {
      await createInstance('WF-2', 'lead', leads.rows[2].id, leads.rows[2].label,
        leads.rows[2].source_owner_user_id || partner1,
        { 1: { status: 'completed' }, 2: { status: 'completed', notes: 'All 6 roles assigned' } }
      );
    }

    // WF-3: Opportunity Pipeline (2 examples)
    if (opps.rows.length >= 2) {
      await createInstance('WF-3', 'opportunity', opps.rows[0].id, opps.rows[0].name,
        opps.rows[0].deal_owner_user_id || partner1,
        { 1: { status: 'completed' }, 2: { status: 'completed' }, 3: { status: 'completed' }, 4: { status: 'completed' } }
      );
      await createInstance('WF-3', 'opportunity', opps.rows[1].id, opps.rows[1].name,
        opps.rows[1].deal_owner_user_id || partner1,
        { 1: { status: 'completed' } }
      );
    }

    // WF-4: Conflict Resolution
    if (conflictRows.length >= 1) {
      await createInstance('WF-4', 'conflict', conflictRows[0].id, conflictRows[0].label,
        governance,
        { 1: { status: 'completed' }, 2: { status: 'completed', assigned_to: governance } }
      );
    }

    // WF-6: Commercial Revenue (1 example)
    if (opps.rows.length >= 3) {
      await createInstance('WF-6', 'economic_entry', opps.rows[2].id, 'Revenue - ' + opps.rows[2].name,
        pmo,
        { 1: { status: 'completed' }, 2: { status: 'completed' }, 3: { status: 'completed', assigned_to: pmo } }
      );
    }

    // WF-8: Compliance Review (1 example)
    if (opps.rows.length >= 1) {
      await createInstance('WF-8', 'compliance_review', opps.rows[0].id, 'Compliance - ' + opps.rows[0].name,
        architect,
        { 1: { status: 'completed' }, 2: { status: 'completed', assigned_to: architect } }
      );
    }

    // WF-9: General Approval (1 example)
    await createInstance('WF-9', 'approval', 1, 'Budget Approval - Q2 Marketing',
      partner1,
      { 1: { status: 'completed', notes: 'Budget request submitted' } }
    );

    // WF-10: Payout Processing (1 example)
    await createInstance('WF-10', 'payout', 1, 'Referral Fee - Partner Deal',
      pmo,
      { 1: { status: 'completed' }, 2: { status: 'completed', assigned_to: pmo, notes: 'Amounts verified against split template' } }
    );

    await client.query('COMMIT');
    console.log('Migration 011: Workflow engine tables created, templates and examples seeded.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration 011 failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

run().then(() => process.exit(0)).catch(() => process.exit(1));
