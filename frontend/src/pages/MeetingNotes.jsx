import { useState, useEffect } from 'react'
import { CalendarDays, ArrowLeft, Plus, X } from 'lucide-react'
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
  { key: 'meeting_date', label: 'Date', render: (v) => v ? formatDate(v) : '-' },
  { key: 'attendees', label: 'Attendees', render: (v) => v || '-' },
  { key: 'visibility_level', label: 'Visibility', render: (v) => v ? <StatusBadge status={v} /> : '-' },
  { key: 'created_by_name', label: 'Created By', render: (v) => v || '-' },
]

const emptyForm = {
  title: '', meeting_date: '', attendees: '', summary: '', action_items: '',
  related_type: '', related_id: '', visibility_level: 'internal',
}

export default function MeetingNotes() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const res = await api.get('/meeting-notes')
      const items = res.data.data || res.data || []
      setData(Array.isArray(items) ? items : [])
    } catch {
      setError('Failed to load meeting notes')
    } finally {
      setLoading(false)
    }
  }

  const filtered = data.filter((r) => {
    const s = search.toLowerCase()
    return !s || `${r.title} ${r.attendees} ${r.summary} ${r.created_by_name}`.toLowerCase().includes(s)
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
      meeting_date: selected.meeting_date ? selected.meeting_date.slice(0, 10) : '',
      attendees: selected.attendees || '',
      summary: selected.summary || '',
      action_items: selected.action_items || '',
      related_type: selected.related_type || '',
      related_id: selected.related_id || '',
      visibility_level: selected.visibility_level || 'internal',
    })
    setEditing(true)
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.title.trim()) return alert('Title is required')
    setSaving(true)
    try {
      if (editing && selected) {
        await api.put(`/meeting-notes/${selected.id}`, form)
      } else {
        await api.post('/meeting-notes', form)
      }
      setShowForm(false)
      setSelected(null)
      fetchData()
    } catch {
      alert('Failed to save meeting note')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this meeting note?')) return
    try {
      await api.delete(`/meeting-notes/${selected.id}`)
      setSelected(null)
      fetchData()
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
          <h2 className="text-xl font-bold text-gray-900 mb-6">{editing ? 'Edit' : 'New'} Meeting Note</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input value={form.title} onChange={e => setForm({...form, title: e.target.value})}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Date</label>
              <input type="date" value={form.meeting_date} onChange={e => setForm({...form, meeting_date: e.target.value})}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Attendees</label>
              <input value={form.attendees} onChange={e => setForm({...form, attendees: e.target.value})}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="Comma-separated names" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Visibility</label>
              <select value={form.visibility_level} onChange={e => setForm({...form, visibility_level: e.target.value})}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                <option value="internal">Internal</option>
                <option value="shared">Shared</option>
                <option value="private">Private</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Summary</label>
              <textarea value={form.summary} onChange={e => setForm({...form, summary: e.target.value})} rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Action Items</label>
              <textarea value={form.action_items} onChange={e => setForm({...form, action_items: e.target.value})} rows={3}
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
          <ArrowLeft className="h-4 w-4" /> Back to Meeting Notes
        </button>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-6 w-6 text-blue-600" />
              <h2 className="text-xl font-bold text-gray-900">{selected.title || 'Meeting Note'}</h2>
              <StatusBadge status={selected.visibility_level || 'internal'} />
            </div>
            <div className="flex gap-2">
              <button onClick={handleEdit} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Edit</button>
              <button onClick={handleDelete} className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50">Delete</button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              ['Title', selected.title],
              ['Meeting Date', selected.meeting_date ? formatDate(selected.meeting_date) : null],
              ['Attendees', selected.attendees],
              ['Visibility', selected.visibility_level],
              ['Created By', selected.created_by_name],
              ['Created', selected.created_at ? formatDate(selected.created_at) : null],
            ].map(([l, v]) => (
              <div key={l} className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs font-medium text-gray-500">{l}</p>
                <p className="mt-1 text-sm text-gray-900">{v != null && v !== '' ? String(v) : '-'}</p>
              </div>
            ))}
          </div>
          {selected.summary && (
            <div className="mt-4 rounded-lg bg-gray-50 p-3">
              <p className="text-xs font-medium text-gray-500">Summary</p>
              <p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{selected.summary}</p>
            </div>
          )}
          {selected.action_items && (
            <div className="mt-4 rounded-lg bg-gray-50 p-3">
              <p className="text-xs font-medium text-gray-500">Action Items</p>
              <p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{selected.action_items}</p>
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
          <CalendarDays className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Meeting Notes</h1>
          <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-0.5 text-sm font-medium text-blue-700">
            {data.length}
          </span>
        </div>
        <button onClick={handleNew}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> New Meeting Note
        </button>
      </div>

      <div className="max-w-sm">
        <SearchBar value={search} onChange={setSearch} placeholder="Search meetings..." />
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
