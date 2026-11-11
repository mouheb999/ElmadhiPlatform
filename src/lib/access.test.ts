import { describe, it, expect } from "vitest";
import {
  ALWAYS_FREE_PREFIXES,
  APP_PREVIEW_PREFIXES,
  APP_SHELL_COOKIE_OPTIONS,
  APP_SHELL_UA,
  PAID_PREFIXES,
  REVERSE_TRIAL,
  isAppShellSignal,
  isAppShellUserAgent,
  isBlockedInApp,
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

  describe("inside the Android shell", () => {
    const app = { appShell: true } as const;

    it("opens the plan-building surface the web currently charges for", () => {
      // The whole point of the app's free mode: somebody who installed the app
      // and has not been activated yet can still see their own answers and the
      // program and meal plan built from them.
      expect(isPaidPath("/dashboard", app)).toBe(false);
      expect(isPaidPath("/workout", app)).toBe(false);
      expect(isPaidPath("/workout/questions", app)).toBe(false);
      expect(isPaidPath("/workout/program", app)).toBe(false);
      expect(isPaidPath("/diet", app)).toBe(false);
      expect(isPaidPath("/diet/questions", app)).toBe(false);
      expect(isPaidPath("/diet/plan", app)).toBe(false);
    });

    it("still charges for recording and tracking", () => {
      // Every paid prefix except the ones deliberately opened as a preview.
      // /qa is in both lists on purpose: paid on the web, readable in the app.
      const stillPaid = PAID_PREFIXES.filter(
        (p) => !APP_PREVIEW_PREFIXES.some((preview) => p === preview),
      );
      expect(stillPaid.length).toBeGreaterThan(0);
      for (const prefix of stillPaid) {
        expect(isPaidPath(prefix, app), prefix).toBe(true);
      }
    });

    it("never gates the route it redirects an unpaid user to", () => {
      // This is the loop guard. proxy.ts sends an unpaid app user to
      // /dashboard; if /dashboard were itself paid in app mode, that redirect
      // would target a route that redirects again.
      expect(isPaidPath("/dashboard", app)).toBe(false);
    });

    it("leaves the locked-out escape routes open", () => {
      for (const prefix of ALWAYS_FREE_PREFIXES) {
        expect(isPaidPath(prefix, app), prefix).toBe(false);
      }
    });

    it("opens the Q&A library as a preview", () => {
      for (const prefix of APP_PREVIEW_PREFIXES) {
        expect(isPaidPath(prefix, app), prefix).toBe(false);
        expect(isPaidPath(`${prefix}/some-card-id`, app), prefix).toBe(false);
      }
    });

    it("keeps the Q&A preview paid on the web", () => {
      // The carve-out is app-only. A browser must still be redirected, or the
      // web funnel quietly gives away a paid surface.
      for (const prefix of APP_PREVIEW_PREFIXES) {
        expect(isPaidPath(prefix), prefix).toBe(true);
      }
    });

    it("carves out only the preview prefix, not its neighbours", () => {
      // The carve-out must not leak into the other paid routes.
      expect(isPaidPath("/progress", app)).toBe(true);
      expect(isPaidPath("/review", app)).toBe(true);
      expect(isPaidPath("/diet/log", app)).toBe(true);
      expect(isPaidPath("/workout/session", app)).toBe(true);
    });

    it("gates by allowlist, so an unknown path is not paid", () => {
      // Worth pinning because it differs from the web, where anything outside
      // ALWAYS_FREE_PREFIXES is paid. In app mode PAID_PREFIXES is an
      // allowlist, so "/qaz" — which is a 404 either way — falls outside it and
      // is never redirected. That is the same semantics REVERSE_TRIAL has on
      // the web, and it is why the loop guard above tests /dashboard directly
      // rather than trusting a prefix rule to cover it.
      expect(isPaidPath("/qaz", app)).toBe(false);
      expect(isPaidPath("/nope", app)).toBe(false);
    });
  });
});

describe("isAppShellUserAgent", () => {
  it("recognises the marker inside a real WebView user agent", () => {
    expect(
      isAppShellUserAgent(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 " +
          `(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 ${APP_SHELL_UA}`,
      ),
    ).toBe(true);
  });

  it("does not match an ordinary browser", () => {
    expect(
      isAppShellUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) " +
          "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile Safari/604.1",
      ),
    ).toBe(false);
  });

  it("treats a missing user agent as a browser", () => {
    expect(isAppShellUserAgent(null)).toBe(false);
    expect(isAppShellUserAgent(undefined)).toBe(false);
    expect(isAppShellUserAgent("")).toBe(false);
  });
});

describe("isAppShellSignal", () => {
  const CHROME =
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

  it("recognises the cookie the start URL leaves behind", () => {
    // The TWA case: real Chrome, ordinary user agent, cookie set by the proxy
    // when it saw ?app=1.
    expect(isAppShellSignal({ cookie: "1", userAgent: CHROME })).toBe(true);
  });

  it("still recognises the user agent, with no cookie", () => {
    // The Capacitor fallback, kept so a TWA rejection does not strand us — and
    // so that clearing site data cannot silently drop an install into web mode.
    expect(
      isAppShellSignal({ cookie: undefined, userAgent: `${CHROME} ${APP_SHELL_UA}` }),
    ).toBe(true);
  });

  it("treats an ordinary browser as the web", () => {
    expect(isAppShellSignal({ cookie: undefined, userAgent: CHROME })).toBe(false);
    expect(isAppShellSignal({ cookie: null, userAgent: null })).toBe(false);
    expect(isAppShellSignal({})).toBe(false);
  });

  it("accepts only the exact cookie value", () => {
    // Guards against a half-written or legacy cookie counting as the app. The
    // proxy writes "1" and nothing else.
    expect(isAppShellSignal({ cookie: "", userAgent: CHROME })).toBe(false);
    expect(isAppShellSignal({ cookie: "0", userAgent: CHROME })).toBe(false);
    expect(isAppShellSignal({ cookie: "true", userAgent: CHROME })).toBe(false);
    expect(isAppShellSignal({ cookie: "11", userAgent: CHROME })).toBe(false);
  });
});

describe("APP_SHELL_COOKIE_OPTIONS", () => {
  it("outlives any plausible install", () => {
    // This records which installation a request came from, not a session. A
    // short life would flip a long-standing install back to web mode, and the
    // first symptom would be a price appearing inside the app.
    const tenYears = 60 * 60 * 24 * 365 * 10;
    expect(APP_SHELL_COOKIE_OPTIONS.maxAge).toBe(tenYears);
    expect(APP_SHELL_COOKIE_OPTIONS.path).toBe("/");
    expect(APP_SHELL_COOKIE_OPTIONS.httpOnly).toBe(true);
  });
});

describe("isBlockedInApp", () => {
  it("closes the marketing site and the till", () => {
    expect(isBlockedInApp("/")).toBe(true);
    expect(isBlockedInApp("/start")).toBe(true);
    expect(isBlockedInApp("/checkout")).toBe(true);
    expect(isBlockedInApp("/checkout/anything")).toBe(true);
    expect(isBlockedInApp("/phone")).toBe(true);
  });

  it("leaves the app itself alone", () => {
    // "/" is matched exactly, not as a prefix — as a prefix it would be every
    // route in the product, and the app would have nothing left to show.
    expect(isBlockedInApp("/dashboard")).toBe(false);
    expect(isBlockedInApp("/workout/session/abc")).toBe(false);
    expect(isBlockedInApp("/diet/log")).toBe(false);
    expect(isBlockedInApp("/support")).toBe(false);
    expect(isBlockedInApp("/settings")).toBe(false);
    expect(isBlockedInApp("/login")).toBe(false);
  });

  it("does not treat a lookalike prefix as blocked", () => {
    expect(isBlockedInApp("/started")).toBe(false);
    expect(isBlockedInApp("/checkoutish")).toBe(false);
  });
});
