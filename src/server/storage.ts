import {
  mkdir,
  readFile,
  writeFile,
  rename,
  unlink,
  readdir,
  stat,
} from "node:fs/promises";
import path from "node:path";
import { AppError } from "../domain/errors";

export interface PayloadStore {
  put(key: string, payload: Uint8Array): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
  list(): Promise<{ key: string; modified: Date }[]>;
}
export class FilePayloadStore implements PayloadStore {
  constructor(private directory: string) {}
  private file(key: string) {
    if (!/^[A-Za-z0-9_-]{22}(\.tmp)?$/.test(key))
      throw new AppError("invalid_storage_key", "Invalid storage identifier.");
    return path.join(this.directory, key);
  }
  async put(key: string, payload: Uint8Array) {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    await writeFile(this.file(`${key}.tmp`), payload, {
      flag: "wx",
      mode: 0o600,
    });
    await rename(this.file(`${key}.tmp`), this.file(key));
  }
  async get(key: string) {
    return readFile(this.file(key));
  }
  async remove(key: string) {
    try {
      await unlink(this.file(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  async list() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const keys = (await readdir(this.directory)).filter((key) =>
      /^[A-Za-z0-9_-]{22}(\.tmp)?$/.test(key),
    );
    const entries = await Promise.all(
      keys.map(async (key) => {
        try {
          const info = await stat(this.file(key));
          return { key, modified: info.mtime };
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
          throw error;
        }
      }),
    );
    return entries.filter(
      (entry): entry is { key: string; modified: Date } => entry !== null,
    );
  }
}
