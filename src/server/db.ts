import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { config } from "./config";
import * as schema from "./schema";

const globalDb = globalThis as unknown as { relayPool?: Pool };
export function pool() {
  if (globalDb.relayPool) return globalDb.relayPool;
  const connectionPool = new Pool({
    connectionString: config().databaseUrl,
    max: 10,
    idleTimeoutMillis: 20_000,
  });
  // pg includes connection objects and cancellation keys on idle-client errors.
  // Handle the pool event here so framework exception logging cannot expose them.
  connectionPool.on("error", () =>
    console.error(
      "Relay database connection interrupted; no connection details were logged.",
    ),
  );
  globalDb.relayPool = connectionPool;
  return connectionPool;
}
export function db() {
  return drizzle(pool(), { schema });
}
export async function closeDb() {
  if (globalDb.relayPool) {
    await globalDb.relayPool.end();
    globalDb.relayPool = undefined;
  }
}
