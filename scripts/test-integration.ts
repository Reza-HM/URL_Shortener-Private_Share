import { spawn } from "node:child_process";
import path from "node:path";
import { startPostgres } from "./postgres";
import { migrate } from "./migrate";
import { closeDb } from "../src/server/db";
if (process.env.RELAY_TEST_DATABASE_URL)
  process.env.DATABASE_URL = process.env.RELAY_TEST_DATABASE_URL;
else delete process.env.DATABASE_URL;
process.env.STORAGE_DIR = path.resolve(".local/integration/payloads");
let postgres = await startPostgres("integration");
try {
  await migrate();
  if (!process.env.RELAY_TEST_DATABASE_URL) {
    const { createLink, managedShare } = await import("../src/server/services");
    const probe = await createLink({
      destination: "https://example.com/restart-probe",
    });
    await closeDb();
    await postgres.stop();
    delete process.env.DATABASE_URL;
    postgres = await startPostgres("integration");
    await migrate();
    if (
      (await managedShare(probe.id, probe.managementToken)).status !== "active"
    )
      throw new Error("PostgreSQL restart persistence check failed");
    console.log("Project-local PostgreSQL restart persistence verified.");
  }
  await closeDb();
  const child = spawn(
    process.execPath,
    [
      "node_modules/vitest/vitest.mjs",
      "run",
      "--config",
      "vitest.integration.config.ts",
    ],
    {
      stdio: "inherit",
      env: { ...process.env, RELAY_INTEGRATION: "1" },
      windowsHide: true,
    },
  );
  process.exitCode = await new Promise<number>((resolve) =>
    child.on("exit", (code) => resolve(code || 0)),
  );
} finally {
  await closeDb();
  await postgres.stop();
}
// tsx's transformer service may keep its IPC pipe alive on Windows. Database
// and child-test cleanup above completes before terminating the supervisor.
process.exit(Number(process.exitCode) || 0);
