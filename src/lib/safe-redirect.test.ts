import { describe, it, expect } from "vitest";
import { safeNextPath } from "./safe-redirect";

describe("safeNextPath", () => {
  it("keeps an ordinary in-app destination", () => {
    expect(safeNextPath("/diet")).toBe("/diet");
    expect(safeNextPath("/workout/session/abc-123")).toBe("/workout/session/abc-123");
    expect(safeNextPath("/qa?view=answered")).toBe("/qa?view=answered");
  });

  it("falls back when nothing was asked for", () => {
    expect(safeNextPath(null)).toBe("/dashboard");
    expect(safeNextPath(undefined)).toBe("/dashboard");
    expect(safeNextPath("")).toBe("/dashboard");
  });

  it("honours an explicit fallback", () => {
    expect(safeNextPath(null, "/checkout")).toBe("/checkout");
    expect(safeNextPath("https://evil.com", "/checkout")).toBe("/checkout");
  });

  // The whole point of the module. Each of these reached a third-party origin
  // before it existed — see the comment block in safe-redirect.ts.
  it.each([
    ["absolute https", "https://evil.com"],
    ["absolute http", "http://evil.com"],
    ["protocol-relative", "//evil.com"],
    ["protocol-relative, backslash", "/\\evil.com"],
    ["userinfo smuggling", "@evil.com"],
    ["bare host", "evil.com"],
    ["scheme-ish", "javascript:alert(1)"],
    ["data url", "data:text/html,<script>alert(1)</script>"],
    ["leading space then protocol-relative", " //evil.com"],
  ])("refuses to leave the site: %s", (_label, hostile) => {
    expect(safeNextPath(hostile)).toBe("/dashboard");
  });
});
