import { describe, expect, it } from "vitest";
import { cameraErrorKey } from "./calorie-ai-client";
import { t } from "@/lib/i18n";

/**
 * getUserMedia rejects with a DOMException whose `name` is the only reliable
 * signal of what went wrong. Previously every failure was swallowed and the
 * file picker was clicked instead, which told the user nothing (and was
 * usually blocked anyway, because the user-gesture token is spent after the
 * await). These cases are the ones a real user actually hits.
 */
function domError(name: string): DOMException {
  const error = new Error(name) as Error & { name: string };
  error.name = name;
  return error as unknown as DOMException;
}

describe("cameraErrorKey", () => {
  it("maps a denied permission prompt to actionable guidance", () => {
    expect(cameraErrorKey(domError("NotAllowedError"))).toBe("ai.camera_denied");
  });

  it("treats an insecure-origin SecurityError as a permission problem", () => {
    expect(cameraErrorKey(domError("SecurityError"))).toBe("ai.camera_denied");
  });

  it("maps a device with no camera to its own message", () => {
    expect(cameraErrorKey(domError("NotFoundError"))).toBe("ai.camera_missing");
  });

  it("maps unsatisfiable constraints to the no-camera message", () => {
    expect(cameraErrorKey(domError("OverconstrainedError"))).toBe("ai.camera_missing");
  });

  it("maps a camera held by another app to the busy message", () => {
    expect(cameraErrorKey(domError("NotReadableError"))).toBe("ai.camera_busy");
  });

  it("falls back to the generic message for an unknown failure", () => {
    expect(cameraErrorKey(domError("WeirdNewError"))).toBe("ai.camera_error");
  });

  it("survives a non-DOMException rejection", () => {
    expect(cameraErrorKey(undefined)).toBe("ai.camera_error");
    expect(cameraErrorKey("boom")).toBe("ai.camera_error");
  });

  it("every message it can return is translated in both locales", () => {
    const keys = [
      "ai.camera_denied", "ai.camera_missing", "ai.camera_busy",
      "ai.camera_error", "ai.camera_insecure", "ai.camera_starting", "ai.camera_retry",
    ] as const;
    for (const key of keys) {
      const en = t("en", key);
      const tn = t("tn", key);
      expect(en.length, `${key} en`).toBeGreaterThan(0);
      expect(tn.length, `${key} tn`).toBeGreaterThan(0);
      // A missing Tunisian translation usually shows up as the English copy.
      expect(tn, `${key} is untranslated`).not.toBe(en);
    }
  });
});
