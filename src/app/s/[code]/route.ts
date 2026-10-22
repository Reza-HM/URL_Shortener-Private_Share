import { redirectLink } from "@/server/services";
import { api } from "@/server/http";
import { AppError } from "@/domain/errors";
export const runtime = "nodejs";
type Context = { params: Promise<{ code: string }> };
async function resolve(request: Request, context: Context, count: boolean) {
  return api(async () => {
    try {
      return new Response(null, {
        status: 302,
        headers: {
          Location: await redirectLink((await context.params).code, count),
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
        },
      });
    } catch (error) {
      if (error instanceof AppError && error.status === 410)
        return new Response(null, {
          status: 302,
          headers: {
            Location: new URL("/unavailable", request.url).href,
            "Cache-Control": "no-store",
          },
        });
      throw error;
    }
  });
}
export async function GET(request: Request, context: Context) {
  return resolve(request, context, true);
}
export async function HEAD(request: Request, context: Context) {
  return resolve(request, context, false);
}
