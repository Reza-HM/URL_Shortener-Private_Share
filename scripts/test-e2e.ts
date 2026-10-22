import { spawn } from "node:child_process";
import { startPostgres } from "./postgres";

// Own PostgreSQL outside Playwright's webServer process tree. On Windows,
// Playwright force-terminates that tree and can strand PostgreSQL IO workers.
if (process.env.RELAY_TEST_DATABASE_URL)
  process.env.DATABASE_URL = process.env.RELAY_TEST_DATABASE_URL;
else delete process.env.DATABASE_URL;
const database = await startPostgres("e2e");
let code = 1;
try {
  const child = spawn(
    process.execPath,
    ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)],
    {
      stdio: "inherit",
      windowsHide: true,
      env: {
        ...process.env,
        RELAY_TEST_DATABASE_URL: process.env.DATABASE_URL,
      },
    },
  );
  code = await new Promise<number>((resolve, reject) => {
    child.on("exit", (value) => resolve(value ?? 1));
    child.on("error", reject);
  });
} finally {
  await database.stop();
}
process.exit(code);
