import { z } from "zod";
import {
  api,
  assertOrigin,
  bearer,
  idSchema,
  json,
  readJson,
  throttle,
} from "@/server/http";
import { changeShare, managedShare } from "@/server/services";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    await throttle(request, "manage", 120, 60_000);
    return json(
      await managedShare(idSchema.parse((await params).id), bearer(request)),
    );
  });
}
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    assertOrigin(request);
    await throttle(request, "manage", 120, 60_000);
    const { action } = z
      .object({ action: z.enum(["disable", "delete"]) })
      .strict()
      .parse(await readJson(request));
    return json(
      await changeShare(
        idSchema.parse((await params).id),
        bearer(request),
        action,
      ),
    );
  });
}
