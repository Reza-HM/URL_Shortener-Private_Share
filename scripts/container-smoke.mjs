const origin = process.env.APP_ORIGIN || "http://localhost:3000";
const health = await fetch(`${origin}/api/health`);
if (!health.ok) throw new Error("Container health failed");
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
