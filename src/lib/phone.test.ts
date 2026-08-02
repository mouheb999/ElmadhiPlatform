import { describe, expect, it } from "vitest";
import { formatPhone, isValidPhone, normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it("accepts the shapes people actually type", () => {
    for (const input of [
      "26341616",
      "26 341 616",
      "026341616",
      "+216 26 341 616",
      "0021626341616",
      "21626341616",
      "+21626341616",
    ]) {
      expect(normalizePhone(input)).toBe("+21626341616");
    }
  });

  it("keeps foreign numbers on their own country code", () => {
    // A real one from the waitlist — an Italian number must not become +216.
    expect(normalizePhone("+393931327449")).toBe("+393931327449");
    expect(normalizePhone("00393931327449")).toBe("+393931327449");
  });

  it("rejects Tunisian landlines, which cannot receive WhatsApp", () => {
    expect(normalizePhone("71234567")).toBeNull();
  });

  it("rejects a bare long number with no country code to prove it", () => {
    expect(normalizePhone("393931327449")).toBeNull();
  });

  it("rejects junk, empties and wrong lengths", () => {
    for (const input of ["", "   ", null, undefined, "abc", "1234", "2634161"]) {
      expect(normalizePhone(input)).toBeNull();
    }
  });

  it("never returns a value the database CHECK would reject", () => {
    const constraint = /^\+[1-9][0-9]{7,14}$/;
    for (const input of ["26341616", "+393931327449", "+216 26 341 616"]) {
      const out = normalizePhone(input);
      expect(out).not.toBeNull();
      expect(out!).toMatch(constraint);
    }
  });
});

describe("isValidPhone / formatPhone", () => {
  it("agrees with normalizePhone", () => {
    expect(isValidPhone("26341616")).toBe(true);
    expect(isValidPhone("71234567")).toBe(false);
  });

  it("spaces Tunisian numbers and leaves others alone", () => {
    expect(formatPhone("+21626341616")).toBe("+216 26 341 616");
    expect(formatPhone("+393931327449")).toBe("+393931327449");
    expect(formatPhone(null)).toBe("");
  });
});
