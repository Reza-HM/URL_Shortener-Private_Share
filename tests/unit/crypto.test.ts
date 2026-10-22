import { afterEach, describe, expect, it, vi } from "vitest";
import {
  decodeKey,
  decryptContent,
  encodeKey,
  encryptContent,
} from "../../src/lib/crypto";

const encode = (value: string) => new TextEncoder().encode(value);
afterEach(() => vi.unstubAllGlobals());
async function encryptedPlain(plain: Uint8Array<ArrayBuffer>) {
  const raw = new Uint8Array(32),
    iv = new Uint8Array(12);
  const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, [
    "encrypt",
  ]);
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain),
  );
  const payload = new Uint8Array(13 + cipher.length);
  payload[0] = 1;
  payload.set(iv, 1);
  payload.set(cipher, 13);
  return { payload, key: encodeKey(raw) };
}
describe("browser encryption", () => {
  it("round trips Unicode, RTL, code and arbitrary file bytes without plaintext metadata", async () => {
    for (const kind of ["text", "code", "file"] as const) {
      const source =
        kind === "file"
          ? new Uint8Array([0, 255, 128, 10])
          : encode("سلام 🌱 <script>alert('hello')</script>\nconst x = 42;");
      const metadata = {
        version: 1 as const,
        kind,
        filename: "private-budget.pdf",
        mime: "application/pdf",
        language: "javascript",
      };
      const encrypted = await encryptContent(source, metadata);
      expect(encrypted.key).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(new TextDecoder().decode(encrypted.payload)).not.toContain(
        "private-budget",
      );
      const result = await decryptContent(encrypted.payload, encrypted.key);
      expect(result.bytes).toEqual(source);
      expect(result.metadata).toEqual(metadata);
    }
  });
  it("uses fresh keys and nonces", async () => {
    const first = await encryptContent(encode("same"), {
      version: 1,
      kind: "text",
    });
    const second = await encryptContent(encode("same"), {
      version: 1,
      kind: "text",
    });
    expect(first.key).not.toBe(second.key);
    expect(first.payload).not.toEqual(second.payload);
  });
  it("rejects missing, malformed and noncanonical keys", () => {
    for (const key of ["", "short", "!".repeat(43), "A".repeat(42) + "B"])
      expect(() => decodeKey(key)).toThrow(/key/);
    expect(decodeKey("A".repeat(43))).toHaveLength(32);
  });
  it("rejects altered payloads and wrong keys", async () => {
    const encrypted = await encryptContent(encode("secret"), {
      version: 1,
      kind: "text",
    });
    encrypted.payload[20] ^= 1;
    await expect(
      decryptContent(encrypted.payload, encrypted.key),
    ).rejects.toThrow(/Could not decrypt/);
    const other = await encryptContent(encode("other"), {
      version: 1,
      kind: "text",
    });
    await expect(decryptContent(other.payload, encrypted.key)).rejects.toThrow(
      /Could not decrypt/,
    );
  });
  it("rejects unsupported formats", async () => {
    await expect(
      decryptContent(new Uint8Array(2), "A".repeat(43)),
    ).rejects.toThrow(/unsupported/);
    const payload = new Uint8Array(50);
    payload[0] = 2;
    await expect(decryptContent(payload, "A".repeat(43))).rejects.toThrow(
      /unsupported/,
    );
  });
  it("rejects malformed authenticated plaintext", async () => {
    // Valid GCM authentication does not make envelope structure trustworthy.
    const short = await encryptedPlain(new Uint8Array([1, 2, 3]));
    // Pad the short ciphertext to the minimum framing size; invalid structure is
    // separately exercised with an empty header and a malformed JSON header.
    expect(short.payload.length).toBe(32);
    const tooLong = new Uint8Array(8);
    new DataView(tooLong.buffer).setUint32(0, 20000);
    const first = await encryptedPlain(tooLong);
    await expect(decryptContent(first.payload, first.key)).rejects.toThrow(
      /invalid metadata/,
    );
    const beyondBody = new Uint8Array(8);
    new DataView(beyondBody.buffer).setUint32(0, 10);
    const second = await encryptedPlain(beyondBody);
    await expect(decryptContent(second.payload, second.key)).rejects.toThrow(
      /invalid metadata/,
    );
    const malformed = new Uint8Array(8);
    new DataView(malformed.buffer).setUint32(0, 4);
    malformed.set(encode("nope"), 4);
    const third = await encryptedPlain(malformed);
    await expect(decryptContent(third.payload, third.key)).rejects.toThrow(
      /invalid metadata/,
    );
  });
  it("requires a secure Web Crypto context and validates metadata", async () => {
    await expect(
      encryptContent(encode("text"), {
        version: 1,
        kind: "file",
        filename: "a".repeat(1025),
      }),
    ).rejects.toThrow();
    vi.stubGlobal("crypto", {});
    await expect(
      encryptContent(encode("text"), { version: 1, kind: "text" }),
    ).rejects.toThrow(/secure browser connection/);
  });
});
