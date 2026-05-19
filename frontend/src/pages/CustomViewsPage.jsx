import HakedisTimelineChart from '../components/HakedisTimelineChart'
import ProjectCompletionHeatmap from '../components/ProjectCompletionHeatmap'
import HakedisReportPdfPanel from '../components/HakedisReportPdfPanel'
import ApprovalRulesEditor from '../components/ApprovalRulesEditor'

export default function CustomViewsPage() {
  return (
    <div data-testid="custom-views-page" className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-800">Hakediş Görünümleri</h1>
        <p className="text-sm text-slate-500">Hakediş ödemeleri, proje tamamlanma ve onay kuralları için özel görünümler.</p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <HakedisTimelineChart />
        <ProjectCompletionHeatmap />
        <HakedisReportPdfPanel />
        <ApprovalRulesEditor />
      </div>
    </div>
  )
}
