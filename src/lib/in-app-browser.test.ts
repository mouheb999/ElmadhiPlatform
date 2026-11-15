import { describe, expect, it } from "vitest";
import { externalBrowserUrl, inAppPlatform, isInAppBrowser } from "./in-app-browser";

const IG_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 340.0.0.22.109";
const IG_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0 Mobile Safari/537.36 Instagram 340.0.0.22.109 Android";
const FB_ANDROID =
  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/125.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/470.0.0.0;]";
const SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const CHROME =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";

const PAGE = "https://hypefitness.club/start?utm_source=ig&utm_campaign=reel1&fbclid=AbC123";

describe("spotting the in-app browser", () => {
  it("recognises Instagram and Facebook, and nothing else", () => {
    expect(isInAppBrowser(IG_IOS)).toBe(true);
    expect(isInAppBrowser(IG_ANDROID)).toBe(true);
    expect(isInAppBrowser(FB_ANDROID)).toBe(true);
    expect(isInAppBrowser(SAFARI)).toBe(false);
    expect(isInAppBrowser(CHROME)).toBe(false);
  });

  it("tells the two phones apart", () => {
    expect(inAppPlatform(IG_IOS)).toBe("ios");
    expect(inAppPlatform(IG_ANDROID)).toBe("android");
    expect(inAppPlatform(SAFARI)).toBeNull();
  });
});

describe("the way out", () => {
  it("asks iOS for Safari, keeping the whole address", () => {
    expect(externalBrowserUrl(IG_IOS, PAGE)).toBe(`x-safari-${PAGE}`);
  });

  it("asks Android for Chrome, keeping the campaign and the click id", () => {
    const out = externalBrowserUrl(IG_ANDROID, PAGE)!;
    expect(out.startsWith("intent://hypefitness.club/start?utm_source=ig&utm_campaign=reel1&fbclid=AbC123#Intent;")).toBe(true);
    expect(out).toContain("scheme=https");
    expect(out).toContain(`S.browser_fallback_url=${encodeURIComponent(PAGE)}`);
    expect(out.endsWith(";end")).toBe(true);
    // Named, so Android goes straight there instead of showing its chooser.
    expect(out).toContain("package=com.android.chrome");
  });

  it("does nothing in a real browser, or for an address it should not rewrite", () => {
    expect(externalBrowserUrl(SAFARI, PAGE)).toBeNull();
    expect(externalBrowserUrl(CHROME, PAGE)).toBeNull();
    expect(externalBrowserUrl(IG_IOS, "http://localhost:3000/start")).toBeNull();
    expect(externalBrowserUrl(IG_IOS, "not a url")).toBeNull();
  });
});
