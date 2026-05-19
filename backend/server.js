const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const auth = require('./middleware/auth');
const { requireAccess } = require('./middleware/roleAccess');

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

// Middleware
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : [`http://localhost:${process.env.FRONTEND_PORT || 3000}`];
app.use(cors({
  origin: corsOrigins,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes (no role check needed)
app.use('/api/auth', require('./routes/auth'));

// Protected routes with role-based access
app.use('/api/dashboard', auth, requireAccess('dashboard'), require('./routes/dashboard'));
app.use('/api/contacts', auth, requireAccess('contacts'), require('./routes/contacts'));
app.use('/api/organizations', auth, requireAccess('organizations'), require('./routes/organizations'));
app.use('/api/leads', auth, requireAccess('leads'), require('./routes/leads'));
app.use('/api/opportunities', auth, requireAccess('opportunities'), require('./routes/opportunities'));
app.use('/api/products', auth, requireAccess('products'), require('./routes/products'));
app.use('/api/projects', auth, requireAccess('projects'), require('./routes/projects'));
app.use('/api/partners', auth, requireAccess('partners'), require('./routes/partners'));
app.use('/api/agreements', auth, requireAccess('agreements'), require('./routes/agreements'));
app.use('/api/activities', auth, requireAccess('activities'), require('./routes/activities'));
app.use('/api/risks', auth, requireAccess('risks'), require('./routes/risks'));
app.use('/api/proposals', auth, requireAccess('proposals'), require('./routes/proposals'));
app.use('/api/kpi', auth, requireAccess('kpi'), require('./routes/kpi'));
app.use('/api/ai', auth, requireAccess('ai'), require('./routes/ai'));

// Governance routes - handles its own sub-route access checks internally
// (conflict-queue, visibility-approvals, overview each check their own permissions)
app.use('/api/governance', auth, require('./routes/governance'));

// Referral & Revenue routes
app.use('/api/referrals', auth, requireAccess('referrals'), require('./routes/referrals'));

// Shared items
app.use('/api/shared-items', auth, requireAccess('shared-items'), require('./routes/sharedItems'));

// Ecosystem routes
app.use('/api/deal-paths', auth, requireAccess('deal-paths'), require('./routes/dealPaths'));
app.use('/api/compliance-reviews', auth, requireAccess('compliance-reviews'), require('./routes/complianceReviews'));

// Notifications (auth only, route handles its own auth internally)
app.use('/api/notifications', require('./routes/notifications'));

// Opportunity roles (internal, auth only)
app.use('/api/opportunity-roles', auth, require('./routes/opportunityRoles'));

// Documents
app.use('/api/documents', auth, require('./routes/documents'));

// Attachments
app.use('/api/attachments', auth, requireAccess('attachments'), require('./routes/attachments'));

// Workflows
app.use('/api/workflows', auth, requireAccess('workflows'), require('./routes/workflows'));

// Economics & Shadow Ledger
app.use('/api/economics', auth, requireAccess('economics'), require('./routes/economics'));
app.use('/api/split-templates', auth, requireAccess('split-templates'), require('./routes/splitTemplates'));
app.use('/api/approval-workflows', auth, requireAccess('approval-workflows'), require('./routes/approvalWorkflows'));
app.use('/api/meeting-notes', auth, requireAccess('meeting-notes'), require('./routes/meetingNotes'));
app.use('/api/advisory-requests', auth, requireAccess('advisory-requests'), require('./routes/advisoryRequests'));

// Pass-5 backlog: NEEDS-PRODUCT-DECISION AI endpoints
app.use('/api/ai', require('./routes/aiBacklog'));
// Pass-5 backlog: NEEDS-SCHEMA additive features (CREATE TABLE IF NOT EXISTS)
app.use('/api/governance-matrix', require('./routes/governanceMatrix'));
app.use('/api/audit-reports', require('./routes/auditReports'));
app.use('/api/contract-versions', require('./routes/contractVersions'));
app.use('/api/payout-reconciliation', require('./routes/payoutReconciliation'));
app.use('/api/custom', auth, require('./routes/customFeatures'));

// Hakedis Custom Views (mounted BEFORE 404 handler; open for in-app fetch)
app.use('/api/custom-views', require('./routes/customViews'));

// User list for pickers (auth only, returns minimal user info)
app.get('/api/users/list', auth, async (req, res) => {
  try {
    const pool = require('./db/connection');
    const result = await pool.query('SELECT id, full_name, role FROM users ORDER BY full_name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve frontend static files in production
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else {
  // 404 handler (dev only — in prod, frontend handles unknown routes)
  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// // === Batch 09 Gaps & Frontend Mounts ===
app.use('/api/gap-ai-alliance_hakedis', require('./routes/batch09GapAi')); // // === Batch 09 Gaps & Frontend Mounts ===
app.use('/api/gap-nonai-alliance_hakedis', require('./routes/batch09GapNonai')); // // === Batch 09 Gaps & Frontend Mounts ===

app.listen(PORT, () => {
  console.log(`Alliance CRM Backend running on port ${PORT}`);
});

module.exports = app;


