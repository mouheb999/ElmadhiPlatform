import { describe, expect, it } from "vitest";
import { normalizeEmailForMeta, normalizePhoneForMeta } from "./capi";

describe("normalizeEmailForMeta", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmailForMeta("  Someone@Example.COM ")).toBe("someone@example.com");
  });
  it("treats blank as missing", () => {
    expect(normalizeEmailForMeta("   ")).toBeNull();
    expect(normalizeEmailForMeta(null)).toBeNull();
  });
});

describe("normalizePhoneForMeta", () => {
  it("is 216 plus the eight digits, no plus or spaces", () => {
    expect(normalizePhoneForMeta("+216 26 341 616")).toBe("21626341616");
    expect(normalizePhoneForMeta("26 341 616")).toBe("21626341616");
    expect(normalizePhoneForMeta("0021626341616")).toBe("21626341616");
  });
  it("drops what cannot be a phone number", () => {
    expect(normalizePhoneForMeta("123")).toBeNull();
    expect(normalizePhoneForMeta(null)).toBeNull();
  });
});
