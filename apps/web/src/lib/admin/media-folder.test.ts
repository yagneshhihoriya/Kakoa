import { describe, expect, it } from "vitest";
import { GENERAL_MEDIA_FOLDER, parseMediaFolder, productMediaFolder } from "./media-folder";

const ID = "7f1c2a3b-4d5e-4f60-8a71-9b82c93d04e5";

describe("parseMediaFolder", () => {
  it("accepts the general folder", () => {
    expect(parseMediaFolder("general")).toBe(GENERAL_MEDIA_FOLDER);
    expect(parseMediaFolder("  general ")).toBe(GENERAL_MEDIA_FOLDER);
  });

  it("accepts a product folder and canonicalises the uuid", () => {
    expect(parseMediaFolder(`products/${ID}`)).toBe(`products/${ID}`);
    expect(parseMediaFolder(`products/${ID.toUpperCase()}`)).toBe(`products/${ID}`);
  });

  it("rejects anything else", () => {
    expect(parseMediaFolder("")).toBeNull();
    expect(parseMediaFolder("products")).toBeNull();
    expect(parseMediaFolder("products/")).toBeNull();
    expect(parseMediaFolder("products/not-a-uuid")).toBeNull();
    expect(parseMediaFolder(`products/${ID}/extra`)).toBeNull();
    expect(parseMediaFolder(`categories/${ID}`)).toBeNull();
    expect(parseMediaFolder("../general")).toBeNull();
    expect(parseMediaFolder(42)).toBeNull();
    expect(parseMediaFolder(null)).toBeNull();
    expect(parseMediaFolder(undefined)).toBeNull();
  });
});

describe("productMediaFolder", () => {
  it("round-trips through parseMediaFolder", () => {
    const folder = productMediaFolder(ID);
    expect(folder).toBe(`products/${ID}`);
    expect(parseMediaFolder(folder)).toBe(folder);
  });
});
