import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The iPhone app (Capacitor). Android ships as a Trusted Web Activity instead
 * — see android-twa/README.md and ios/README.md for why each platform got the
 * shell it did.
 *
 * Like the Android app, this is the live website in a native frame, so a
 * deploy reaches installed phones with no App Store update. Only changes to
 * this file, the native project or its permissions need a new build.
 *
 * Point a test build at a preview deployment with CAP_SERVER_URL, e.g.
 *   CAP_SERVER_URL=https://<preview>.vercel.app npx cap sync ios
 * The value is baked in at sync time, so re-sync before building.
 */
const serverUrl = process.env.CAP_SERVER_URL ?? "https://hypefitness.club";

const config: CapacitorConfig = {
  // Same identifier as the Android package, so both stores list one product.
  appId: "club.hypefitness.app",
  appName: "HYPE FITNESS",
  // Bundled pages: shown only when the site cannot be reached.
  webDir: "ios-shell/www",
  server: {
    url: serverUrl,
    // A local page instead of WebKit's blank error screen when offline.
    errorPath: "offline.html",
  },
  ios: {
    /**
     * How the server knows this is the app. The proxy treats any request
     * carrying this marker exactly like the Android app's `?app=1` cookie:
     * no marketing pages, no checkout, no prices (App Store rule 3.1.1 —
     * no outside payment for digital subscriptions; accounts bought on the
     * web may sign in under 3.1.3(b)). The marker is defined once, in
     * src/lib/access.ts as APP_SHELL_UA.
     */
    appendUserAgent: "HypeFitnessApp",
    backgroundColor: "#000000",
    // The site already pads for the notch and home indicator with
    // env(safe-area-inset-*); letting iOS inset it too would pad twice.
    contentInset: "never",
  },
};

export default config;
