import { describe, it, expect } from "vitest";
import { normalizeOrigin, resolveOrigin } from "./site-url";

describe("normalizeOrigin", () => {
  it("keeps a well-formed origin", () => {
    expect(normalizeOrigin("https://elmadhi.com")).toBe("https://elmadhi.com");
    expect(normalizeOrigin("http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("forgives the ways a dashboard value gets typed", () => {
    expect(normalizeOrigin("elmadhi.com")).toBe("https://elmadhi.com");
    expect(normalizeOrigin("https://elmadhi.com/")).toBe("https://elmadhi.com");
    expect(normalizeOrigin("  https://elmadhi.com  ")).toBe("https://elmadhi.com");
    expect(normalizeOrigin("https://elmadhi.com/app?x=1")).toBe("https://elmadhi.com");
  });

  it("treats an unset or unusable value as absent", () => {
    expect(normalizeOrigin(undefined)).toBeNull();
    expect(normalizeOrigin("")).toBeNull();
    expect(normalizeOrigin("   ")).toBeNull();
    expect(normalizeOrigin("https://")).toBeNull();
  });
});

describe("resolveOrigin", () => {
  it("prefers the runtime variable over the build-time one", () => {
    // The whole reason SITE_URL exists: NEXT_PUBLIC_SITE_URL is frozen into the
    // bundle at build time, so it is the value that cannot be corrected without
    // a rebuild. SITE_URL has to be able to override it.
    expect(
      resolveOrigin({ siteUrl: "https://new.com", publicSiteUrl: "https://old.com" }),
    ).toBe("https://new.com");
  });

  it("still honours NEXT_PUBLIC_SITE_URL on its own", () => {
    expect(resolveOrigin({ publicSiteUrl: "https://elmadhi.com" })).toBe("https://elmadhi.com");
  });

  it("falls back to the production domain on a Vercel production deploy", () => {
    expect(
      resolveOrigin({
        vercelEnv: "production",
        vercelProductionUrl: "elmadhi-platform.vercel.app",
        vercelUrl: "elmadhi-platform-abc123.vercel.app",
      }),
    ).toBe("https://elmadhi-platform.vercel.app");
  });

  it("uses the deployment host on a preview deploy", () => {
    // Sending a preview user to the production domain mid-sign-in loses them.
    expect(
      resolveOrigin({
        vercelEnv: "preview",
        vercelProductionUrl: "elmadhi-platform.vercel.app",
        vercelUrl: "elmadhi-platform-abc123.vercel.app",
      }),
    ).toBe("https://elmadhi-platform-abc123.vercel.app");
  });

  it("lets an explicit value win over the platform's guess", () => {
    expect(
      resolveOrigin({
        siteUrl: "https://elmadhi.com",
        vercelEnv: "production",
        vercelProductionUrl: "elmadhi-platform.vercel.app",
      }),
    ).toBe("https://elmadhi.com");
  });

  it("reports nothing when nothing is configured", () => {
    expect(resolveOrigin({})).toBeNull();
    expect(resolveOrigin({ siteUrl: "", publicSiteUrl: "" })).toBeNull();
  });
});
