import { openDB } from "idb";
import type { ReviewAction, Snapshot } from "./types";
const db = () =>
  openDB("kotoba-cache-v1", 1, {
    upgrade(d) {
      d.createObjectStore("outbox", { keyPath: "id" });
      d.createObjectStore("snapshots");
    },
  });
export async function pending(userId: string): Promise<ReviewAction[]> {
  return (await (await db()).getAll("outbox"))
    .filter((x: ReviewAction) => x.userId === userId)
    .sort((a: ReviewAction, b: ReviewAction) =>
      a.reviewedAt.localeCompare(b.reviewedAt),
    );
}
export async function putAction(action: ReviewAction) {
  await (await db()).put("outbox", action);
}
export async function removeAction(id: string) {
  await (await db()).delete("outbox", id);
}
export async function cacheSnapshot(userId: string, value: Snapshot) {
  await (await db()).put("snapshots", value, userId);
}
export async function readSnapshot(
  userId: string,
): Promise<Snapshot | undefined> {
  return (await db()).get("snapshots", userId);
}
export async function clearSnapshot(userId: string) {
  await (await db()).delete("snapshots", userId);
}
