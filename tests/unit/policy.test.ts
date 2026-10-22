import { describe, expect, it } from "vitest";
import {
  expiration,
  normalizeDestination,
  statusOf,
} from "../../src/domain/policy";
import { AppError, unavailable } from "../../src/domain/errors";
import { dropInput, durations, linkInput } from "../../src/shared/contracts";

describe("sharing policy", () => {
  const now = new Date("2026-10-22T12:00:00Z");
  const active = {
    deletedAt: null,
    consumedAt: null,
    disabledAt: null,
    expiresAt: null,
  };
  it("preserves URL queries, fragments and Unicode destinations", () => {
    expect(
      normalizeDestination(
        "https://example.com/a?q=hello%20world#section",
        "http://localhost:3000",
      ),
    ).toBe("https://example.com/a?q=hello%20world#section");
    expect(
      normalizeDestination("https://example.com/سلام", "http://localhost:3000"),
    ).toContain("%D8");
  });
  it.each([
    "not a url",
    "/relative",
    "javascript:alert(1)",
    "ftp://example.com",
    "data:text/html,test",
    "https://user:secret@example.com",
  ])("rejects unsafe destinations: %s", (value) =>
    expect(() => normalizeDestination(value, "https://relay.example")).toThrow(
      AppError,
    ),
  );
  it("rejects its own origin including secret-bearing drop links", () =>
    expect(() =>
      normalizeDestination(
        "https://relay.example/d/test#key=secret",
        "https://relay.example",
      ),
    ).toThrow(/cannot point back/));
  it("also rejects alternate loopback names and protocols for Relay", () => {
    expect(() =>
      normalizeDestination(
        "http://127.0.0.1:3000/d/test#key=private",
        "http://localhost:3000",
      ),
    ).toThrow(/cannot point back/);
    expect(() =>
      normalizeDestination(
        "http://relay.example/path",
        "https://relay.example",
      ),
    ).toThrow(/cannot point back/);
    expect(
      normalizeDestination(
        "http://localhost:9000/path",
        "http://localhost:3000",
      ),
    ).toBe("http://localhost:9000/path");
  });
  it("applies all expiration durations and no-expiry", () => {
    expect(expiration(null, now)).toBeNull();
    for (const expiry of Object.keys(durations) as (keyof typeof durations)[])
      expect(expiration(expiry, now)?.getTime()).toBe(
        now.getTime() + durations[expiry],
      );
    expect(expiration("5m")).toBeInstanceOf(Date);
  });
  it("checks expiration at the exact boundary with lifecycle precedence", () => {
    expect(statusOf(active, now)).toBe("active");
    expect(statusOf(active)).toBe("active");
    expect(
      statusOf({ ...active, expiresAt: new Date(now.getTime() + 1) }, now),
    ).toBe("active");
    expect(statusOf({ ...active, expiresAt: now }, now)).toBe("expired");
    expect(statusOf({ ...active, disabledAt: now }, now)).toBe("disabled");
    expect(statusOf({ ...active, consumedAt: now, disabledAt: now }, now)).toBe(
      "consumed",
    );
    expect(statusOf({ ...active, deletedAt: now, consumedAt: now }, now)).toBe(
      "deleted",
    );
  });
  it("validates and normalizes aliases and rejects extra fields", () => {
    expect(
      linkInput.parse({
        destination: "https://example.com",
        alias: " My-Link ",
      }),
    ).toMatchObject({ alias: "my-link", expiresIn: null });
    for (const alias of [
      "abc",
      "-hello",
      "hello-",
      "with space",
      "a".repeat(49),
    ])
      expect(
        linkInput.safeParse({ destination: "https://example.com", alias })
          .success,
      ).toBe(false);
    expect(
      linkInput.safeParse({
        destination: "https://example.com",
        encryptionKey: "secret",
      }).success,
    ).toBe(false);
  });
  it("validates drop options without accepting plaintext metadata or keys", () => {
    expect(dropInput.parse({ kind: "text" })).toEqual({
      kind: "text",
      expiresIn: "24h",
      oneTime: false,
    });
    expect(
      dropInput.safeParse({ kind: "file", password: "short" }).success,
    ).toBe(false);
    expect(
      dropInput.safeParse({ kind: "text", filename: "secret.txt" }).success,
    ).toBe(false);
    expect(dropInput.safeParse({ kind: "code", key: "secret" }).success).toBe(
      false,
    );
  });
  it("returns distinct consumed and unavailable errors", () => {
    expect(() => unavailable()).toThrow(/expired/);
    expect(() => unavailable("consumed")).toThrow(/already been opened/);
  });
});
