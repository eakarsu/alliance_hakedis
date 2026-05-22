import { useState } from 'react'

export default function HakedisReportPdfPanel() {
  const [status, setStatus] = useState('')

  const openPdf = () => {
    setStatus('PDF açılıyor...')
    window.open('/api/custom-views/report.pdf', '_blank', 'noopener')
    setTimeout(() => setStatus('PDF yeni sekmede açıldı.'), 400)
  }

  const downloadPdf = async () => {
    try {
      setStatus('İndiriliyor...')
      const r = await fetch('/api/custom-views/report.pdf')
      if (!r.ok) throw new Error('HTTP ' + r.status)
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'hakedis-report.pdf'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setStatus('İndirildi.')
    } catch (e) {
      setStatus('Hata: ' + e.message)
    }
  }

  return (
    <div data-testid="hakedis-pdf" className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="mb-2 text-base font-semibold text-slate-800">Hakediş Raporu (PDF)</h3>
      <p className="mb-3 text-sm text-slate-600">
        Aktif tüm hakediş projeleri için TRY bazlı toplu rapor. Tek tıkla PDF olarak indirilebilir veya yeni sekmede açılabilir.
      </p>
      <div className="flex gap-2">
        <button
          onClick={openPdf}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          PDF'i Aç
        </button>
        <button
          onClick={downloadPdf}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          İndir
        </button>
      </div>
      {status && <div className="mt-3 text-xs text-slate-500">{status}</div>}
    </div>
  )
}
