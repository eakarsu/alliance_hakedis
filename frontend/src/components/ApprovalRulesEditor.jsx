import { useEffect, useState } from 'react'

const EMPTY = { name: '', threshold_try: 0, requires_pm: false, requires_director: false, requires_cfo: false, active: true }

export default function ApprovalRulesEditor() {
  const [rules, setRules] = useState([])
  const [draft, setDraft] = useState(EMPTY)
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    try {
      const r = await fetch('/api/custom-views/approval-rules')
      const d = await r.json()
      setRules(d.rules || [])
    } catch (e) { setError(e.message) }
  }

  useEffect(() => { load() }, [])

  const send = async (action, payload) => {
    setBusy(true); setError('')
    try {
      const r = await fetch('/api/custom-views/approval-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, rule: payload }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Hata')
      setRules(d.rules || [])
    } catch (e) { setError(e.message) }
    setBusy(false)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (editingId) {
      await send('update', { ...draft, id: editingId })
    } else {
      await send('create', draft)
    }
    setDraft(EMPTY); setEditingId(null)
  }

  const startEdit = (r) => { setDraft({ ...r }); setEditingId(r.id) }
  const cancelEdit = () => { setDraft(EMPTY); setEditingId(null) }
  const remove = (id) => send('delete', { id })

  return (
    <div data-testid="approval-rules-editor" className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-base font-semibold text-slate-800">Onay Kuralları Düzenleyicisi</h3>

      <form onSubmit={submit} className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-6">
        <input
          className="md:col-span-2 rounded border border-slate-300 px-2 py-1 text-sm"
          placeholder="Kural adı"
          value={draft.name}
          onChange={e => setDraft({ ...draft, name: e.target.value })}
          required
        />
        <input
          type="number"
          className="rounded border border-slate-300 px-2 py-1 text-sm"
          placeholder="Eşik (TRY)"
          value={draft.threshold_try}
          onChange={e => setDraft({ ...draft, threshold_try: Number(e.target.value) })}
        />
        <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={draft.requires_pm} onChange={e => setDraft({ ...draft, requires_pm: e.target.checked })} />PM</label>
        <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={draft.requires_director} onChange={e => setDraft({ ...draft, requires_director: e.target.checked })} />Direktör</label>
        <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={draft.requires_cfo} onChange={e => setDraft({ ...draft, requires_cfo: e.target.checked })} />CFO</label>
        <div className="md:col-span-6 flex gap-2">
          <button type="submit" disabled={busy} className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {editingId ? 'Güncelle' : 'Ekle'}
          </button>
          {editingId && (
            <button type="button" onClick={cancelEdit} className="rounded border px-3 py-1 text-sm">İptal</button>
          )}
        </div>
      </form>

      {error && <div className="mb-2 text-xs text-red-600">{error}</div>}

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-500">
            <th className="py-1">Ad</th>
            <th>Eşik (TRY)</th>
            <th>PM</th>
            <th>Dir.</th>
            <th>CFO</th>
            <th>Aktif</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rules.map(r => (
            <tr key={r.id} className="border-t border-slate-100">
              <td className="py-1">{r.name}</td>
              <td>{r.threshold_try.toLocaleString('tr-TR')}</td>
              <td>{r.requires_pm ? '✓' : ''}</td>
              <td>{r.requires_director ? '✓' : ''}</td>
              <td>{r.requires_cfo ? '✓' : ''}</td>
              <td>{r.active ? 'Evet' : 'Hayır'}</td>
              <td className="text-right">
                <button onClick={() => startEdit(r)} className="text-xs text-blue-600 hover:underline mr-2">Düzenle</button>
                <button onClick={() => remove(r.id)} className="text-xs text-red-600 hover:underline">Sil</button>
              </td>
            </tr>
          ))}
          {!rules.length && (
            <tr><td colSpan="7" className="py-3 text-center text-slate-400">Kural yok.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
