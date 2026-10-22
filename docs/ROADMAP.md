# Relay roadmap

Checkboxes describe verified completion, not implementation intent. Tests accompany each feature. Production deployment is deferred.

## M0 — Project contract

- [x] Product scope, architecture, security boundaries, Git rules, and milestone acceptance recorded.
- [x] Existing agent instructions preserved and extended.

Evidence: reviewed against the accepted implementation plan; repository inspected before changes.

## M1 — Foundation

- [x] Windows local PostgreSQL startup, migrations, restart persistence.
- [x] Storage abstraction, idempotent cleanup worker, redacted errors.
- [x] Application shell, unit/integration/browser harnesses, CI configuration.

Evidence: real PostgreSQL stop/start persistence probe and 14 integration tests pass on Windows. Graceful shutdown uses pg_ctl; browser tests own PostgreSQL outside Playwright's process tree.

## M2 — Short Links

- [x] Random/custom codes, URL validation, redirects, safe previews, expiry.
- [x] Aggregate request counts, capability management, disable/delete.
- [x] Copy and local QR generation/download; automated feature coverage.

Evidence: policy/validation tests, PostgreSQL alias races and lifecycle tests, and the production-browser create/preview/QR/manage/disable journey pass.

## M3 — Encrypted Text and Code

- [x] Browser AES-256-GCM; key stays in fragment; encrypted metadata.
- [x] Text/code recipients, passwords, expiry, atomic one-time reveal.
- [x] Management/deletion, privacy and concurrency regression coverage.

Evidence: ciphertext tampering/wrong-key tests, database privacy inspection, concurrent claims, and separate-browser password/one-time/Unicode/code-safety journeys pass.

## M4 — Encrypted Files

- [x] Bounded encrypted upload with progress and safe downloads.
- [x] Encrypted filename/MIME, cleanup/orphan recovery, storage-failure tests.

Evidence: encrypted multipart inspection, byte-exact recipient download, oversized-body rejection, storage traversal/interruption tests, and cleanup retry/orphan tests pass.

## M5 — Complete Experience

- [x] Opt-in IndexedDB history, light/dark themes, responsive polish.
- [x] Keyboard access, accessible errors, RTL/Unicode, reduced motion.
- [x] Automated cross-context journeys, accessibility scans, visual review.

Evidence: 11 production-browser tests pass, including opt-in history/forget/clear, keyboard tabs/dialogs, mobile overflow, clipboard fallback with line breaks, and zero axe violations on the tested light/dark workspace. Desktop/mobile screenshots visually reviewed.

## M6 — Local Release and Deployment Preparation

- [x] Formatting, lint, types, unit/integration/browser suite, production build pass.
- [x] Domain/security coverage: >=90% lines, >=85% branches.
- [x] Docker/Compose, health checks, backup/restore and deployment runbook prepared.
- [x] Container build/smoke verified in CI.
- [x] Milestone branches committed, pushed and integrated after checks.

Release evidence (2026-10-22): 54 unit/component tests, 14 PostgreSQL integration tests, and 11 production Chromium journeys pass locally and in Linux CI. Measured domain/security coverage: 97.72% lines, 96.07% branches. The production build passes a guard excluding local data, Git metadata, test artifacts and secrets. [Final CI run](https://github.com/Reza-HM/URL_Shortener/actions/runs/39838900562) passed both verification and Docker build/lifecycle jobs on source commit `b800624`. Container health, migrations, cleanup process, creation, redirect and deletion were verified in CI because Docker is not installed on this computer. The checked release was fast-forwarded and pushed to `main`; deployment remains deferred.

Development-mode QA: the local workspace retained entered text without refreshes after restricting CSS scanning to application source. Verification servers were shut down gracefully and local development data was preserved.

## M7 — Deployment (deferred)

- [ ] Select host/domain and configure HTTPS.
- [ ] Configure persistent storage, secrets and backups.
- [ ] Deploy and verify external sharing and restore procedure.

## Defaults and boundaries

- Next.js/TypeScript, PostgreSQL/Drizzle; one Node app and a cleanup worker.
- Anonymous capabilities, no accounts or public listing.
- Text/code <=1 MiB; one file <=25 MiB (configurable).
- Drop expiry: 5m/1h/24h/7d, default 24h. Links default to no expiry.
- One-time access is consumed before delivery; interruptions can lose a drop.
- Passwords are a server access gate, independent of browser encryption.
- No scheduled unlocking, bundles, collaborative editing, destination fetching or remote previews.
- Localhost links require a reachable running server. Real external sharing waits for deployment.
