import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import {
  ArrowLeft, CheckCircle, Clock, Play, SkipForward, XCircle,
  User, AlertTriangle, ChevronDown, ChevronUp, Send, Ban
} from 'lucide-react'

export default function WorkflowDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [instance, setInstance] = useState(null)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedStep, setExpandedStep] = useState(null)
  const [actionNotes, setActionNotes] = useState('')
  const [assignUserId, setAssignUserId] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  const [showCancel, setShowCancel] = useState(false)

  const fetchInstance = async () => {
    try {
      const res = await api.get(`/workflows/instances/${id}`)
      setInstance(res.data)
      // Auto-expand current active step
      const activeStep = res.data.steps?.find(s => s.status === 'in_progress')
      if (activeStep) setExpandedStep(activeStep.id)
    } catch (err) {
      console.error('Failed to load workflow:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInstance()
    api.get('/users/list').then(res => setUsers(res.data || [])).catch(() => {})
  }, [id])

  const handleComplete = async (stepId) => {
    try {
      const res = await api.put(`/workflows/instances/${id}/steps/${stepId}/complete`, { notes: actionNotes })
      setInstance(res.data)
      setActionNotes('')
      const nextActive = res.data.steps?.find(s => s.status === 'in_progress')
      if (nextActive) setExpandedStep(nextActive.id)
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to complete step')
    }
  }

  const handleSkip = async (stepId) => {
    try {
      await api.put(`/workflows/instances/${id}/steps/${stepId}/skip`, { notes: actionNotes || 'Skipped' })
      setActionNotes('')
      fetchInstance()
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to skip step')
    }
  }

  const handleAssign = async (stepId) => {
    if (!assignUserId) return
    try {
      await api.put(`/workflows/instances/${id}/steps/${stepId}/assign`, { assigned_to_user_id: parseInt(assignUserId) })
      setAssignUserId('')
      fetchInstance()
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to assign')
    }
  }

  const handleCancel = async () => {
    try {
      await api.put(`/workflows/instances/${id}/cancel`, { reason: cancelReason })
      setCancelReason('')
      setShowCancel(false)
      fetchInstance()
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to cancel')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  if (!instance) {
    return (
      <div className="text-center py-20 text-slate-400">
        <p>Workflow not found</p>
        <button onClick={() => navigate('/workflows')} className="mt-2 text-blue-500 text-sm">Go back</button>
      </div>
    )
  }

  const steps = instance.steps || []
  const completedCount = steps.filter(s => s.status === 'completed').length
  const totalSteps = steps.length
  const progress = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0

  const getStepIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-5 w-5 text-emerald-500" />
      case 'in_progress': return <Play className="h-5 w-5 text-blue-500" />
      case 'skipped': return <SkipForward className="h-5 w-5 text-slate-400" />
      default: return <Clock className="h-5 w-5 text-slate-300" />
    }
  }

  const getStepBorder = (status) => {
    switch (status) {
      case 'completed': return 'border-emerald-200 bg-emerald-50/50'
      case 'in_progress': return 'border-blue-300 bg-blue-50/50 ring-1 ring-blue-100'
      case 'skipped': return 'border-slate-200 bg-slate-50/50'
      default: return 'border-slate-100 bg-white'
    }
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {/* Back */}
      <button onClick={() => navigate('/workflows')}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Back to Workflows
      </button>

      {/* Header Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{instance.template_code}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                instance.status === 'active' ? 'bg-blue-100 text-blue-700' :
                instance.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                'bg-red-100 text-red-600'
              }`}>
                {instance.status}
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-800">{instance.entity_label || instance.template_name}</h1>
            <p className="text-sm text-slate-500 mt-1">{instance.template_description}</p>
          </div>
          {instance.status === 'active' && (
            <button onClick={() => setShowCancel(!showCancel)}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors">
              <Ban className="h-3 w-3" /> Cancel
            </button>
          )}
        </div>

        {/* Cancel form */}
        {showCancel && (
          <div className="border-t border-slate-100 pt-3 mt-3">
            <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)}
              placeholder="Reason for cancellation..."
              rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-red-500" />
            <div className="flex gap-2">
              <button onClick={handleCancel}
                className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600">
                Confirm Cancel
              </button>
              <button onClick={() => setShowCancel(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                Keep Active
              </button>
            </div>
          </div>
        )}

        {/* Progress */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-500">Progress</span>
            <span className="text-xs font-medium text-slate-600">{completedCount}/{totalSteps} steps &middot; {progress}%</span>
          </div>
          <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${
              instance.status === 'completed' ? 'bg-emerald-500' :
              instance.status === 'cancelled' ? 'bg-red-300' : 'bg-blue-500'
            }`} style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-xs">
          <div>
            <span className="text-slate-400">Entity</span>
            <p className="font-medium text-slate-600">{instance.entity_type} #{instance.entity_id || '—'}</p>
          </div>
          <div>
            <span className="text-slate-400">Started By</span>
            <p className="font-medium text-slate-600">{instance.started_by_name}</p>
          </div>
          <div>
            <span className="text-slate-400">Created</span>
            <p className="font-medium text-slate-600">{new Date(instance.created_at).toLocaleDateString()}</p>
          </div>
          <div>
            <span className="text-slate-400">{instance.completed_at ? 'Completed' : 'Current Step'}</span>
            <p className="font-medium text-slate-600">
              {instance.completed_at
                ? new Date(instance.completed_at).toLocaleDateString()
                : `Step ${instance.current_step_order}`}
            </p>
          </div>
        </div>
      </div>

      {/* Steps Timeline */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Workflow Steps</h2>
        <div className="space-y-0">
          {steps.map((step, idx) => {
            const isExpanded = expandedStep === step.id
            const isActive = step.status === 'in_progress'
            const isOverdue = step.due_at && new Date(step.due_at) < new Date() && step.status === 'in_progress'

            return (
              <div key={step.id} className="relative">
                {/* Connector line */}
                {idx < steps.length - 1 && (
                  <div className={`absolute left-[19px] top-[48px] w-0.5 h-[calc(100%-28px)] ${
                    step.status === 'completed' ? 'bg-emerald-300' : 'bg-slate-200'
                  }`} />
                )}

                <div
                  className={`relative rounded-xl border p-4 mb-2 transition-all cursor-pointer ${getStepBorder(step.status)} ${
                    isActive ? 'shadow-sm' : ''
                  }`}
                  onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                >
                  <div className="flex items-center gap-3">
                    {/* Step number + icon */}
                    <div className="flex-shrink-0 relative z-10">
                      {getStepIcon(step.status)}
                    </div>

                    {/* Step info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400">STEP {step.step_order}</span>
                        {isOverdue && (
                          <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                            <AlertTriangle className="h-2.5 w-2.5" /> OVERDUE
                          </span>
                        )}
                        {step.status === 'skipped' && (
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">SKIPPED</span>
                        )}
                      </div>
                      <h4 className="text-sm font-semibold text-slate-700">{step.name}</h4>
                    </div>

                    {/* Assigned user */}
                    {step.assigned_to_name && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 flex-shrink-0">
                        <User className="h-3 w-3" />
                        {step.assigned_to_name}
                      </div>
                    )}

                    {/* Completed info */}
                    {step.completed_at && (
                      <span className="text-[10px] text-slate-400 flex-shrink-0">
                        {new Date(step.completed_at).toLocaleDateString()}
                      </span>
                    )}

                    {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-300" /> : <ChevronDown className="h-4 w-4 text-slate-300" />}
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="mt-3 pl-8 space-y-3" onClick={e => e.stopPropagation()}>
                      {step.description && (
                        <p className="text-xs text-slate-500">{step.description}</p>
                      )}

                      {/* Meta row */}
                      <div className="flex flex-wrap gap-4 text-xs">
                        {step.started_at && (
                          <div><span className="text-slate-400">Started:</span> <span className="text-slate-600">{new Date(step.started_at).toLocaleString()}</span></div>
                        )}
                        {step.due_at && (
                          <div><span className="text-slate-400">Due:</span> <span className={isOverdue ? 'text-red-600 font-semibold' : 'text-slate-600'}>{new Date(step.due_at).toLocaleString()}</span></div>
                        )}
                        {step.completed_by_name && (
                          <div><span className="text-slate-400">Completed by:</span> <span className="text-slate-600">{step.completed_by_name}</span></div>
                        )}
                      </div>

                      {/* Notes */}
                      {step.notes && (
                        <div className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600 whitespace-pre-wrap">
                          {step.notes}
                        </div>
                      )}

                      {/* Actions for active steps */}
                      {isActive && instance.status === 'active' && (
                        <div className="border-t border-slate-100 pt-3 space-y-3">
                          {/* Assign user */}
                          <div className="flex items-center gap-2">
                            <select value={assignUserId} onChange={e => setAssignUserId(e.target.value)}
                              className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
                              <option value="">Assign to user...</option>
                              {users.map(u => (
                                <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
                              ))}
                            </select>
                            <button onClick={() => handleAssign(step.id)}
                              className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200">
                              Assign
                            </button>
                          </div>

                          {/* Notes + actions */}
                          <textarea value={actionNotes} onChange={e => setActionNotes(e.target.value)}
                            placeholder="Add notes for this step..."
                            rows={2}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          <div className="flex gap-2">
                            <button onClick={() => handleComplete(step.id)}
                              className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 transition-colors">
                              <CheckCircle className="h-3 w-3" /> Complete Step
                            </button>
                            <button onClick={() => handleSkip(step.id)}
                              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors">
                              <SkipForward className="h-3 w-3" /> Skip
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
