import { api, json, throttle } from "@/server/http";
import { linkPreview } from "@/server/services";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  return api(async () => {
    await throttle(request, "metadata", 300, 60_000);
    return json(await linkPreview((await params).code));
  });
}
