import { useState, useEffect } from 'react'
import { Plus, ArrowLeft, TrendingUp } from 'lucide-react'
import api from '../api/axios'
import DataTable from '../components/DataTable'
import SearchBar from '../components/SearchBar'
import StatusBadge from '../components/StatusBadge'
import DetailModal from '../components/DetailModal'
import { useAuth } from '../context/AuthContext'
import { getAccessDepth } from '../config/rolePermissions'

const columns = [
  { key: 'lead_name', label: 'Name', render: (v) => v || '-' },
  { key: 'source_type', label: 'Source Type', render: (v) => v ? <StatusBadge status={v} /> : '-' },
  { key: 'org_name', label: 'Organization', render: (v) => v || '-' },
  { key: 'contact_name', label: 'Contact', render: (v) => v || '-' },
  { key: 'geography', label: 'Geography', render: (v) => v || '-' },
  { key: 'status', label: 'Status', render: (v) => v ? <StatusBadge status={v} /> : '-' },
  { key: 'estimated_value', label: 'Est. Value', render: (v) => v ? `$${Number(v).toLocaleString()}` : '-' },
  { key: 'confidence_score', label: 'Confidence', render: (v) => v != null ? `${v}%` : '-' },
]

const emptyForm = { lead_name: '', source_type: '', source_owner_user_id: '', sponsor_user_id: '', geography: '', vertical: '', need_type: '', estimated_value: '', confidence_score: '', status: '', visibility_level: '', organization_id: '', contact_id: '', notes: '' }

const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

export default function Leads() {
  const { user } = useAuth()
  const accessLevel = getAccessDepth(user?.role, 'leads')
  const isRestricted = accessLevel === 'ilgili' || accessLevel === 'sinirli' || accessLevel === 'paylasilan' || accessLevel === 'yok'
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [converting, setConverting] = useState(false)
  const [showConvertForm, setShowConvertForm] = useState(false)
  const [convertForm, setConvertForm] = useState({ opportunity_name: '', deal_type: '', deal_path_id: '', deal_owner_user_id: '', technical_partner_user_id: '', product_owner_user_id: '', delivery_owner_user_id: '', estimated_total_value: '', expected_close_date: '', notes: '' })
  const [orgs, setOrgs] = useState([])
  const [contacts, setContacts] = useState([])
  const [users, setUsers] = useState([])
  const [dealPaths, setDealPaths] = useState([])

  useEffect(() => { fetchData(); fetchOrgs(); fetchUsers(); fetchDealPaths(); fetchContacts() }, [])

  const fetchData = async () => {
    try {
      const res = await api.get('/leads')
      const items = res.data.data || []
      setData(Array.isArray(items) ? items : [])
      setTotal(res.data.total || items.length || 0)
    } catch { setError('Failed to load leads') } finally { setLoading(false) }
  }

  const fetchOrgs = async () => {
    try { const res = await api.get('/organizations'); setOrgs(res.data.data || []) } catch {}
  }
  const fetchUsers = async () => {
    try { const res = await api.get('/users/list'); setUsers(Array.isArray(res.data) ? res.data : []) } catch {}
  }
  const fetchDealPaths = async () => {
    try { const res = await api.get('/deal-paths'); setDealPaths(res.data.data || []) } catch {}
  }
  const [allContacts, setAllContacts] = useState([])
  const fetchContacts = async (orgId) => {
    try {
      const res = await api.get('/contacts?limit=500')
      const items = res.data.data || []
      setAllContacts(items)
      setContacts(orgId ? items.filter(c => String(c.organization_id) === String(orgId)) : items)
    } catch {}
  }

  const handleOrgChange = (orgId) => {
    setForm(p => ({ ...p, organization_id: orgId, contact_id: '' }))
    setContacts(orgId ? allContacts.filter(c => String(c.organization_id) === String(orgId)) : allContacts)
  }

  const filtered = data.filter(r => { const s = search.toLowerCase(); return !s || `${r.lead_name} ${r.geography} ${r.status} ${r.source_type} ${r.org_name}`.toLowerCase().includes(s) })

  const handleRowClick = (row) => { setSelected(row); setEditMode(false); setShowForm(false) }
  const handleNew = () => { setForm({...emptyForm, source_owner_user_id: user?.id || ''}); setContacts(allContacts); setEditMode(false); setShowForm(true); setSelected(null) }
  const handleEdit = (row) => {
    setForm({ lead_name: row.lead_name || '', source_type: row.source_type || '', source_owner_user_id: row.source_owner_user_id || '', sponsor_user_id: row.sponsor_user_id || '', geography: row.geography || '', vertical: row.vertical || '', need_type: row.need_type || '', estimated_value: row.estimated_value || '', confidence_score: row.confidence_score || '', status: row.status || '', visibility_level: row.visibility_level || '', organization_id: row.organization_id || '', contact_id: row.contact_id || '', notes: row.notes || '' })
    if (row.organization_id) fetchContacts(row.organization_id)
    setEditMode(true); setShowForm(true); setSelected(row)
  }
  const handleDelete = async (row) => {
    if (!confirm(`Delete lead "${row.lead_name}"?`)) return
    try { await api.delete(`/leads/${row.id}`); setData(prev => prev.filter(r => r.id !== row.id)); if (selected?.id === row.id) setSelected(null) }
    catch { alert('Failed to delete') }
  }
  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      if (editMode && selected) { await api.put(`/leads/${selected.id}`, form) } else { await api.post('/leads', form) }
      setShowForm(false); setSelected(null); fetchData()
    } catch (err) { alert(err.response?.data?.error || 'Failed to save') } finally { setSaving(false) }
  }
  const handleCancel = () => { setShowForm(false); if (!editMode) setSelected(null) }

  const handleConvert = async (e) => {
    e.preventDefault()
    setConverting(true)
    try {
      const payload = {
        ...convertForm,
        opportunity_name: convertForm.opportunity_name || `${selected.lead_name} - Opportunity`,
        estimated_total_value: convertForm.estimated_total_value || selected.estimated_value,
      }
      Object.keys(payload).forEach(k => { if (payload[k] === '') delete payload[k] })
      await api.post(`/leads/${selected.id}/convert`, payload)
      alert('Lead converted to opportunity successfully!')
      setShowConvertForm(false)
      setSelected(null)
      fetchData()
    } catch (err) { alert(err.response?.data?.error || 'Failed to convert lead') } finally { setConverting(false) }
  }

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" /></div>

  // ─── INLINE FORM VIEW (Create / Edit) ───
  if (showForm) {
    return (
      <div className="animate-fade-in space-y-6">
        <button onClick={handleCancel} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> Back to Leads
        </button>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-6">{editMode ? 'Edit Lead' : 'New Lead'}</h2>
          {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 mb-4">{error}</div>}
          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lead Name *</label>
              <input required value={form.lead_name} onChange={e => setForm(p => ({ ...p, lead_name: e.target.value }))} className={inputCls} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Organization</label>
                <select value={form.organization_id} onChange={e => handleOrgChange(e.target.value)} className={inputCls}>
                  <option value="">Select organization...</option>
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.org_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
                <select value={form.contact_id} onChange={e => setForm(p => ({ ...p, contact_id: e.target.value }))} className={inputCls}>
                  <option value="">Select contact...</option>
                  {contacts.map(c => <option key={c.id} value={c.id}>{c.full_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || `Contact #${c.id}`}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source Type</label>
                <select value={form.source_type} onChange={e => setForm(p => ({ ...p, source_type: e.target.value }))} className={inputCls}>
                  <option value="">Select...</option>
                  <option value="inbound">Inbound</option><option value="outbound">Outbound</option><option value="referral">Referral</option><option value="partner">Partner</option><option value="event">Event</option><option value="direct">Direct</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Geography</label>
                <input value={form.geography} onChange={e => setForm(p => ({ ...p, geography: e.target.value }))} className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source Owner</label>
                <select value={form.source_owner_user_id} onChange={e => setForm(p => ({ ...p, source_owner_user_id: e.target.value }))} className={inputCls}>
                  <option value="">Select user...</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sponsor</label>
                <select value={form.sponsor_user_id} onChange={e => setForm(p => ({ ...p, sponsor_user_id: e.target.value }))} className={inputCls}>
                  <option value="">Select user...</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vertical</label>
                <input value={form.vertical} onChange={e => setForm(p => ({ ...p, vertical: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Need Type</label>
                <select value={form.need_type} onChange={e => setForm(p => ({ ...p, need_type: e.target.value }))} className={inputCls}>
                  <option value="">Select...</option>
                  <option value="product">Product</option><option value="implementation">Implementation</option><option value="consulting">Consulting</option><option value="integration">Integration</option><option value="licensing">Licensing</option><option value="support">Support</option><option value="training">Training</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Value</label>
                <input type="number" value={form.estimated_value} onChange={e => setForm(p => ({ ...p, estimated_value: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confidence (%)</label>
                <input type="number" min="0" max="100" value={form.confidence_score} onChange={e => setForm(p => ({ ...p, confidence_score: e.target.value }))} className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className={inputCls}>
                  <option value="">Select...</option>
                  <option value="new">New</option><option value="reviewing">Reviewing</option><option value="qualified">Qualified</option><option value="needs_sponsor">Needs Sponsor</option><option value="blocked">Blocked</option><option value="rejected">Rejected</option><option value="converted">Converted</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Visibility</label>
                <select value={form.visibility_level} onChange={e => setForm(p => ({ ...p, visibility_level: e.target.value }))} className={inputCls}>
                  <option value="">Select...</option>
                  <option value="public">Public</option><option value="internal">Internal</option><option value="team">Team</option><option value="restricted">Restricted</option><option value="confidential">Confidential</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3} className={inputCls} />
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving...' : editMode ? 'Update Lead' : 'Create Lead'}
              </button>
              <button type="button" onClick={handleCancel} className="rounded-lg border border-gray-300 px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // ─── DETAIL VIEW ───
  if (selected && !showForm) {
    return (
      <div className="animate-fade-in space-y-6">
        <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="h-4 w-4" /> Back to Leads</button>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">{selected.lead_name}</h2>
            <div className="flex gap-2">
              <button onClick={() => handleEdit(selected)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Edit</button>
              {!isRestricted && <button onClick={() => handleDelete(selected)} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Delete</button>}
              {selected.status !== 'converted' && (
                <button disabled={converting} onClick={() => setShowConvertForm(true)} className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
                  <TrendingUp className="h-4 w-4" /> Convert to Opportunity
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(() => {
              const allFields = [
                ['Source Type', selected.source_type],
                ['Source Owner', selected.source_owner_name],
                ['Sponsor', selected.sponsor_name],
                ['Organization', selected.org_name],
                ['Contact', selected.contact_name],
                ['Geography', selected.geography],
                ['Vertical', selected.vertical],
                ['Need Type', selected.need_type],
                ['Estimated Value', selected.estimated_value ? `$${Number(selected.estimated_value).toLocaleString()}` : null],
                ['Confidence', selected.confidence_score != null ? `${selected.confidence_score}%` : null],
                ['Visibility', selected.visibility_level],
                ['Status', selected.status],
                ['Conflict Flag', selected.conflict_flag != null ? (selected.conflict_flag ? 'Yes' : 'No') : null],
                ['Protected Until', selected.protected_until ? new Date(selected.protected_until).toLocaleDateString() : null],
                ['Notes', selected.notes],
                ['Created', selected.created_at ? new Date(selected.created_at).toLocaleDateString() : null],
                ['Updated', selected.updated_at ? new Date(selected.updated_at).toLocaleDateString() : null],
              ]
              const restrictedFields = ['Visibility', 'Conflict Flag', 'Protected Until', 'Confidence', 'Notes']
              const detailFields = isRestricted
                ? allFields.filter(([label]) => !restrictedFields.includes(label))
                : allFields
              return detailFields.map(([l, v]) => (
                <div key={l} className="rounded-lg bg-gray-50 p-3"><p className="text-xs font-medium text-gray-500">{l}</p><p className="mt-1 text-sm text-gray-900">{v != null && v !== '' ? String(v) : '-'}</p></div>
              ))
            })()}
          </div>
        </div>

        {/* Convert modal - this one stays as modal since it's a secondary action */}
        <DetailModal open={showConvertForm} onClose={() => setShowConvertForm(false)} title="Convert Lead to Opportunity">
          <form onSubmit={handleConvert} className="space-y-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Opportunity Name</label><input value={convertForm.opportunity_name} onChange={e => setConvertForm(p => ({...p, opportunity_name: e.target.value}))} placeholder={`${selected?.lead_name || ''} - Opportunity`} className={inputCls} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Deal Type</label>
                <select value={convertForm.deal_type} onChange={e => setConvertForm(p => ({...p, deal_type: e.target.value}))} className={inputCls}>
                  <option value="">Select...</option><option value="new_business">New Business</option><option value="expansion">Expansion</option><option value="renewal">Renewal</option><option value="upsell">Upsell</option>
                </select>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Deal Path</label>
                <select value={convertForm.deal_path_id} onChange={e => setConvertForm(p => ({...p, deal_path_id: e.target.value}))} className={inputCls}>
                  <option value="">Select deal path...</option>
                  {dealPaths.map(dp => <option key={dp.id} value={dp.id}>{dp.path_name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Estimated Value</label><input type="number" value={convertForm.estimated_total_value} onChange={e => setConvertForm(p => ({...p, estimated_total_value: e.target.value}))} placeholder={selected?.estimated_value || ''} className={inputCls} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Expected Close Date</label><input type="date" value={convertForm.expected_close_date} onChange={e => setConvertForm(p => ({...p, expected_close_date: e.target.value}))} className={inputCls} /></div>
            </div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider pt-2">Assign Roles</p>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Deal Owner</label>
                <select value={convertForm.deal_owner_user_id} onChange={e => setConvertForm(p => ({...p, deal_owner_user_id: e.target.value}))} className={inputCls}>
                  <option value="">Select user...</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Technical Partner</label>
                <select value={convertForm.technical_partner_user_id} onChange={e => setConvertForm(p => ({...p, technical_partner_user_id: e.target.value}))} className={inputCls}>
                  <option value="">Select user...</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Product Owner</label>
                <select value={convertForm.product_owner_user_id} onChange={e => setConvertForm(p => ({...p, product_owner_user_id: e.target.value}))} className={inputCls}>
                  <option value="">Select user...</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Delivery Owner</label>
                <select value={convertForm.delivery_owner_user_id} onChange={e => setConvertForm(p => ({...p, delivery_owner_user_id: e.target.value}))} className={inputCls}>
                  <option value="">Select user...</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Notes</label><textarea value={convertForm.notes} onChange={e => setConvertForm(p => ({...p, notes: e.target.value}))} rows={2} className={inputCls} /></div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowConvertForm(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={converting} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">{converting ? 'Converting...' : 'Convert'}</button>
            </div>
          </form>
        </DetailModal>
      </div>
    )
  }

  // ─── LIST VIEW ───
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Leads</h1><p className="text-sm text-gray-500">{filtered.length} lead{filtered.length !== 1 ? 's' : ''}</p></div>
        <button onClick={handleNew} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"><Plus className="h-4 w-4" /> New Lead</button>
      </div>
      <div className="max-w-sm"><SearchBar value={search} onChange={setSearch} placeholder="Search leads..." /></div>
      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{error}</div>}
      <DataTable columns={columns} data={filtered} onRowClick={handleRowClick} onEdit={handleEdit} onDelete={isRestricted ? undefined : handleDelete} />
    </div>
  )
}
