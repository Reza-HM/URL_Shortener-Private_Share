import { durations, type Expiry } from "../shared/contracts";
import { AppError } from "./errors";

export function expiration(expiry: Expiry | null, now = new Date()) {
  return expiry === null ? null : new Date(now.getTime() + durations[expiry]);
}
export function normalizeDestination(value: string, appOrigin: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AppError(
      "invalid_url",
      "Enter a complete http:// or https:// address.",
    );
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new AppError(
      "invalid_url",
      "Use an HTTP or HTTPS address without embedded credentials.",
    );
  const application = new URL(appOrigin);
  const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
  if (
    url.host === application.host ||
    (loopback.has(url.hostname) &&
      loopback.has(application.hostname) &&
      url.port === application.port)
  )
    throw new AppError(
      "relay_destination",
      "Relay links cannot point back to Relay. Share a Private Drop using its original link.",
    );
  return url.href;
}
export interface Lifecycle {
  deletedAt: Date | null;
  disabledAt: Date | null;
  consumedAt: Date | null;
  expiresAt: Date | null;
}
export function statusOf(share: Lifecycle, now = new Date()) {
  if (share.deletedAt) return "deleted" as const;
  if (share.consumedAt) return "consumed" as const;
  if (share.disabledAt) return "disabled" as const;
  if (share.expiresAt && share.expiresAt <= now) return "expired" as const;
  return "active" as const;
}
