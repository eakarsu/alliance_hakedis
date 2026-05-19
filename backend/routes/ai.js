const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const auth = require('../middleware/auth');
const { isFullAccess, isRestricted, isPartnerRole, canAccessRecord,
  opportunityFilter, leadFilter, projectFilter, riskFilter } = require('../middleware/dataFilter');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL;
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL;

const SYSTEM_PROMPT = `You are an AI assistant for Alliance CRM, a sophisticated partner ecosystem and deal management platform. Provide detailed, comprehensive answers with step-by-step instructions when users ask "how to" questions.

## System Overview

Alliance CRM has these main sections accessible from the sidebar:

**Main**: Dashboard — personal KPIs, pipeline summary, recent activities, and key metrics.

**Workflows**: Workflow Hub (view all workflow instances, track progress), New Workflow (start a workflow from 10 predefined templates WF-1 to WF-10), Configure (edit workflow templates, add/remove steps, set SLA hours, toggle auto-trigger).
- The 10 workflows are: WF-1 New Lead Intake, WF-2 Lead-to-Opportunity Conversion, WF-3 Opportunity Qualification, WF-4 Proposal & Pricing, WF-5 Contract & Agreement, WF-6 Project Kickoff, WF-7 Delivery & Milestones, WF-8 Risk Escalation, WF-9 Partner Onboarding, WF-10 Revenue Recognition.
- Each workflow has steps that can be completed, skipped, or assigned to users. Steps have SLA hours for overdue tracking.

**CRM Section**:
- Contacts — add/edit contacts, link to organizations, track relationship strength (1-10), manage lifecycle state (lead/active/churned), consent/GDPR status, and visibility settings.
- Organizations — manage client/partner/prospect companies with type, country, industry, and owner assignment.
- Leads — create leads with source tracking, qualification scoring, protection periods, status management (new/qualified/converted/lost). Leads can be converted to opportunities. Conflict detection prevents duplicate leads.
- Opportunities — multi-pipeline deal management through 13 stages (Registered → Discovery → Qualified → Demo/Workshop → Proposal Drafting → Commercial Negotiation → Legal Review → Closed Won/Lost etc.). Supports Direct Sales, Channel/Referral, Partnership, and Government pipeline types. Revenue sharing splits, product linking, deal paths, and compliance reviews.
- Products — catalog of SaaS, consulting, hardware, and service offerings with maturity levels (concept/beta/GA/mature), pricing models, capabilities, and market targeting.

**Delivery Section**:
- Projects — created from won opportunities, with milestones, deadlines, team assignment (delivery manager, tech lead), budget tracking, and health status.
- Partners — ecosystem partner management with tiers, capabilities, agreements, and performance tracking.
- Agreements — NDA, MSA, SOW, DPA management with governing law, dates, and status tracking.
- Proposals — create proposals for opportunities with pricing, multi-currency support, and approval workflows.
- Resource View — PMO dashboard showing team workload and project assignments.

**Governance Section**:
- Governance Dashboard — ecosystem-wide oversight of deals, conflicts, and compliance.
- Conflict Queue — resolve lead/deal conflicts between partners, with governance review and resolution.
- Visibility Approvals — control who can see sensitive records, approve/deny access requests.
- Risks & Compliance — log and track risks (technical/commercial/compliance/delivery) with severity, mitigation plans, and owner assignment.
- Compliance Reviews — formal deal compliance review process.

**Economics Section**:
- Economics — shadow ledger tracking revenue lifecycle across all deals (10 commercial states, 12 ledger states).
- Split Templates — configure revenue sharing formulas and templates for different deal types.

**Referrals & Revenue Section**:
- My Referrals — submit and track referral leads as a channel/referral partner.
- Status Tracker — follow referral lead progress through the pipeline.
- Payout Summary — view earned commissions, paid amounts, and pending payouts.

**Ecosystem Section**:
- Deal Paths — map how opportunities route through the partner ecosystem.
- Integration Map — visualize product and technology connections.
- Demo Queue — schedule and manage product demos for partners and clients.

**Shared Section**:
- Shared With Me — view records shared by other users (for restricted/external roles).
- Advisory Requests — submit and respond to advisory/consultation requests.
- Meeting Notes — create and manage meeting notes for partner meetings.

**Tools Section**:
- Activities — log calls, meetings, emails, tasks linked to contacts/opportunities/projects.
- KPI Contributions — track individual and team performance metrics and scores.
- AI Assistant — this page, for analyzing CRM data and getting help.

## 8 User Roles (with access levels):
1. **Founding Orchestrator** (Fetih) — Full system access, all governance, economics, split templates, all visibility.
2. **Enterprise Partner** (Gökhan, Yasin, İbrahim) — Own leads/opportunities/contacts, limited pipeline view, conflict queue summary.
3. **Solution Architect** (Erol) — Technical focus: products (full), integration map, demo queue, assigned opportunities.
4. **Channel/Referral Partner** (Michael) — Referrals, status tracker, payout summary, filtered pipeline view.
5. **PMO Coordinator** (Muhittin) — Delivery focus: projects (full), resource view, agreements, governance summary.
6. **Product Experience Lead** — Product-focused with related opportunities and projects.
7. **Product Partner** — Similar to product experience lead with partner-level access.
8. **Restricted External** (Archie) — Minimal: shared items, limited products, activities, advisory requests, meeting notes.

Access depth levels: tam (full), ozet (summary), sinirli (limited), ilgili (related only), gorevli (assigned only), paylasilan (shared only).

When answering "how to" questions, provide detailed step-by-step instructions with specific UI elements (buttons, menus, fields) the user should interact with. When answering analysis questions, use data-driven recommendations with specific numbers from the provided context.`;

async function callOpenRouter(messages) {
  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'Alliance CRM',
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages,
      max_tokens: 4000,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorData}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// POST /api/ai/analyze
router.post('/analyze', auth, async (req, res) => {
  try {
    const { prompt, context, feature } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    let contextualSystemPrompt = SYSTEM_PROMPT;

    if (feature) {
      const featureContexts = {
        dashboard: '\n\nThe user is viewing the dashboard. Help analyze overall CRM performance, trends, and key metrics.',
        leads: '\n\nThe user is analyzing leads. Help with lead scoring, qualification, conversion strategies, lead source performance, and protection period tracking. Provide specific, data-driven answers.',
        opportunities: '\n\nThe user is analyzing opportunities. Help with deal strategy, pipeline analysis, win probability assessment, stage progression, and revenue forecasting. Provide specific, data-driven answers.',
        risks: '\n\nThe user is analyzing risks. Help assess risk severity, suggest mitigation strategies, prioritize actions, and track compliance risks. Provide specific, data-driven answers.',
        projects: '\n\nThe user is analyzing projects. Help with project status assessment, timeline analysis, milestone tracking, resource planning, delivery health, and identifying at-risk projects. Provide specific, data-driven answers.',
        proposals: '\n\nThe user is working on proposals. Help with pricing strategy, competitive positioning, and proposal optimization.',
        contacts: '\n\nThe user is analyzing contacts. Help with relationship strength analysis, engagement tracking, consent management, contact prioritization, and key decision-maker identification. Provide specific, data-driven answers.',
        kpi: '\n\nThe user is reviewing KPIs. Help analyze performance metrics, identify trends, and suggest improvements.',
        products: '\n\nThe user is analyzing products and solutions. Help with product performance analysis, maturity assessment, pricing strategy, product bundling, and revenue contribution by product. Provide specific, data-driven answers.',
        partners: '\n\nThe user is analyzing partners. Help with partner performance evaluation, revenue sharing analysis, channel vs referral effectiveness, partner engagement, and co-selling recommendations. Provide specific, data-driven answers.',
        pipeline: '\n\nThe user is analyzing the sales pipeline. Help with pipeline health assessment, stage conversion rates, velocity metrics, bottleneck identification, pipeline coverage, and revenue forecasting. Provide specific, data-driven answers.',
        general: '\n\nThe user is asking a general question about the CRM. Provide a comprehensive, executive-level answer covering the relevant areas. Provide specific, data-driven answers.',
      };
      contextualSystemPrompt += featureContexts[feature] || '';
    }

    // C2: Block restricted_external from sensitive features
    const role = req.user.role;
    const userId = req.user.id;
    if (isRestricted(role)) {
      const allowedFeatures = ['products', 'general'];
      if (feature && !allowedFeatures.includes(feature)) {
        return res.status(403).json({ error: 'Your role does not have access to analyze this data' });
      }
    }

    // Fetch real data from database based on feature, with role-based filtering
    let dbContext = null;
    try {
      // C2: Build role-filtered queries for each feature
      const buildFilteredQuery = (feature) => {
        if (isFullAccess(role)) {
          // Full access: no filtering needed, use original queries
          const fullQueries = {
            contacts: `SELECT COUNT(*) as total,
              COUNT(CASE WHEN relationship_strength >= 7 THEN 1 END) as strong_relationships,
              COUNT(CASE WHEN relationship_strength <= 3 THEN 1 END) as weak_relationships,
              COUNT(CASE WHEN consent_status = 'given' THEN 1 END) as consent_given,
              COUNT(CASE WHEN consent_status = 'expired' OR consent_status IS NULL THEN 1 END) as consent_missing
              FROM contacts`,
            leads: `SELECT COUNT(*) as total,
              COUNT(CASE WHEN status = 'new' THEN 1 END) as new_leads,
              COUNT(CASE WHEN status = 'qualified' THEN 1 END) as qualified,
              COUNT(CASE WHEN status = 'converted' THEN 1 END) as converted,
              COUNT(CASE WHEN status = 'lost' OR status = 'disqualified' THEN 1 END) as lost,
              COUNT(CASE WHEN updated_at < NOW() - INTERVAL '14 days' AND status NOT IN ('converted', 'lost', 'disqualified') THEN 1 END) as idle_leads
              FROM leads`,
            opportunities: `SELECT COUNT(*) as total,
              COALESCE(SUM(deal_value), 0) as total_pipeline_value,
              COUNT(CASE WHEN status = 'open' THEN 1 END) as open_deals,
              COUNT(CASE WHEN status = 'won' THEN 1 END) as won_deals,
              COUNT(CASE WHEN status = 'lost' THEN 1 END) as lost_deals,
              COALESCE(AVG(deal_value), 0) as avg_deal_value
              FROM opportunities`,
            products: `SELECT COUNT(*) as total,
              COUNT(CASE WHEN product_type = 'SaaS' THEN 1 END) as saas_count,
              COUNT(CASE WHEN product_type = 'Consulting' THEN 1 END) as consulting_count,
              COUNT(CASE WHEN product_type = 'Hardware' THEN 1 END) as hardware_count,
              COUNT(CASE WHEN maturity_level = 'mature' THEN 1 END) as mature_products,
              COUNT(CASE WHEN is_active = true THEN 1 END) as active_products
              FROM products`,
            projects: `SELECT COUNT(*) as total,
              COUNT(CASE WHEN status = 'active' OR status = 'in_progress' THEN 1 END) as active_projects,
              COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
              COUNT(CASE WHEN status = 'at_risk' OR status = 'delayed' THEN 1 END) as at_risk,
              COUNT(CASE WHEN status = 'on_hold' THEN 1 END) as on_hold
              FROM projects`,
            partners: `SELECT COUNT(*) as total,
              COUNT(CASE WHEN partner_type = 'channel' THEN 1 END) as channel_partners,
              COUNT(CASE WHEN partner_type = 'referral' THEN 1 END) as referral_partners,
              COUNT(CASE WHEN is_active = true OR status = 'active' THEN 1 END) as active_partners
              FROM partners`,
            risks: `SELECT COUNT(*) as total,
              COUNT(CASE WHEN severity = 'critical' OR severity = 'high' THEN 1 END) as high_severity,
              COUNT(CASE WHEN severity = 'medium' THEN 1 END) as medium_severity,
              COUNT(CASE WHEN severity = 'low' THEN 1 END) as low_severity,
              COUNT(CASE WHEN status = 'open' OR status = 'active' THEN 1 END) as open_risks,
              COUNT(CASE WHEN status = 'mitigated' OR status = 'resolved' THEN 1 END) as resolved_risks
              FROM risks`,
            pipeline: `SELECT p.pipeline_name, COUNT(o.id) as deal_count, COALESCE(SUM(o.deal_value), 0) as total_value
              FROM pipelines p
              LEFT JOIN opportunities o ON o.pipeline_id = p.id
              GROUP BY p.id, p.pipeline_name`,
          };
          return fullQueries[feature] ? { query: fullQueries[feature], params: [] } : null;
        }

        // Role-filtered queries for non-full-access users
        const { leadFilter: lf, opportunityFilter: of, projectFilter: pf, riskFilter: rf, productFilter: prodf } = require('../middleware/dataFilter');
        switch (feature) {
          case 'leads': {
            const f = lf(role, userId, 1);
            return {
              query: `SELECT COUNT(*) as total,
                COUNT(CASE WHEN l.status = 'new' THEN 1 END) as new_leads,
                COUNT(CASE WHEN l.status = 'qualified' THEN 1 END) as qualified,
                COUNT(CASE WHEN l.status = 'converted' THEN 1 END) as converted,
                COUNT(CASE WHEN l.status = 'lost' OR l.status = 'disqualified' THEN 1 END) as lost
                FROM leads l WHERE 1=1${f.clause}`,
              params: f.params
            };
          }
          case 'opportunities': {
            const f = of(role, userId, 1);
            return {
              query: `SELECT COUNT(*) as total,
                COALESCE(SUM(op.deal_value), 0) as total_pipeline_value,
                COUNT(CASE WHEN op.status = 'open' THEN 1 END) as open_deals,
                COUNT(CASE WHEN op.status = 'won' THEN 1 END) as won_deals,
                COUNT(CASE WHEN op.status = 'lost' THEN 1 END) as lost_deals
                FROM opportunities op WHERE 1=1${f.clause}`,
              params: f.params
            };
          }
          case 'projects': {
            const f = pf(role, userId, 1);
            return {
              query: `SELECT COUNT(*) as total,
                COUNT(CASE WHEN pj.status = 'active' OR pj.status = 'in_progress' THEN 1 END) as active_projects,
                COUNT(CASE WHEN pj.status = 'completed' THEN 1 END) as completed,
                COUNT(CASE WHEN pj.status = 'at_risk' OR pj.status = 'delayed' THEN 1 END) as at_risk
                FROM projects pj WHERE 1=1${f.clause}`,
              params: f.params
            };
          }
          case 'risks': {
            const f = rf(role, userId, 1);
            return {
              query: `SELECT COUNT(*) as total,
                COUNT(CASE WHEN r.severity = 'critical' OR r.severity = 'high' THEN 1 END) as high_severity,
                COUNT(CASE WHEN r.severity = 'medium' THEN 1 END) as medium_severity,
                COUNT(CASE WHEN r.status = 'open' OR r.status = 'active' THEN 1 END) as open_risks
                FROM risks r WHERE 1=1${f.clause}`,
              params: f.params
            };
          }
          case 'products': {
            const f = prodf(role, userId, 1);
            return {
              query: `SELECT COUNT(*) as total,
                COUNT(CASE WHEN p.maturity_level = 'mature' THEN 1 END) as mature_products
                FROM products p WHERE 1=1${f.clause}`,
              params: f.params
            };
          }
          case 'contacts': {
            // PMO/SA see all; partners see own
            if (role === 'pmo_coordinator' || role === 'solution_architect') {
              return {
                query: `SELECT COUNT(*) as total,
                  COUNT(CASE WHEN consent_status = 'given' THEN 1 END) as consent_given
                  FROM contacts`,
                params: []
              };
            }
            return {
              query: `SELECT COUNT(*) as total,
                COUNT(CASE WHEN consent_status = 'given' THEN 1 END) as consent_given
                FROM contacts WHERE owner_user_id = $1 OR id IN (SELECT contact_id FROM relationship_links WHERE known_by_user_id = $1)`,
              params: [userId]
            };
          }
          case 'pipeline': {
            const f = of(role, userId, 1);
            return {
              query: `SELECT p.pipeline_name, COUNT(op.id) as deal_count, COALESCE(SUM(op.deal_value), 0) as total_value
                FROM pipelines p
                LEFT JOIN opportunities op ON op.pipeline_id = p.id AND (1=1${f.clause})
                GROUP BY p.id, p.pipeline_name`,
              params: f.params
            };
          }
          default:
            return null;
        }
      };

      const filteredQuery = buildFilteredQuery(feature);
      if (filteredQuery) {
        const result = await pool.query(filteredQuery.query, filteredQuery.params);
        dbContext = feature === 'pipeline' ? result.rows : result.rows[0];
      }
    } catch (dbErr) {
      console.log('DB context fetch skipped:', dbErr.message);
    }

    const messages = [
      { role: 'system', content: contextualSystemPrompt },
    ];

    if (dbContext) {
      messages.push({ role: 'user', content: `Here is the current data from the database for context:\n${JSON.stringify(dbContext, null, 2)}\n\nBased on this real data, answer the following question directly and specifically. Do not ask clarifying questions - use the data provided.` });
    }

    if (context) {
      messages.push({ role: 'user', content: `Additional context: ${JSON.stringify(context)}` });
    }

    messages.push({ role: 'user', content: prompt });

    const aiResponse = await callOpenRouter(messages);

    res.json({ response: aiResponse, model: OPENROUTER_MODEL });
  } catch (err) {
    console.error('AI analyze error:', err);
    res.status(500).json({ error: 'AI analysis failed', message: err.message });
  }
});

// POST /api/ai/suggest
router.post('/suggest', auth, async (req, res) => {
  try {
    const { entity_type, entity_id, action } = req.body;

    if (!entity_type) {
      return res.status(400).json({ error: 'Entity type is required' });
    }

    // C2: Block restricted_external from suggest endpoint
    if (isRestricted(req.user.role)) {
      return res.status(403).json({ error: 'Your role does not have access to AI suggestions' });
    }

    let entityData = null;
    let contextPrompt = '';

    // C2: Access check mapping for entity types
    const accessChecks = {
      opportunity: { table: 'opportunities', alias: 'op', filterFn: opportunityFilter },
      lead: { table: 'leads', alias: 'l', filterFn: leadFilter },
      project: { table: 'projects', alias: 'pj', filterFn: projectFilter },
      risk: { table: 'risks', alias: 'r', filterFn: riskFilter },
    };

    // C2: Verify user can access the entity before fetching data for AI
    if (entity_id && accessChecks[entity_type]) {
      const check = accessChecks[entity_type];
      const hasAccess = await canAccessRecord(pool, check.table, check.alias, check.filterFn, entity_id, req.user.role, req.user.id);
      if (!hasAccess) {
        return res.status(403).json({ error: `Access denied to this ${entity_type}` });
      }
    }

    switch (entity_type) {
      case 'opportunity': {
        const result = await pool.query(
          `SELECT o.*, org.org_name, s.stage_name, p.pipeline_name, u.full_name AS deal_owner_name
           FROM opportunities o
           LEFT JOIN organizations org ON o.account_org_id = org.id
           LEFT JOIN stages s ON o.stage_id = s.id
           LEFT JOIN pipelines p ON o.pipeline_id = p.id
           LEFT JOIN users u ON o.deal_owner_user_id = u.id
           WHERE o.id = $1`,
          [entity_id]
        );
        entityData = result.rows[0];
        contextPrompt = `Analyze this opportunity and provide suggestions for advancing it: ${JSON.stringify(entityData)}`;
        break;
      }
      case 'lead': {
        const result = await pool.query(
          `SELECT l.*, o.org_name, u.full_name AS source_owner_name
           FROM leads l
           LEFT JOIN organizations o ON l.organization_id = o.id
           LEFT JOIN users u ON l.source_owner_user_id = u.id
           WHERE l.id = $1`,
          [entity_id]
        );
        entityData = result.rows[0];
        contextPrompt = `Analyze this lead and suggest next steps for qualification and conversion: ${JSON.stringify(entityData)}`;
        break;
      }
      case 'project': {
        const result = await pool.query(
          `SELECT pj.*, u.full_name AS owner_name, dm.full_name AS delivery_manager_name
           FROM projects pj
           LEFT JOIN users u ON pj.project_owner_user_id = u.id
           LEFT JOIN users dm ON pj.delivery_manager_user_id = dm.id
           WHERE pj.id = $1`,
          [entity_id]
        );
        entityData = result.rows[0];

        const milestones = await pool.query(
          'SELECT * FROM project_milestones WHERE project_id = $1 ORDER BY due_date',
          [entity_id]
        );
        entityData.milestones = milestones.rows;
        contextPrompt = `Analyze this project status and milestones, suggest improvements: ${JSON.stringify(entityData)}`;
        break;
      }
      case 'risk': {
        const result = await pool.query(
          `SELECT r.*, u.full_name AS owner_name FROM risks r
           LEFT JOIN users u ON r.owner_user_id = u.id WHERE r.id = $1`,
          [entity_id]
        );
        entityData = result.rows[0];
        contextPrompt = `Analyze this risk and suggest mitigation strategies: ${JSON.stringify(entityData)}`;
        break;
      }
      default:
        contextPrompt = action || `Provide general suggestions for managing ${entity_type} entities in the Alliance CRM.`;
    }

    if (!entityData && entity_id) {
      return res.status(404).json({ error: `${entity_type} not found` });
    }

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT + '\n\nProvide 3-5 specific, actionable suggestions. Format as numbered list.' },
      { role: 'user', content: contextPrompt },
    ];

    const aiResponse = await callOpenRouter(messages);

    res.json({ suggestions: aiResponse, entity_type, entity_id, model: OPENROUTER_MODEL });
  } catch (err) {
    console.error('AI suggest error:', err);
    res.status(500).json({ error: 'AI suggestion failed', message: err.message });
  }
});

// POST /api/ai/optimize-economics
// Suggests revenue-share / economics adjustments for an opportunity given the current split.
// Mechanical addition based on audit recommendation: "economics optimization".
router.post('/optimize-economics', auth, async (req, res) => {
  try {
    const { opportunity_id, scenario } = req.body;
    if (!opportunity_id) {
      return res.status(400).json({ error: 'opportunity_id is required' });
    }

    if (isRestricted(req.user.role)) {
      return res.status(403).json({ error: 'Your role does not have access to economics optimization' });
    }

    const hasAccess = await canAccessRecord(
      pool, 'opportunities', 'op', opportunityFilter, opportunity_id, req.user.role, req.user.id
    );
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this opportunity' });
    }

    const oppResult = await pool.query(
      `SELECT o.*, org.org_name, s.stage_name, p.pipeline_name
       FROM opportunities o
       LEFT JOIN organizations org ON o.account_org_id = org.id
       LEFT JOIN stages s ON o.stage_id = s.id
       LEFT JOIN pipelines p ON o.pipeline_id = p.id
       WHERE o.id = $1`,
      [opportunity_id]
    );
    const opp = oppResult.rows[0];
    if (!opp) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }

    let economics = [];
    try {
      const econ = await pool.query(
        'SELECT * FROM economics WHERE opportunity_id = $1',
        [opportunity_id]
      );
      economics = econ.rows;
    } catch (_) {
      economics = [];
    }

    let templates = [];
    try {
      const t = await pool.query('SELECT * FROM split_templates LIMIT 20');
      templates = t.rows;
    } catch (_) {
      templates = [];
    }

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT + '\n\nPropose adjustments to revenue-share splits to balance partner satisfaction with company margin. Respond with strict JSON: {"recommended_split": [{"role": <string>, "percent": <number>}], "rationale": <string>, "guardrails": [<strings>], "warnings": [<strings>]}. No prose outside JSON.' },
      { role: 'user', content: `Opportunity:\n${JSON.stringify(opp, null, 2)}\n\nCurrent economics rows:\n${JSON.stringify(economics, null, 2)}\n\nAvailable split templates:\n${JSON.stringify(templates, null, 2)}\n\nScenario / objective: ${scenario || 'maximise expected company contribution while keeping channel partner share competitive'}` },
    ];

    const aiResponse = await callOpenRouter(messages);
    let parsed = null;
    try {
      const match = aiResponse.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : null;
    } catch (_) {
      parsed = null;
    }

    res.json({
      opportunity_id,
      proposal: parsed || { raw: aiResponse },
      model: OPENROUTER_MODEL,
    });
  } catch (err) {
    console.error('AI optimize-economics error:', err);
    res.status(500).json({ error: 'AI economics optimization failed', message: err.message });
  }
});

// POST /api/ai/predict-bottleneck
// Predicts likely workflow bottlenecks for an approval workflow instance.
// Mechanical addition based on audit recommendation: "approval workflow prediction (likely bottlenecks)".
router.post('/predict-bottleneck', auth, async (req, res) => {
  try {
    const { workflow_instance_id, workflow_template_id } = req.body;
    if (!workflow_instance_id && !workflow_template_id) {
      return res.status(400).json({ error: 'workflow_instance_id or workflow_template_id is required' });
    }

    if (isRestricted(req.user.role)) {
      return res.status(403).json({ error: 'Your role does not have access to workflow prediction' });
    }

    let instanceData = null;
    let templateData = null;
    try {
      if (workflow_instance_id) {
        const r = await pool.query(
          'SELECT * FROM approval_workflow_instances WHERE id = $1',
          [workflow_instance_id]
        );
        instanceData = r.rows[0] || null;
      }
      if (workflow_template_id || (instanceData && instanceData.template_id)) {
        const tid = workflow_template_id || instanceData.template_id;
        const r = await pool.query(
          'SELECT * FROM approval_workflow_templates WHERE id = $1',
          [tid]
        );
        templateData = r.rows[0] || null;
      }
    } catch (_) {
      // tables may not exist in all envs; let LLM still reason from inputs
    }

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT + '\n\nPredict likely workflow bottlenecks. Respond with strict JSON: {"likely_bottleneck_steps": [<strings>], "estimated_delay_hours": <number>, "root_causes": [<strings>], "mitigations": [<strings>]}. No prose outside JSON.' },
      { role: 'user', content: `Workflow instance:\n${JSON.stringify(instanceData, null, 2)}\n\nWorkflow template:\n${JSON.stringify(templateData, null, 2)}` },
    ];

    const aiResponse = await callOpenRouter(messages);
    let parsed = null;
    try {
      const match = aiResponse.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : null;
    } catch (_) {
      parsed = null;
    }

    res.json({
      workflow_instance_id: workflow_instance_id || null,
      workflow_template_id: workflow_template_id || null,
      prediction: parsed || { raw: aiResponse },
      model: OPENROUTER_MODEL,
    });
  } catch (err) {
    console.error('AI predict-bottleneck error:', err);
    res.status(500).json({ error: 'AI bottleneck prediction failed', message: err.message });
  }
});

// POST /api/ai/governance-exception
// Routes a governance exception (out-of-policy ask) and recommends approvers + conditions.
// Mechanical addition based on audit recommendation: "governance exception handling".
router.post('/governance-exception', auth, async (req, res) => {
  try {
    const { entity_type, entity_id, exception_request } = req.body;
    if (!exception_request) {
      return res.status(400).json({ error: 'exception_request is required' });
    }

    if (isRestricted(req.user.role)) {
      return res.status(403).json({ error: 'Your role does not have access to governance exception routing' });
    }

    let entityData = null;
    if (entity_type && entity_id) {
      const accessChecks = {
        opportunity: { table: 'opportunities', alias: 'op', filterFn: opportunityFilter },
        lead: { table: 'leads', alias: 'l', filterFn: leadFilter },
        project: { table: 'projects', alias: 'pj', filterFn: projectFilter },
        risk: { table: 'risks', alias: 'r', filterFn: riskFilter },
      };
      if (accessChecks[entity_type]) {
        const check = accessChecks[entity_type];
        const hasAccess = await canAccessRecord(
          pool, check.table, check.alias, check.filterFn, entity_id, req.user.role, req.user.id
        );
        if (!hasAccess) {
          return res.status(403).json({ error: `Access denied to this ${entity_type}` });
        }
        try {
          const r = await pool.query(`SELECT * FROM ${check.table} WHERE id = $1`, [entity_id]);
          entityData = r.rows[0] || null;
        } catch (_) {
          entityData = null;
        }
      }
    }

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT + '\n\nYou are routing a governance exception. Recommend the minimum approvers and the conditions / mitigations. Respond with strict JSON: {"verdict": "auto_approve|needs_approval|escalate|deny", "required_approvers": [<roles>], "conditions": [<strings>], "audit_notes": [<strings>]}. No prose outside JSON.' },
      { role: 'user', content: `Exception request: ${exception_request}\n\nEntity: ${entity_type || 'none'} ${entity_id || ''}\n\nEntity data:\n${entityData ? JSON.stringify(entityData, null, 2) : 'none'}` },
    ];

    const aiResponse = await callOpenRouter(messages);
    let parsed = null;
    try {
      const match = aiResponse.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : null;
    } catch (_) {
      parsed = null;
    }

    res.json({
      entity_type: entity_type || null,
      entity_id: entity_id || null,
      routing: parsed || { raw: aiResponse },
      model: OPENROUTER_MODEL,
    });
  } catch (err) {
    console.error('AI governance-exception error:', err);
    res.status(500).json({ error: 'AI governance exception routing failed', message: err.message });
  }
});

module.exports = router;
