import { api, assertOrigin, json, readJson, throttle } from "@/server/http";
import { createLink } from "@/server/services";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return api(async () => {
    assertOrigin(request);
    await throttle(request, "create");
    return json(await createLink(await readJson(request)), 201);
  });
}
