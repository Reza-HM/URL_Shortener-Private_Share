import { spawnSync } from "node:child_process";
// Public CI uses synthetic credentials only. Publish bounded startup logs as
// check annotations so diagnostics remain readable without private log access.
for (const service of ["app", "cleanup", "migrate"]) {
  const result = spawnSync(
    "docker",
    ["compose", "logs", "--no-color", "--tail", "35", service],
    { encoding: "utf8", maxBuffer: 1024 * 1024 },
  );
  const message = (result.stdout || result.stderr || "No startup output.")
    .slice(-10000)
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A");
  console.log(`::error title=Relay ${service} startup::${message}`);
}
