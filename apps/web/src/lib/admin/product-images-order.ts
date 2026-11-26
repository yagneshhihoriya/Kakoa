/**
 * Pure gallery-order helpers — NO db import, unit-testable. The reorder
 * endpoint receives the full list of a product's image ids in the new order;
 * `validateReorderIds` proves the list is exactly the product's current set
 * (same ids, no duplicates, nothing missing, nothing foreign) before any
 * position is rewritten.
 */
import { isUuid } from "./product-validation";

export type ReorderIdsResult =
  | { ok: true; ids: string[] }
  | { ok: false; message: string };

/**
 * `ids` is the client's proposed order; `existing` is the product's current
 * image ids. Succeeds only when both are the same set.
 */
export function validateReorderIds(ids: unknown, existing: readonly string[]): ReorderIdsResult {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { ok: false, message: "Send the gallery's image ids in their new order." };
  }
  if (!ids.every((id): id is string => isUuid(id))) {
    return { ok: false, message: "Send the gallery's image ids in their new order." };
  }
  const proposed = ids.map((id) => id.toLowerCase());
  const seen = new Set<string>();
  for (const id of proposed) {
    if (seen.has(id)) return { ok: false, message: "Each image may appear only once." };
    seen.add(id);
  }
  const current = new Set(existing.map((id) => id.toLowerCase()));
  if (proposed.length !== current.size || proposed.some((id) => !current.has(id))) {
    return {
      ok: false,
      message: "The gallery changed while you were reordering — reload and try again.",
    };
  }
  return { ok: true, ids: proposed };
}

/** Move the item at `from` to `to` (both indices), returning a new array. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = items.slice();
  if (from < 0 || from >= next.length || to < 0 || to >= next.length || from === to) return next;
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return next;
  next.splice(to, 0, moved);
  return next;
}

/** Keep only the items whose url is not already attached (case-sensitive, trimmed). */
export function dedupeByUrl<T extends { url: string }>(
  items: readonly T[],
  attachedUrls: readonly string[],
): T[] {
  const seen = new Set(attachedUrls.map((u) => u.trim()));
  const out: T[] = [];
  for (const item of items) {
    const url = item.url.trim();
    if (url.length === 0 || seen.has(url)) continue;
    seen.add(url);
    out.push(item);
  }
  return out;
}
