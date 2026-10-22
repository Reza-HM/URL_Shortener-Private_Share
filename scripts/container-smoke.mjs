import { execFileSync } from "node:child_process";
const origin = process.env.APP_ORIGIN || "http://localhost:3000";
let healthy = false;
for (let attempt = 0; attempt < 60; attempt++) {
  try {
    healthy = (
      await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(3000) })
    ).ok;
  } catch {
    /* Startup is still in progress. */
  }
  if (healthy) break;
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
if (!healthy) throw new Error("Container health did not become ready");
if (
  !execFileSync(
    "docker",
    ["compose", "ps", "--status", "running", "-q", "cleanup"],
    { encoding: "utf8" },
  ).trim()
)
  throw new Error("Cleanup service is not running");
const create = await fetch(`${origin}/api/v1/links`, {
  method: "POST",
  headers: { Origin: origin, "Content-Type": "application/json" },
  body: JSON.stringify({ destination: "https://example.com/smoke#anchor" }),
});
if (create.status !== 201) throw new Error("Container link creation failed");
const share = await create.json();
const redirect = await fetch(`${origin}${share.sharePath}`, {
  redirect: "manual",
});
if (
  redirect.status !== 302 ||
  redirect.headers.get("location") !== "https://example.com/smoke#anchor"
)
  throw new Error("Container redirect failed");
const removed = await fetch(`${origin}/api/v1/manage/${share.id}`, {
  method: "PATCH",
  headers: {
    Origin: origin,
    Authorization: `Bearer ${share.managementToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ action: "delete" }),
});
if (!removed.ok || (await removed.json()).status !== "deleted")
  throw new Error("Container deletion failed");
console.log("Container health, creation, redirect and deletion passed.");
