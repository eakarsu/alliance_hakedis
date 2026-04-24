import { useState, useEffect } from 'react'
import { ArrowLeft, Plus, ChevronRight } from 'lucide-react'
import api from '../api/axios'
import DataTable from '../components/DataTable'
import SearchBar from '../components/SearchBar'
import StatusBadge from '../components/StatusBadge'
import { useAuth } from '../context/AuthContext'

const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

const TABS = ['Commercial', 'Shadow', 'Payouts']

const entryColumns = [
  { key: 'opportunity_name', label: 'Opportunity', render: v => v || '-' },
  { key: 'entry_type', label: 'Type', render: v => v ? <StatusBadge status={v} /> : '-' },
  { key: 'lifecycle_stage', label: 'Stage', render: v => v ? <StatusBadge status={v} /> : '-' },
  { key: 'total_basis_amount', label: 'Basis Amount', render: v => v ? `$${Number(v).toLocaleString()}` : '-' },
  { key: 'currency', label: 'Currency', render: v => v || 'USD' },
  { key: 'template_name', label: 'Template', render: v => v || '-' },
  { key: 'created_by_name', label: 'Created By', render: v => v || '-' },
]

const shareColumns = [
  { key: 'opportunity_name', label: 'Opportunity', render: v => v || '-' },
  { key: 'role_type', label: 'Role', render: v => v?.replace(/_/g, ' ') || '-' },
  { key: 'share_percent', label: '%', render: v => v != null ? `${v}%` : '-' },
  { key: 'calculated_amount', label: 'Calculated', render: v => v ? `$${Number(v).toLocaleString()}` : '-' },
  { key: 'final_amount', label: 'Final', render: v => v ? `$${Number(v).toLocaleString()}` : '-' },
  { key: 'status', label: 'Status', render: v => v ? <StatusBadge status={v} /> : '-' },
  { key: 'entry_stage', label: 'Entry Stage', render: v => v ? <StatusBadge status={v} /> : '-' },
]

const shadowColumns = [
  { key: 'opportunity_name', label: 'Opportunity', render: v => v || '-' },
  { key: 'contribution_type', label: 'Type', render: v => v?.replace(/_/g, ' ') || '-' },
  { key: 'description', label: 'Description', render: v => v ? (v.length > 50 ? v.slice(0, 50) + '...' : v) : '-' },
  { key: 'estimated_value', label: 'Estimated', render: v => v ? `$${Number(v).toLocaleString()}` : '-' },
  { key: 'actual_value', label: 'Actual', render: v => v ? `$${Number(v).toLocaleString()}` : '-' },
  { key: 'deserved_amount', label: 'Deserved', render: v => v ? `$${Number(v).toLocaleString()}` : '-' },
  { key: 'lifecycle_stage', label: 'Stage', render: v => v ? <StatusBadge status={v} /> : '-' },
]

const payoutColumns = [
  { key: 'opportunity_name', label: 'Opportunity', render: v => v || '-' },
  { key: 'role_type', label: 'Role', render: v => v?.replace(/_/g, ' ') || '-' },
  { key: 'amount', label: 'Amount', render: v => v ? `$${Number(v).toLocaleString()}` : '-' },
  { key: 'payment_method', label: 'Method', render: v => v || '-' },
  { key: 'payment_date', label: 'Date', render: v => v ? new Date(v).toLocaleDateString() : '-' },
  { key: 'status', label: 'Status', render: v => v ? <StatusBadge status={v} /> : '-' },
  { key: 'processed_by_name', label: 'Processed By', render: v => v || '-' },
]

export default function Economics() {
  const { user } = useAuth()
  const [tab, setTab] = useState('Commercial')
  const [entries, setEntries] = useState([])
  const [shares, setShares] = useState([])
  const [shadow, setShadow] = useState([])
  const [payouts, setPayouts] = useState([])
  const [shareTotals, setShareTotals] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ opportunity_id: '', entry_type: 'commercial', template_id: '', total_basis_amount: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [templates, setTemplates] = useState([])
  const [opportunities, setOpportunities] = useState([])

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [entriesRes, sharesRes, shadowRes, payoutsRes, templatesRes, opportunitiesRes] = await Promise.all([
        api.get('/economics/entries'),
        api.get('/economics/shares'),
        api.get('/economics/shadow'),
        api.get('/economics/payouts'),
        api.get('/split-templates').catch(() => ({ data: { data: [] } })),
        api.get('/opportunities').catch(() => ({ data: { data: [] } })),
      ])
      setEntries(entriesRes.data.data || [])
      setShares(sharesRes.data.data || [])
      setShareTotals(sharesRes.data.totals || {})
      setShadow(shadowRes.data.data || [])
      setPayouts(payoutsRes.data.data || [])
      setTemplates(templatesRes.data.data || [])
      setOpportunities(opportunitiesRes.data.data || opportunitiesRes.data || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form }
      Object.keys(payload).forEach(k => { if (payload[k] === '') delete payload[k] })
      await api.post('/economics/entries', payload)
      setShowForm(false)
      fetchAll()
    } catch (err) { alert(err.response?.data?.error || 'Failed to create') }
    finally { setSaving(false) }
  }

  const handleTransition = async (entryId, toStage) => {
    const reason = prompt(`Reason for transitioning to ${toStage}:`)
    if (reason === null) return
    try {
      await api.post(`/economics/entries/${entryId}/transition`, { to_stage: toStage, reason })
      fetchAll()
      if (detail) {
        const res = await api.get(`/economics/entries/${entryId}`)
        setDetail(res.data)
      }
    } catch (err) { alert(err.response?.data?.error || 'Transition failed') }
  }

  const viewDetail = async (row) => {
    try {
      const res = await api.get(`/economics/entries/${row.id}`)
      setDetail(res.data)
    } catch { alert('Failed to load details') }
  }

  const filterFn = (data) => {
    if (!search) return data
    const s = search.toLowerCase()
    return data.filter(r => JSON.stringify(r).toLowerCase().includes(s))
  }

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" /></div>

  /* ── Inline form view (create) ── */
  if (showForm) {
    return (
      <div className="animate-fade-in space-y-6">
        <button onClick={() => setShowForm(false)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> Back to Economics
        </button>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-6">New Economic Entry</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Opportunity *</label>
              <select required value={form.opportunity_id} onChange={e => setForm(p => ({...p, opportunity_id: e.target.value}))} className={inputCls}>
                <option value="">Select opportunity...</option>
                {opportunities.map(o => <option key={o.id} value={o.id}>{o.opportunity_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Entry Type *</label>
              <select value={form.entry_type} onChange={e => setForm(p => ({...p, entry_type: e.target.value}))} className={inputCls}>
                <option value="commercial">Commercial</option>
                <option value="shadow">Shadow</option>
              </select>
            </div>
            {form.entry_type === 'commercial' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Split Template</label>
                <select value={form.template_id} onChange={e => setForm(p => ({...p, template_id: e.target.value}))} className={inputCls}>
                  <option value="">No template (manual)</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.template_name} ({t.deal_path_type})</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Basis Amount</label>
              <input type="number" step="0.01" value={form.total_basis_amount} onChange={e => setForm(p => ({...p, total_basis_amount: e.target.value}))} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} rows={2} className={inputCls} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{saving ? 'Creating...' : 'Create'}</button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  /* ── Detail view (read-only) ── */
  if (detail) {
    const nextStages = detail.entry_type === 'commercial'
      ? { draft: ['proposed'], proposed: ['reviewed'], reviewed: ['approved'], approved: ['accrued'], accrued: ['payable'], payable: ['paid'] }
      : {}
    const available = nextStages[detail.lifecycle_stage] || []

    return (
      <div className="animate-fade-in space-y-6">
        <button onClick={() => setDetail(null)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="h-4 w-4" /> Back to Economics</button>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Economic Entry #{detail.id}</h2>
            <div className="flex gap-2">
              {available.map(stage => (
                <button key={stage} onClick={() => handleTransition(detail.id, stage)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
                  <ChevronRight className="inline h-3 w-3 mr-1" />{stage.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {[['Opportunity', detail.opportunity_name], ['Type', detail.entry_type], ['Stage', detail.lifecycle_stage], ['Basis Amount', detail.total_basis_amount ? `$${Number(detail.total_basis_amount).toLocaleString()}` : '-'], ['Currency', detail.currency], ['Template', detail.template_name], ['Created By', detail.created_by_name], ['Approved By', detail.approved_by_name]].map(([l, v]) => (
              <div key={l} className="rounded-lg bg-gray-50 p-3"><p className="text-xs font-medium text-gray-500">{l}</p><p className="mt-1 text-sm text-gray-900">{v || '-'}</p></div>
            ))}
          </div>

          {detail.commercial_shares?.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Commercial Shares</h3>
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50"><tr>
                    {['Beneficiary', 'Role', '%', 'Calculated', 'Final', 'Status'].map(h => <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500">{h}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-gray-200">
                    {detail.commercial_shares.map((s, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2 text-sm">{s.beneficiary_name || s.entity_name || '-'}</td>
                        <td className="px-4 py-2 text-sm">{s.role_type?.replace(/_/g, ' ') || '-'}</td>
                        <td className="px-4 py-2 text-sm">{s.share_percent}%</td>
                        <td className="px-4 py-2 text-sm">${Number(s.calculated_amount || 0).toLocaleString()}</td>
                        <td className="px-4 py-2 text-sm font-medium">${Number(s.final_amount || 0).toLocaleString()}</td>
                        <td className="px-4 py-2 text-sm"><StatusBadge status={s.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {detail.shadow_entries?.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Shadow Contributions</h3>
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50"><tr>
                    {['Contributor', 'Type', 'Description', 'Estimated', 'Actual', 'Deserved', 'Stage'].map(h => <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500">{h}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-gray-200">
                    {detail.shadow_entries.map((s, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2 text-sm">{s.contributor_name || '-'}</td>
                        <td className="px-4 py-2 text-sm">{s.contribution_type || '-'}</td>
                        <td className="px-4 py-2 text-sm">{s.description ? (s.description.length > 40 ? s.description.slice(0, 40) + '...' : s.description) : '-'}</td>
                        <td className="px-4 py-2 text-sm">${Number(s.estimated_value || 0).toLocaleString()}</td>
                        <td className="px-4 py-2 text-sm">${Number(s.actual_value || 0).toLocaleString()}</td>
                        <td className="px-4 py-2 text-sm">${Number(s.deserved_amount || 0).toLocaleString()}</td>
                        <td className="px-4 py-2 text-sm"><StatusBadge status={s.lifecycle_stage} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {detail.stage_history?.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Stage History</h3>
              <div className="space-y-2">
                {detail.stage_history.map((h, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm text-gray-600">
                    <span className="text-xs text-gray-400">{new Date(h.created_at).toLocaleString()}</span>
                    <span>{h.from_stage || 'new'} <ChevronRight className="inline h-3 w-3" /> {h.to_stage}</span>
                    <span className="text-gray-400">by {h.changed_by_name}</span>
                    {h.reason && <span className="text-gray-500 italic">"{h.reason}"</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  /* ── List view ── */
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Economics & Shadow Ledger</h1>
          <p className="text-sm text-gray-500">Commercial entitlements, shadow contributions, and payouts</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> New Entry
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500">Total Shares</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">${Number(shareTotals.total_amount || 0).toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500">Paid Out</p>
          <p className="mt-1 text-2xl font-bold text-green-600">${Number(shareTotals.total_paid || 0).toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500">Pending</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">${Number(shareTotals.total_pending || 0).toLocaleString()}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{t}</button>
        ))}
      </div>

      <div className="max-w-sm"><SearchBar value={search} onChange={setSearch} placeholder={`Search ${tab.toLowerCase()}...`} /></div>

      {tab === 'Commercial' && (
        <DataTable columns={entryColumns} data={filterFn(entries.filter(e => e.entry_type === 'commercial'))} onRowClick={viewDetail} />
      )}
      {tab === 'Shadow' && (
        <>
          <DataTable columns={shadowColumns} data={filterFn(shadow)} onRowClick={(row) => setSelected(row)} />
          {/* Also show shadow-type economic entries */}
          <h3 className="text-sm font-semibold text-gray-700 mt-4">Shadow Economic Entries</h3>
          <DataTable columns={entryColumns} data={filterFn(entries.filter(e => e.entry_type === 'shadow'))} onRowClick={viewDetail} />
        </>
      )}
      {tab === 'Payouts' && (
        <DataTable columns={payoutColumns} data={filterFn(payouts)} />
      )}
    </div>
  )
}
