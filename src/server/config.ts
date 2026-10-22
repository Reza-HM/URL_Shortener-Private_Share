import path from "node:path";
import { DEFAULT_FILE_LIMIT } from "../shared/contracts";

export function config() {
  const origin = new URL(process.env.APP_ORIGIN || "http://localhost:3000")
    .origin;
  const maxFileBytes = Number(process.env.MAX_FILE_BYTES || DEFAULT_FILE_LIMIT);
  if (
    !Number.isSafeInteger(maxFileBytes) ||
    maxFileBytes < 1 ||
    maxFileBytes > 100 * 1024 * 1024
  )
    throw new Error("MAX_FILE_BYTES must be between 1 and 104857600.");
  if (
    process.env.NODE_ENV === "production" &&
    (!process.env.RATE_LIMIT_SECRET ||
      process.env.RATE_LIMIT_SECRET.length < 32)
  )
    throw new Error("Set RATE_LIMIT_SECRET to at least 32 random characters.");
  return {
    origin,
    maxFileBytes,
    // Runtime data must never be traced into the standalone application image.
    storageDir: path.resolve(
      /* turbopackIgnore: true */ process.env.STORAGE_DIR || ".local/payloads",
    ),
    rateSecret:
      process.env.RATE_LIMIT_SECRET ||
      "relay-local-development-not-for-production",
    databaseUrl:
      process.env.DATABASE_URL ||
      "postgresql://relay:relay@127.0.0.1:55432/relay",
  };
}
