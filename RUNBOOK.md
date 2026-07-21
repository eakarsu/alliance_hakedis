# Governed hakediş operations runbook

## Supported journey and acceptance

The primary user is a contractor or alliance partner submitting a progress-payment (`hakediş`) claim. A claim is accepted only with an ordered service period, exact integer minor-unit amount, line items that total the claim, retention in basis points, and checksum-bound HTTPS or vault evidence. The authoritative journey is `draft -> measurement_review -> finance_review -> payable -> paid`. A verifier independently approves measured work, finance independently authorizes the retained net amount, and `paid` is reachable only after the typed payment provider returns a receipt bound to the exact payload hash.

The supported API is `/api/v1/hakedis`; legacy demo CRUD, generated gap routes, custom visualizations, and generic AI routes return `410`. Identity comes from an upstream issuer: HS256 tokens must use issuer `hakedis-identity`, audience `hakedis-api`, and include `sub`, `tenantId`, and `role`. Provision the same subject, tenant, and canonical role in `hakedis_memberships`. There are no demo credentials.

Acceptance is the database-backed HTTP journey in `backend/test/hakedis.database.test.js`: exact retention math, stage-bound one-use approvals, separation of duties, idempotency conflict detection, tenant and suspended-member denial, typed provider failure and success, receipt persistence, monitoring, audit, and append-only enforcement.

## Verify, migrate, and start

Use Node 22 and PostgreSQL 16. Install both lockfiles with `npm ci`. Copy `.env.example` into an ignored local environment or deployment secret store and replace every placeholder.

```sh
./start.sh check
```

Back up PostgreSQL and review the additive migration before deployment. Schema change is an explicit, guarded release action:

```sh
ALLOW_SCHEMA_MIGRATION=1 ./start.sh migrate
./start.sh start
```

`start` runs a single foreground API on `127.0.0.1`; it never kills processes, installs dependencies, starts system services, creates database roles/databases, migrates, resets, or seeds. Put authenticated TLS ingress in front and set exact CORS origins. Readiness checks the governed tables before admitting traffic.

Rollback the application first. The migration is additive, so the previous release can ignore its tables. Do not drop claim, approval, receipt, event, or audit data during rollback. Any later removal requires a separately approved retention/export migration.

## Payment delivery and monitoring

Only `payment/payout.create` and `notification/claim.status` are valid outbound contracts. Every call is HTTPS, time-bounded, retried at most three immediate times, carries an idempotency key and payload hash, and accepts a success only when the provider receipt repeats that hash. Workflow-level retry is bounded; terminal and exhausted failures are retained as `dead_letter` with an immutable audit entry. Inspect `/api/v1/hakedis/monitoring`, resolve the provider or beneficiary-reference issue, and create a new idempotent disbursement only while the claim remains payable.

Monitor live/ready health, age in review states, pending approvals, queued retries, dead letters, provider latency/error rate, and audit-write failure. Page on readiness or audit failure and sustained dead-letter growth. Never log tokens, beneficiary details, evidence content, or full claim payloads.

## Backup, recovery, and incident response

Create encrypted `pg_dump` backups under the organization's retention policy. Restore only into an isolated database, replay the migration, run the database journey, compare claim/event/approval/job/receipt counts and sampled hashes, and obtain finance approval before declaring recovery. Never restore over production.

Rotate JWT and provider secrets through the secret store. JWT rotation invalidates outstanding tokens and must be coordinated with the issuer. On payment or credential incidents, revoke provider access, suspend memberships, preserve audit/receipt evidence, reconcile provider references outside this service, and notify affected tenants under policy. Reachable Git history contains no tracked root or backend `.env`; ignored local files were not opened and should be rotated if their origin is uncertain.
