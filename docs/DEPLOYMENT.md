# Deployment runbook — prepared, not deployed

Relay currently targets local development. Docker packaging is for a later single-host deployment with persistent PostgreSQL and encrypted-payload volumes. No hosting resources, public domain or TLS certificates have been provisioned.

## Local operation

1. Install Node.js 24 and pnpm 11, then `pnpm install`.
2. Run `pnpm dev`. It creates a random, ignored local DB password, starts PostgreSQL on 127.0.0.1:55432, runs migrations, starts the web app on localhost:3000, and runs cleanup each minute.
3. Stop with Ctrl+C. Both the cluster and payloads persist in `.local/`.

Integration tests use a separate cluster on port 55433; browser tests use 55434 and web port 3100. Stop the development supervisor before browser tests or production builds because Next.js shares its build directory. `RELAY_TEST_DATABASE_URL` explicitly selects an external **disposable test database**; the test harness truncates share/rate tables. Never point it at development or production data.

`pnpm test:e2e` builds the production application, checks that private local files are absent from its traces, and tests that build. Its outer supervisor owns PostgreSQL separately from Playwright's web server so Windows process-tree cleanup cannot strand database workers. Local clusters shut down with PostgreSQL's graceful control command.

The first install approves only the named PostgreSQL hydration scripts and the bundled toolchain build scripts. The embedded database launcher is development/test tooling, not the production database service. It never requests creation of an OS database user.

## Later Docker launch

Set these in a private, untracked environment file or your secret manager:

```dotenv
POSTGRES_PASSWORD=<random database password, URL-encode special characters in DATABASE_URL if using an external database>
RATE_LIMIT_SECRET=<at least 32 random characters>
APP_ORIGIN=https://your-relay-domain.example
TRUST_PROXY=1
```

Prefer hex-generated passwords in Compose, since its database URL embeds the password. `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` generates a suitable value. Do not save secrets to tracked files or shell history.

Run `docker compose --env-file <private-file> up --build -d`. The migration job must succeed before the web and cleanup services start. `/api/health` verifies PostgreSQL and writable storage. The app runs as a non-root user and binds only host loopback by default.

Place an HTTPS reverse proxy in front of loopback port 3000. It must overwrite `X-Forwarded-For` rather than append untrusted values before `TRUST_PROXY=1` is enabled. Allow bounded uploads slightly above `MAX_FILE_BYTES` for encryption/multipart overhead (at least 64 KiB). Set finite read/upload timeouts, prevent public access to database ports and payload storage, and disable sensitive URL/body/header logging. Browser crypto and clipboard features require HTTPS outside localhost.

Do not deploy with a changing `APP_ORIGIN`. It is the exact allowed browser origin. Keep a stable random `RATE_LIMIT_SECRET`; it pseudonymizes rate-limit identities. With `TRUST_PROXY=0`, clients share a single conservative rate-limit bucket. Creation allows 60/hour per bucket, metadata 300/minute, management 120/minute, and reveal attempts 20/15 minutes per share and bucket. These are request counts, not identity guarantees.

## Migrations and upgrades

- Back up before upgrading. Pull/build a specific Git commit and stop web/cleanup writers during a schema-changing deployment.
- Apply ordered, transactional migrations with `pnpm db:migrate` or the Compose migration job. A database advisory lock serializes migrations.
- Start one web instance and one cleanup worker with the persistent volumes. Check health and run a synthetic create/reveal/delete flow. Do not log its management URL or encryption key.
- Roll back application images only when compatible with the installed schema. Restore a backup for incompatible schema rollbacks; never automatically run destructive reverse migrations.

## Backup and restore

Use PostgreSQL's `pg_dump -Fc` for a database backup and a filesystem/volume snapshot for encrypted payloads. For a consistent pair, briefly stop app and cleanup writers while taking both. Keep backups encrypted, access-controlled, and subject to an explicit retention period; they contain URL destinations, hashes and lifecycle metadata even though drop content is encrypted.

To restore, use a fresh private database and payload volume. Restore the DB with `pg_restore --no-owner` and restore the matching payload snapshot under the non-root app user's ownership. Configure secrets/origin, apply any pending compatible migrations, then start cleanup before accepting traffic. Expiry is enforced on reads, and cleanup removes expired/deleted/consumed files. Test restore with synthetic shares and confirm their expected lifecycle state.

Deletion immediately blocks future API access and eventually removes live ciphertext. It does not erase recipients' copies, forensic filesystem remnants or older backups. Never promise secure erasure. A restored older snapshot can also restore older lifecycle state; do not reopen a public service from such a snapshot without reconciling consumed/deleted records against a newer backup or deletion ledger. If that state is unavailable, invalidate restored drops before accepting traffic.

## Operations and scale

Monitor health failures, safe aggregate error counts, cleanup retries, disk space and PostgreSQL capacity. There is no public admin dashboard and no plaintext content moderation or malware inspection; encrypted files must never be advertised as verified safe.

The filesystem adapter initially supports a single host. PostgreSQL already supports multiple application processes, but moving to multiple hosts requires shared object storage and testing its one-time/cleanup behavior. An S3 adapter, larger streaming uploads, accounts, and scheduled unlock are future work. Public anonymous file hosting also needs an operational abuse/takedown process and capacity controls before launch.
