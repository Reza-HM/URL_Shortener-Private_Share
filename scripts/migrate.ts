import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool, closeDb } from "../src/server/db";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });
export async function migrate() {
  const connection = await pool().connect();
  try {
    await connection.query("SELECT pg_advisory_lock(730921)");
    await connection.query(
      "CREATE TABLE IF NOT EXISTS relay_migrations (name text PRIMARY KEY, applied_at timestamptz DEFAULT now())",
    );
    for (const name of (await readdir(path.resolve("migrations")))
      .filter((name) => name.endsWith(".sql"))
      .sort()) {
      if (
        (
          await connection.query(
            "SELECT 1 FROM relay_migrations WHERE name=$1",
            [name],
          )
        ).rowCount
      )
        continue;
      await connection.query("BEGIN");
      try {
        await connection.query(
          await readFile(path.resolve("migrations", name), "utf8"),
        );
        await connection.query(
          "INSERT INTO relay_migrations(name) VALUES($1)",
          [name],
        );
        await connection.query("COMMIT");
      } catch (error) {
        await connection.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await connection.query("SELECT pg_advisory_unlock(730921)");
    connection.release();
  }
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  migrate()
    .then(() => console.log("Database migrations applied."))
    .catch(() => {
      console.error("Migration failed. Check database configuration.");
      process.exitCode = 1;
    })
    .finally(closeDb);
}
