import { afterEach, expect, it, vi } from "vitest";
import { closeDb, pool } from "../../src/server/db";
afterEach(async () => {
  await closeDb();
  vi.restoreAllMocks();
});
it("handles idle database errors without leaking connection or cancellation details", () => {
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  const connectionPool = pool();
  const error = Object.assign(new Error("password=private"), {
    client: { secretKey: "private-cancellation-key" },
  });
  expect(() => connectionPool.emit("error", error)).not.toThrow();
  expect(logged).toHaveBeenCalledOnce();
  expect(logged.mock.calls.flat().join(" ")).not.toMatch(
    /password=private|private-cancellation-key/,
  );
});
