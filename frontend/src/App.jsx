import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { hasPageAccess } from './config/rolePermissions'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Contacts from './pages/Contacts'
import Organizations from './pages/Organizations'
import Leads from './pages/Leads'
import Opportunities from './pages/Opportunities'
import Products from './pages/Products'
import Projects from './pages/Projects'
import Partners from './pages/Partners'
import Agreements from './pages/Agreements'
import Activities from './pages/Activities'
import Risks from './pages/Risks'
import Proposals from './pages/Proposals'
import KPI from './pages/KPI'
import AIAssistant from './pages/AIAssistant'
import AIInsights from './pages/AIInsights'
import ConflictQueue from './pages/ConflictQueue'
import VisibilityApprovals from './pages/VisibilityApprovals'
import MyReferrals from './pages/MyReferrals'
import StatusTracker from './pages/StatusTracker'
import PayoutSummary from './pages/PayoutSummary'
import SharedItems from './pages/SharedItems'
import ComplianceReviews from './pages/ComplianceReviews'
import DealPaths from './pages/DealPaths'
import DemoQueue from './pages/DemoQueue'
import IntegrationMap from './pages/IntegrationMap'
import AdvisoryRequests from './pages/AdvisoryRequests'
import MeetingNotes from './pages/MeetingNotes'
import ResourceView from './pages/ResourceView'
import GovernanceDashboard from './pages/GovernanceDashboard'
import Economics from './pages/Economics'
import SplitTemplates from './pages/SplitTemplates'
import WorkflowHub from './pages/WorkflowHub'
import WorkflowDetail from './pages/WorkflowDetail'
import WorkflowConfig from './pages/WorkflowConfig'
import WorkflowNew from './pages/WorkflowNew'
import ApprovalWorkflows from './pages/ApprovalWorkflows'

// // === Batch 09 Gaps & Frontend Mounts ===
const SplitStructureOptimizationPartnerSatisfactionMarginCfs = React.lazy(() => import('./pages/Batch09/SplitStructureOptimizationPartnerSatisfactionMarginCfs'));
const ApprovalWorkflowPredictionLikelyBottlenecksCfs = React.lazy(() => import('./pages/Batch09/ApprovalWorkflowPredictionLikelyBottlenecksCfs'));
const EconomicScenarioModelingWhatIfOnDealTermsCfs = React.lazy(() => import('./pages/Batch09/EconomicScenarioModelingWhatIfOnDealTermsCfs'));
const PartnerPerformanceDashboardsWithAnomalyAlertsCfs = React.lazy(() => import('./pages/Batch09/PartnerPerformanceDashboardsWithAnomalyAlertsCfs'));
const AutomatedPayoutReconciliationWithDisputeDetectionCfs = React.lazy(() => import('./pages/Batch09/AutomatedPayoutReconciliationWithDisputeDetectionCfs'));
const ErpIntegrationForRevenueRecognitionCfs = React.lazy(() => import('./pages/Batch09/ErpIntegrationForRevenueRecognitionCfs'));
const GovernanceExceptionManagementWithAiRoutingCfs = React.lazy(() => import('./pages/Batch09/GovernanceExceptionManagementWithAiRoutingCfs'));
const StrategicPartnerRecommendationBasedOnCapabilityGapsCfs = React.lazy(() => import('./pages/Batch09/StrategicPartnerRecommendationBasedOnCapabilityGapsCfs'));
const AiWorkflowBottleneckDetectionGapAi = React.lazy(() => import('./pages/Batch09/AiWorkflowBottleneckDetectionGapAi'));
const EconomicsSplitOptimizationAiGapAi = React.lazy(() => import('./pages/Batch09/EconomicsSplitOptimizationAiGapAi'));
const DealStructureRecommendationsGapAi = React.lazy(() => import('./pages/Batch09/DealStructureRecommendationsGapAi'));
const PayoutPredictionGapAi = React.lazy(() => import('./pages/Batch09/PayoutPredictionGapAi'));
const GovernanceExceptionTriageGapAi = React.lazy(() => import('./pages/Batch09/GovernanceExceptionTriageGapAi'));
const MultiLevelGovernanceApprovalsBoardCfoSequencedGapNon = React.lazy(() => import('./pages/Batch09/MultiLevelGovernanceApprovalsBoardCfoSequencedGapNon'));
const FullESignatureIntegrationGapNon = React.lazy(() => import('./pages/Batch09/FullESignatureIntegrationGapNon'));
const MobilePartnerPortalUiGapNon = React.lazy(() => import('./pages/Batch09/MobilePartnerPortalUiGapNon'));
const ExternalTaxReporting10991042GenerationGapNon = React.lazy(() => import('./pages/Batch09/ExternalTaxReporting10991042GenerationGapNon'));
const SoxGradeSodControlsReportingGapNon = React.lazy(() => import('./pages/Batch09/SoxGradeSodControlsReportingGapNon'));

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    )
  }
  return user ? children : <Navigate to="/login" replace />
}

function RoleRoute({ page, children }) {
  const { user } = useAuth()
  if (!user || !hasPageAccess(user.role, page)) {
    return <Navigate to="/dashboard" replace />
  }
  return children
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        {/* Workflows */}
        <Route path="/workflows" element={<RoleRoute page="workflows"><WorkflowHub /></RoleRoute>} />
        <Route path="/workflow-detail/:id" element={<RoleRoute page="workflows"><WorkflowDetail /></RoleRoute>} />
        <Route path="/workflow-config" element={<RoleRoute page="workflows"><WorkflowConfig /></RoleRoute>} />
        <Route path="/workflow-new" element={<RoleRoute page="workflows"><WorkflowNew /></RoleRoute>} />
        <Route path="/approval-workflows" element={<RoleRoute page="approval-workflows"><ApprovalWorkflows /></RoleRoute>} />
        {/* CRM */}
        <Route path="/contacts" element={<RoleRoute page="contacts"><Contacts /></RoleRoute>} />
        <Route path="/organizations" element={<RoleRoute page="organizations"><Organizations /></RoleRoute>} />
        <Route path="/leads" element={<RoleRoute page="leads"><Leads /></RoleRoute>} />
        <Route path="/opportunities" element={<RoleRoute page="opportunities"><Opportunities /></RoleRoute>} />
        <Route path="/products" element={<RoleRoute page="products"><Products /></RoleRoute>} />
        {/* Delivery */}
        <Route path="/projects" element={<RoleRoute page="projects"><Projects /></RoleRoute>} />
        <Route path="/partners" element={<RoleRoute page="partners"><Partners /></RoleRoute>} />
        <Route path="/agreements" element={<RoleRoute page="agreements"><Agreements /></RoleRoute>} />
        <Route path="/proposals" element={<RoleRoute page="proposals"><Proposals /></RoleRoute>} />
        {/* Governance */}
        <Route path="/governance" element={<RoleRoute page="governance"><GovernanceDashboard /></RoleRoute>} />
        <Route path="/conflict-queue" element={<RoleRoute page="conflict-queue"><ConflictQueue /></RoleRoute>} />
        <Route path="/visibility-approvals" element={<RoleRoute page="visibility-approvals"><VisibilityApprovals /></RoleRoute>} />
        <Route path="/risks" element={<RoleRoute page="risks"><Risks /></RoleRoute>} />
        {/* Referrals & Revenue */}
        <Route path="/referrals" element={<RoleRoute page="referrals"><MyReferrals /></RoleRoute>} />
        <Route path="/status-tracker" element={<RoleRoute page="status-tracker"><StatusTracker /></RoleRoute>} />
        <Route path="/payout-summary" element={<RoleRoute page="payout-summary"><PayoutSummary /></RoleRoute>} />
        {/* Shared */}
        <Route path="/shared-items" element={<RoleRoute page="shared-items"><SharedItems /></RoleRoute>} />
        {/* New screens */}
        <Route path="/compliance-reviews" element={<RoleRoute page="compliance-reviews"><ComplianceReviews /></RoleRoute>} />
        <Route path="/deal-paths" element={<RoleRoute page="deal-paths"><DealPaths /></RoleRoute>} />
        <Route path="/demo-queue" element={<RoleRoute page="demo-queue"><DemoQueue /></RoleRoute>} />
        <Route path="/integration-map" element={<RoleRoute page="integration-map"><IntegrationMap /></RoleRoute>} />
        {/* Restricted / Advisor screens (Rol 6) */}
        <Route path="/advisory-requests" element={<RoleRoute page="advisory-requests"><AdvisoryRequests /></RoleRoute>} />
        <Route path="/meeting-notes" element={<RoleRoute page="meeting-notes"><MeetingNotes /></RoleRoute>} />
        {/* Economics (Section 10) */}
        <Route path="/economics" element={<RoleRoute page="economics"><Economics /></RoleRoute>} />
        <Route path="/split-templates" element={<RoleRoute page="split-templates"><SplitTemplates /></RoleRoute>} />
        {/* PMO Resource View (Rol 5) */}
        <Route path="/resource-view" element={<RoleRoute page="resource-view"><ResourceView /></RoleRoute>} />
        {/* Tools */}
        <Route path="/activities" element={<RoleRoute page="activities"><Activities /></RoleRoute>} />
        <Route path="/kpi" element={<RoleRoute page="kpi"><KPI /></RoleRoute>} />
        <Route path="/ai" element={<RoleRoute page="ai"><AIAssistant /></RoleRoute>} />
        <Route path="/ai-insights" element={<RoleRoute page="ai"><AIInsights /></RoleRoute>} />
      </Route>
      <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
    
      {/* // === Batch 09 Gaps & Frontend Mounts === */}
        <Route path="/batch09/cfs/split-structure-optimization-partner-satisfaction-margin" element={<React.Suspense fallback={<div>Loading...</div>}><SplitStructureOptimizationPartnerSatisfactionMarginCfs /></React.Suspense>} />
        <Route path="/batch09/cfs/approval-workflow-prediction-likely-bottlenecks" element={<React.Suspense fallback={<div>Loading...</div>}><ApprovalWorkflowPredictionLikelyBottlenecksCfs /></React.Suspense>} />
        <Route path="/batch09/cfs/economic-scenario-modeling-what-if-on-deal-terms" element={<React.Suspense fallback={<div>Loading...</div>}><EconomicScenarioModelingWhatIfOnDealTermsCfs /></React.Suspense>} />
        <Route path="/batch09/cfs/partner-performance-dashboards-with-anomaly-alerts" element={<React.Suspense fallback={<div>Loading...</div>}><PartnerPerformanceDashboardsWithAnomalyAlertsCfs /></React.Suspense>} />
        <Route path="/batch09/cfs/automated-payout-reconciliation-with-dispute-detection" element={<React.Suspense fallback={<div>Loading...</div>}><AutomatedPayoutReconciliationWithDisputeDetectionCfs /></React.Suspense>} />
        <Route path="/batch09/cfs/erp-integration-for-revenue-recognition" element={<React.Suspense fallback={<div>Loading...</div>}><ErpIntegrationForRevenueRecognitionCfs /></React.Suspense>} />
        <Route path="/batch09/cfs/governance-exception-management-with-ai-routing" element={<React.Suspense fallback={<div>Loading...</div>}><GovernanceExceptionManagementWithAiRoutingCfs /></React.Suspense>} />
        <Route path="/batch09/cfs/strategic-partner-recommendation-based-on-capability-gaps" element={<React.Suspense fallback={<div>Loading...</div>}><StrategicPartnerRecommendationBasedOnCapabilityGapsCfs /></React.Suspense>} />
        <Route path="/batch09/gap-ai/ai-workflow-bottleneck-detection" element={<React.Suspense fallback={<div>Loading...</div>}><AiWorkflowBottleneckDetectionGapAi /></React.Suspense>} />
        <Route path="/batch09/gap-ai/economics-split-optimization-ai" element={<React.Suspense fallback={<div>Loading...</div>}><EconomicsSplitOptimizationAiGapAi /></React.Suspense>} />
        <Route path="/batch09/gap-ai/deal-structure-recommendations" element={<React.Suspense fallback={<div>Loading...</div>}><DealStructureRecommendationsGapAi /></React.Suspense>} />
        <Route path="/batch09/gap-ai/payout-prediction" element={<React.Suspense fallback={<div>Loading...</div>}><PayoutPredictionGapAi /></React.Suspense>} />
        <Route path="/batch09/gap-ai/governance-exception-triage" element={<React.Suspense fallback={<div>Loading...</div>}><GovernanceExceptionTriageGapAi /></React.Suspense>} />
        <Route path="/batch09/gap-nonai/multi-level-governance-approvals-board-cfo-sequenced" element={<React.Suspense fallback={<div>Loading...</div>}><MultiLevelGovernanceApprovalsBoardCfoSequencedGapNon /></React.Suspense>} />
        <Route path="/batch09/gap-nonai/full-e-signature-integration" element={<React.Suspense fallback={<div>Loading...</div>}><FullESignatureIntegrationGapNon /></React.Suspense>} />
        <Route path="/batch09/gap-nonai/mobile-partner-portal-ui" element={<React.Suspense fallback={<div>Loading...</div>}><MobilePartnerPortalUiGapNon /></React.Suspense>} />
        <Route path="/batch09/gap-nonai/external-tax-reporting-10991042-generation" element={<React.Suspense fallback={<div>Loading...</div>}><ExternalTaxReporting10991042GenerationGapNon /></React.Suspense>} />
        <Route path="/batch09/gap-nonai/sox-grade-sod-controls-reporting" element={<React.Suspense fallback={<div>Loading...</div>}><SoxGradeSodControlsReportingGapNon /></React.Suspense>} />

      </Routes>
  )
}
