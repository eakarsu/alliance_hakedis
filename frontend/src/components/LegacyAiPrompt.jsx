import { useState } from 'react';
import AIReport from './AIReport';

export default function LegacyAiPrompt({ title, endpoint }) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const examples = [
    { label: 'Partner review', text: `Prepare a ${title.toLowerCase()} review for an alliance with two delivery partners. One partner owns client discovery and the other owns implementation. Identify missing evidence, approval dependencies, risks, and a practical next step. Treat this as an example, not a real deal.` },
    { label: 'Finance review', text: `Assess ${title.toLowerCase()} for a proposed engagement with a constrained margin, an unresolved payment schedule, and an unapproved scope change. List assumptions, options for finance review, and controls needed before any decision. No real account or transaction is supplied.` },
    { label: 'Operations review', text: `Analyze ${title.toLowerCase()} for a team facing a two-week delivery target, one unavailable approver, and incomplete handoff notes. Prioritize the evidence to collect, likely bottlenecks, accountable roles, and escalation steps. Do not infer a real record ID.` },
  ];

  const run = async () => {
    if (!input.trim() || loading) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ prompt: input }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Request failed');
      setResult(data);
    } catch (failure) { setError(failure.message || 'Request failed'); }
    finally { setLoading(false); }
  };

  return <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
    <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>{title}</h1>
    <p>Review the example and supply any genuine records or evidence before generating.</p>
    <div className="ai-actions" aria-label="Example prompts">{examples.map((example) => <button key={example.label} type="button" className="btn btn-secondary" disabled={loading} onClick={() => { setInput(example.text); setResult(null); setError(''); }}>{example.label}</button>)}</div>
    <textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="Describe what you need..." rows={6} style={{ width: '100%', padding: 12, border: '1px solid #ccc', borderRadius: 6, marginBottom: 12 }} />
    <button type="button" className="btn btn-primary" onClick={run} disabled={loading || !input.trim()}>{loading ? 'Running...' : 'Run AI'}</button>
    {error && <p role="alert">{error}</p>}
    <AIReport response={result} title={title} />
  </div>;
}
