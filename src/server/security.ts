import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { hash, verify } from "@node-rs/argon2";

export const randomId = () => randomBytes(16).toString("base64url");
export const randomCode = () =>
  randomBytes(6).toString("base64url").toLowerCase();
export const randomToken = () => randomBytes(32).toString("base64url");
export const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export function verifyToken(token: string, expected: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token) || !/^[a-f0-9]{64}$/.test(expected))
    return false;
  return timingSafeEqual(
    Buffer.from(tokenHash(token), "hex"),
    Buffer.from(expected, "hex"),
  );
}
export function rateKey(ip: string, secret: string, scope: string) {
  return createHmac("sha256", secret).update(`${scope}:${ip}`).digest("hex");
}
// @node-rs/argon2 exposes Algorithm as an ambient const enum; 2 is Argon2id.
export const hashPassword = (password: string) =>
  hash(password, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
export async function verifyPassword(password: string, encoded: string) {
  try {
    return await verify(encoded, password);
  } catch {
    return false;
  }
}
