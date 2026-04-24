import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import StatusBadge from '../components/StatusBadge'
import {
  CheckSquare, Plus, CheckCircle, XCircle, Clock, ChevronRight,
  User, FileText, ArrowLeft, Send
} from 'lucide-react'

const WORKFLOW_TYPES = [
  'revenue_approval', 'proposal_approval', 'visibility_change',
  'compliance_sign_off', 'budget_approval', 'partner_onboarding',
  'contract_approval', 'payout_authorization', 'other'
]

const ENTITY_TYPES = [
  'opportunity', 'lead', 'proposal', 'economic_entry', 'agreement',
  'project', 'product', 'partner_entity'
]

const emptyForm = {
  related_type: '',
  related_id: '',
  workflow_type: '',
  total_steps: 1,
  assigned_to_user_id: '',
  notes: '',
}

export default function ApprovalWorkflows() {
  const { user } = useAuth()
  const [workflows, setWorkflows] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState('all') // all, pending, approved, rejected, my_pending
  const [actionNotes, setActionNotes] = useState('')

  useEffect(() => {
    fetchWorkflows()
    fetchUsers()
  }, [])

  const fetchWorkflows = async () => {
    try {
      const res = await api.get('/approval-workflows')
      setWorkflows(res.data.data || [])
    } catch (err) {
      console.error('Failed to load workflows:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users/list')
      setUsers(res.data || [])
    } catch (err) {
      console.error('Failed to load users:', err)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.related_type || !form.related_id || !form.workflow_type) return
    setSaving(true)
    try {
      await api.post('/approval-workflows', form)
      setShowForm(false)
      setForm(emptyForm)
      fetchWorkflows()
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create workflow')
    } finally {
      setSaving(false)
    }
  }

  const handleApprove = async (id) => {
    try {
      await api.put(`/approval-workflows/${id}/approve`, { notes: actionNotes })
      setActionNotes('')
      setSelected(null)
      fetchWorkflows()
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to approve')
    }
  }

  const handleReject = async (id) => {
    try {
      await api.put(`/approval-workflows/${id}/reject`, { notes: actionNotes })
      setActionNotes('')
      setSelected(null)
      fetchWorkflows()
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to reject')
    }
  }

  const filtered = workflows.filter((wf) => {
    if (filter === 'all') return true
    if (filter === 'my_pending') return wf.status === 'pending' && wf.assigned_to_user_id === user.id
    return wf.status === filter
  })

  const pendingMyCount = workflows.filter(
    (wf) => wf.status === 'pending' && wf.assigned_to_user_id === user.id
  ).length

  if (selected) {
    const wf = selected
    const canAct = wf.status === 'pending' && (
      wf.assigned_to_user_id === user.id ||
      user.role === 'founding_orchestrator' ||
      user.role === 'pmo_coordinator'
    )

    return (
      <div className="space-y-6 animate-fade-in">
        <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-4 w-4" /> Back to list
        </button>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-lg font-bold text-slate-800">
                  {wf.workflow_type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </h2>
                <StatusBadge status={wf.status} />
              </div>
              <p className="text-sm text-slate-500">
                {wf.related_type} #{wf.related_id}
              </p>
            </div>
            <div className="text-right text-xs text-slate-400">
              <p>Created {new Date(wf.created_at).toLocaleDateString()}</p>
              {wf.approved_at && <p>Resolved {new Date(wf.approved_at).toLocaleDateString()}</p>}
            </div>
          </div>

          {/* Progress Steps */}
          <div className="mb-6">
            <p className="text-xs font-medium text-slate-500 mb-2">Progress</p>
            <div className="flex items-center gap-2">
              {Array.from({ length: wf.total_steps }, (_, i) => {
                const stepNum = i + 1
                const isDone = stepNum < wf.current_step || wf.status === 'approved'
                const isCurrent = stepNum === wf.current_step && wf.status === 'pending'
                const isRejected = wf.status === 'rejected' && stepNum === wf.current_step
                return (
                  <div key={i} className="flex items-center gap-2">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold
                      ${isDone ? 'bg-emerald-500 text-white' :
                        isCurrent ? 'bg-blue-500 text-white ring-2 ring-blue-200' :
                        isRejected ? 'bg-red-500 text-white' :
                        'bg-slate-200 text-slate-500'}`}>
                      {isDone ? <CheckCircle className="h-4 w-4" /> : stepNum}
                    </div>
                    {i < wf.total_steps - 1 && (
                      <div className={`h-0.5 w-8 ${isDone ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                    )}
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Step {Math.min(wf.current_step, wf.total_steps)} of {wf.total_steps}
            </p>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-xs text-slate-400 mb-1">Requested By</p>
              <p className="text-sm font-medium text-slate-700">{wf.requested_by_name || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Assigned To</p>
              <p className="text-sm font-medium text-slate-700">{wf.assigned_to_name || '—'}</p>
            </div>
            {wf.approved_by_name && (
              <div>
                <p className="text-xs text-slate-400 mb-1">Resolved By</p>
                <p className="text-sm font-medium text-slate-700">{wf.approved_by_name}</p>
              </div>
            )}
          </div>

          {/* Notes */}
          {wf.notes && (
            <div className="mb-6">
              <p className="text-xs text-slate-400 mb-1">Notes</p>
              <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600 whitespace-pre-wrap">
                {wf.notes}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {canAct && (
            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs font-medium text-slate-500 mb-2">Take Action</p>
              <textarea
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder="Add notes (optional)..."
                rows={2}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => handleApprove(wf.id)}
                  className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 transition-colors"
                >
                  <CheckCircle className="h-4 w-4" />
                  {wf.current_step < wf.total_steps ? `Approve Step ${wf.current_step}` : 'Approve'}
                </button>
                <button
                  onClick={() => handleReject(wf.id)}
                  className="flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 transition-colors"
                >
                  <XCircle className="h-4 w-4" /> Reject
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Approval Workflows</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage multi-step approval chains for opportunities, proposals, payouts, and more.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 transition-colors"
        >
          <Plus className="h-4 w-4" /> New Request
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Create Approval Request</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Entity Type *</label>
              <select value={form.related_type} onChange={(e) => setForm({ ...form, related_type: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                <option value="">Select entity type...</option>
                {ENTITY_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Entity ID *</label>
              <input type="number" value={form.related_id} onChange={(e) => setForm({ ...form, related_id: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter entity ID" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Workflow Type *</label>
              <select value={form.workflow_type} onChange={(e) => setForm({ ...form, workflow_type: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                <option value="">Select workflow type...</option>
                {WORKFLOW_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Approval Steps</label>
              <input type="number" min="1" max="10" value={form.total_steps}
                onChange={(e) => setForm({ ...form, total_steps: parseInt(e.target.value) || 1 })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Assign To</label>
              <select value={form.assigned_to_user_id} onChange={(e) => setForm({ ...form, assigned_to_user_id: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select approver...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2} placeholder="Describe what needs approval..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button type="button" onClick={() => { setShowForm(false); setForm(emptyForm) }}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50">
              <Send className="h-4 w-4" /> {saving ? 'Creating...' : 'Submit Request'}
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'all', label: 'All', count: workflows.length },
          { key: 'my_pending', label: 'My Pending', count: pendingMyCount },
          { key: 'pending', label: 'Pending', count: workflows.filter(w => w.status === 'pending').length },
          { key: 'approved', label: 'Approved', count: workflows.filter(w => w.status === 'approved').length },
          { key: 'rejected', label: 'Rejected', count: workflows.filter(w => w.status === 'rejected').length },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === f.key
                ? 'bg-blue-500 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* Workflow List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <CheckSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No workflows found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((wf) => (
            <div
              key={wf.id}
              onClick={() => setSelected(wf)}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm hover:shadow-md hover:border-blue-200 cursor-pointer transition-all"
            >
              <div className="flex items-center gap-4">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                  wf.status === 'pending' ? 'bg-amber-100 text-amber-600' :
                  wf.status === 'approved' ? 'bg-emerald-100 text-emerald-600' :
                  'bg-red-100 text-red-600'
                }`}>
                  {wf.status === 'pending' ? <Clock className="h-4 w-4" /> :
                   wf.status === 'approved' ? <CheckCircle className="h-4 w-4" /> :
                   <XCircle className="h-4 w-4" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-700">
                      {wf.workflow_type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </h4>
                    <StatusBadge status={wf.status} />
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {wf.related_type} #{wf.related_id}
                    {' '}&middot;{' '}
                    Step {Math.min(wf.current_step, wf.total_steps)}/{wf.total_steps}
                    {' '}&middot;{' '}
                    by {wf.requested_by_name || 'Unknown'}
                    {wf.assigned_to_name && <> &middot; assigned to {wf.assigned_to_name}</>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">{new Date(wf.created_at).toLocaleDateString()}</span>
                <ChevronRight className="h-4 w-4 text-slate-300" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
