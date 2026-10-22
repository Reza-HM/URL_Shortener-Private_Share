import { describe, expect, it } from "vitest";
import {
  hashPassword,
  randomCode,
  randomId,
  randomToken,
  rateKey,
  tokenHash,
  verifyPassword,
  verifyToken,
} from "../../src/server/security";

describe("secret handling", () => {
  it("generates independent capabilities and identifiers", () => {
    const tokens = new Set(Array.from({ length: 100 }, randomToken));
    expect(tokens.size).toBe(100);
    expect(randomId()).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(randomCode()).toMatch(/^[a-z0-9_-]{8}$/);
    for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
  it("verifies only a valid hashed management capability", () => {
    const token = randomToken();
    expect(tokenHash(token)).not.toBe(token);
    expect(verifyToken(token, tokenHash(token))).toBe(true);
    expect(verifyToken(randomToken(), tokenHash(token))).toBe(false);
    expect(verifyToken("", tokenHash(token))).toBe(false);
    expect(verifyToken(token, "broken")).toBe(false);
  });
  it("hashes passwords with Argon2id and handles wrong/malformed hashes", async () => {
    const hash = await hashPassword("a-long-private-password");
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain("a-long-private-password");
    expect(await verifyPassword("a-long-private-password", hash)).toBe(true);
    expect(await verifyPassword("incorrect", hash)).toBe(false);
    expect(await verifyPassword("test", "malformed")).toBe(false);
  });
  it("pseudonymizes IPs separately for each scope", () => {
    const key = rateKey("127.0.0.1", "secret", "create");
    expect(key).toMatch(/^[a-f0-9]{64}$/);
    expect(key).not.toContain("127.0.0.1");
    expect(rateKey("127.0.0.1", "secret", "reveal")).not.toBe(key);
    expect(rateKey("127.0.0.1", "other", "create")).not.toBe(key);
  });
});
