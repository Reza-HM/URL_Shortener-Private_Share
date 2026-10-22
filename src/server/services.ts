import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { AppError, unavailable } from "../domain/errors";
import { expiration, normalizeDestination, statusOf } from "../domain/policy";
import {
  dropInput,
  ENVELOPE_OVERHEAD,
  linkInput,
  TEXT_LIMIT,
  type CreatedShare,
  type ManagedShare,
} from "../shared/contracts";
import { config } from "./config";
import { db, pool } from "./db";
import { shares } from "./schema";
import {
  hashPassword,
  randomCode,
  randomId,
  randomToken,
  tokenHash,
  verifyPassword,
  verifyToken,
} from "./security";
import { FilePayloadStore, type PayloadStore } from "./storage";

export const payloadStore = () => new FilePayloadStore(config().storageDir);
const active = () =>
  and(
    isNull(shares.deletedAt),
    isNull(shares.disabledAt),
    isNull(shares.consumedAt),
    or(isNull(shares.expiresAt), gt(shares.expiresAt, new Date())),
  );
function uniqueViolation(error: unknown): boolean {
  const value = error as { code?: string; cause?: unknown };
  return (
    value?.code === "23505" || (!!value?.cause && uniqueViolation(value.cause))
  );
}
function created(
  id: string,
  path: string,
  token: string,
  expiresAt: Date | null,
): CreatedShare {
  return {
    id,
    sharePath: path,
    managementPath: `/manage/${id}`,
    managementToken: token,
    expiresAt: expiresAt?.toISOString() ?? null,
  };
}

export async function createLink(raw: unknown) {
  const input = linkInput.parse(raw);
  const destination = normalizeDestination(input.destination, config().origin);
  const id = randomId(),
    token = randomToken(),
    expiresAt = expiration(input.expiresIn);
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = input.alias || randomCode();
    try {
      await db()
        .insert(shares)
        .values({
          id,
          kind: "link",
          code,
          destination,
          managementHash: tokenHash(token),
          expiresAt,
        });
      return created(id, `/s/${code}`, token, expiresAt);
    } catch (error) {
      if (!uniqueViolation(error)) throw error;
      if (input.alias)
        throw new AppError(
          "alias_taken",
          "That alias is already in use. Try another.",
          409,
        );
    }
  }
  throw new AppError(
    "code_unavailable",
    "Could not reserve a link. Please try again.",
    503,
  );
}
export async function linkPreview(code: string) {
  const [share] = await db()
    .select()
    .from(shares)
    .where(and(eq(shares.code, code), eq(shares.kind, "link")))
    .limit(1);
  if (!share || statusOf(share) !== "active") unavailable();
  return {
    destination: share.destination!,
    expiresAt: share.expiresAt?.toISOString() ?? null,
  };
}
export async function redirectLink(code: string, count = true) {
  if (!count) return (await linkPreview(code)).destination;
  const [share] = await db()
    .update(shares)
    .set({ requests: sql`${shares.requests} + 1` })
    .where(and(eq(shares.code, code), eq(shares.kind, "link"), active()))
    .returning({ destination: shares.destination });
  if (!share) unavailable();
  return share.destination!;
}
export async function createDrop(
  raw: unknown,
  ciphertext: Uint8Array,
  store: PayloadStore = payloadStore(),
) {
  const input = dropInput.parse(raw);
  const limit = input.kind === "file" ? config().maxFileBytes : TEXT_LIMIT;
  if (ciphertext.byteLength < 30 || ciphertext[0] !== 1)
    throw new AppError("invalid_payload", "Upload an encrypted Relay payload.");
  if (ciphertext.byteLength > limit + ENVELOPE_OVERHEAD)
    throw new AppError(
      "too_large",
      "This encrypted payload exceeds the size limit.",
      413,
    );
  const id = randomId(),
    token = randomToken(),
    expiresAt = expiration(input.expiresIn)!;
  const passwordHash = input.password
    ? await hashPassword(input.password)
    : null;
  try {
    await store.put(id, ciphertext);
    await db()
      .insert(shares)
      .values({
        id,
        kind: "drop",
        payloadKind: input.kind,
        storageKey: id,
        byteLength: ciphertext.byteLength,
        managementHash: tokenHash(token),
        passwordHash,
        oneTime: input.oneTime,
        expiresAt,
      });
  } catch (error) {
    await store.remove(id).catch(() => {});
    await store.remove(`${id}.tmp`).catch(() => {});
    throw error;
  }
  return created(id, `/d/${id}`, token, expiresAt);
}
async function dropRecord(id: string) {
  const [share] = await db()
    .select()
    .from(shares)
    .where(and(eq(shares.id, id), eq(shares.kind, "drop")))
    .limit(1);
  if (!share) unavailable();
  const status = statusOf(share);
  if (status !== "active")
    unavailable(status === "consumed" ? "consumed" : "unavailable");
  return share;
}
export async function dropMetadata(id: string) {
  const share = await dropRecord(id);
  return {
    kind: share.payloadKind!,
    requiresPassword: !!share.passwordHash,
    oneTime: share.oneTime,
    expiresAt: share.expiresAt!.toISOString(),
    maxFileBytes: config().maxFileBytes,
  };
}
export async function revealDrop(
  id: string,
  password: string,
  store: PayloadStore = payloadStore(),
) {
  const share = await dropRecord(id);
  if (
    share.passwordHash &&
    !(await verifyPassword(password, share.passwordHash))
  )
    throw new AppError(
      "incorrect_password",
      "That password is incorrect. Please try again.",
      401,
    );
  let payload: Buffer;
  try {
    payload = await store.get(share.storageKey!);
  } catch {
    throw new AppError(
      "storage_unavailable",
      "The encrypted content could not be loaded. Please try again.",
      503,
    );
  }
  // Read before claiming: a storage failure must not consume the share. The
  // conditional UPDATE is the only authorization to return bytes, even in races.
  const [claimed] = await db()
    .update(shares)
    .set({
      requests: sql`${shares.requests} + 1`,
      ...(share.oneTime ? { consumedAt: new Date() } : {}),
    })
    .where(and(eq(shares.id, id), active()))
    .returning({ id: shares.id });
  if (!claimed) unavailable(share.oneTime ? "consumed" : "unavailable");
  return payload;
}
async function authorize(id: string, token: string) {
  const [share] = await db()
    .select()
    .from(shares)
    .where(eq(shares.id, id))
    .limit(1);
  if (!share || !verifyToken(token, share.managementHash))
    throw new AppError(
      "unauthorized",
      "This management link is invalid or incomplete.",
      401,
    );
  return share;
}
export async function managedShare(
  id: string,
  token: string,
): Promise<ManagedShare> {
  const share = await authorize(id, token);
  return {
    id,
    kind: share.kind,
    destination: share.destination,
    code: share.code,
    createdAt: share.createdAt.toISOString(),
    expiresAt: share.expiresAt?.toISOString() ?? null,
    status: statusOf(share),
    requests: share.requests,
    oneTime: share.oneTime,
    requiresPassword: !!share.passwordHash,
  };
}
export async function changeShare(
  id: string,
  token: string,
  action: "disable" | "delete",
) {
  const share = await authorize(id, token);
  if (action === "disable" && share.kind !== "link")
    throw new AppError("invalid_action", "Only short links can be disabled.");
  await db()
    .update(shares)
    .set(
      action === "delete"
        ? { deletedAt: new Date() }
        : { disabledAt: new Date() },
    )
    .where(eq(shares.id, id));
  return managedShare(id, token);
}
export async function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
) {
  const result = await pool().query<{ count: number; reset_at: Date }>(
    `INSERT INTO rate_buckets(key,count,reset_at) VALUES($1,1,now()+($2 * interval '1 millisecond')) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_buckets.reset_at<=now() THEN 1 ELSE rate_buckets.count+1 END, reset_at=CASE WHEN rate_buckets.reset_at<=now() THEN EXCLUDED.reset_at ELSE rate_buckets.reset_at END RETURNING count,reset_at`,
    [key, windowMs],
  );
  if (result.rows[0].count > limit)
    throw new AppError(
      "rate_limited",
      "Too many attempts. Please wait before trying again.",
      429,
    );
}
