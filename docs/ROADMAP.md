# Relay roadmap

Checkboxes describe verified completion, not implementation intent. Tests accompany each feature. Production deployment is deferred.

## M0 — Project contract
- [x] Product scope, architecture, security boundaries, Git rules, and milestone acceptance recorded.
- [x] Existing agent instructions preserved and extended.

Evidence: reviewed against the accepted implementation plan; repository inspected before changes.

## M1 — Foundation
- [ ] Windows local PostgreSQL startup, migrations, restart persistence.
- [ ] Storage abstraction, idempotent cleanup worker, redacted errors.
- [ ] Application shell, unit/integration/browser harnesses, CI.

## M2 — Short Links
- [ ] Random/custom codes, URL validation, redirects, safe previews, expiry.
- [ ] Aggregate request counts, capability management, disable/delete.
- [ ] Copy and local QR generation/download; automated feature coverage.

## M3 — Encrypted Text and Code
- [ ] Browser AES-256-GCM; key stays in fragment; encrypted metadata.
- [ ] Text/code recipients, passwords, expiry, atomic one-time reveal.
- [ ] Management/deletion, privacy and concurrency regression coverage.

## M4 — Encrypted Files
- [ ] Bounded encrypted upload with progress and safe downloads.
- [ ] Encrypted filename/MIME, cleanup/orphan recovery, storage-failure tests.

## M5 — Complete Experience
- [ ] Opt-in IndexedDB history, light/dark themes, responsive polish.
- [ ] Keyboard access, accessible errors, RTL/Unicode, reduced motion.
- [ ] Automated cross-context journeys, accessibility scans, visual review.

## M6 — Local Release and Deployment Preparation
- [ ] Formatting, lint, types, unit/integration/browser suite, production build pass.
- [ ] Domain/security coverage: >=90% lines, >=85% branches.
- [ ] Docker/Compose, health checks, backup/restore and deployment runbook.
- [ ] Container build/smoke verified in CI.
- [ ] Milestone branches committed, pushed and integrated after checks.

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
