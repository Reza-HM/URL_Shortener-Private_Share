import { describe, expect, it } from "vitest";
import { isPrivateBuildPath } from "../../scripts/check-build.mjs";
describe("production build privacy", () => {
  it.each([
    "../../.local/dev/password",
    "..\\.local\\payloads\\secret",
    "../../../.git/config",
    "../../.env.local",
    "../../.env",
    "../test-results/trace.zip",
    "../coverage/report.json",
  ])("rejects private trace path %s", (filename) =>
    expect(isPrivateBuildPath(filename)).toBe(true),
  );
  it.each([
    "../../src/app/page.js",
    "../../node_modules/pg/index.js",
    "../../.next/server/app.js",
  ])("allows runtime code %s", (filename) =>
    expect(isPrivateBuildPath(filename)).toBe(false),
  );
});
