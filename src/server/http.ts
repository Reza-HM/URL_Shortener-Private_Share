import { z, ZodError } from "zod";
import { AppError } from "../domain/errors";
import { config } from "./config";
import { rateKey } from "./security";
import { consumeRateLimit } from "./services";

export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export function api(handler: () => Promise<Response>): Promise<Response> {
  return handler().catch((error: unknown) => {
    if (error instanceof ZodError)
      return json(
        {
          error: {
            code: "invalid_input",
            message: error.issues[0]?.message || "Check the entered values.",
          },
        },
        400,
      );
    if (error instanceof AppError)
      return json(
        { error: { code: error.code, message: error.message } },
        error.status,
      );
    // Deliberately omit error objects: database errors may include bound secrets.
    console.error("Relay request failed; no request data was logged.");
    return json(
      {
        error: {
          code: "server_error",
          message: "Something went wrong. Please try again.",
        },
      },
      500,
    );
  });
}
export function assertOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin !== config().origin)
    throw new AppError(
      "invalid_origin",
      "This request must come from Relay.",
      403,
    );
  if (request.headers.get("sec-fetch-site") === "cross-site")
    throw new AppError(
      "invalid_origin",
      "Cross-site requests are not allowed.",
      403,
    );
}
export async function throttle(
  request: Request,
  scope: string,
  limit = 60,
  windowMs = 3_600_000,
) {
  // Only trust this header when a controlled reverse proxy overwrites it.
  const ip =
    process.env.TRUST_PROXY === "1"
      ? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        "unknown"
      : "local";
  await consumeRateLimit(
    rateKey(ip, config().rateSecret, scope),
    limit,
    windowMs,
  );
}
export async function boundedBody(request: Request, limit: number) {
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > limit))
    throw new AppError("too_large", "This upload exceeds the size limit.", 413);
  const reader = request.body?.getReader();
  if (!reader)
    throw new AppError("invalid_input", "The request body is missing.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw new AppError(
          "too_large",
          "This upload exceeds the size limit.",
          413,
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, length);
}
export async function readJson(request: Request) {
  try {
    return JSON.parse((await boundedBody(request, 16 * 1024)).toString("utf8"));
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("invalid_input", "Send a valid JSON request.");
  }
}
export function bearer(request: Request) {
  return (
    request.headers
      .get("authorization")
      ?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1] || ""
  );
}
export const idSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{22}$/, "Invalid share identifier.");
