import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AppError } from "../../src/domain/errors";
import {
  api,
  assertOrigin,
  bearer,
  boundedBody,
  idSchema,
  json,
  readJson,
  throttle,
} from "../../src/server/http";
import { config } from "../../src/server/config";
import { consumeRateLimit } from "../../src/server/services";
vi.mock("../../src/server/services", () => ({ consumeRateLimit: vi.fn() }));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
describe("request boundaries", () => {
  it("requires the configured same-origin and rejects cross-site mutation", () => {
    const request = (origin?: string, site?: string) =>
      new Request("http://localhost:3000/api", {
        headers: {
          ...(origin ? { origin } : {}),
          ...(site ? { "sec-fetch-site": site } : {}),
        },
      });
    expect(() => assertOrigin(request("http://localhost:3000"))).not.toThrow();
    expect(() => assertOrigin(request())).toThrow(/must come from Relay/);
    expect(() => assertOrigin(request("https://evil.example"))).toThrow();
    expect(() =>
      assertOrigin(request("http://localhost:3000", "cross-site")),
    ).toThrow();
  });
  it("validates bearer capabilities and IDs", () => {
    expect(bearer(new Request("https://example.com"))).toBe("");
    expect(
      bearer(
        new Request("https://example.com", {
          headers: { authorization: `Bearer ${"A".repeat(43)}` },
        }),
      ),
    ).toBe("A".repeat(43));
    expect(
      bearer(
        new Request("https://example.com", {
          headers: { authorization: "Bearer short" },
        }),
      ),
    ).toBe("");
    expect(idSchema.safeParse("../file").success).toBe(false);
  });
  it("bounds actual streamed bytes even with no content-length", async () => {
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(5));
        controller.enqueue(new Uint8Array(5));
        controller.close();
      },
    });
    const request = new Request("https://example.com", {
      method: "POST",
      body,
      duplex: "half",
    } as RequestInit);
    await expect(boundedBody(request, 8)).rejects.toMatchObject({
      status: 413,
    });
    await expect(
      boundedBody(
        new Request("https://example.com", {
          method: "POST",
          body: "large",
          headers: { "content-length": "999" },
        }),
        5,
      ),
    ).rejects.toMatchObject({ status: 413 });
    await expect(
      boundedBody(new Request("https://example.com"), 5),
    ).rejects.toThrow(/missing/);
  });
  it("parses JSON and reports malformed requests without leaking details", async () => {
    expect(
      await readJson(
        new Request("https://example.com", {
          method: "POST",
          body: '{"ok":true}',
        }),
      ),
    ).toEqual({ ok: true });
    await expect(
      readJson(
        new Request("https://example.com", { method: "POST", body: "{" }),
      ),
    ).rejects.toThrow(/valid JSON/);
    await expect(
      readJson(
        new Request("https://example.com", {
          method: "POST",
          body: "x".repeat(17000),
        }),
      ),
    ).rejects.toMatchObject({ status: 413 });
  });
  it("maps errors to consistent safe responses", async () => {
    expect((await api(async () => json({ ok: true }, 201))).status).toBe(201);
    expect(
      (
        await api(async () => {
          throw new AppError("gone", "Gone", 410);
        })
      ).status,
    ).toBe(410);
    const invalid = await api(async () => {
      z.string().parse(4);
      return json({});
    });
    expect(invalid.status).toBe(400);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const failed = await api(async () => {
      throw new Error("password=secret token=private");
    });
    expect(failed.status).toBe(500);
    expect(JSON.stringify(await failed.json())).not.toContain("secret");
    expect(spy.mock.calls.flat().join(" ")).not.toContain("password");
  });
  it("does not trust forwarded IP headers unless explicitly configured", async () => {
    const request = new Request("https://example.com", {
      headers: { "x-forwarded-for": "10.0.0.1, 10.0.0.2" },
    });
    await throttle(request, "create");
    const local = vi.mocked(consumeRateLimit).mock.calls.at(-1)?.[0];
    vi.stubEnv("TRUST_PROXY", "1");
    await throttle(request, "create", 2, 1000);
    const forwarded = vi.mocked(consumeRateLimit).mock.calls.at(-1)?.[0];
    expect(local).not.toBe(forwarded);
    expect(forwarded).not.toContain("10.0");
  });
  it("validates production settings and upload bounds", () => {
    vi.stubEnv("MAX_FILE_BYTES", "0");
    expect(() => config()).toThrow(/MAX_FILE_BYTES/);
    vi.stubEnv("MAX_FILE_BYTES", "26214400");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RATE_LIMIT_SECRET", "short");
    expect(() => config()).toThrow(/RATE_LIMIT_SECRET/);
    vi.stubEnv("RATE_LIMIT_SECRET", "a".repeat(32));
    expect(config().maxFileBytes).toBe(26214400);
  });
});
