# Audit Apply Notes — alliance_hakedis

Source: `_AUDIT/reports/batch_09.md` § alliance_hakedis

## Original audit recommendations

### Missing AI counterparts
- Workflow automation
- Economics optimization
- Deal structure recommendations
- Payout prediction
- Governance exception handling

### Missing non-AI features
- Multi-level governance approvals (board + CFO)
- Audit reporting
- Contract version control

### Custom feature ideas
- Split-structure optimization
- Approval workflow prediction (likely bottlenecks)
- Economic scenario modelling (what-if)
- Partner performance dashboards with anomaly alerts
- Automated payout reconciliation with dispute detection
- Integration with ERP for revenue recognition
- Governance exception management with AI routing
- Strategic partner recommendation based on capability gaps

## Implemented this pass

All implemented in `backend/routes/ai.js`, mounted under `/api/ai`:

- `POST /api/ai/optimize-economics` — pulls opportunity + economics rows + split templates and asks the LLM for a recommended split with rationale, guardrails, warnings. Mechanical implementation of "economics optimization" + "split-structure optimization".
- `POST /api/ai/predict-bottleneck` — pulls a workflow instance (and its template), asks the LLM for likely bottleneck steps + delay hours + mitigations. Mechanical implementation of "approval workflow prediction (likely bottlenecks)".
- `POST /api/ai/governance-exception` — accepts an exception request and optional entity ref, returns JSON verdict + required approvers + conditions. Mechanical implementation of "governance exception handling" / "governance exception management with AI routing".

All three reuse existing helpers (`callOpenRouter`, `auth`, `canAccessRecord`, `isRestricted`) so they match the surrounding style. DB queries are wrapped in try/catch so missing tables (e.g. `economics`, `split_templates`, `approval_workflow_instances`) do not break the endpoints in environments without them. Syntax-checked with `node --check`.

## Backlog (not implemented)

### Needs product decision
- Workflow automation — needs catalog of which steps can auto-execute and which require human-in-loop.
- Deal structure recommendations — needs definition of allowed structures per pipeline.
- Payout prediction — needs historical payout dataset and a forecasting horizon.
- Strategic partner recommendation engine — capability-gap modelling.
- Partner performance dashboards with anomaly alerts.

### Needs schema/data model work
- Multi-level governance approvals (board + CFO) — needs approval matrix table.
- Audit reporting (period coverage, controls).
- Contract version control (redlines, parties' approvals).
- Automated payout reconciliation with dispute detection — needs payout ledger and dispute states.
- Integration with ERP / revenue recognition.

### Larger AI work
- Economic scenario modelling (what-if Monte Carlo) — out of scope for a chat endpoint.
- Anomaly detection on partner performance — needs feature pipeline.

## Categorisation

- MECHANICAL: economics optimisation endpoint, workflow bottleneck prediction, governance exception routing (all done).
- NEEDS-PRODUCT-DECISION: workflow automation rules, deal-structure rec, payout prediction horizon, strategic partner rec, partner dashboards.
- NEEDS-SCHEMA: governance approval matrix, audit reports, CLM, payout reconciliation, ERP integration.
- TOO-RISKY (this pass): scenario Monte Carlo simulations, ML-based anomaly detection.

## Apply pass 3 (frontend)

- **Action:** LEFT-AS-IS — FE already wired.
- `frontend/src/pages/AIInsights.jsx` exposes the 3 pass-2 endpoints (optimize-economics, predict-bottleneck, governance-exception) via a feature switcher.
- Route registered in `frontend/src/App.jsx` at `/ai-insights` (RoleRoute-protected). JWT via `frontend/src/api/axios.js`.
- `AIAssistant.jsx` covers the older `/analyze` and `/suggest` endpoints.
- No FE files modified.

## Apply pass 4 (mechanical backlog)

- **Action:** SKIPPED — pass-2 already covered every MECHANICAL item (economics optimization, bottleneck prediction, governance exception). Remaining backlog is NEEDS-PRODUCT-DECISION (workflow automation, deal-structure rec, payout prediction, partner rec/dashboards), NEEDS-SCHEMA (multi-level approvals matrix, audit reports, CLM, payout reconciliation, ERP), or TOO-RISKY (Monte-Carlo scenarios, ML anomaly detection).
