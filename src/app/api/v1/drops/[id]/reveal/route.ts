import { z } from "zod";
import { api, assertOrigin, idSchema, readJson, throttle } from "@/server/http";
import { revealDrop } from "@/server/services";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    assertOrigin(request);
    const id = idSchema.parse((await params).id);
    await throttle(request, `reveal:${id}`, 20, 15 * 60_000);
    const { password } = z
      .object({ password: z.string().max(128).default("") })
      .strict()
      .parse(await readJson(request));
    const payload = await revealDrop(id, password);
    return new Response(new Uint8Array(payload), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Cache-Control": "no-store",
        "Content-Disposition": 'attachment; filename="encrypted.bin"',
      },
    });
  });
}
