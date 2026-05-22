import { useEffect, useState } from 'react'

export default function HakedisTimelineChart() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetch('/api/custom-views/timeline')
      .then(r => r.json())
      .then(d => { if (alive) { setData(d); setLoading(false) } })
      .catch(e => { if (alive) { setError(e.message); setLoading(false) } })
    return () => { alive = false }
  }, [])

  if (loading) return <div className="p-4 text-sm text-slate-500">Yükleniyor...</div>
  if (error) return <div className="p-4 text-sm text-red-600">Hata: {error}</div>
  if (!data?.projects?.length) return <div className="p-4 text-sm">Veri yok.</div>

  const allMonths = Array.from(new Set(data.projects.flatMap(p => p.monthly.map(m => m.period)))).sort()
  const maxAmount = Math.max(...data.projects.flatMap(p => p.monthly.map(m => m.amount_try)))
  const palette = ['#2563eb', '#16a34a', '#dc2626', '#9333ea', '#ea580c']

  return (
    <div data-testid="hakedis-timeline" className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-base font-semibold text-slate-800">Hakediş Ödeme Zaman Çizelgesi (Aylık, TRY)</h3>
      <div className="overflow-x-auto">
        <svg width={Math.max(680, allMonths.length * 60 + 60)} height={260}>
          {/* axes */}
          <line x1="40" y1="220" x2={Math.max(680, allMonths.length * 60 + 60) - 10} y2="220" stroke="#94a3b8" />
          <line x1="40" y1="20" x2="40" y2="220" stroke="#94a3b8" />
          {data.projects.map((p, pi) => {
            const points = p.monthly.map(m => {
              const x = 40 + allMonths.indexOf(m.period) * 60 + 30
              const y = 220 - (m.amount_try / maxAmount) * 190
              return `${x},${y}`
            }).join(' ')
            return <polyline key={p.project_id} points={points} fill="none" stroke={palette[pi % palette.length]} strokeWidth="2" />
          })}
          {allMonths.map((m, i) => (
            <text key={m} x={40 + i * 60 + 30} y={235} fontSize="9" textAnchor="middle" fill="#475569">{m}</text>
          ))}
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs">
        {data.projects.map((p, pi) => (
          <div key={p.project_id} className="flex items-center gap-1">
            <span className="inline-block h-2 w-4 rounded" style={{ background: palette[pi % palette.length] }} />
            <span>{p.project_name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
