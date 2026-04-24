import { useState, useEffect } from 'react'
import { FileSearch, ArrowLeft, Plus } from 'lucide-react'
import api from '../api/axios'
import DataTable from '../components/DataTable'
import SearchBar from '../components/SearchBar'
import StatusBadge from '../components/StatusBadge'

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const columns = [
  { key: 'title', label: 'Title', render: (v) => v || '-' },
  { key: 'priority', label: 'Priority', render: (v) => v ? <StatusBadge status={v} /> : '-' },
  { key: 'status', label: 'Status', render: (v) => v ? <StatusBadge status={v} /> : '-' },
  { key: 'requested_by_name', label: 'Requested By', render: (v) => v || '-' },
  { key: 'assigned_to_name', label: 'Assigned To', render: (v) => v || '-' },
  { key: 'created_at', label: 'Created', render: (v) => v ? formatDate(v) : '-' },
]

const emptyForm = {
  title: '', description: '', assigned_to_user_id: '', priority: 'medium',
  related_type: '', related_id: '',
}

export default function AdvisoryRequests() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [users, setUsers] = useState([])

  useEffect(() => {
    fetchItems()
    fetchUsers()
  }, [])

  const fetchItems = async () => {
    try {
      const res = await api.get('/advisory-requests')
      const data = res.data.data || res.data || []
      setItems(Array.isArray(data) ? data : [])
    } catch {
      setError('Failed to load advisory requests')
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users/list')
      setUsers(Array.isArray(res.data) ? res.data : [])
    } catch { /* ignore */ }
  }

  const filtered = items.filter((r) => {
    const s = search.toLowerCase()
    return !s || `${r.title} ${r.description} ${r.priority} ${r.status} ${r.requested_by_name} ${r.assigned_to_name}`.toLowerCase().includes(s)
  })

  const handleNew = () => {
    setForm(emptyForm)
    setEditing(false)
    setShowForm(true)
    setSelected(null)
  }

  const handleEdit = () => {
    setForm({
      title: selected.title || '',
      description: selected.description || '',
      assigned_to_user_id: selected.assigned_to_user_id || '',
      priority: selected.priority || 'medium',
      related_type: selected.related_type || '',
      related_id: selected.related_id || '',
    })
    setEditing(true)
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.title.trim()) return alert('Title is required')
    setSaving(true)
    try {
      const payload = { ...form, assigned_to_user_id: form.assigned_to_user_id || null }
      if (editing && selected) {
        await api.put(`/advisory-requests/${selected.id}`, payload)
      } else {
        await api.post('/advisory-requests', payload)
      }
      setShowForm(false)
      setSelected(null)
      fetchItems()
    } catch {
      alert('Failed to save advisory request')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this advisory request?')) return
    try {
      await api.delete(`/advisory-requests/${selected.id}`)
      setSelected(null)
      fetchItems()
    } catch {
      alert('Failed to delete')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  if (showForm) {
    return (
      <div className="animate-fade-in space-y-6">
        <button onClick={() => { setShowForm(false); if (!editing) setSelected(null) }} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-6">{editing ? 'Edit' : 'New'} Advisory Request</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input value={form.title} onChange={e => setForm({...form, title: e.target.value})}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
              <select value={form.assigned_to_user_id} onChange={e => setForm({...form, assigned_to_user_id: e.target.value})}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                <option value="">-- Select User --</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={4}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
            </div>
          </div>
          <div className="mt-6 flex gap-3">
            <button onClick={handleSave} disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
            </button>
            <button onClick={() => setShowForm(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (selected) {
    return (
      <div className="animate-fade-in space-y-6">
        <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> Back to Advisory Requests
        </button>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <FileSearch className="h-6 w-6 text-blue-600" />
              <h2 className="text-xl font-bold text-gray-900">{selected.title || 'Advisory Request'}</h2>
              <StatusBadge status={selected.status || 'open'} />
            </div>
            <div className="flex gap-2">
              <button onClick={handleEdit} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Edit</button>
              <button onClick={handleDelete} className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50">Delete</button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              ['Title', selected.title],
              ['Priority', selected.priority],
              ['Status', selected.status],
              ['Requested By', selected.requested_by_name],
              ['Assigned To', selected.assigned_to_name],
              ['Related Type', selected.related_type],
              ['Created', selected.created_at ? formatDate(selected.created_at) : null],
              ['Responded At', selected.responded_at ? formatDate(selected.responded_at) : null],
            ].map(([l, v]) => (
              <div key={l} className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs font-medium text-gray-500">{l}</p>
                <p className="mt-1 text-sm text-gray-900">{v != null && v !== '' ? String(v) : '-'}</p>
              </div>
            ))}
          </div>
          {selected.description && (
            <div className="mt-4 rounded-lg bg-gray-50 p-3">
              <p className="text-xs font-medium text-gray-500">Description</p>
              <p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{selected.description}</p>
            </div>
          )}
          {selected.response && (
            <div className="mt-4 rounded-lg bg-gray-50 p-3">
              <p className="text-xs font-medium text-gray-500">Response</p>
              <p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{selected.response}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileSearch className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Advisory Requests</h1>
          <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-0.5 text-sm font-medium text-blue-700">
            {items.length}
          </span>
        </div>
        <button onClick={handleNew}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> New Request
        </button>
      </div>

      <div className="max-w-sm">
        <SearchBar value={search} onChange={setSearch} placeholder="Search advisory requests..." />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <DataTable columns={columns} data={filtered} onRowClick={(row) => setSelected(row)} />
    </div>
  )
}
