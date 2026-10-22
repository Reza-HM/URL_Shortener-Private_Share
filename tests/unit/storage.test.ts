import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { FilePayloadStore } from "../../src/server/storage";
import { randomId } from "../../src/server/security";
const root = path.resolve(".local/unit");
let directory: string;
let store: FilePayloadStore;
beforeEach(async () => {
  await mkdir(root, { recursive: true });
  directory = await mkdtemp(path.join(root, "storage-"));
  store = new FilePayloadStore(directory);
});
afterEach(async () => {
  if (!directory.startsWith(root + path.sep))
    throw new Error("Unsafe test directory");
  await rm(directory, { recursive: true, force: true });
});
describe("private file storage", () => {
  it("persists opaque bytes atomically, lists them, and deletes idempotently", async () => {
    const id = randomId();
    await store.put(id, new Uint8Array([0, 1, 255]));
    expect(await store.get(id)).toEqual(Buffer.from([0, 1, 255]));
    expect((await store.list()).map((entry) => entry.key)).toEqual([id]);
    expect((await store.list())[0].modified).toBeInstanceOf(Date);
    await store.remove(id);
    await store.remove(id);
    expect(await store.list()).toEqual([]);
  });
  it("rejects traversal and arbitrary filenames for every operation", async () => {
    for (const key of ["../secret", "/etc/passwd", "test.html", "..\\secret"]) {
      await expect(store.put(key, new Uint8Array([1]))).rejects.toThrow();
      await expect(store.get(key)).rejects.toThrow();
      await expect(store.remove(key)).rejects.toThrow();
    }
  });
  it("reports missing content and ignores unrelated files", async () => {
    await expect(store.get(randomId())).rejects.toThrow();
    await writeFile(path.join(directory, "unrelated.txt"), "keep");
    expect(await store.list()).toEqual([]);
  });
  it("does not overwrite an interrupted temporary upload", async () => {
    const id = randomId();
    await writeFile(path.join(directory, `${id}.tmp`), "partial");
    await expect(store.put(id, new Uint8Array([1]))).rejects.toThrow();
    expect((await store.list())[0].key).toBe(`${id}.tmp`);
  });
});
