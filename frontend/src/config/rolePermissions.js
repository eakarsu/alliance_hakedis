// Role-based page access configuration
// Based on Alliance CRM Rol Bazlı Kullanıcı El Kitabı (Sections 5-13)
// Document roles: Governance(Fetih), PMO(Muhittin), Technical(Erol),
// Partner Owner(Gökhan,Yasin,İbrahim), Referral(Michael), Restricted(Archie)

export const rolePageAccess = {
  // Rol 1 – Founding Orchestrator / Core Governance (Fetih)
  // Doc: Governance Dashboard, All Opportunities, Conflict Queue,
  //      Visibility Approval Queue, Agreement Registry, Risk & Compliance View
  // Matrix: Full access to all screens
  founding_orchestrator: [
    'dashboard', 'workflows', 'contacts', 'organizations', 'leads', 'opportunities',
    'products', 'projects', 'partners', 'agreements', 'activities',
    'risks', 'proposals', 'kpi', 'ai',
    'conflict-queue', 'visibility-approvals', 'compliance-reviews',
    'deal-paths', 'demo-queue', 'integration-map', 'governance',
    'economics', 'split-templates', 'approval-workflows', 'attachments',
    'payout-summary'
  ],

  // Rol 5 – Delivery Manager / PMO (Muhittin)
  // Doc: Delivery Dashboard, Projects, Milestones, Resource View,
  //      SOW/Agreement Tracker, Delivery Risks
  // Matrix: Projects(tam), Opportunities(delivery), Conflict Queue(özet),
  //         Products(ilgili), Agreements(ilgili), Governance Dashboard(özet)
  pmo_coordinator: [
    'dashboard', 'workflows', 'contacts', 'organizations', 'leads', 'opportunities',
    'products', 'projects', 'partners', 'agreements', 'activities',
    'risks', 'proposals', 'kpi', 'ai',
    'conflict-queue', 'compliance-reviews', 'deal-paths',
    'resource-view', 'governance',
    'economics', 'split-templates', 'approval-workflows', 'attachments',
    'payout-summary'
  ],

  // Rol 3 – Solution Architect / Technical Partner (Erol)
  // Doc: Technical Dashboard, Opportunities Needing Review, Products & Architectures,
  //      Integration Map, Demo Queue, Delivery Risk Panel
  // Matrix: Products(tam), Opportunities(görevli), Conflict Queue(özet),
  //         Projects(ilgili), Agreements(ilgili), Governance Dashboard(özet)
  solution_architect: [
    'dashboard', 'workflows', 'contacts', 'organizations', 'leads', 'opportunities',
    'products', 'projects', 'partners', 'agreements', 'activities',
    'risks', 'proposals', 'kpi', 'ai',
    'conflict-queue', 'compliance-reviews',
    'deal-paths', 'demo-queue', 'integration-map', 'governance',
    'economics', 'approval-workflows', 'attachments'
  ],

  // Rol 2 – Partner Owner / Business Builder (Gökhan, Yasin, İbrahim)
  // Doc: My Dashboard, My Leads, My Opportunities, My Accounts, My Products,
  //      Activities & Documents
  // Matrix: Opportunities(sınırlı), Conflict Queue(özet), Products(kendi+paylaşılan),
  //         Projects(ilgili), Agreements(ilgili), Governance Dashboard(yok)
  enterprise_partner: [
    'dashboard', 'workflows', 'contacts', 'organizations', 'leads', 'opportunities',
    'products', 'projects', 'partners', 'agreements', 'activities',
    'risks', 'proposals', 'kpi', 'ai',
    'conflict-queue', 'deal-paths', 'demo-queue', 'integration-map',
    'economics', 'approval-workflows', 'attachments'
  ],

  product_experience_lead: [
    'dashboard', 'workflows', 'contacts', 'organizations', 'leads', 'opportunities',
    'products', 'projects', 'partners', 'agreements', 'activities',
    'risks', 'proposals', 'kpi', 'ai',
    'conflict-queue', 'deal-paths', 'demo-queue', 'integration-map',
    'economics', 'approval-workflows', 'attachments'
  ],

  product_partner: [
    'dashboard', 'workflows', 'contacts', 'organizations', 'leads', 'opportunities',
    'products', 'projects', 'partners', 'agreements', 'activities',
    'risks', 'proposals', 'kpi', 'ai',
    'conflict-queue', 'deal-paths', 'demo-queue', 'integration-map',
    'economics', 'approval-workflows', 'attachments'
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
}

export const roleLabels = {
  founding_orchestrator: 'Founding Orchestrator',
  pmo_coordinator: 'PMO Coordinator',
  solution_architect: 'Solution Architect',
  enterprise_partner: 'Enterprise Partner',
  product_experience_lead: 'Product Experience Lead',
  product_partner: 'Product Partner',
  us_market_bridge: 'US Market Bridge',
  restricted_external: 'Restricted External',
}

// Access depth per role per resource (Section 13 matrix)
// tam = full, ozet = summary, sinirli = limited, paylasilan = shared only, ilgili = related only, gorevli = assigned only
export const accessDepth = {
  founding_orchestrator: {
    dashboard: 'tam', contacts: 'tam', organizations: 'tam', leads: 'tam',
    opportunities: 'tam', products: 'tam', projects: 'ozet', partners: 'tam',
    agreements: 'tam', activities: 'tam', risks: 'tam',
    'conflict-queue': 'tam', 'visibility-approvals': 'tam', 'compliance-reviews': 'tam',
  },
  pmo_coordinator: {
    dashboard: 'tam', contacts: 'tam', organizations: 'tam', leads: 'tam',
    opportunities: 'ilgili', products: 'ilgili', projects: 'tam', partners: 'tam',
    agreements: 'ilgili', activities: 'tam', risks: 'ozet',
    'conflict-queue': 'ozet', 'compliance-reviews': 'tam',
    'governance-dashboard': 'ozet',
  },
  solution_architect: {
    dashboard: 'tam', contacts: 'tam', organizations: 'tam', leads: 'tam',
    opportunities: 'gorevli', products: 'tam', projects: 'ilgili', partners: 'tam',
    agreements: 'ilgili', activities: 'tam', risks: 'ozet',
    'conflict-queue': 'ozet', 'compliance-reviews': 'tam',
    'integration-map': 'tam', 'demo-queue': 'tam',
    'governance-dashboard': 'ozet',
  },
  enterprise_partner: {
    dashboard: 'tam', contacts: 'ilgili', organizations: 'ilgili', leads: 'ilgili',
    opportunities: 'sinirli', products: 'kendi_paylasilan', projects: 'ilgili', partners: 'ilgili',
    agreements: 'ilgili', activities: 'ilgili',
    'conflict-queue': 'ozet',
  },
  product_experience_lead: {
    dashboard: 'tam', contacts: 'ilgili', organizations: 'ilgili', leads: 'ilgili',
    opportunities: 'ilgili', products: 'ilgili', projects: 'ilgili', partners: 'ilgili',
    agreements: 'ilgili', activities: 'ilgili',
    'conflict-queue': 'ozet',
  },
  product_partner: {
    dashboard: 'tam', contacts: 'ilgili', organizations: 'ilgili', leads: 'ilgili',
    opportunities: 'ilgili', products: 'ilgili', projects: 'ilgili', partners: 'ilgili',
    agreements: 'ilgili', activities: 'ilgili',
    'conflict-queue': 'ozet',
  },
  us_market_bridge: {
    dashboard: 'tam', contacts: 'ilgili', organizations: 'ilgili', leads: 'ilgili',
    opportunities: 'ilgili', products: 'ozet', projects: 'ilgili', partners: 'ilgili',
    agreements: 'ilgili', activities: 'ilgili', risks: 'ilgili', proposals: 'ilgili', kpi: 'ilgili',
    referrals: 'tam', 'status-tracker': 'tam', 'payout-summary': 'tam',
  },
  restricted_external: {
    dashboard: 'sinirli', 'shared-items': 'paylasilan',
    products: 'paylasilan', activities: 'paylasilan',
    agreements: 'paylasilan',
  },
}

export function hasPageAccess(role, page) {
  const pages = rolePageAccess[role]
  if (!pages) return false
  return pages.includes(page)
}

export function getAccessiblePages(role) {
  return rolePageAccess[role] || []
}

export function getAccessDepth(role, resource) {
  return accessDepth[role]?.[resource] || 'yok'
}
