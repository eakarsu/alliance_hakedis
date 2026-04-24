import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import {
  ArrowLeft, Settings, ChevronDown, ChevronUp, Plus, Trash2,
  Save, Clock, User, GripVertical, CheckCircle, ToggleLeft, ToggleRight
} from 'lucide-react'

const ROLES = [
  { value: '', label: 'Any role' },
  { value: 'founding_orchestrator', label: 'Founding Orchestrator' },
  { value: 'pmo_coordinator', label: 'PMO Coordinator' },
  { value: 'solution_architect', label: 'Solution Architect' },
  { value: 'enterprise_partner', label: 'Enterprise Partner' },
  { value: 'product_experience_lead', label: 'Product Experience Lead' },
  { value: 'product_partner', label: 'Product Partner' },
  { value: 'us_market_bridge', label: 'US Market Bridge' },
  { value: 'source_owner', label: 'Source Owner (dynamic)' },
  { value: 'deal_owner', label: 'Deal Owner (dynamic)' },
]

export default function WorkflowConfig() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [templateSteps, setTemplateSteps] = useState({})
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [newStep, setNewStep] = useState({ name: '', description: '', required_role: '', sla_hours: '', is_optional: false })
  const [addingStepTo, setAddingStepTo] = useState(null)

  const canEdit = user?.role === 'founding_orchestrator' || user?.role === 'pmo_coordinator'

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      const res = await api.get('/workflows/templates')
      setTemplates(res.data.data || [])
    } catch (err) {
      console.error('Failed to load templates:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchTemplateDetail = async (id) => {
    try {
      const res = await api.get(`/workflows/templates/${id}`)
      setTemplateSteps(prev => ({ ...prev, [id]: res.data.steps || [] }))
    } catch (err) {
      console.error('Failed to load template detail:', err)
    }
  }

  const toggleExpand = (id) => {
    if (expanded === id) {
      setExpanded(null)
    } else {
      setExpanded(id)
      if (!templateSteps[id]) fetchTemplateDetail(id)
    }
  }

  const handleToggleActive = async (tmpl) => {
    try {
      await api.put(`/workflows/templates/${tmpl.id}`, { is_active: !tmpl.is_active })
      fetchTemplates()
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update')
    }
  }

  const handleToggleAutoTrigger = async (tmpl) => {
    try {
      await api.put(`/workflows/templates/${tmpl.id}`, { auto_trigger: !tmpl.auto_trigger })
      fetchTemplates()
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update')
    }
  }

  const handleUpdateTemplate = async (id, updates) => {
    try {
      await api.put(`/workflows/templates/${id}`, updates)
      setEditingTemplate(null)
      fetchTemplates()
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update')
    }
  }

  const handleAddStep = async (templateId) => {
    if (!newStep.name) return
    try {
      await api.post(`/workflows/templates/${templateId}/steps`, {
        ...newStep,
        sla_hours: newStep.sla_hours ? parseInt(newStep.sla_hours) : null,
      })
      setNewStep({ name: '', description: '', required_role: '', sla_hours: '', is_optional: false })
      setAddingStepTo(null)
      fetchTemplateDetail(templateId)
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add step')
    }
  }

  const handleUpdateStep = async (templateId, stepId, updates) => {
    try {
      await api.put(`/workflows/templates/${templateId}/steps/${stepId}`, updates)
      fetchTemplateDetail(templateId)
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update step')
    }
  }

  const handleDeleteStep = async (templateId, stepId) => {
    if (!confirm('Remove this step from the template?')) return
    try {
      await api.delete(`/workflows/templates/${templateId}/steps/${stepId}`)
      fetchTemplateDetail(templateId)
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete step')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <button onClick={() => navigate('/workflows')}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Back to Workflows
      </button>

      <div>
        <h1 className="text-2xl font-bold text-slate-800">Workflow Configuration</h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure workflow templates — enable/disable, edit steps, set SLAs, and assign required roles.
        </p>
        {!canEdit && (
          <p className="text-xs text-amber-600 mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            View-only mode. Only Founding Orchestrator and PMO Coordinator can edit templates.
          </p>
        )}
      </div>

      {/* Template List */}
      <div className="space-y-3">
        {templates.map(tmpl => {
          const isExpanded = expanded === tmpl.id
          const steps = templateSteps[tmpl.id] || []

          return (
            <div key={tmpl.id} className={`rounded-xl border bg-white shadow-sm transition-all ${
              tmpl.is_active ? 'border-slate-200' : 'border-slate-100 opacity-60'
            }`}>
              {/* Template Header */}
              <div className="flex items-center gap-4 px-5 py-4 cursor-pointer" onClick={() => toggleExpand(tmpl.id)}>
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${tmpl.color} text-white flex-shrink-0`}>
                  <Settings className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400">{tmpl.code}</span>
                    <h3 className="text-sm font-semibold text-slate-700">{tmpl.name}</h3>
                    {!tmpl.is_active && (
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">DISABLED</span>
                    )}
                    {tmpl.auto_trigger && (
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">AUTO</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 truncate">{tmpl.description}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-slate-400">{tmpl.step_count} steps</span>
                  <span className="text-xs text-slate-400">{tmpl.active_instances} active</span>
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-300" /> : <ChevronDown className="h-4 w-4 text-slate-300" />}
                </div>
              </div>

              {/* Expanded: Template Settings + Steps */}
              {isExpanded && (
                <div className="border-t border-slate-100 px-5 py-4 space-y-4">
                  {/* Settings row */}
                  {canEdit && (
                    <div className="flex flex-wrap gap-4">
                      <button onClick={() => handleToggleActive(tmpl)}
                        className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          tmpl.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-50 text-slate-500 border border-slate-200'
                        }`}>
                        {tmpl.is_active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                        {tmpl.is_active ? 'Active' : 'Disabled'}
                      </button>
                      <button onClick={() => handleToggleAutoTrigger(tmpl)}
                        className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          tmpl.auto_trigger ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-50 text-slate-500 border border-slate-200'
                        }`}>
                        {tmpl.auto_trigger ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                        Auto-trigger {tmpl.auto_trigger ? 'ON' : 'OFF'}
                      </button>
                      {tmpl.trigger_event && (
                        <span className="text-xs text-slate-400 self-center">
                          Trigger: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">{tmpl.trigger_event}</code>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Steps */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Steps</h4>
                      {canEdit && (
                        <button onClick={() => setAddingStepTo(addingStepTo === tmpl.id ? null : tmpl.id)}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
                          <Plus className="h-3 w-3" /> Add Step
                        </button>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      {steps.map((step, idx) => (
                        <div key={step.id} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-500 flex-shrink-0">
                            {step.step_order}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700">{step.name}</p>
                            <div className="flex flex-wrap gap-2 mt-0.5">
                              {step.description && (
                                <span className="text-[10px] text-slate-400 truncate max-w-xs">{step.description}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {step.required_role && (
                              <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                <User className="h-2.5 w-2.5" /> {step.required_role}
                              </span>
                            )}
                            {step.sla_hours && (
                              <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                <Clock className="h-2.5 w-2.5" /> {step.sla_hours}h
                              </span>
                            )}
                            {step.is_optional && (
                              <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full">optional</span>
                            )}
                            {canEdit && (
                              <button onClick={() => handleDeleteStep(tmpl.id, step.id)}
                                className="p-1 text-slate-300 hover:text-red-500 transition-colors">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Add step form */}
                    {addingStepTo === tmpl.id && (
                      <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3 space-y-2">
                        <p className="text-xs font-semibold text-blue-700">New Step</p>
                        <div className="grid grid-cols-2 gap-2">
                          <input type="text" placeholder="Step name *" value={newStep.name}
                            onChange={e => setNewStep({ ...newStep, name: e.target.value })}
                            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          <input type="text" placeholder="Description" value={newStep.description}
                            onChange={e => setNewStep({ ...newStep, description: e.target.value })}
                            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          <select value={newStep.required_role} onChange={e => setNewStep({ ...newStep, required_role: e.target.value })}
                            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
                            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                          <div className="flex gap-2">
                            <input type="number" placeholder="SLA (hours)" value={newStep.sla_hours}
                              onChange={e => setNewStep({ ...newStep, sla_hours: e.target.value })}
                              className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            <label className="flex items-center gap-1 text-xs text-slate-500">
                              <input type="checkbox" checked={newStep.is_optional}
                                onChange={e => setNewStep({ ...newStep, is_optional: e.target.checked })} />
                              Optional
                            </label>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleAddStep(tmpl.id)}
                            className="flex items-center gap-1 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600">
                            <Plus className="h-3 w-3" /> Add
                          </button>
                          <button onClick={() => { setAddingStepTo(null); setNewStep({ name: '', description: '', required_role: '', sla_hours: '', is_optional: false }) }}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50">
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
