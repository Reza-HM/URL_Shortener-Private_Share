import { afterEach, describe, expect, it, vi } from "vitest";
import { postJson, responseData, safeFilename } from "../../src/lib/client";
afterEach(() => vi.unstubAllGlobals());
describe("recipient utilities", () => {
  it("keeps Unicode filenames while removing path and control characters", () => {
    expect(safeFilename("سلام.txt")).toBe("سلام.txt");
    expect(safeFilename("../../private\u0000.html")).not.toMatch(
      /[\/\\\u0000]/,
    );
    expect(safeFilename()).toBe("download");
    expect(safeFilename("a".repeat(200))).toHaveLength(180);
  });
  it("sends JSON only to the selected API and surfaces safe errors", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ id: "example" }, { status: 201 }));
    vi.stubGlobal("fetch", fetcher);
    expect(
      await postJson("/api/v1/links", { destination: "https://example.com" }),
    ).toEqual({ id: "example" });
    expect(fetcher.mock.calls[0][1].method).toBe("POST");
    await expect(
      responseData(
        Response.json({ error: { message: "Expired" } }, { status: 410 }),
      ),
    ).rejects.toThrow("Expired");
    await expect(
      responseData(Response.json({}, { status: 500 })),
    ).rejects.toThrow(/request failed/);
  });
});
