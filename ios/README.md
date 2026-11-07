# HYPE FITNESS — iPhone app (Capacitor)

This folder is the iPhone app. Like the Android app in `android-twa/`, it is
the live website (`hypefitness.club`) inside a native frame: a deploy reaches
installed iPhones without an App Store update. Only changes to
`capacitor.config.ts`, this native project, its permissions or its icons need
a new build.

**Why Capacitor here and a TWA on Android:** iOS has no Trusted Web Activity.
Capacitor's WKWebView is the standard way to ship a web app on the App Store.
The cost is that Google blocks its sign-in page inside embedded web views, so
"Continue with Google" needs a native sign-in plugin before review — see
`STORE-LAUNCH.md`.

**How the server knows it is the app:** `capacitor.config.ts` appends
`HypeFitnessApp` to the user agent. The proxy treats that exactly like the
Android app's `?app=1` cookie — no marketing pages, no checkout, no prices.
Nothing on the server had to change.

## What is in git and what is generated

| Path | In git | Notes |
|---|---|---|
| `capacitor.config.ts` (repo root) | yes | the app's settings |
| `ios-shell/www/` | yes | the offline page and an empty start page, bundled in the app |
| `ios/App/App/Info.plist` | yes | camera and photo permission wording, portrait only |
| `ios/App/App/Assets.xcassets/` | yes | icon and launch image — regenerate with `python scripts/generate-app-icons.py` |
| `ios/App/App/public/`, `capacitor.config.json` | no | copied in by `npx cap sync ios` |

The project uses **Swift Package Manager**, not CocoaPods, so there is no
`pod install` step.

## Building it

iOS apps can only be built on macOS with Xcode. From Windows you have two
options.

### Option A — a Mac (yours or borrowed)

1. Install the current **Xcode** from the Mac App Store, and Node 20+.
2. Clone the repo, check out this branch, then:
   ```bash
   npm ci
   npx cap sync ios
   npx cap open ios
   ```
3. In Xcode: select the **App** target → **Signing & Capabilities** → tick
   *Automatically manage signing* and pick your team (needs the Apple
   Developer Program, see `STORE-LAUNCH.md`).
4. Plug in an iPhone and press ▶︎ to run it, or **Product → Archive** to upload
   to App Store Connect / TestFlight.

### Option B — Codemagic (cloud Mac, works from Windows)

Codemagic builds iOS apps on its Macs and uploads them to TestFlight; its free
tier covers occasional builds.

1. Sign up at codemagic.io with the GitHub account that owns this repo.
2. In App Store Connect → Users and Access → Integrations → **App Store
   Connect API**, create a key with *App Manager* access. Download the `.p8`
   once — Apple never shows it again. Never commit it (it is gitignored).
3. In Codemagic, add that key under Team → Integrations → Developer Portal,
   and let it manage signing for `club.hypefitness.app`.
4. Build workflow: Node, then `npm ci`, `npx cap sync ios`, then Codemagic's
   *Xcode project build* on `ios/App/App.xcodeproj`, scheme `App`, with
   *Publish to App Store Connect* enabled.

## Testing against a preview deployment

```bash
CAP_SERVER_URL=https://<preview>.vercel.app npx cap sync ios
```

The URL is written into the build at sync time, so sync again before every
build. Without it, the app loads `https://hypefitness.club`.

## Things that look like bugs but are not

- **"Continue with Google" opens Safari and never comes back.** Expected until
  native Google sign-in lands. Email and password work.
