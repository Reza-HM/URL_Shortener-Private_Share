import { openDB } from "idb";
export interface LocalShare {
  id: string;
  kind: "link" | "drop";
  label: string;
  shareUrl: string;
  managementUrl: string;
  createdAt: number;
  expiresAt: string | null;
}
const database = () =>
  openDB("relay-device-history", 1, {
    upgrade(db) {
      db.createObjectStore("shares", { keyPath: "id" });
    },
  });
export async function rememberShare(share: LocalShare) {
  const db = await database();
  try {
    await db.put("shares", share);
  } finally {
    db.close();
  }
}
export async function listHistory(): Promise<LocalShare[]> {
  const db = await database();
  try {
    return ((await db.getAll("shares")) as LocalShare[]).sort(
      (a, b) => b.createdAt - a.createdAt,
    );
  } finally {
    db.close();
  }
}
export async function forgetShare(id: string) {
  const db = await database();
  try {
    await db.delete("shares", id);
  } finally {
    db.close();
  }
}
export async function clearHistory() {
  const db = await database();
  try {
    await db.clear("shares");
  } finally {
    db.close();
  }
}
