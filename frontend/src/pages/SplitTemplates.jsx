import { useState, useEffect } from 'react'
import { Layers, Plus, ArrowLeft, Pencil, Trash2, Save, X } from 'lucide-react'
import api from '../api/axios'
import DataTable from '../components/DataTable'
import SearchBar from '../components/SearchBar'
import { useAuth } from '../context/AuthContext'

const templateColumns = [
  { key: 'template_name', label: 'Template Name' },
  { key: 'deal_path_name', label: 'Deal Path', render: (v) => v || '-' },
  { key: 'description', label: 'Description', render: (v) => v || '-' },
  { key: 'is_default', label: 'Default', render: (v) => v ? 'Yes' : 'No' },
  { key: 'line_count', label: 'Roles', render: (v) => v || '0' },
]

const roleTypes = [
  'deal_owner', 'co_sell_partner', 'referrer', 'solution_architect',
  'delivery_lead', 'governance', 'ops_pool', 'product_owner',
]

const shareBases = ['gross_revenue', 'net_revenue', 'margin', 'fixed_fee']

const emptyLine = { role_type: '', share_percent: '', share_basis: 'gross_revenue', description: '' }

export default function SplitTemplates() {
  const { user } = useAuth()
  const canEdit = ['founding_orchestrator', 'pmo_coordinator'].includes(user?.role)

  const [templates, setTemplates] = useState([])
  const [dealPaths, setDealPaths] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const [selected, setSelected] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ template_name: '', deal_path_id: '', description: '', is_default: false })
  const [lines, setLines] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchTemplates()
    fetchDealPaths()
  }, [])

  const fetchTemplates = async () => {
    try {
      const res = await api.get('/split-templates')
      setTemplates(res.data.data || [])
    } catch { setError('Failed to load split templates') } finally { setLoading(false) }
  }

  const fetchDealPaths = async () => {
    try {
      const res = await api.get('/deal-paths')
      setDealPaths(res.data.data || [])
    } catch { /* ignore */ }
  }

  const handleSelect = async (tpl) => {
    setSelected(null)
    setEditing(false)
    setDetailLoading(true)
    try {
      const res = await api.get(`/split-templates/${tpl.id}`)
      setSelected(res.data.data || res.data)
    } catch { setError('Failed to load template details') } finally { setDetailLoading(false) }
  }

  const startCreate = () => {
    setSelected(null)
    setForm({ template_name: '', deal_path_id: '', description: '', is_default: false })
    setLines([{ ...emptyLine }])
    setEditing(true)
  }

  const startEdit = () => {
    if (!selected) return
    setForm({
      template_name: selected.template_name || '',
      deal_path_id: selected.deal_path_id || '',
      description: selected.description || '',
      is_default: selected.is_default || false,
    })
    setLines((selected.lines || []).map(l => ({
      role_type: l.role_type || '',
      share_percent: l.share_percent || '',
      share_basis: l.share_basis || 'gross_revenue',
      description: l.description || '',
    })))
    setEditing(true)
  }

  const handleSave = async () => {
    if (!form.template_name.trim()) return setError('Template name is required')
    const totalPct = lines.reduce((s, l) => s + (parseFloat(l.share_percent) || 0), 0)
    if (totalPct > 100) return setError('Total share percentage cannot exceed 100%')
    if (lines.some(l => !l.role_type || !l.share_percent)) return setError('All lines must have role and percentage')

    setSaving(true)
    setError('')
    try {
      const payload = { ...form, lines }
      if (selected?.id) {
        await api.put(`/split-templates/${selected.id}`, payload)
      } else {
        await api.post('/split-templates', payload)
      }
      setEditing(false)
      setSelected(null)
      fetchTemplates()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save template')
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!selected?.id || !confirm('Delete this template?')) return
    try {
      await api.delete(`/split-templates/${selected.id}`)
      setSelected(null)
      fetchTemplates()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete template')
    }
  }

  const addLine = () => setLines([...lines, { ...emptyLine }])
  const removeLine = (i) => setLines(lines.filter((_, idx) => idx !== i))
  const updateLine = (i, field, value) => {
    const updated = [...lines]
    updated[i] = { ...updated[i], [field]: value }
    setLines(updated)
  }

  const filtered = templates.filter(t =>
    (t.template_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (t.deal_path_name || '').toLowerCase().includes(search.toLowerCase())
  )

  // Detail view
  if (selected && !editing) {
    const totalPct = (selected.lines || []).reduce((s, l) => s + parseFloat(l.share_percent || 0), 0)
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelected(null)} className="rounded-lg p-2 hover:bg-slate-100">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <Layers className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-slate-800">{selected.template_name}</h1>
          {canEdit && (
            <div className="ml-auto flex gap-2">
              <button onClick={startEdit} className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700">
                <Pencil className="h-4 w-4" /> Edit
              </button>
              <button onClick={handleDelete} className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700">
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            </div>
          )}
        </div>

        {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

        <div className="grid grid-cols-2 gap-4 rounded-xl bg-white p-6 shadow-sm border border-slate-200">
          <div><span className="text-xs text-slate-500">Deal Path</span><p className="font-medium">{selected.deal_path_name || '-'}</p></div>
          <div><span className="text-xs text-slate-500">Default Template</span><p className="font-medium">{selected.is_default ? 'Yes' : 'No'}</p></div>
          <div className="col-span-2"><span className="text-xs text-slate-500">Description</span><p className="font-medium">{selected.description || '-'}</p></div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Split Lines</h2>
            <span className="text-sm text-slate-500">Total: {totalPct}%</span>
          </div>
          {(selected.lines || []).length === 0 ? (
            <p className="text-sm text-slate-400">No split lines defined.</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-xs text-slate-500">
                <th className="pb-2">Role</th><th className="pb-2">Share %</th><th className="pb-2">Basis</th><th className="pb-2">Description</th>
              </tr></thead>
              <tbody>
                {(selected.lines || []).map((l, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-2 capitalize">{(l.role_type || '').replace(/_/g, ' ')}</td>
                    <td className="py-2">{l.share_percent}%</td>
                    <td className="py-2 capitalize">{(l.share_basis || '').replace(/_/g, ' ')}</td>
                    <td className="py-2 text-slate-500">{l.description || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    )
  }

  // Edit / Create form
  if (editing) {
    const totalPct = lines.reduce((s, l) => s + (parseFloat(l.share_percent) || 0), 0)
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => { setEditing(false); if (!selected) setSelected(null) }} className="rounded-lg p-2 hover:bg-slate-100">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <Layers className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-slate-800">{selected ? 'Edit Template' : 'New Split Template'}</h1>
        </div>

        {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

        <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Template Name *</label>
              <input value={form.template_name} onChange={e => setForm({ ...form, template_name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Deal Path</label>
              <select value={form.deal_path_id} onChange={e => setForm({ ...form, deal_path_id: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">-- Select --</option>
                {dealPaths.map(dp => <option key={dp.id} value={dp.id}>{dp.path_name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_default} onChange={e => setForm({ ...form, is_default: e.target.checked })} />
            Default template for this deal path
          </label>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Split Lines</h2>
            <div className="flex items-center gap-3">
              <span className={`text-sm ${totalPct > 100 ? 'text-red-600 font-bold' : 'text-slate-500'}`}>Total: {totalPct}%</span>
              <button onClick={addLine} className="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-sm hover:bg-slate-200">
                <Plus className="h-4 w-4" /> Add Line
              </button>
            </div>
          </div>

          {lines.length === 0 ? (
            <p className="text-sm text-slate-400">No split lines. Click "Add Line" to begin.</p>
          ) : (
            <div className="space-y-3">
              {lines.map((line, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                  <select value={line.role_type} onChange={e => updateLine(i, 'role_type', e.target.value)}
                    className="rounded border border-slate-300 px-2 py-1.5 text-sm flex-1">
                    <option value="">-- Role --</option>
                    {roleTypes.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                  </select>
                  <input type="number" value={line.share_percent} onChange={e => updateLine(i, 'share_percent', e.target.value)}
                    placeholder="%" className="w-20 rounded border border-slate-300 px-2 py-1.5 text-sm" min="0" max="100" step="0.5" />
                  <select value={line.share_basis} onChange={e => updateLine(i, 'share_basis', e.target.value)}
                    className="rounded border border-slate-300 px-2 py-1.5 text-sm">
                    {shareBases.map(b => <option key={b} value={b}>{b.replace(/_/g, ' ')}</option>)}
                  </select>
                  <input value={line.description} onChange={e => updateLine(i, 'description', e.target.value)}
                    placeholder="Description" className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm" />
                  <button onClick={() => removeLine(i)} className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
            <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Template'}
          </button>
          <button onClick={() => { setEditing(false); if (!selected) setSelected(null) }}
            className="flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm hover:bg-slate-200">
            <X className="h-4 w-4" /> Cancel
          </button>
        </div>
      </div>
    )
  }

  // List view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Layers className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-slate-800">Split Templates</h1>
        </div>
        {canEdit && (
          <button onClick={startCreate} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
            <Plus className="h-4 w-4" /> New Template
          </button>
        )}
      </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

      <SearchBar value={search} onChange={setSearch} placeholder="Search templates..." />

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        </div>
      ) : (
        <DataTable
          columns={templateColumns}
          data={filtered}
          onRowClick={handleSelect}
          emptyMessage="No split templates found."
        />
      )}
    </div>
  )
}
