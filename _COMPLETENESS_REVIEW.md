# Completeness Review: alliance_hakedis

**Review date:** 2026-07-18

## Assessment basis

Static inspection of project-owned source and configuration only; no dependency installation, build, database migration, external-service call, or runtime launch was performed. The scan considered 186 project files (147 source files), 2 manifest(s), 0 test-like file(s), and 0 CI workflow(s), excluding dependency/generated directories.

## Classification

**Functional but incomplete**

This is a substantive but unfinished application workflow application, not just an empty scaffold. Inspection found 147 source files across `frontend/`, `backend/` using Next.js, React, Express; however, the checked-in workflow and delivery controls do not yet demonstrate a complete, production-operable product.

## Why it is not complete

- Generated gap/visualization routes describe missing capabilities or simulate recommendations; they do not implement the underlying domain operation.
- Generic LLM calls are used as product behavior without enough typed tools, grounded evidence, deterministic rules, or output evaluation.
- Mock, demo, sample, fixture, or placeholder behavior remains in executable/product paths.
- No recognizable project-owned automated tests were found for the main workflow.
- No checked-in CI workflow proves builds, tests, migrations, and security checks on every change.

## Needed features

1. Define the primary user and acceptance criteria, then complete one end-to-end workflow against persistent data instead of demo fixtures.
2. Replace mocks, placeholders, and generic AI responses with validated domain services and explicit failure/retry behavior.
3. Implement secure identity, role/tenant boundaries, input validation, secrets handling, and auditable state changes.
4. Add representative automated tests, CI quality gates, environment documentation, migrations, observability, backup, and deployment configuration.
5. Add risk-based unit, integration, and end-to-end tests in CI, including migration and failure-path coverage.

## Risks or launch blockers

- Credential/configuration exposure: environment files are present in the repository tree and must be checked against Git history and rotated if real.
- Automation contains destructive process, filesystem, or database operations; do not run it on a shared machine without review.
- Startup appears coupled to seed/migration behavior, risking data mutation or non-repeatable launches.
- AI-provider availability, cost, privacy, prompt injection, and unvalidated output are launch risks until bounded and evaluated.

## Evidence inspected

- `frontend/README.md`
- `frontend/src/App.jsx:1`
- `frontend/src/components/ApprovalRulesEditor.jsx:58`
- `backend/server.js`
- `backend/package.json`
- `start.sh`

## Recommended next action

Choose one real application workflow journey, define acceptance criteria and external contracts, then close its persistence, permission, integration, failure, and test gaps before expanding features.

## Implementation progress — 2026-07-19

All source-actionable findings in this review are implemented.

1. `RUNBOOK.md` now defines the primary contractor/partner user and an exact acceptance contract for a progress-payment (`hakediş`) claim. The authoritative `/api/v1/hakedis` flow persists a checksum-evidenced, exact-minor-unit claim and moves it through draft, independent measurement review, independent finance review, payable, and provider-confirmed paid state. Retention uses integer basis points, line items must equal the claimed amount, commands use optimistic versions and request hashes, and approvals are stage-bound and one-use.
2. Legacy demo CRUD, custom-visualization, generated-gap, and generic-LLM routes are excluded from the runtime and return `410`. Deterministic domain code owns claim math and transitions. The only outbound contracts are typed payment and notification operations with HTTPS, timeouts, idempotency, a bounded retry/dead-letter policy, and payload-hash-bound provider receipts; terminal delivery failure remains explicit and audited.
3. Issuer/audience/algorithm-bound JWTs, a strong fail-closed runtime secret, active database memberships, exact role matching, tenant-qualified queries, owner/participant/privileged scope, independent decisions, bounded input collections, immutable events, and immutable audit entries enforce the security boundary. `.env.example` is secret-free, while populated environments remain ignored. Reachable Git history contains no tracked root or backend `.env`; ignored local files were not opened.
4. The replacement `start.sh` exposes only `check`, guarded additive `migrate`, and foreground loopback-only `start`. It does not kill processes, install dependencies, manage system services, create/drop databases or roles, seed, reset, or silently migrate. Destructive legacy schema/seed commands were removed from package scripts. The runbook documents identity provisioning, deployment, health/readiness, monitoring, delivery recovery, secrets/incidents, encrypted backup, isolated restore verification, retention, and application-first rollback. CI provisions PostgreSQL 16, installs lockfiles, replays the migration twice, runs backend tests, builds the UI, audits production dependencies, and checks the launcher.
5. Ten tests cover exact amounts/retention, invalid periods and evidence, deterministic state/role/separation rules, tenant and participant denial, bounded retries, typed provider and receipt validation, migration invariants, route quarantine, and launcher safety. The database-backed HTTP journey additionally proves premature-approval denial, duplicate/conflicting idempotency, two independently approved gates, failed and successful payment dispatch, receipt persistence, paid state, cross-tenant and suspended-member denial, monitoring, consumed approvals, and append-only events.

Local validation passed all 10 tests with the database journey enabled. The additive migration applied three consecutive times to a disposable PostgreSQL cluster, including through the guarded launcher. Backend syntax, frontend production build, `bash -n start.sh`, `git diff --check`, and backend/frontend production dependency audits all passed; both audits report zero vulnerabilities. The isolated database server was stopped and removed, and no shared database was touched.

Remaining launch work requires external authority or infrastructure: provision the production identity issuer and memberships, contract and credential the payment provider, perform provider reconciliation/failure and capacity drills, select financial retention and recovery objectives, and have finance/legal/security owners approve the real payout, evidence, privacy, and incident procedures.

## Runtime verification — 2026-07-20

The safe launcher was verified with disposable PostgreSQL on port `55630` and the API on `6074`. An environment-provisioned administrator was persisted with a bcrypt password hash; `/api/auth/login` returned a signed token and `/api/auth/me` verified that session against the database. The validator recorded `API_VERIFIED / startup_login_session_api`. The maintained checks also passed: nine isolated workflow tests, the frontend production build, and the full PostgreSQL claim journey with the application on `6074` and its mock provider on `6075`. No assigned port remained open afterward.
