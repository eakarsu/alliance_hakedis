import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'
import api from '../api/axios'
import AIResponseDisplay from '../components/AIResponseDisplay'

const features = [
  { value: 'contacts', label: 'Analyze Contacts' },
  { value: 'leads', label: 'Analyze Leads' },
  { value: 'opportunities', label: 'Analyze Opportunities' },
  { value: 'products', label: 'Analyze Products' },
  { value: 'projects', label: 'Analyze Projects' },
  { value: 'partners', label: 'Analyze Partners' },
  { value: 'risks', label: 'Analyze Risks' },
  { value: 'pipeline', label: 'Pipeline Analysis' },
  { value: 'general', label: 'General Question' },
]

const featureQuestions = {
  contacts: [
    // How to use
    'How do I add a new contact to the system?',
    'How do I link a contact to an organization?',
    'How do I set the lifecycle state of a contact (lead, active, churned)?',
    'How do I track relationship strength for a contact?',
    'How do I find contacts by region, country, or organization?',
    'How do I manage contact consent and GDPR compliance?',
    'How do I assign a contact to a specific team member or partner?',
    'How do I see all opportunities and activities linked to a contact?',
    'How do I filter and search contacts by organization type or role?',
    'How do I handle duplicate contacts in the system?',
    'How do I add notes, calls, or meeting activities to a contact?',
    'How do I set visibility rules for sensitive or restricted contacts?',
    'How do I change a contact owner or reassign to another user?',
    'How do I see the full activity history and timeline of a contact?',
    'How do I link a contact to multiple organizations?',
    'What contact fields are required vs optional when creating a new record?',
    'How does role-based access affect which contacts I can see?',
    'How do I use the contact detail view to manage all related records?',
    // Analysis
    'Who are our most engaged contacts this quarter?',
    'Which contacts have the strongest relationship scores?',
    'Show contacts that need follow-up or re-engagement',
    'Summarize contact distribution by organization and region',
    'Which contacts are linked to the most opportunities?',
    'Recommend contacts to prioritize for outreach this week',
    'Identify key decision-makers across our top accounts',
    'Show recently added contacts and their engagement status',
  ],
  leads: [
    // How to use
    'How do I create a new lead in the system?',
    'How do I convert a lead into an opportunity?',
    'How do I assign a lead to a partner or team member?',
    'How does the lead protection period work and what happens when it expires?',
    'How do I check for lead conflicts or duplicates before creating?',
    'How do I change the status of a lead (new, qualified, converted, lost)?',
    'How do I track lead source and attribution for reporting?',
    'How do I set up and use lead qualification scoring?',
    'How do I view only leads assigned to me vs all leads?',
    'How do I submit a referral lead for governance review?',
    'How do I see the full history and timeline of a lead?',
    'How does the lead conflict resolution process work in the Conflict Queue?',
    'How do I add notes, activities, and documents to a lead?',
    'How do I set the expected value and close date on a lead?',
    'What is the difference between a lead and an opportunity in Alliance CRM?',
    'How do I filter leads by status, source, region, or assigned partner?',
    'How do I bulk update or manage multiple leads at once?',
    'How does lead ownership work when multiple partners are involved?',
    // Analysis
    'What is the current lead conversion rate by source?',
    'Which leads are at risk of expiring their protection period?',
    'Are there any lead conflicts or duplicates to resolve?',
    'Rank leads by qualification score and recommend next steps',
    'Show leads that have been idle for more than 2 weeks',
    'Identify hot leads that should be fast-tracked to opportunities',
    'What percentage of leads convert to opportunities by source?',
    'Which regions or industries produce the most qualified leads?',
  ],
  opportunities: [
    // How to use
    'How do I create a new opportunity from a lead or from scratch?',
    'How do I move an opportunity through the 13 pipeline stages?',
    'How do I assign revenue shares and splits to an opportunity?',
    'How do I add products and services to an opportunity?',
    'How do I set up deal paths for an opportunity?',
    'How do I link partners and their roles to an opportunity?',
    'How do I create and submit a proposal for an opportunity?',
    'How do I track and manage risks on an opportunity?',
    'How do I see all activities, notes, and documents on an opportunity?',
    'How does the commercial negotiation stage work?',
    'How do I close-win or close-lose an opportunity and what happens next?',
    'How do I set estimated value, close date, and probability?',
    'How do I view and edit opportunity revenue sharing splits?',
    'How do I request a compliance review for a deal?',
    'How do I assign opportunity roles (technical lead, delivery manager)?',
    'How does the shadow ledger track revenue lifecycle for an opportunity?',
    'What are the different pipeline types (Direct Sales, Channel, Government)?',
    'How do I filter opportunities by stage, pipeline, owner, or value?',
    'How do I see the full audit trail and stage history of an opportunity?',
    'How do I link an opportunity to a project after closing?',
    // Analysis
    'What is the total pipeline value by stage?',
    'Which opportunities are most likely to close this month?',
    'Identify stalled opportunities that need attention',
    'What are the top 10 opportunities by deal value?',
    'Forecast revenue for the current quarter',
    'Compare win rates across Direct Sales, Channel, and Government pipelines',
    'Which opportunities have been in the same stage for too long?',
    'Show opportunity aging analysis across all pipelines',
  ],
  products: [
    // How to use
    'How do I add a new product to the catalog?',
    'How do I set product pricing, pricing model, and currency?',
    'How do I define product capabilities and target markets?',
    'How do I change the maturity level of a product (concept to GA)?',
    'How do I link a product to an opportunity or proposal?',
    'How do I track product performance and adoption metrics?',
    'How do I categorize products by type (SaaS, consulting, hardware, service)?',
    'How do I set up product bundles for cross-sell deals?',
    'How do I update product descriptions, positioning, and documentation?',
    'How do I see which opportunities and proposals include a product?',
    'How do I manage product versions, variants, and editions?',
    'How do I mark a product as end-of-life or deprecated?',
    'How do I view the Integration Map to see product connections?',
    'How do I add a product to the Demo Queue for partner demos?',
    'How do I define which partners can sell or deliver a product?',
    'What fields are required when adding a new product?',
    'How do I filter products by type, maturity, market, or owner?',
    'How does product visibility work for different partner roles?',
    // Analysis
    'Which products have the highest revenue contribution?',
    'Show product maturity levels and readiness assessment',
    'Which products are most frequently included in proposals?',
    'Compare product performance across different regions',
    'Recommend product bundles for upcoming enterprise deals',
    'What products are underperforming relative to their potential?',
    'Which consulting services generate the highest margins?',
    'List products approaching end-of-life or needing refresh',
  ],
  projects: [
    // How to use
    'How do I create a new project from a won opportunity?',
    'How do I set project milestones, deadlines, and deliverables?',
    'How do I assign team members and roles to a project?',
    'How do I track project progress, health status, and completion?',
    'How do I manage project risks, blockers, and dependencies?',
    'How do I update project status (active, on-hold, completed, cancelled)?',
    'How do I link a project to its source opportunity and account?',
    'How do I set up project handoff from sales to delivery team?',
    'How do I view all projects assigned to me or my team?',
    'How do I add activities, notes, and documents to a project?',
    'How do I manage project budgets and resource allocation?',
    'How do I escalate a project issue to governance?',
    'How do I use the Resource View to see team workload?',
    'How do I track milestone blockers and resolution status?',
    'How do I set up project roles (delivery manager, tech lead)?',
    'How does the PMO dashboard show project health across all projects?',
    'How do I filter projects by status, owner, account, or delivery date?',
    'How do I manage project agreements and SOWs?',
    // Analysis
    'Which projects are behind schedule or at risk?',
    'Show project milestone completion rates across all projects',
    'What is the resource utilization across active projects?',
    'Identify projects that need delivery manager attention',
    'Which projects have upcoming milestones this month?',
    'What lessons learned should be applied to current projects?',
    'Compare planned vs actual timelines for recent projects',
    'Which technical leads are overloaded with project assignments?',
  ],
  partners: [
    // How to use
    'How do I add a new partner to the Alliance ecosystem?',
    'How do I set up a partner entity with legal and business details?',
    'How do I assign a partner tier (strategic, technology, channel, referral)?',
    'How do I track partner revenue, commissions, and payouts?',
    'How do I link a partner to opportunities and deals?',
    'How do I manage the partner onboarding and activation process?',
    'How do I view a partner performance dashboard and scorecard?',
    'How do I set up revenue sharing splits and templates for a partner?',
    'How do I manage partner capabilities, specializations, and certifications?',
    'How do I handle partner conflicts on overlapping deals?',
    'How do I approve or reject a partner referral lead?',
    'How do I see all deals, projects, and activities for a partner?',
    'How do I create a partner agreement or contract?',
    'How do I manage partner visibility and data access levels?',
    'How do I set up co-selling arrangements between partners?',
    'How do I track partner engagement and relationship health?',
    'What is the difference between enterprise, product, and channel partners?',
    'How do I offboard or deactivate a partner?',
    // Analysis
    'Who are our top-performing partners by revenue?',
    'Which partners have the most active deals in pipeline?',
    'Identify partners that need engagement or reactivation',
    'What is the revenue sharing breakdown by partner?',
    'Compare channel vs referral partner effectiveness',
    'Recommend partners for co-selling on current opportunities',
    'Show partner onboarding pipeline and activation status',
    'What is the average revenue per partner by tier?',
  ],
  risks: [
    // How to use
    'How do I log a new risk in the system?',
    'How do I set risk severity, probability, and impact level?',
    'How do I assign a risk owner and responsible team?',
    'How do I create and track a mitigation plan for a risk?',
    'How do I link a risk to a project, opportunity, or partner?',
    'How do I escalate a risk to governance for review?',
    'How do I update risk status (open, mitigating, resolved, accepted)?',
    'How do I view all risks assigned to me or my projects?',
    'How do I categorize risks (technical, commercial, compliance, delivery)?',
    'How do I set up risk monitoring and review schedules?',
    'How do I close a risk after successful mitigation?',
    'How does the risk review and approval process work?',
    'How do I use the Compliance Reviews page for deal compliance?',
    'How do I add risk notes, evidence, and documentation?',
    'How do I filter risks by severity, category, owner, or entity?',
    'How does the governance dashboard show risk overview?',
    'What is the risk scoring methodology used in Alliance CRM?',
    'How do I generate a risk report for stakeholders?',
    // Analysis
    'What are the highest severity risks across all deals and projects?',
    'Show risks that need immediate mitigation action',
    'Summarize risk distribution by category and status',
    'Which projects or opportunities have the most open risks?',
    'List risks with overdue mitigation deadlines',
    'Provide a risk heat map summary across all entities',
    'Which risk owners need to update their action plans?',
    'Compare risk trends this quarter vs previous quarter',
  ],
  pipeline: [
    // How to use
    'How do I view the full sales pipeline and filter by criteria?',
    'How do I filter pipeline by stage, owner, partner, or value range?',
    'How do I move a deal through the pipeline stages step by step?',
    'What are the 13 pipeline stages and what does each stage mean?',
    'What are the different pipeline types (Direct Sales, Channel, Government)?',
    'How do I track stage conversion rates and deal velocity?',
    'How do I see my personal pipeline as a partner or sales owner?',
    'How do I forecast revenue from current pipeline data?',
    'How do I identify deals stuck in a stage for too long?',
    'How does the deal protection period work across pipelines?',
    'How do I compare pipeline performance across teams and partners?',
    'How do I use the Deal Paths feature to map deal flow?',
    'How do I view pipeline by account, region, or product?',
    'How does the pipeline connect to the Economics and Shadow Ledger?',
    'How do I set up pipeline targets and track against goals?',
    'How do I view the Governance Dashboard for pipeline oversight?',
    'How do I use the KPI Contributions page to track my pipeline impact?',
    'What happens when a deal moves to Closed Won — what gets triggered?',
    // Analysis
    'What is the overall pipeline health and velocity?',
    'Show conversion rates between each pipeline stage',
    'Forecast expected revenue for next quarter based on pipeline',
    'Identify bottleneck stages where deals get stuck',
    'Analyze pipeline leakage — where are we losing deals?',
    'Compare Direct Sales vs Channel vs Government pipeline performance',
    'What is the pipeline coverage ratio for our quarterly targets?',
    'Which stages have the longest average dwell time?',
  ],
  general: [
    // System Navigation & Getting Started
    'How do I navigate the Alliance CRM system and find what I need?',
    'What are the 8 user roles and what can each role access?',
    'How do I log in and what credentials do I use?',
    'How do I understand the sidebar menu and what each section contains?',
    'How does role-based access control work — what can I see vs others?',
    // Workflow Engine
    'How do I use the Workflow Hub to track all business processes?',
    'How do I start a new workflow instance for a deal or project?',
    'How do I configure and customize workflow templates (WF-1 to WF-10)?',
    'How do I complete, skip, or assign workflow steps?',
    'How do I see my pending workflow actions and overdue steps?',
    'What are the 10 predefined workflows and when should I use each?',
    // Dashboard & KPIs
    'How do I use the dashboard to see my personal KPIs and metrics?',
    'How do I track my KPI contributions and performance scores?',
    'How do I use the Activity page to log calls, meetings, and tasks?',
    // Governance & Compliance
    'How do I use the Governance Dashboard for ecosystem oversight?',
    'How do I submit and resolve items in the Conflict Queue?',
    'How do I use Visibility Approvals to control data access?',
    'How do I initiate and track Compliance Reviews for deals?',
    // Economics & Revenue
    'How do I use the Economics page and Shadow Ledger?',
    'How do I set up Split Templates for revenue sharing formulas?',
    'How do I view my Payout Summary and track earned commissions?',
    'How do I use My Referrals to submit and track referral leads?',
    'How do I use the Status Tracker to follow referral progress?',
    // Ecosystem Features
    'How do I use Deal Paths to map opportunity routing?',
    'How do I use the Integration Map to see product connections?',
    'How do I use the Demo Queue to schedule and manage demos?',
    // Shared & Collaboration
    'How do I use Shared Items to share records with external advisors?',
    'How do I create and manage Meeting Notes for partner meetings?',
    'How do I submit and respond to Advisory Requests?',
    // Documents & Attachments
    'How do I upload and manage document attachments on any record?',
    'How do I manage Agreements, SOWs, and contracts?',
    'How do I create and manage Proposals for opportunities?',
    // Notifications
    'How do I manage my notifications and alert preferences?',
    // Analysis
    'Give me an executive summary of overall CRM performance',
    'What are the top priorities across the Alliance ecosystem this week?',
    'Show key metrics and KPIs across all modules',
    'Which areas of the system need the most attention right now?',
    'What strategic recommendations do you have for next quarter?',
    'How is overall revenue tracking against targets across all partners?',
  ],
}

export default function AIAssistant() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [feature, setFeature] = useState('general')
  const [loading, setLoading] = useState(false)
  const [showQuestions, setShowQuestions] = useState(true)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (messageText) => {
    if (!messageText.trim() || loading) return

    const userMsg = { role: 'user', content: messageText, feature, timestamp: new Date().toISOString() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await api.post('/ai/analyze', {
        feature,
        query: messageText,
        prompt: messageText,
      })

      const aiContent = res.data.analysis || res.data.response || res.data.result || res.data.message || (typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2))

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: aiContent,
        timestamp: new Date().toISOString()
      }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `I encountered an error processing your request: ${err.response?.data?.error || err.message || 'Unknown error'}. Please try again.`,
        timestamp: new Date().toISOString(),
        isError: true
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleSend = (e) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleQuestionClick = (question) => {
    sendMessage(question)
  }

  return (
    <div className="flex h-[calc(100vh-120px)] flex-col animate-fade-in">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Assistant</h1>
          <p className="text-sm text-gray-500">Intelligent insights for your CRM data</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-600">Analyze:</label>
          <select
            value={feature}
            onChange={(e) => setFeature(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {features.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-sm flex flex-col">
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center p-4">
            <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 p-4 shadow-lg">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-gray-900">Alliance AI Assistant</h3>
            <p className="mt-2 max-w-md text-sm text-gray-500">
              Ask me to analyze your CRM data. Select a category above and pick a question below, or type your own.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="flex-shrink-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                  </div>
                )}
                <div className={`max-w-[80%] ${msg.role === 'user' ? '' : ''}`}>
                  {msg.role === 'user' ? (
                    <div className="rounded-2xl rounded-tr-sm bg-blue-600 px-4 py-3 text-sm text-white">
                      {msg.feature !== 'general' && (
                        <span className="mb-1 block text-xs text-blue-200">[{features.find(f => f.value === msg.feature)?.label}]</span>
                      )}
                      {msg.content}
                    </div>
                  ) : (
                    <div className={msg.isError ? 'rounded-xl border border-red-200 bg-red-50 p-4' : ''}>
                      {msg.isError ? (
                        <p className="text-sm text-red-600">{msg.content}</p>
                      ) : (
                        <AIResponseDisplay response={msg.content} />
                      )}
                    </div>
                  )}
                  <p className="mt-1 text-xs text-gray-400">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </p>
                </div>
                {msg.role === 'user' && (
                  <div className="flex-shrink-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200">
                      <User className="h-4 w-4 text-gray-600" />
                    </div>
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="rounded-2xl rounded-tl-sm bg-gray-100 px-4 py-3">
                  <div className="flex gap-1">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '0ms' }} />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '150ms' }} />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Suggested questions - collapsible panel */}
        <div className="border-t border-gray-100 bg-gray-50/50">
          <button
            onClick={() => setShowQuestions(!showQuestions)}
            className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
          >
            <span className="flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              Suggested questions for {features.find(f => f.value === feature)?.label} ({(featureQuestions[feature] || featureQuestions.general).length})
            </span>
            {showQuestions ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          </button>
          {showQuestions && (
            <div className="max-h-48 overflow-y-auto px-3 pb-3">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-1.5">
                {(featureQuestions[feature] || featureQuestions.general).map((question) => (
                  <button
                    key={question}
                    onClick={() => handleQuestionClick(question)}
                    disabled={loading}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-xs text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSend} className="mt-4 flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the AI assistant about your CRM data..."
          className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-700 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <Send className="h-4 w-4" />
          Send
        </button>
      </form>
    </div>
  )
}
