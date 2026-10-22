import { beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { mkdir, writeFile, utimes } from "node:fs/promises";
import path from "node:path";
import { db, pool, closeDb } from "../../src/server/db";
import { shares } from "../../src/server/schema";
import {
  changeShare,
  consumeRateLimit,
  createDrop,
  createLink,
  dropMetadata,
  linkPreview,
  managedShare,
  payloadStore,
  redirectLink,
  revealDrop,
} from "../../src/server/services";
import { cleanup } from "../../src/server/cleanup";
import { encryptContent } from "../../src/lib/crypto";
import { tokenHash, randomId } from "../../src/server/security";
import type { PayloadStore } from "../../src/server/storage";
import { config } from "../../src/server/config";

if (process.env.RELAY_INTEGRATION !== "1")
  throw new Error(
    "Run through pnpm test:integration for an isolated database.",
  );
beforeEach(async () => {
  await pool().query("TRUNCATE shares, rate_buckets");
});
afterAll(closeDb);
const privateText = "سلام — a private note";
const encrypted = () =>
  encryptContent(new TextEncoder().encode(privateText), {
    version: 1,
    kind: "text",
    filename: "secret-name.txt",
  });
describe("PostgreSQL sharing lifecycle", () => {
  it("creates manageable links, previews without counting and preserves complete URLs", async () => {
    const destination = "https://example.com/path?q=hello%20world#anchor";
    const created = await createLink({ destination, alias: "my-link" });
    expect(created.sharePath).toBe("/s/my-link");
    expect(created.expiresAt).toBeNull();
    expect(await linkPreview("my-link")).toMatchObject({ destination });
    expect(await redirectLink("my-link", false)).toBe(destination);
    expect(
      (await managedShare(created.id, created.managementToken)).requests,
    ).toBe(0);
    expect(await redirectLink("my-link")).toBe(destination);
    expect(
      (await managedShare(created.id, created.managementToken)).requests,
    ).toBe(1);
    const row = (await db().select().from(shares))[0];
    expect(row.managementHash).toBe(tokenHash(created.managementToken));
    expect(row.managementHash).not.toBe(created.managementToken);
  });
  it("resolves alias uniqueness races without creating duplicate links", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () =>
        createLink({ destination: "https://example.com", alias: "one-alias" }),
      ),
    );
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    for (const result of results)
      if (result.status === "rejected")
        expect(result.reason.code).toBe("alias_taken");
  });
  it("denies unsafe destinations and unauthorized management", async () => {
    await expect(
      createLink({ destination: "javascript:alert(1)" }),
    ).rejects.toMatchObject({ code: "invalid_url" });
    const link = await createLink({ destination: "https://example.com" });
    await expect(managedShare(link.id, "bad")).rejects.toMatchObject({
      status: 401,
    });
    await expect(
      changeShare(link.id, "A".repeat(43), "delete"),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      managedShare(randomId(), link.managementToken),
    ).rejects.toMatchObject({ status: 401 });
  });
  it("immediately blocks disabled, deleted and expired links", async () => {
    const disabled = await createLink({
      destination: "https://example.com",
      alias: "disabled-link",
    });
    expect(
      (await changeShare(disabled.id, disabled.managementToken, "disable"))
        .status,
    ).toBe("disabled");
    await expect(redirectLink("disabled-link")).rejects.toMatchObject({
      status: 410,
    });
    expect(
      (await changeShare(disabled.id, disabled.managementToken, "delete"))
        .status,
    ).toBe("deleted");
    const expired = await createLink({
      destination: "https://example.com",
      alias: "expired-link",
      expiresIn: "5m",
    });
    await db()
      .update(shares)
      .set({ expiresAt: new Date(0) })
      .where(eq(shares.id, expired.id));
    await expect(linkPreview("expired-link")).rejects.toMatchObject({
      status: 410,
    });
    await expect(redirectLink("missing")).rejects.toMatchObject({
      status: 410,
    });
  });
  it("persists across database reconnection", async () => {
    const link = await createLink({
      destination: "https://example.com",
      alias: "persistent-link",
    });
    await closeDb();
    expect((await managedShare(link.id, link.managementToken)).status).toBe(
      "active",
    );
  });
  it("stores ciphertext, hashes and minimal metadata, never content or filenames", async () => {
    const cipher = await encrypted();
    const drop = await createDrop(
      { kind: "text", password: "long-password" },
      cipher.payload,
    );
    const row = (
      await db().select().from(shares).where(eq(shares.id, drop.id))
    )[0];
    const stored = await payloadStore().get(drop.id);
    expect(JSON.stringify(row)).not.toContain(privateText);
    expect(JSON.stringify(row)).not.toContain("secret-name.txt");
    expect(JSON.stringify(row)).not.toContain(cipher.key);
    expect(row.passwordHash).toMatch(/^\$argon2id\$/);
    expect(stored).toEqual(Buffer.from(cipher.payload));
    const metadata = await dropMetadata(drop.id);
    expect(metadata).toMatchObject({
      kind: "text",
      requiresPassword: true,
      oneTime: false,
    });
    expect(JSON.stringify(metadata)).not.toMatch(
      /storageKey|managementHash|passwordHash|secret-name/,
    );
    expect((await managedShare(drop.id, drop.managementToken)).requests).toBe(
      0,
    );
    await expect(revealDrop(drop.id, "incorrect")).rejects.toMatchObject({
      code: "incorrect_password",
    });
    expect((await managedShare(drop.id, drop.managementToken)).requests).toBe(
      0,
    );
    expect(await revealDrop(drop.id, "long-password")).toEqual(stored);
  });
  it("allows at most one concurrent reveal and never consumes metadata reads", async () => {
    const cipher = await encrypted();
    const drop = await createDrop(
      { kind: "text", oneTime: true },
      cipher.payload,
    );
    await Promise.all(Array.from({ length: 5 }, () => dropMetadata(drop.id)));
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => revealDrop(drop.id, "")),
    );
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(await managedShare(drop.id, drop.managementToken)).toMatchObject({
      status: "consumed",
      requests: 1,
    });
    await expect(dropMetadata(drop.id)).rejects.toMatchObject({
      code: "consumed",
    });
  });
  it("blocks expired/deleted drops before cleanup and rejects disable for drops", async () => {
    const cipher = await encrypted();
    const drop = await createDrop({ kind: "text" }, cipher.payload);
    await expect(
      changeShare(drop.id, drop.managementToken, "disable"),
    ).rejects.toMatchObject({ code: "invalid_action" });
    await changeShare(drop.id, drop.managementToken, "delete");
    await expect(revealDrop(drop.id, "")).rejects.toMatchObject({
      status: 410,
    });
    const other = await createDrop({ kind: "text" }, cipher.payload);
    await db()
      .update(shares)
      .set({ expiresAt: new Date(0) })
      .where(eq(shares.id, other.id));
    await expect(dropMetadata(other.id)).rejects.toMatchObject({ status: 410 });
    await expect(revealDrop(randomId(), "")).rejects.toMatchObject({
      status: 410,
    });
  });
  it("bounds payloads and rolls back incomplete storage writes", async () => {
    await expect(
      createDrop({ kind: "text" }, new Uint8Array(4)),
    ).rejects.toMatchObject({ code: "invalid_payload" });
    const huge = new Uint8Array(1024 * 1024 + 16385);
    huge[0] = 1;
    await expect(createDrop({ kind: "text" }, huge)).rejects.toMatchObject({
      status: 413,
    });
    const store = payloadStore();
    const failure: PayloadStore = {
      put: async (id) => {
        await store.put(id, new Uint8Array([1]));
        throw new Error("disk full");
      },
      get: (id) => store.get(id),
      remove: (id) => store.remove(id),
      list: () => store.list(),
    };
    await expect(
      createDrop({ kind: "text" }, (await encrypted()).payload, failure),
    ).rejects.toThrow("disk full");
    expect(await db().select().from(shares)).toHaveLength(0);
  });
  it("does not consume a one-time drop when storage is unavailable", async () => {
    const drop = await createDrop(
      { kind: "text", oneTime: true },
      (await encrypted()).payload,
    );
    const store = payloadStore();
    const failedRead: PayloadStore = {
      put: (id, bytes) => store.put(id, bytes),
      remove: (id) => store.remove(id),
      list: () => store.list(),
      get: async () => {
        throw new Error("offline");
      },
    };
    await expect(revealDrop(drop.id, "", failedRead)).rejects.toMatchObject({
      code: "storage_unavailable",
    });
    expect((await managedShare(drop.id, drop.managementToken)).status).toBe(
      "active",
    );
    await expect(revealDrop(drop.id, "")).resolves.toBeInstanceOf(Buffer);
  });
  it("cleans expired payloads and retries failed deletions idempotently", async () => {
    const drop = await createDrop(
      { kind: "text" },
      (await encrypted()).payload,
    );
    await db()
      .update(shares)
      .set({ expiresAt: new Date(0) })
      .where(eq(shares.id, drop.id));
    const store = payloadStore();
    const failing: PayloadStore = {
      put: (id, data) => store.put(id, data),
      get: (id) => store.get(id),
      list: () => store.list(),
      remove: async () => {
        throw new Error("busy");
      },
    };
    expect((await cleanup(failing)).failed).toBeGreaterThan(0);
    expect(
      (await db().select().from(shares).where(eq(shares.id, drop.id)))[0]
        .purgedAt,
    ).toBeNull();
    expect((await cleanup()).purged).toBeGreaterThan(0);
    await expect(store.get(drop.id)).rejects.toThrow();
    expect(
      (await db().select().from(shares).where(eq(shares.id, drop.id)))[0]
        .purgedAt,
    ).not.toBeNull();
    await cleanup();
  });
  it("removes old orphan/temp uploads but protects recent in-flight files", async () => {
    const directory = config().storageDir;
    await mkdir(directory, { recursive: true });
    const orphan = randomId(),
      recent = randomId(),
      temporary = `${randomId()}.tmp`;
    for (const key of [orphan, recent, temporary])
      await writeFile(path.join(directory, key), "opaque");
    for (const key of [orphan, temporary])
      await utimes(path.join(directory, key), new Date(0), new Date(0));
    await cleanup();
    await expect(payloadStore().get(orphan)).rejects.toThrow();
    await expect(payloadStore().get(temporary)).rejects.toThrow();
    expect(await payloadStore().get(recent)).toEqual(Buffer.from("opaque"));
  });
  it("enforces atomic database rate limits and resets expired buckets", async () => {
    await Promise.all(
      Array.from({ length: 3 }, () => consumeRateLimit("test", 3, 60000)),
    );
    await expect(consumeRateLimit("test", 3, 60000)).rejects.toMatchObject({
      status: 429,
    });
    await pool().query(
      "UPDATE rate_buckets SET reset_at=now()-interval '1 second'",
    );
    await expect(consumeRateLimit("test", 3, 60000)).resolves.toBeUndefined();
  });
});
