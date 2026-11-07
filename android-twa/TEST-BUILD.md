# Test build on your phone, today

A sideloaded APK pointed at the **preview deployment** of `feat/app-shell`, so
you can hold the app in your hand without merging anything.

The branch is pushed. Everything below is yours to run — it needs a toolchain,
a signing key and the Vercel dashboard.

For the production route (Play Console, Play App Signing, closed testing) see
[README.md](./README.md). This file is the short path to a device.

---

## Before anything: three settings that will silently break this

Do these first. Each one fails in a way that looks like a different problem.

### 1. Vercel Deployment Protection must be OFF for previews

This is the big one. If preview deployments require a Vercel login, your phone
gets an auth wall instead of the app, **and** Chrome gets a `401` when it
fetches `assetlinks.json` — so verification fails and you get a URL bar even if
everything else is perfect.

Vercel → your project → **Settings → Deployment Protection** → set Vercel
Authentication to **Disabled** for Preview (or at minimum allow public access
to this deployment). Turn it back on when you are done testing.

Check it from a machine that is not logged into Vercel:

```bash
curl -I https://<PREVIEW-HOST>/.well-known/assetlinks.json
```

`200` means you are fine. `401` means protection is still on.

### 2. Don't let `SITE_URL` point at production

`src/lib/site-url.ts` prefers `SITE_URL` / `NEXT_PUBLIC_SITE_URL` over Vercel's
own variables. If either is set to `hypefitness.club` in the **Preview**
environment, sign-in on the preview will redirect to production and you will
test the wrong site without noticing.

Vercel → **Settings → Environment Variables**: make sure neither is set for
Preview. Left unset, the code falls through to `VERCEL_URL`, which is the
preview host — exactly what you want.

### 3. Supabase has to allow the preview URL back

Supabase → **Authentication → URL Configuration → Redirect URLs**, add:

```
https://*.vercel.app/**
```

Without it, Supabase drops the redirect after Google sign-in and sends people
to the project's Site URL instead.

---

## Step 1 — Toolchain

**Your machine right now:** Node v22 ✓. Java on your PATH is **1.8**, and
`JAVA_HOME` points at **JDK 19**. Bubblewrap needs **JDK 17** exactly — lower
cannot compile the project, higher is incompatible with the Android
command-line tools.

**Do not change `JAVA_HOME`.** Let Bubblewrap install and manage its own copy:
it keeps its paths in `~/.bubblewrap/config.json` and ignores your system Java,
so nothing else on your machine is touched.

```bash
npm i -g @bubblewrap/cli
```

Then, from the `android-twa` folder:

```bash
bubblewrap doctor
```

The first run offers to download JDK 17 and the Android SDK command-line
tools. **Say yes to both** and accept the Android SDK licence when asked.
It is a few hundred MB and takes a few minutes.

> If you ever install the SDK yourself instead, put it somewhere with **no
> spaces** in the path — `C:\android-sdk`, not `C:\Program Files\...`.
> Bubblewrap breaks on spaces.

## Step 2 — Get the preview URL

Vercel → your project → **Deployments**, find the one for `feat/app-shell`.
Copy the branch URL (the stable one, ending `-git-feat-app-shell-…`), not the
per-deployment hash URL — the branch URL survives the next push.

It looks like `something-git-feat-app-shell-yourname.vercel.app`.

Sanity-check it in a browser before going further: the marketing page should
load, and `https://<PREVIEW-HOST>/manifest.webmanifest` should return JSON.

## Step 3 — Create the project and your signing key

From `android-twa`:

```bash
bubblewrap init --manifest https://<PREVIEW-HOST>/manifest.webmanifest
```

It asks a lot of questions. **Press enter through all of them** — the next step
overwrites everything that matters — except these:

| Prompt | Answer |
|---|---|
| Application name | `HYPE FITNESS` |
| Short name | `HYPE` |
| Application ID / package | `club.hypefitness.app` |
| Key store location | `./android.keystore` |
| Key alias | `hypefitness` |
| Create a new signing key? | **Yes** |

It then asks for a keystore password and a key password, plus name/org/country
for the certificate. The certificate details are cosmetic; the passwords are
not.

> **Back up `android.keystore` and both passwords right now**, to a password
> manager and one other place. This file is how Google Play will identify the
> app forever. Lose it and you cannot ever update the listing — you start over
> with a new package name and zero installs. It is gitignored; keep it that way.

## Step 4 — Apply our settings and build

`init` writes its own `twa-manifest.json` over ours, and three of its choices
are wrong in ways that fail quietly — most importantly `startUrl`, which it
takes from the web manifest as `/dashboard`. The app must launch at
`/login?app=1`, because that flag is the only way the server learns it is
talking to the app rather than a browser. Without it the shell gets the full
website: marketing pages, checkout, prices.

So:

```bash
node apply-config.mjs <PREVIEW-HOST>
bubblewrap update
bubblewrap build
```

`build` asks for the two passwords from step 3.

## Step 5 — Where the APK is

```
C:\Users\MSI\Desktop\Platform\android-twa\app-release-signed.apk
```

Alongside it, `app-release-bundle.aab` — that one is for Play, ignore it today.

Install it:

```bash
adb install -r app-release-signed.apk
```

No adb? Copy the `.apk` to the phone (USB, Drive, email it to yourself), open
it in the Files app, and allow "install unknown apps" when prompted.

## Step 6 — Your key's SHA-256, into the preview

A sideloaded APK is signed with **your** key, not Google's — so for this test
the fingerprint is the one from the keystore you just made.

```bash
bubblewrap fingerprint list
```

Or straight from the keystore:

```bash
keytool -list -v -keystore android.keystore -alias hypefitness
```

Copy the **SHA256** line — 32 hex pairs separated by colons,
`AB:CD:EF:...`.

Then Vercel → **Settings → Environment Variables → Add**:

| | |
|---|---|
| Name | `ANDROID_CERT_FINGERPRINT` |
| Value | your SHA-256 |
| Environment | **Preview** only |

**Then redeploy.** Environment variables do not apply to deployments that
already exist — Vercel → Deployments → the `feat/app-shell` one → ⋯ →
**Redeploy**.

Confirm it went live:

```bash
curl https://<PREVIEW-HOST>/.well-known/assetlinks.json
```

Your fingerprint must be in `sha256_cert_fingerprints`, and
`PASTE_PLAY_APP_SIGNING_SHA256_HERE` must be gone.

> When you later ship to Play, this value changes. Play re-signs your upload
> with its own key, so production needs **Play's** app signing fingerprint, set
> on the Production environment. Same variable, different value, different
> environment — see [README.md](./README.md) step 6.

## Step 7 — Did it work?

Open the app.

- **No URL bar at the top** → asset links verified. It is a real TWA.
- **A URL bar** → verification failed. Almost always: deployment protection
  still on, the wrong fingerprint, you forgot to redeploy, or `packageId` does
  not match. Plug the phone in and run
  `adb logcat | grep -e OriginVerifier -e digital_asset_links`.

Then check the things this whole branch was about:

- It opens on the **dashboard**, not the marketing page, and not a login form
  if you are already signed in.
- **Google sign-in works** — this is the reason we chose a TWA over Capacitor.
- There is **no price, no checkout and no RIB** anywhere, including on an
  unactivated account.
- The bottom bar is Today · Workout · scan · Food · Progress.
- Turn on aeroplane mode and navigate: you get our offline screen, not Chrome's
  dinosaur.
- The meal scan opens the camera.

## When you are done

- Turn Vercel Deployment Protection back **on**.
- Before you ever install the Play build on this phone, **uninstall this test
  build**. Same package name, different signing key — Android refuses to
  install over it, and the error it gives does not explain why.
