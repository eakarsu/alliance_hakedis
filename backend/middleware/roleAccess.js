// Role-based page/resource access configuration
// Based on Alliance CRM Rol Bazlı Kullanıcı El Kitabı - Sections 5-13
// Must stay in sync with frontend/src/config/rolePermissions.js

const rolePageAccess = {
  // Rol 1 – Founding Orchestrator / Core Governance (Fetih)
  // Full system access + all governance screens
  founding_orchestrator: [
    'dashboard', 'workflows', 'contacts', 'organizations', 'leads', 'opportunities',
    'products', 'projects', 'partners', 'agreements', 'activities',
    'risks', 'proposals', 'kpi', 'ai',
    'conflict-queue', 'visibility-approvals', 'compliance-reviews',
    'deal-paths', 'demo-queue', 'integration-map', 'governance',
    'economics', 'split-templates', 'approval-workflows', 'attachments',
    'meeting-notes', 'advisory-requests', 'payout-summary', 'referrals'
  ],

  // Rol 5 – Delivery Manager / PMO (Muhittin)
  // Delivery focus: Projects(tam), Agreements(ilgili), Risks(özet), Conflict Queue(özet)
  pmo_coordinator: [
    'dashboard', 'workflows', 'contacts', 'organizations', 'leads', 'opportunities',
    'products', 'projects', 'partners', 'agreements', 'activities',
    'risks', 'proposals', 'kpi', 'ai',
    'conflict-queue', 'compliance-reviews', 'deal-paths',
    'resource-view', 'governance',
    'economics', 'split-templates', 'approval-workflows', 'attachments',
    'meeting-notes', 'advisory-requests', 'payout-summary', 'referrals'
  ],

  // Rol 3 – Solution Architect / Technical Partner (Erol)
  // Technical focus: Products(tam), Integration Map, Demo Queue, Risks(özet)
  solution_architect: [
    'dashboard', 'workflows', 'contacts', 'organizations', 'leads', 'opportunities',
    'products', 'projects', 'partners', 'agreements', 'activities',
    'risks', 'proposals', 'kpi', 'ai',
    'conflict-queue', 'compliance-reviews',
    'deal-paths', 'demo-queue', 'integration-map', 'governance',
    'economics', 'approval-workflows', 'attachments',
    'meeting-notes', 'advisory-requests', 'referrals', 'payout-summary'
  ],

  // Rol 2 – Partner Owner / Business Builder (Gökhan, Yasin, İbrahim)
  // Own records focus: Leads, Opportunities, Products, Activities (all filtered)
  // Matrix: Conflict Queue(özet), Projects(ilgili), Agreements(ilgili)
  enterprise_partner: [
    'dashboard', 'workflows', 'contacts', 'organizations', 'leads', 'opportunities',
    'products', 'projects', 'partners', 'agreements', 'activities',
    'risks', 'proposals', 'kpi', 'ai',
    'conflict-queue', 'deal-paths', 'demo-queue', 'integration-map',
    'economics', 'approval-workflows', 'attachments', 'referrals', 'payout-summary'
  ],

  product_experience_lead: [
    'dashboard', 'workflows', 'contacts', 'organizations', 'leads', 'opportunities',
    'products', 'projects', 'partners', 'agreements', 'activities',
    'risks', 'proposals', 'kpi', 'ai',
    'conflict-queue', 'deal-paths', 'demo-queue', 'integration-map',
    'economics', 'approval-workflows', 'attachments', 'referrals', 'payout-summary'
  ],

  product_partner: [
    'dashboard', 'workflows', 'contacts', 'organizations', 'leads', 'opportunities',
    'products', 'projects', 'partners', 'agreements', 'activities',
    'risks', 'proposals', 'kpi', 'ai',
    'conflict-queue', 'deal-paths', 'demo-queue', 'integration-map',
    'economics', 'approval-workflows', 'attachments', 'referrals', 'payout-summary'
  ],

  // Rol 4 – Channel / Referral Partner (Michael)
  // Özet access to most resources, filtered by ownership at data level
  us_market_bridge: [
    'dashboard', 'workflows', 'contacts', 'organizations', 'leads', 'opportunities',
    'products', 'projects', 'partners', 'agreements', 'activities',
    'proposals', 'risks', 'kpi',
    'referrals', 'status-tracker', 'payout-summary',
    'economics', 'attachments'
  ],

  // Rol 6 – Restricted External / Advisor (Archie)
  // Minimal: shared items, limited products, limited activities
  restricted_external: [
    'dashboard', 'workflows', 'shared-items', 'products', 'activities',
    'advisory-requests', 'meeting-notes', 'agreements'
  ],
};

function requireAccess(resource) {
  return (req, res, next) => {
    const userRole = req.user?.role;
    if (!userRole) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const allowedPages = rolePageAccess[userRole];
    if (!allowedPages || !allowedPages.includes(resource)) {
      return res.status(403).json({ error: 'Access denied. Your role does not have permission for this resource.' });
    }

    next();
  };
}

module.exports = { requireAccess, rolePageAccess };
