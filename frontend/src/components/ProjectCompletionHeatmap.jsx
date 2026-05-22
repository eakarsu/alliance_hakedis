import { useEffect, useState } from 'react'

function bucketColor(pct) {
  if (pct < 25) return '#fee2e2'
  if (pct < 50) return '#fde68a'
  if (pct < 75) return '#bbf7d0'
  return '#34d399'
}

export default function ProjectCompletionHeatmap() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetch('/api/custom-views/heatmap')
      .then(r => r.json())
      .then(d => { if (alive) { setData(d); setLoading(false) } })
      .catch(e => { if (alive) { setError(e.message); setLoading(false) } })
    return () => { alive = false }
  }, [])

  if (loading) return <div className="p-4 text-sm text-slate-500">Yükleniyor...</div>
  if (error) return <div className="p-4 text-sm text-red-600">Hata: {error}</div>
  if (!data?.rows?.length) return <div className="p-4 text-sm">Veri yok.</div>

  return (
    <div data-testid="completion-heatmap" className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-base font-semibold text-slate-800">Proje Tamamlanma Isı Haritası (% Tamamlanma)</h3>
      <div className="overflow-x-auto">
        <table className="text-xs">
          <thead>
            <tr>
              <th className="px-2 py-1 text-left text-slate-600">Proje</th>
              {data.periods.map(p => (
                <th key={p} className="px-1 py-1 text-center text-slate-600">{p.slice(2)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map(row => (
              <tr key={row.project_id}>
                <td className="whitespace-nowrap px-2 py-1 text-slate-700">{row.project_name}</td>
                {row.cells.map(c => (
                  <td key={c.period} className="px-1 py-1 text-center"
                      title={`${row.project_name} ${c.period}: ${c.pct_complete}%`}
                      style={{ background: bucketColor(c.pct_complete), width: 42 }}>
                    {Math.round(c.pct_complete)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex gap-3 text-xs">
        {data.legend.map(l => (
          <div key={l.range} className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded" style={{ background: l.color }} />
            <span>{l.range}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
