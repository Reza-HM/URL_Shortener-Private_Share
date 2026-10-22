import { config as loadEnv } from "dotenv";
import { cleanup } from "../src/server/cleanup";
import { closeDb } from "../src/server/db";
loadEnv({ path: ".env.local", quiet: true });
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    stopping = true;
  });
while (!stopping) {
  try {
    const result = await cleanup();
    if (result.purged || result.failed)
      console.log(
        `Cleanup: ${result.purged} removed, ${result.failed} pending retry.`,
      );
  } catch {
    console.error("Cleanup failed; retrying without logging request data.");
  }
  for (let second = 0; second < 60 && !stopping; second++)
    await new Promise((resolve) => setTimeout(resolve, 1000));
}
await closeDb();
