import { test, expect } from "@playwright/test";
import { encryptContent } from "../../src/lib/crypto";
const origin = "http://localhost:3100";
const headers = { origin };
test("HTTP boundaries reject cross-origin, malformed and unsafe requests", async ({
  request,
}) => {
  expect(
    (
      await request.post("/api/v1/links", {
        data: { destination: "https://example.com" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/v1/links", {
        headers: { origin: "https://evil.example" },
        data: { destination: "https://example.com" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/v1/links", {
        headers,
        data: { destination: "javascript:alert(1)" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/v1/links", {
        headers,
        data: { destination: `${origin}/d/private#key=secret` },
      })
    ).status(),
  ).toBe(400);
  expect(
    (await request.post("/api/v1/links", { headers, data: "{" })).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/v1/links", { headers, data: "x".repeat(17000) })
    ).status(),
  ).toBe(413);
  expect((await request.get("/api/v1/manage/invalid")).status()).toBe(400);
});
test("drop HTTP reads never consume and uploads reject plaintext metadata", async ({
  request,
}) => {
  const encrypted = await encryptContent(
    new TextEncoder().encode("api private data"),
    { version: 1, kind: "text" },
  );
  const upload = (options: unknown) =>
    request.post("/api/v1/drops", {
      headers,
      multipart: {
        options: JSON.stringify(options),
        payload: {
          name: "encrypted.bin",
          mimeType: "application/octet-stream",
          buffer: Buffer.from(encrypted.payload),
        },
      },
    });
  expect((await upload({ kind: "text", key: encrypted.key })).status()).toBe(
    400,
  );
  expect(
    (await upload({ kind: "text", filename: "secret.txt" })).status(),
  ).toBe(400);
  const response = await upload({ kind: "text", oneTime: true });
  expect(response.status()).toBe(201);
  const created = await response.json();
  const metadata = await request.get(`/api/v1/drops/${created.id}`);
  expect(metadata.status()).toBe(200);
  expect(JSON.stringify(await metadata.json())).not.toContain(encrypted.key);
  expect(
    (await request.get(`/api/v1/drops/${created.id}/reveal`)).status(),
  ).toBe(405);
  const results = await Promise.all(
    Array.from({ length: 5 }, () =>
      request.post(`/api/v1/drops/${created.id}/reveal`, { headers, data: {} }),
    ),
  );
  expect(results.filter((result) => result.status() === 200)).toHaveLength(1);
  expect(results.filter((result) => result.status() === 410)).toHaveLength(4);
  expect((await request.get(`/api/v1/drops/${created.id}`)).status()).toBe(410);
});
test("malformed uploads and configured size limits are enforced", async ({
  request,
}) => {
  expect(
    (
      await request.post("/api/v1/drops", { headers, data: "plain content" })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/v1/drops", {
        headers,
        multipart: {
          options: "{",
          payload: {
            name: "encrypted.bin",
            mimeType: "application/octet-stream",
            buffer: Buffer.from([1, 2]),
          },
        },
      })
    ).status(),
  ).toBe(400);
  const large = Buffer.alloc(25 * 1024 * 1024 + 40000);
  large[0] = 1;
  expect(
    (
      await request.post("/api/v1/drops", {
        headers,
        multipart: {
          options: JSON.stringify({ kind: "file" }),
          payload: {
            name: "encrypted.bin",
            mimeType: "application/octet-stream",
            buffer: large,
          },
        },
      })
    ).status(),
  ).toBe(413);
});
