import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/axios'
import {
  ArrowLeft, Play, Target, TrendingUp, Shield, Eye, DollarSign,
  BookOpen, ShieldCheck, CheckSquare, Receipt, Zap
} from 'lucide-react'

const iconMap = {
  Target, Zap, TrendingUp, Shield, Eye, DollarSign,
  BookOpen, ShieldCheck, CheckSquare, Receipt,
}

export default function WorkflowNew() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preselectedTemplate = searchParams.get('template')

  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [templateDetail, setTemplateDetail] = useState(null)
  const [form, setForm] = useState({ entity_id: '', entity_label: '', notes: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/workflows/templates')
      .then(res => {
        const active = (res.data.data || []).filter(t => t.is_active)
        setTemplates(active)
        if (preselectedTemplate) {
          const found = active.find(t => t.id === parseInt(preselectedTemplate))
          if (found) selectTemplate(found)
        }
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  const selectTemplate = async (tmpl) => {
    setSelectedTemplate(tmpl)
    try {
      const res = await api.get(`/workflows/templates/${tmpl.id}`)
      setTemplateDetail(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!selectedTemplate) return
    setSaving(true)
    try {
      const res = await api.post('/workflows/instances', {
        template_id: selectedTemplate.id,
        entity_type: selectedTemplate.entity_type,
        entity_id: form.entity_id ? parseInt(form.entity_id) : null,
        entity_label: form.entity_label || null,
        notes: form.notes || null,
      })
      navigate(`/workflow-detail/${res.data.id}`)
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create workflow')
    } finally {
      setSaving(false)
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
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <button onClick={() => navigate('/workflows')}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Back to Workflows
      </button>

      <div>
        <h1 className="text-2xl font-bold text-slate-800">Start New Workflow</h1>
        <p className="text-sm text-slate-500 mt-1">Choose a workflow template and provide entity details to begin.</p>
      </div>

      {/* Step 1: Select Template */}
      <div>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          1. Select Workflow Type
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {templates.map(tmpl => {
            const Icon = iconMap[tmpl.icon] || CheckSquare
            const isSelected = selectedTemplate?.id === tmpl.id
            return (
              <button key={tmpl.id}
                onClick={() => selectTemplate(tmpl)}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                  isSelected
                    ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-200'
                    : 'border-slate-200 bg-white hover:border-blue-200 hover:shadow-sm'
                }`}>
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${tmpl.color} text-white flex-shrink-0`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-slate-400">{tmpl.code}</span>
                  <p className="text-xs font-semibold text-slate-700 truncate">{tmpl.name}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Step 2: Template Preview */}
      {templateDetail && (
        <div>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            2. Review Steps
          </h2>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-600 mb-3">{templateDetail.description}</p>
            <div className="space-y-1.5">
              {(templateDetail.steps || []).map((step, idx) => (
                <div key={step.id} className="flex items-center gap-3 text-xs">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[9px] font-bold text-slate-500 flex-shrink-0">
                    {step.step_order}
                  </span>
                  <span className="font-medium text-slate-700">{step.name}</span>
                  {step.required_role && (
                    <span className="text-[10px] bg-purple-50 text-purple-500 px-1.5 py-0.5 rounded-full">{step.required_role}</span>
                  )}
                  {step.sla_hours && (
                    <span className="text-[10px] bg-amber-50 text-amber-500 px-1.5 py-0.5 rounded-full">{step.sla_hours}h SLA</span>
                  )}
                  {step.is_optional && (
                    <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full">optional</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Entity Details */}
      {selectedTemplate && (
        <form onSubmit={handleCreate}>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            3. Entity Details
          </h2>
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  {selectedTemplate.entity_type ? `${selectedTemplate.entity_type} ID` : 'Entity ID'}
                </label>
                <input type="number" value={form.entity_id}
                  onChange={e => setForm({ ...form, entity_id: e.target.value })}
                  placeholder="e.g., 42"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Label</label>
                <input type="text" value={form.entity_label}
                  onChange={e => setForm({ ...form, entity_label: e.target.value })}
                  placeholder="e.g., Acme Corp Deal"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
              <textarea value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Additional context for this workflow..."
                rows={2}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50 transition-colors">
              <Play className="h-4 w-4" /> {saving ? 'Starting...' : 'Start Workflow'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
