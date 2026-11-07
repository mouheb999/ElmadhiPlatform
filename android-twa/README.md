# HYPE FITNESS — Android shell (Trusted Web Activity)

This folder is the Android app. It contains almost nothing, on purpose: a TWA
is a thin native wrapper that opens `hypefitness.club` in the user's Chrome,
so the app *is* the website. Bubblewrap generates the Android project from
`twa-manifest.json`; the generated files are gitignored because
`bubblewrap update` overwrites them.

**Why a TWA and not Capacitor:** a TWA runs in real Chrome, so Google sign-in
works unchanged. Google blocks OAuth inside embedded WebViews, which would
have made our sign-in button a dead end in a Capacitor shell.

**How the app tells the server it is the app:** a TWA cannot change the user
agent, so the start URL is `/login?app=1`. The proxy swaps that flag for a
long-lived `elmadhi_app` cookie and redirects to the clean URL. Everything the
app sees differently — no marketing pages, no checkout, no prices, free mode
for unactivated accounts — hangs off that cookie. See `src/lib/access.ts`.

> **Testing on a phone today?** [TEST-BUILD.md](./TEST-BUILD.md) is the short
> path: a sideloaded APK pointed at a Vercel preview, no Play Console. This
> file is the production route.

---

## What you do by hand

Everything below is yours — it needs accounts, a browser, and secrets that
must not live in this repo. Expect the first pass to take an afternoon, mostly
waiting on Play Console.

### 1. Install the toolchain

- **JDK 17.** Not 11, not 21. Bubblewrap's own words: lower versions cannot
  compile the project and higher ones are incompatible with the Android
  command line tools. Get Temurin 17 from <https://adoptium.net>.
- **Android SDK command-line tools** (not Android Studio — you do not need the
  IDE). From <https://developer.android.com/studio#command-line-tools-only>.
  Unzip somewhere **with no spaces in the path** — Bubblewrap warns about this
  explicitly, and `C:\Program Files\...` will break it. `C:\android-sdk` is fine.
- **Node 18+** (you already have it).
- Then: `npm i -g @bubblewrap/cli`

On first run Bubblewrap offers to download and install what is missing and
asks you to accept the Android SDK licence. Let it. If it gets the paths
wrong: `bubblewrap updateConfig --jdkPath <path> --androidSdkPath <path>`.

### 2. Generate the Android project

From **inside this folder**:

```bash
bubblewrap init --manifest https://hypefitness.club/manifest.webmanifest
```

It will ask a lot of questions and offer defaults from the web manifest.
`init` writes its own `twa-manifest.json` over the one in this folder. Rather
than restoring it by hand, run:

```bash
node apply-config.mjs hypefitness.club
bubblewrap update
```

which forces the fields that matter back on — most importantly `startUrl`,
which `init` takes from the web manifest as `/dashboard` and which must be
`/login?app=1` or the app gets the full website, prices included.
The values that matter and must not drift:

| Field | Value | Why |
|---|---|---|
| `packageId` | `club.hypefitness.app` | Must match `PACKAGE_NAME` in `src/app/.well-known/assetlinks.json/route.ts`. Permanent — it cannot be changed after the first Play upload. |
| `startUrl` | `/login?app=1` | How the app identifies itself. |
| `themeColor` / `backgroundColor` | `#0F0F0F` | Matches the splash and status bar to the app background. |
| `enableNotifications` | `true` | Notification delegation, so web push can show under the app's name later. |
| `fallbackType` | `customtabs` | The default. If a device has no TWA-capable browser it opens as a Custom Tab with a URL bar — degraded but working. |

### 3. Create the upload keystore — and back it up

`bubblewrap init` offers to generate one. Say yes, and use alias
`hypefitness` so it matches `twa-manifest.json`.

> **Read this bit twice.** The keystore is the only thing in this project that
> cannot be regenerated. Google Play identifies your app by this key forever.
>
> - **Lose it** and you can never publish an update to this listing again. Not
>   "it is annoying" — the listing is dead and you start over with a new
>   package name, a new URL and zero installs.
> - **Leak it** and somebody else can sign builds that Play will accept as
>   yours.
>
> Back up `android.keystore` **and both passwords** (keystore password and key
> password) to at least two places that are not this machine and not this
> repo — a password manager entry with the file attached is ideal. Do it the
> day you create it, not later.
>
> It is gitignored. Keep it that way.

### 4. Build

```bash
bubblewrap build
```

Produces `app-release-bundle.aab` (upload this to Play) and
`app-release-signed.apk` (sideload this to test on a device).

For CI later, the passwords can come from `BUBBLEWRAP_KEYSTORE_PASSWORD` and
`BUBBLEWRAP_KEY_PASSWORD` instead of prompts.

### 5. Create the app in Play Console

1. <https://play.google.com/console> → **Create app**.
2. Name `HYPE FITNESS`, language, **App**, **Free**.
3. Work through **Dashboard → Set up your app**: privacy policy URL, app
   access (give them a working test account — the reviewer cannot sign up,
   since there is no checkout in the app), ads declaration, content rating
   questionnaire, target audience, data safety.
4. **Data safety matters here.** Declare what the site collects: email,
   name, phone, health and fitness data, photos (the meal scan). Say that it
   is encrypted in transit and that users can request deletion.

### 6. Enable Play App Signing and get the real fingerprint

This is the step that decides whether the app looks like an app or like a
browser tab.

1. Upload `app-release-bundle.aab` to a release (the closed test track in
   step 8 is fine for this).
2. Play App Signing is on by default for new apps. Accept it.
3. Go to **Test and release → Setup → App signing**.
4. Copy the **SHA-256 certificate fingerprint** under *App signing key
   certificate*.

> Copy the **app signing key** fingerprint, **not** the upload key
> fingerprint. Both are on that page. Google re-signs your upload with the app
> signing key, so that is the certificate on users' devices. Using the upload
> key's fingerprint is the classic mistake, and you cannot catch it locally —
> a sideloaded APK is signed with the upload key and verifies perfectly.

### 7. Put the fingerprint live, then verify

1. In Vercel → the project → **Settings → Environment Variables**, add:

   ```
   ANDROID_CERT_FINGERPRINT = AB:CD:EF:...  (the SHA-256 from step 6)
   ```

2. **Redeploy.** Environment variables do not apply to an existing deployment.
3. Check it is live:

   ```bash
   curl https://hypefitness.club/.well-known/assetlinks.json
   ```

   The `sha256_cert_fingerprints` array must contain your fingerprint and
   **not** `PASTE_PLAY_APP_SIGNING_SHA256_HERE`. Content type must be
   `application/json`.
4. Confirm Google agrees, with the official tester:
   <https://developers.google.com/digital-asset-links/tools/generator>

**How you know it worked:** install the app and open it. No URL bar across the
top means verification passed. A URL bar means it failed and Chrome fell back
to a Custom Tab — recheck the fingerprint. To see why:
`adb logcat | grep -e OriginVerifier -e digital_asset_links`.

### 8. Closed test track

Play requires a closed test with **at least 12 testers running the app for 14
continuous days** before a personal developer account can apply for production.
Start this early — the clock is the long pole, not the code.

1. **Test and release → Testing → Closed testing → Create track**.
2. Add testers by email list, or a Google Group (a group is much easier to
   change later).
3. Upload the `.aab`, add release notes, roll out.
4. Share the opt-in URL with your testers. They must **accept the invitation
   and install from Play** — a sideloaded APK does not count toward the 14
   days.
5. Testers must keep it installed. Check **Track summary** for the tester
   count Google is actually seeing; it is the number that matters, not the
   number of people you invited.

---

## Updating later

```bash
bubblewrap update        # pull changes from twa-manifest.json
bubblewrap build
```

`update` **deletes or overwrites anything you added to the generated Android
project by hand** — so if the app ever needs native code, it goes in a patch
script or a fork of the template, never a manual edit.

Most changes need no new build at all: the app loads the live site, so
shipping to Vercel ships to the app. A new `.aab` is only needed for the icon,
the name, the splash, the start URL, permissions, or the target SDK.

## Troubleshooting

| Symptom | Cause |
|---|---|
| URL bar at the top of the app | Asset links failed. Wrong fingerprint (upload vs app signing), not redeployed, or `packageId` mismatch. |
| App opens the marketing page | The `?app=1` → cookie exchange did not happen. Check `startUrl`, and that `/login?app=1` 307s with a `set-cookie`. |
| Google sign-in refused | Should not happen in a TWA. If it does, the app is running as a WebView, not Chrome — check the device actually has Chrome. |
| Build fails on JDK | Wrong Java version. Must be 17. |
| `bubblewrap` cannot find the SDK | Spaces in the SDK path. |
