- Keep `main` stable; use milestone branches such as `feat/relay-foundation` and `feat/relay-short-links`.
- Make focused Conventional Commits. Commit migrations, lockfiles, tests, and related documentation together.
- Push milestone branches; after required checks pass, integrate into `main` and push it. Honor any repository protection rules.
- Never force-push, discard unrelated work, or commit credentials, local databases, uploads, or generated reports.
- Add behavioral and regression tests with changes. Never claim verification that was not run.
- Keep browser secrets out of server modules and maintain the encryption boundary.
- Validate inputs at server boundaries and use transactions for lifecycle transitions.
- Update roadmap checkboxes and validation evidence in the milestone completion commit.
- Document environment changes and keep development/test data separate.
- Work locally now; keep actual production deployment deferred.

## Relay development contract

- Use Node.js 24, pnpm, TypeScript, Next.js Node route handlers, Drizzle and PostgreSQL.
- Keep UI, shared validation, domain logic, database/storage, and browser cryptography separate.
- Use `pnpm check`, `pnpm test`, `pnpm test:integration`, `pnpm test:e2e`, and `pnpm build` as release gates. Domain/security coverage must reach 90% lines and 85% branches.
- Run browser tests through `pnpm test:e2e`; its supervisor owns PostgreSQL outside Playwright's web-server tree. Do not force-kill local PostgreSQL workers on Windows. Use the launcher's graceful pg_ctl shutdown.
- Stop the development server before production builds or browser tests because they share Next.js build output. `pnpm typecheck` generates route types first; keep generated `next-env.d.ts` untracked.
- Keep the production build privacy guard enabled. Runtime payload/database directories must never be included in standalone output or Docker build context.
- Every documented behavior needs a behavioral test; critical security and concurrency failures need explicit regressions. Record actual command results in docs/ROADMAP.md.
- Never send decryption keys or unencrypted drop metadata to the server. Do not add third-party scripts to recipient pages.
- Store only hashes of management capabilities/passwords. Never log request bodies, Authorization headers, full private URLs, or raw IP addresses.
- Expiration is checked on access. One-time claims must be atomic in PostgreSQL; previews and GET requests must never consume drops.
- Never render uploaded HTML or execute uploaded files. Keep payloads outside public assets and validate storage identifiers.
- Default device history to off. Document that it contains secret capabilities when enabled.
- Bind local services to loopback. Keep integration/browser databases and storage separate from development data; never reset a user database for testing.
- Preserve the user-authored rules above. Check Git status before editing and avoid blanket staging of unrelated files.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
