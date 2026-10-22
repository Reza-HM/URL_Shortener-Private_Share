import { pool } from "./db";
import { payloadStore } from "./services";
import type { PayloadStore } from "./storage";

export async function cleanup(
  store: PayloadStore = payloadStore(),
  now = new Date(),
) {
  const connection = await pool().connect();
  let purged = 0,
    failed = 0;
  try {
    if (
      !(await connection.query("SELECT pg_try_advisory_lock(730922) AS locked"))
        .rows[0].locked
    )
      return { purged, failed };
    const result = await connection.query<{ id: string; storage_key: string }>(
      "SELECT id, storage_key FROM shares WHERE kind='drop' AND purged_at IS NULL AND (expires_at <= $1 OR consumed_at IS NOT NULL OR deleted_at IS NOT NULL) LIMIT 100",
      [now],
    );
    for (const share of result.rows) {
      try {
        await store.remove(share.storage_key);
        await connection.query("UPDATE shares SET purged_at=$2 WHERE id=$1", [
          share.id,
          now,
        ]);
        purged++;
      } catch {
        failed++;
      }
    }
    // A grace period protects in-flight uploads that do not yet have a DB row.
    for (const entry of await store.list()) {
      if (entry.modified.getTime() > now.getTime() - 3_600_000) continue;
      const exists = entry.key.endsWith(".tmp")
        ? false
        : (
            await connection.query(
              "SELECT 1 FROM shares WHERE storage_key=$1 AND purged_at IS NULL",
              [entry.key],
            )
          ).rowCount;
      if (!exists) {
        try {
          await store.remove(entry.key);
          purged++;
        } catch {
          failed++;
        }
      }
    }
    await connection.query("DELETE FROM rate_buckets WHERE reset_at < $1", [
      now,
    ]);
    return { purged, failed };
  } finally {
    await connection.query("SELECT pg_advisory_unlock(730922)");
    connection.release();
  }
}
