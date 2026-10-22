import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { config } from "./config";
import * as schema from "./schema";

const globalDb = globalThis as unknown as { relayPool?: Pool };
export function pool() {
  return (globalDb.relayPool ??= new Pool({
    connectionString: config().databaseUrl,
    max: 10,
    idleTimeoutMillis: 20_000,
  }));
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
