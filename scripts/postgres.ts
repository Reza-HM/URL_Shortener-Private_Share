import EmbeddedPostgres from "embedded-postgres";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execute = promisify(execFile);
async function controlBinary() {
  const require = createRequire(import.meta.url);
  const platform = process.platform === "win32" ? "windows" : process.platform;
  const binaryModule = require.resolve(
    `@embedded-postgres/${platform}-${process.arch}`,
    { paths: [path.dirname(require.resolve("embedded-postgres"))] },
  );
  return (await import(pathToFileURL(binaryModule).href)).pg_ctl as string;
}

export async function startPostgres(mode: "dev" | "integration" | "e2e") {
  if (process.env.DATABASE_URL) return { stop: async () => {} };
  const port = mode === "dev" ? 55432 : mode === "integration" ? 55433 : 55434;
  const root = path.resolve(".local", mode);
  await mkdir(root, { recursive: true });
  const secretPath = path.join(root, "password");
  let password: string;
  try {
    password = await readFile(secretPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    password = randomBytes(24).toString("hex");
    await writeFile(secretPath, password, { mode: 0o600, flag: "wx" });
  }
  const databaseDir = path.join(root, "postgres");
  let starting = true;
  const startupMessages: string[] = [];
  const postgres = new EmbeddedPostgres({
    databaseDir,
    user: "relay",
    password,
    port,
    persistent: true,
    authMethod: "scram-sha-256",
    postgresFlags: ["-h", "127.0.0.1"],
    createPostgresUser: false,
    onLog: (message: string) => {
      if (starting) startupMessages.push(message);
    },
    onError: () => {},
  });
  try {
    const version = (
      await readFile(path.join(root, "postgres", "PG_VERSION"), "utf8")
    ).trim();
    if (version !== "18")
      throw new Error(
        "This local cluster needs PostgreSQL 18. Back it up before changing database versions.",
      );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    await postgres.initialise();
  }
  const pgControl = await controlBinary();
  async function running() {
    try {
      await execute(pgControl, ["-D", databaseDir, "status"], {
        windowsHide: true,
      });
      return true;
    } catch (error) {
      if ((error as { code?: number }).code === 3) return false;
      throw error;
    }
  }
  let shutdown: Promise<void> | undefined;
  // Override the launcher's force-kill shutdown with PostgreSQL's graceful,
  // idempotent control interface. Its registered exit hook calls this too.
  postgres.stop = () =>
    (shutdown ??= (async () => {
      if (await running())
        await execute(
          pgControl,
          ["-D", databaseDir, "-m", "fast", "-w", "stop"],
          { windowsHide: true, timeout: 30_000 },
        );
    })());
  if (!(await running())) {
    try {
      await postgres.start();
    } catch {
      throw new Error(
        `Local PostgreSQL could not start on port ${port}. ${startupMessages.join("").slice(-1800)}`,
      );
    }
  }
  starting = false;
  const client = postgres.getPgClient("postgres", "127.0.0.1");
  await client.connect();
  if (
    !(await client.query("SELECT 1 FROM pg_database WHERE datname='relay'"))
      .rowCount
  )
    await client.query("CREATE DATABASE relay");
  await client.end();
  process.env.DATABASE_URL = `postgresql://relay:${password}@127.0.0.1:${port}/relay`;
  return { stop: () => postgres.stop() };
}
