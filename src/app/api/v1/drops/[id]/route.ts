import { api, idSchema, json, throttle } from "@/server/http";
import { dropMetadata } from "@/server/services";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    await throttle(request, "metadata", 300, 60_000);
    return json(await dropMetadata(idSchema.parse((await params).id)));
  });
}
