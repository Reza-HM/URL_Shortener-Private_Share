import { z } from "zod";
import { ENVELOPE_OVERHEAD } from "../shared/contracts";

const metadataSchema = z
  .object({
    version: z.literal(1),
    kind: z.enum(["text", "code", "file"]),
    language: z.string().max(40).optional(),
    filename: z.string().max(1024).optional(),
    mime: z.string().max(256).optional(),
  })
  .strict();
export type ContentMetadata = z.infer<typeof metadataSchema>;
export interface DecryptedContent {
  metadata: ContentMetadata;
  bytes: Uint8Array<ArrayBuffer>;
}
const encoder = new TextEncoder();
export function encodeKey(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
export function decodeKey(key: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(key))
    throw new Error(
      "The decryption key is missing or invalid. Ask the sender for the complete link.",
    );
  const bytes = Uint8Array.from(
    atob(key.replace(/-/g, "+").replace(/_/g, "/") + "="),
    (value) => value.charCodeAt(0),
  );
  if (encodeKey(bytes) !== key)
    throw new Error(
      "The decryption key is invalid. Ask the sender for the complete link.",
    );
  return bytes;
}
export async function encryptContent(
  bytes: Uint8Array,
  metadata: ContentMetadata,
) {
  if (!globalThis.crypto?.subtle)
    throw new Error(
      "Private Drops require a secure browser connection (HTTPS or localhost).",
    );
  const header = encoder.encode(JSON.stringify(metadataSchema.parse(metadata)));
  if (header.byteLength > ENVELOPE_OVERHEAD - 64)
    throw new Error("Content metadata is too large.");
  const plain = new Uint8Array(4 + header.length + bytes.length);
  new DataView(plain.buffer).setUint32(0, header.length);
  plain.set(header, 4);
  plain.set(bytes, 4 + header.length);
  const keyBytes = crypto.getRandomValues(new Uint8Array(32)),
    iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, [
    "encrypt",
  ]);
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain),
  );
  const payload = new Uint8Array(13 + encrypted.length);
  payload[0] = 1;
  payload.set(iv, 1);
  payload.set(encrypted, 13);
  return { key: encodeKey(keyBytes), payload };
}
export async function decryptContent(
  payload: Uint8Array,
  encodedKey: string,
): Promise<DecryptedContent> {
  const bytes = decodeKey(encodedKey);
  if (payload.length < 33 || payload[0] !== 1)
    throw new Error("This encrypted content has an unsupported format.");
  const key = await crypto.subtle.importKey("raw", bytes, "AES-GCM", false, [
    "decrypt",
  ]);
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(payload.slice(1, 13)) },
      key,
      new Uint8Array(payload.slice(13)),
    );
  } catch {
    throw new Error(
      "Could not decrypt this drop. The key may be wrong or the content may be damaged.",
    );
  }
  if (plain.byteLength < 4)
    throw new Error("This encrypted content is incomplete.");
  const length = new DataView(plain).getUint32(0);
  if (length > ENVELOPE_OVERHEAD || length > plain.byteLength - 4)
    throw new Error("This encrypted content has invalid metadata.");
  let metadata: ContentMetadata;
  try {
    metadata = metadataSchema.parse(
      JSON.parse(new TextDecoder().decode(new Uint8Array(plain, 4, length))),
    );
  } catch {
    throw new Error("This encrypted content has invalid metadata.");
  }
  return { metadata, bytes: new Uint8Array(plain.slice(4 + length)) };
}
