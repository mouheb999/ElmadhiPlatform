import { describe, it, expect } from "vitest";
import {
  ALWAYS_FREE_PREFIXES,
  PAID_PREFIXES,
  REVERSE_TRIAL,
  isPaidPath,
} from "./access";

/**
 * These assert the mode the product is actually shipping in, so flipping
 * REVERSE_TRIAL is expected to turn the second block red. That is the point:
 * the flip should have to be deliberate, and whoever makes it should have to
 * move the expectation with it.
 */
describe("isPaidPath", () => {
  it("keeps the locked-out escape routes open regardless of mode", () => {
    // Gating any of these strands the user: no way to pay, no way to ask for
    // help, no way to sign out.
    for (const prefix of ALWAYS_FREE_PREFIXES) {
      expect(isPaidPath(prefix), prefix).toBe(false);
      expect(isPaidPath(`${prefix}/anything`), prefix).toBe(false);
    }
  });

  it("does not treat a lookalike prefix as free", () => {
    // "/settingsomething" is not "/settings".
    expect(isPaidPath("/settingsomething")).toBe(true);
    expect(isPaidPath("/checkoutish")).toBe(true);
  });

  describe("with the reverse trial OFF (current)", () => {
    it("is off", () => {
      expect(REVERSE_TRIAL).toBe(false);
    });

    it("charges for the plan-building surface too", () => {
      expect(isPaidPath("/dashboard")).toBe(true);
      expect(isPaidPath("/workout/questions")).toBe(true);
      expect(isPaidPath("/workout/program")).toBe(true);
      expect(isPaidPath("/diet/questions")).toBe(true);
      expect(isPaidPath("/diet/plan")).toBe(true);
    });

    it("still charges for everything it charged for before", () => {
      for (const prefix of PAID_PREFIXES) {
        expect(isPaidPath(prefix), prefix).toBe(true);
      }
    });
  });
});
