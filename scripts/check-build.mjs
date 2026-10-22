import { readdir, readFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function isPrivateBuildPath(value) {
  return /(?:^|\/)(?:\.local|\.git|test-results|coverage|playwright-report)(?:\/|$)|(?:^|\/)\.env(?:[./]|$)/.test(
    value.replaceAll("\\", "/"),
  );
}
export async function checkBuild(root = path.resolve(".next")) {
  async function inspect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) await inspect(filename);
      else if (entry.name.endsWith(".nft.json")) {
        const manifest = JSON.parse(await readFile(filename, "utf8"));
        if (manifest.files.some(isPrivateBuildPath))
          throw new Error(
            "Build trace includes private local data or secrets.",
          );
      }
    }
  }
  await inspect(path.join(root, "server"));
  for (const name of [".local", ".git", ".env.local", "test-results"]) {
    let exists = false;
    try {
      await access(path.join(root, "standalone", name));
      exists = true;
    } catch {
      /* Missing is expected. */
    }
    if (exists)
      throw new Error(
        "Standalone build contains private local data or secrets.",
      );
  }
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await checkBuild();
  console.log(
    "Build privacy guard passed: local data and secrets are excluded.",
  );
}
