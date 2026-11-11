import { describe, expect, it } from "vitest";
import { dedupeByUrl, moveItem, validateReorderIds } from "./product-images-order";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

describe("validateReorderIds", () => {
  it("accepts a permutation of the current set", () => {
    expect(validateReorderIds([C, A, B], [A, B, C])).toEqual({ ok: true, ids: [C, A, B] });
  });

  it("lower-cases ids so the client's casing does not matter", () => {
    const r = validateReorderIds([B.toUpperCase(), A], [A, B]);
    expect(r).toEqual({ ok: true, ids: [B, A] });
  });

  it("rejects empty, non-array and non-uuid input", () => {
    expect(validateReorderIds([], [A]).ok).toBe(false);
    expect(validateReorderIds("nope", [A]).ok).toBe(false);
    expect(validateReorderIds([A, "x"], [A]).ok).toBe(false);
    expect(validateReorderIds(undefined, [A]).ok).toBe(false);
  });

  it("rejects duplicates, missing and foreign ids", () => {
    expect(validateReorderIds([A, A], [A, B]).ok).toBe(false);
    expect(validateReorderIds([A], [A, B]).ok).toBe(false);
    expect(validateReorderIds([A, B, C], [A, B]).ok).toBe(false);
    expect(validateReorderIds([A, C], [A, B]).ok).toBe(false);
  });
});

describe("moveItem", () => {
  it("moves forward and backward without mutating the input", () => {
    const src = ["a", "b", "c", "d"];
    expect(moveItem(src, 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveItem(src, 3, 1)).toEqual(["a", "d", "b", "c"]);
    expect(src).toEqual(["a", "b", "c", "d"]);
  });

  it("returns a copy when the move is a no-op or out of range", () => {
    expect(moveItem(["a", "b"], 1, 1)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], -1, 0)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], 0, 5)).toEqual(["a", "b"]);
  });
});

describe("dedupeByUrl", () => {
  it("drops urls already attached and repeats within the batch", () => {
    const items = [{ url: "/u/1.png" }, { url: " /u/2.png " }, { url: "/u/1.png" }, { url: "" }];
    expect(dedupeByUrl(items, ["/u/2.png"])).toEqual([{ url: "/u/1.png" }]);
  });

  it("keeps everything when nothing overlaps", () => {
    expect(dedupeByUrl([{ url: "/a" }, { url: "/b" }], [])).toEqual([{ url: "/a" }, { url: "/b" }]);
  });
});
