#!/usr/bin/env node
/**
 * Force our required fields onto whatever `bubblewrap init` generated.
 *
 *     node apply-config.mjs hypefitness.club                  # production
 *     node apply-config.mjs my-app-git-feat-x-me.vercel.app   # a preview
 *
 * Why this exists: `bubblewrap init` writes its own twa-manifest.json from the
 * web manifest plus a dozen interactive prompts, overwriting the one in this
 * folder. Most of what it picks is right. Three things are not, and all three
 * fail quietly:
 *
 *   - **startUrl.** It takes `start_url` from the web manifest, which is
 *     /dashboard. The app must launch at /login?app=1 — that flag is the only
 *     way the server learns it is talking to the app, and without it the shell
 *     gets the full website, marketing pages and prices included.
 *   - **packageId.** Must match PACKAGE_NAME in the assetlinks route, or
 *     verification fails and the app opens with a browser URL bar.
 *   - **The colours.** Default to white, which flashes at every cold start
 *     before the dark app paints.
 *
 * And one that fails loudly, which is `minSdkVersion` — see below.
 *
 * Run it after `init` and after any `init` re-run, then `bubblewrap update`.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(here, "twa-manifest.json");

const raw = process.argv[2];
if (!raw) {
  console.error(
    "usage: node apply-config.mjs <host>\n" +
      "  e.g. node apply-config.mjs hypefitness.club\n" +
      "       node apply-config.mjs elmadhi-git-feat-app-shell-me.vercel.app",
  );
  process.exit(1);
}

// Accept a full URL or a bare host, because both are what you have to hand —
// one is copied from Vercel, the other typed from memory.
const host = raw.replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim();
if (!host || !host.includes(".")) {
  console.error(`"${raw}" does not look like a host.`);
  process.exit(1);
}

if (!existsSync(manifestPath)) {
  console.error(
    "twa-manifest.json not found. Run `bubblewrap init` in this folder first.",
  );
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const origin = `https://${host}`;

Object.assign(manifest, {
  packageId: "club.hypefitness.app",
  host,
  /**
   * 24, because Bubblewrap's template and its own dependency disagree.
   *
   * `bubblewrap init` writes minSdkVersion 21, but androidbrowserhelper —
   * the support library every TWA is built on — declares 24 since 2.7.x. The
   * manifest merger refuses to reconcile them and the Gradle build dies with
   * "uses-sdk:minSdkVersion 21 cannot be smaller than version 24 declared in
   * library [com.google.androidbrowserhelper]".
   *
   * Raising ours is the right fix rather than forcing the merge with
   * `tools:overrideLibrary`, which the error also suggests: the library means
   * it, and overriding would move a build failure to a runtime crash on the
   * devices that cannot run it.
   *
   * Nothing is lost by it. API 24 is Android 7.0, from 2016, and a TWA already
   * needs Chrome 72+ — a device too old for 24 was never going to run this.
   */
  minSdkVersion: 24,
  name: "HYPE FITNESS",
  launcherName: "HYPE",
  display: "standalone",
  orientation: "portrait",
  // The flag the proxy exchanges for the app_shell cookie. Everything the app
  // sees differently hangs off this.
  startUrl: "/login?app=1",
  themeColor: "#0F0F0F",
  themeColorDark: "#0F0F0F",
  backgroundColor: "#0F0F0F",
  navigationColor: "#0F0F0F",
  navigationColorDark: "#0F0F0F",
  navigationDividerColor: "#0F0F0F",
  navigationDividerColorDark: "#0F0F0F",
  iconUrl: `${origin}/icon`,
  maskableIconUrl: `${origin}/icon`,
  monochromeIconUrl: `${origin}/icon`,
  webManifestUrl: `${origin}/manifest.webmanifest`,
  splashScreenFadeOutDuration: 300,
  enableNotifications: true,
  fallbackType: "customtabs",
});

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(`twa-manifest.json updated for ${origin}`);
console.log(`  packageId  ${manifest.packageId}`);
console.log(`  startUrl   ${manifest.startUrl}`);
console.log(`  minSdk     ${manifest.minSdkVersion}`);
console.log(`  signingKey ${manifest.signingKey?.path ?? "(not set — run bubblewrap init)"}`);
console.log("\nNext: bubblewrap update && bubblewrap build");
