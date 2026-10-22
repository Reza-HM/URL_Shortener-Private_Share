import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { startPostgres } from "./postgres";
import { migrate } from "./migrate";
import { cleanup } from "../src/server/cleanup";
import { closeDb, pool } from "../src/server/db";
import { cp } from "node:fs/promises";

const testing = process.argv.includes("--e2e");
const production = process.argv.includes("--production");
if (!testing) loadEnv({ path: ".env.local", quiet: true });
if (testing) {
  if (process.env.RELAY_TEST_DATABASE_URL)
    process.env.DATABASE_URL = process.env.RELAY_TEST_DATABASE_URL;
  else delete process.env.DATABASE_URL;
  process.env.APP_ORIGIN = "http://localhost:3100";
  process.env.STORAGE_DIR = path.resolve(".local/e2e/payloads");
  process.env.RATE_LIMIT_SECRET = "relay-e2e-secret-kept-out-of-production";
}
if (production) {
  process.env.NODE_ENV = "production";
  process.env.HOSTNAME = "localhost";
  process.env.PORT = testing ? "3100" : "3000";
  await cp(
    path.resolve(".next/static"),
    path.resolve(".next/standalone/.next/static"),
    { recursive: true },
  );
}
const postgres = await startPostgres(testing ? "e2e" : "dev");
await migrate();
if (testing) await pool().query("TRUNCATE shares, rate_buckets");
console.log(
  `Relay database ready (${testing ? "browser tests" : "development"}).`,
);
const child = spawn(
  process.execPath,
  production
    ? [".next/standalone/server.js"]
    : [
        "node_modules/next/dist/bin/next",
        "dev",
        "--hostname",
        "localhost",
        "--port",
        testing ? "3100" : "3000",
      ],
  { stdio: "inherit", env: process.env, windowsHide: true },
);
let busy = false,
  stopping = false;
async function sweep() {
  if (busy || stopping) return;
  busy = true;
  try {
    await cleanup();
  } catch {
    console.error("Cleanup will retry.");
  } finally {
    busy = false;
  }
}
await sweep();
const timer = setInterval(sweep, 60_000);
async function stop() {
  if (stopping) return;
  stopping = true;
  clearInterval(timer);
  if (child.pid && child.exitCode === null) {
    if (process.platform === "win32")
      spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
    else child.kill("SIGTERM");
  }
  while (busy) await new Promise((resolve) => setTimeout(resolve, 20));
  await closeDb();
  await postgres.stop();
}
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    void stop().then(() => process.exit(0));
  });
child.on("exit", (code) => {
  void stop().then(() => process.exit(code || 0));
});
