# Relay

Short links. Private drops. Less in the way.

Relay combines manageable short URLs with anonymous, browser-encrypted text, code and file sharing. No account required. Development is local; production deployment is deliberately deferred.

## Development

Requires Node.js 24 and pnpm. On Windows, `pnpm dev` runs a project-local PostgreSQL cluster rather than installing a Windows service. A first install downloads the database binary and dependencies.

```sh
pnpm install
pnpm dev
```

Open http://localhost:3000. The supervisor starts PostgreSQL, applies migrations, starts Next.js and runs cleanup. Stop it with Ctrl+C. Local data persists under ignored `.local/`. Use `DATABASE_URL` to connect an existing PostgreSQL server instead. Copy `.env.example` to `.env.local` for optional settings.

```sh
pnpm check             # formatting, lint, types
pnpm test              # unit tests and coverage
pnpm test:integration  # real, isolated PostgreSQL tests
pnpm test:e2e          # browser journeys (install Chromium first)
pnpm build
```

## Architecture

Next.js App Router and React form a single TypeScript application. Route handlers validate inputs with Zod; domain services use Drizzle and PostgreSQL. Ciphertext lives in a private filesystem store behind a storage interface. A separate idempotent worker removes expired, consumed and orphaned payloads. No destination URLs are fetched by the server.

Short links use `/s/{code}`; recipient drops use `/d/{id}#key=…`; private management uses `/manage/{id}#token=…`. Share management uses independent bearer capabilities whose hashes are stored server-side.

## Privacy boundaries

Private Drops encrypt content and filenames in the browser with AES-256-GCM. Their keys stay in URL fragments and never enter server requests. Optional passwords are an additional server access gate, stored as Argon2id hashes; they do not replace encryption. Anyone with the full link can decrypt an unprotected drop. There is no recovery for a lost key.

Recipients can retain revealed content. Encryption cannot protect a compromised browser or maliciously modified application JavaScript. Servers see metadata such as ciphertext size and expiry. One-time drops are consumed before transmission, so interrupted delivery can still consume them. Expiration denies access immediately; disk removal happens asynchronously and backups have their own retention.

Device history is explicitly opt-in and stores full links and management capabilities in this browser. It is unsuitable for a shared browser. No third-party scripts or analytics are used on recipient pages.

See [the roadmap](docs/ROADMAP.md) for checked completion evidence and [the deployment runbook](docs/DEPLOYMENT.md) for later hosting.
