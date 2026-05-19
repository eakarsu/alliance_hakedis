// Custom Views: Hakedis (Turkish progress payment) management features
// - 2 VIZ endpoints: progress-payment timeline + project completion heatmap
// - 2 NON-VIZ endpoints: hakedis report PDF + approval rules editor CRUD
const express = require('express');
const router = express.Router();

// In-memory approval rules store (no schema changes required)
let approvalRules = [
  { id: 1, name: 'Auto-approve under 50k', threshold_try: 50000, requires_pm: false, requires_director: false, requires_cfo: false, active: true },
  { id: 2, name: 'PM signoff 50k-250k', threshold_try: 250000, requires_pm: true, requires_director: false, requires_cfo: false, active: true },
  { id: 3, name: 'Director above 250k', threshold_try: 1000000, requires_pm: true, requires_director: true, requires_cfo: false, active: true },
  { id: 4, name: 'CFO sign for 1M+', threshold_try: 999999999, requires_pm: true, requires_director: true, requires_cfo: true, active: true },
];
let nextRuleId = 5;

// Helper: deterministic synthetic hakedis dataset based on project list
function syntheticProjects() {
  return [
    { id: 'P-101', name: 'Anadolu Otoyolu Faz-2', total_try: 12500000, start: '2025-09-01', months: 9 },
    { id: 'P-102', name: 'Marmara Liman Genişleme', total_try: 8750000, start: '2025-11-01', months: 8 },
    { id: 'P-103', name: 'Ankara Metro M5', total_try: 21000000, start: '2025-07-01', months: 12 },
    { id: 'P-104', name: 'İzmir HES Modernizasyon', total_try: 5300000, start: '2026-01-01', months: 6 },
    { id: 'P-105', name: 'Adana Lojistik Terminali', total_try: 6900000, start: '2025-12-01', months: 7 },
  ];
}

// 1. VIZ: progress-payment timeline (monthly hakedis amounts per project)
router.get('/timeline', (req, res) => {
  try {
    const projects = syntheticProjects();
    const series = projects.map(p => {
      const start = new Date(p.start);
      const monthly = [];
      let cumulative = 0;
      // S-curve style distribution
      const weights = [];
      let total = 0;
      for (let i = 0; i < p.months; i++) {
        const x = (i + 0.5) / p.months;
        const w = Math.sin(Math.PI * x); // bell curve
        weights.push(w); total += w;
      }
      for (let i = 0; i < p.months; i++) {
        const amount = Math.round((weights[i] / total) * p.total_try);
        cumulative += amount;
        const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
        monthly.push({
          period: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
          amount_try: amount,
          cumulative_try: cumulative,
          pct_complete: Math.round((cumulative / p.total_try) * 1000) / 10,
        });
      }
      return { project_id: p.id, project_name: p.name, total_try: p.total_try, monthly };
    });
    res.json({
      currency: 'TRY',
      generated_at: new Date().toISOString(),
      projects: series,
    });
  } catch (e) {
    console.error('timeline error:', e);
    res.status(500).json({ error: e.message });
  }
});

// 2. VIZ: project completion heatmap (% complete x project x month)
router.get('/heatmap', (req, res) => {
  try {
    const projects = syntheticProjects();
    // Build a 6-month sliding window centered on now
    const now = new Date();
    const cols = [];
    for (let i = -3; i <= 8; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      cols.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    const matrix = projects.map(p => {
      const start = new Date(p.start);
      const startKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
      const row = { project_id: p.id, project_name: p.name, cells: [] };
      let cum = 0;
      for (const col of cols) {
        const [yy, mm] = col.split('-').map(Number);
        const colDate = new Date(yy, mm - 1, 1);
        const monthsFromStart = (colDate.getFullYear() - start.getFullYear()) * 12 + (colDate.getMonth() - start.getMonth());
        let pct = 0;
        if (monthsFromStart < 0) pct = 0;
        else if (monthsFromStart >= p.months) pct = 100;
        else {
          // cumulative bell-curve percent
          let total = 0, accum = 0;
          for (let j = 0; j < p.months; j++) {
            const w = Math.sin(Math.PI * ((j + 0.5) / p.months));
            total += w;
            if (j <= monthsFromStart) accum += w;
          }
          pct = Math.round((accum / total) * 1000) / 10;
        }
        row.cells.push({ period: col, pct_complete: pct });
      }
      return row;
    });
    res.json({
      generated_at: new Date().toISOString(),
      periods: cols,
      rows: matrix,
      legend: [
        { range: '0-25%', color: '#fee2e2' },
        { range: '25-50%', color: '#fde68a' },
        { range: '50-75%', color: '#bbf7d0' },
        { range: '75-100%', color: '#34d399' },
      ],
    });
  } catch (e) {
    console.error('heatmap error:', e);
    res.status(500).json({ error: e.message });
  }
});

// 3. NON-VIZ: hakedis report PDF (returns minimal valid PDF stream)
router.get('/report.pdf', (req, res) => {
  try {
    const projects = syntheticProjects();
    const totalTry = projects.reduce((s, p) => s + p.total_try, 0);
    const lines = [];
    lines.push('HAKEDIS RAPORU - ALLIANCE');
    lines.push(`Tarih: ${new Date().toISOString().slice(0, 10)}`);
    lines.push(`Proje sayisi: ${projects.length}`);
    lines.push(`Toplam sozlesme bedeli: ${totalTry.toLocaleString('tr-TR')} TRY`);
    lines.push('');
    projects.forEach(p => {
      lines.push(`${p.id}  ${p.name}  ${p.total_try.toLocaleString('tr-TR')} TRY  ${p.months} ay`);
    });

    // Build a minimal one-page PDF (text content stream)
    const escape = s => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    let textOps = 'BT /F1 12 Tf 50 780 Td 14 TL\n';
    lines.forEach((ln, idx) => {
      if (idx === 0) textOps += `(${escape(ln)}) Tj\n`;
      else textOps += `T* (${escape(ln)}) Tj\n`;
    });
    textOps += 'ET';

    const content = textOps;
    const contentLen = Buffer.byteLength(content, 'latin1');

    const objects = [];
    objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
    objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
    objects.push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n');
    objects.push(`4 0 obj\n<< /Length ${contentLen} >>\nstream\n${content}\nendstream\nendobj\n`);
    objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');

    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    for (const obj of objects) {
      offsets.push(Buffer.byteLength(pdf, 'latin1'));
      pdf += obj;
    }
    const xrefStart = Buffer.byteLength(pdf, 'latin1');
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= objects.length; i++) {
      pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

    const buf = Buffer.from(pdf, 'latin1');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="hakedis-report.pdf"');
    res.setHeader('Content-Length', buf.length);
    res.status(200).end(buf);
  } catch (e) {
    console.error('report.pdf error:', e);
    res.status(500).json({ error: e.message });
  }
});

// 4. NON-VIZ: approval rules editor (CRUD via single endpoint)
//    GET   ?action=list   -> list
//    POST  body { action: 'create'|'update'|'delete', rule }
router.get('/approval-rules', (req, res) => {
  try {
    res.json({ rules: approvalRules });
  } catch (e) {
    console.error('approval-rules GET error:', e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/approval-rules', (req, res) => {
  try {
    const { action, rule } = req.body || {};
    if (!action) return res.status(400).json({ error: 'action required (create|update|delete)' });

    if (action === 'create') {
      if (!rule || !rule.name) return res.status(400).json({ error: 'rule.name required' });
      const newRule = {
        id: nextRuleId++,
        name: String(rule.name),
        threshold_try: Number(rule.threshold_try) || 0,
        requires_pm: !!rule.requires_pm,
        requires_director: !!rule.requires_director,
        requires_cfo: !!rule.requires_cfo,
        active: rule.active !== false,
      };
      approvalRules.push(newRule);
      return res.json({ ok: true, rule: newRule, rules: approvalRules });
    }
    if (action === 'update') {
      if (!rule || !rule.id) return res.status(400).json({ error: 'rule.id required' });
      const idx = approvalRules.findIndex(r => r.id === Number(rule.id));
      if (idx < 0) return res.status(404).json({ error: 'rule not found' });
      approvalRules[idx] = { ...approvalRules[idx], ...rule, id: approvalRules[idx].id };
      return res.json({ ok: true, rule: approvalRules[idx], rules: approvalRules });
    }
    if (action === 'delete') {
      if (!rule || !rule.id) return res.status(400).json({ error: 'rule.id required' });
      approvalRules = approvalRules.filter(r => r.id !== Number(rule.id));
      return res.json({ ok: true, rules: approvalRules });
    }
    return res.status(400).json({ error: 'unknown action' });
  } catch (e) {
    console.error('approval-rules POST error:', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
