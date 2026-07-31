import { describe, expect, it } from "vitest";
import { normalizeDecimal, parseDecimal, toDecimalDraft } from "./utils";

/**
 * The comma is not a formatting nicety here: on an Arabic keyboard it is the
 * only decimal mark available, so "70,5" is what a Tunisian user types when
 * they mean 70.5 kg.
 */
describe("normalizeDecimal", () => {
  it("accepts every decimal mark a user can produce", () => {
    expect(normalizeDecimal("70,5")).toBe("70.5");
    expect(normalizeDecimal("70،5")).toBe("70.5"); // Arabic comma
    expect(normalizeDecimal("70٫5")).toBe("70.5"); // Arabic decimal separator
    expect(normalizeDecimal("70.5")).toBe("70.5");
  });

  it("converts Arabic-Indic digits", () => {
    expect(normalizeDecimal("٧٠٫٥")).toBe("70.5");
    expect(normalizeDecimal("۸۲")).toBe("82"); // extended (Persian) forms
  });
});

describe("toDecimalDraft", () => {
  it("keeps a trailing point so the next digit can be typed", () => {
    expect(toDecimalDraft("70,")).toBe("70.");
  });

  it("drops anything that isn't part of a number", () => {
    expect(toDecimalDraft("7a0 kg")).toBe("70");
  });

  it("keeps only the first decimal point", () => {
    expect(toDecimalDraft("70.5.3")).toBe("70.53");
  });

  it("passes an empty field through", () => {
    expect(toDecimalDraft("")).toBe("");
  });
});

describe("parseDecimal", () => {
  it("parses what the user typed", () => {
    expect(parseDecimal("70,5")).toBe(70.5);
    expect(parseDecimal(" 82 ")).toBe(82);
    expect(parseDecimal("٧٥")).toBe(75);
  });

  it("returns null rather than NaN for nothing usable", () => {
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal("   ")).toBeNull();
    expect(parseDecimal("kg")).toBeNull();
  });
});
