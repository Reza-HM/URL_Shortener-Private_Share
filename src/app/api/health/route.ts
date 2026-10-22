import { pool } from "@/server/db";
import { config } from "@/server/config";
import { mkdir, access, constants } from "node:fs/promises";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const directory = config().storageDir;
    await pool().query("SELECT 1");
    await mkdir(directory, { recursive: true });
    await access(directory, constants.W_OK);
    return Response.json(
      { status: "ok" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
