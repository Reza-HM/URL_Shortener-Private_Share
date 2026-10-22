import { api, assertOrigin, boundedBody, json, throttle } from "@/server/http";
import { config } from "@/server/config";
import { AppError } from "@/domain/errors";
import { createDrop } from "@/server/services";
import { ENVELOPE_OVERHEAD } from "@/shared/contracts";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return api(async () => {
    assertOrigin(request);
    await throttle(request, "create");
    if (
      !request.headers.get("content-type")?.startsWith("multipart/form-data;")
    )
      throw new AppError(
        "invalid_input",
        "Send an encrypted multipart upload.",
      );
    const body = await boundedBody(
      request,
      config().maxFileBytes + ENVELOPE_OVERHEAD + 16 * 1024,
    );
    let form: FormData;
    try {
      form = await new Response(new Uint8Array(body), {
        headers: { "content-type": request.headers.get("content-type")! },
      }).formData();
    } catch {
      throw new AppError(
        "invalid_input",
        "The upload was interrupted or malformed.",
      );
    }
    const options = form.get("options"),
      payload = form.get("payload");
    if (
      typeof options !== "string" ||
      options.length > 4096 ||
      !(payload instanceof File)
    )
      throw new AppError(
        "invalid_input",
        "Upload options and encrypted content are required.",
      );
    let input: unknown;
    try {
      input = JSON.parse(options);
    } catch {
      throw new AppError("invalid_input", "Invalid upload options.");
    }
    return json(
      await createDrop(input, new Uint8Array(await payload.arrayBuffer())),
      201,
    );
  });
}
