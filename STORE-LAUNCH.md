# Launch checklist — Google Play and the App Store

Everything between "the app builds" and "the app is live in both stores", in
the order it has to happen. **Code** items are work in this repo; **You**
items need your accounts, money, a phone or a decision.

Platform details live with each shell: [android-twa/README.md](android-twa/README.md)
(Android, Trusted Web Activity) and [ios/README.md](ios/README.md) (iPhone,
Capacitor).

---

## 0. Decisions before anything else

- [ ] **You — how iPhone users pay.** The App Store is stricter than Google
  Play here. Google allows a "consumption-only" app: accounts bought on the
  website sign in, nothing is sold in the app (what the app mode already
  does). Apple's rule 3.1.3(b) lets an app unlock a subscription bought
  elsewhere *provided it is also offered as an in-app purchase*. Shipping
  sign-in-only is likely to be rejected for a subscription product like
  this one. The realistic options:
  1. Add Apple in-app purchase for the subscription on iOS (Apple keeps 15%
     under its Small Business Program; RevenueCat makes this manageable), or
  2. Submit sign-in-only, accept the rejection risk, and argue the case in
     review.
  Decide before building payment-related screens.
- [ ] **You — individual or organisation account,** on both stores. An
  organisation account shows the company as the seller and skips Google's
  closed-testing requirement (section 2), but needs a D-U-N-S number
  (free, takes days to weeks).

## 1. Code that both stores require

- [ ] **Code — delete my account, inside the app.** Required by Google Play
  (data deletion policy, plus a web link to request it) and by Apple (rule
  5.1.1(v)). Today only admins can delete accounts.
- [ ] **Code — a privacy policy page** at a public URL, e.g.
  `hypefitness.club/privacy`. Both store listings require the link. It must
  cover what is collected (account, weight and check-ins, meals, meal photos
  sent for estimation, workout logs) and who processes it (Supabase, the AI
  model used for photo estimates, Meta pixel on the website).
- [ ] **Code — native Google sign-in on iPhone.** Google refuses its sign-in
  page inside embedded web views, so "Continue with Google" cannot work in
  the iPhone app as is. Needs a native plugin and the Supabase ID-token
  sign-in flow. (Android's TWA runs in real Chrome and is unaffected; if
  Google sign-in fails there, check the Supabase redirect allowlist.)
- [ ] **Code — Sign in with Apple.** Apple rule 4.8: an app that offers Google
  sign-in must also offer an equivalent privacy-focused option. Sign in with
  Apple is the standard answer, and Supabase supports it.
- [ ] **Code — push notifications** (strongly recommended for iOS). Apple
  rejects apps that are "just a website" (rule 4.2). Native features are
  what clear that bar; daily check-in and workout reminders are the natural
  ones here.
- [ ] **Code — a review account.** Both stores need a working login for their
  reviewers. A dedicated, active test account with a program, a meal plan
  and some history, created by script and never deleted.

## 2. Google Play

- [ ] **You — Play Console account,** $25 once, with identity verification.
- [ ] **You — closed test, 12 testers, 14 days.** New *personal* developer
  accounts must run a closed test with at least 12 testers opted in for 14
  days in a row before they can apply for production. Start this early: it
  is the longest wait in the whole process. (Organisation accounts are
  exempt.)
- [ ] **You — upload the signed bundle** (`app-release-bundle.aab`, see
  `android-twa/README.md`), and enrol in Play App Signing.
- [ ] **You — Digital Asset Links:** copy the *Play App Signing* SHA-256 from
  Play Console into `ANDROID_CERT_FINGERPRINT` on Vercel and redeploy.
  Without it the app shows a browser bar at the top.
- [ ] **You — store listing:** name, short description (80 characters), full
  description, 512×512 icon (`public/icons/icon-maskable-512.png`),
  1024×500 feature graphic, at least 2 phone screenshots. English and Arabic
  listings if you want both.
- [ ] **You — App content forms:** privacy policy URL, data safety, content
  rating, target audience (adults), ads (none in the app), **health apps
  declaration** (fitness and nutrition features), account deletion URL, and
  app access (the review account).

## 3. App Store

- [ ] **You — Apple Developer Program,** $99 a year.
- [ ] **You — a way to build:** a Mac with Xcode, or Codemagic from Windows
  (see `ios/README.md`).
- [ ] **You — App Store Connect app record** for bundle ID
  `club.hypefitness.app`, with support URL and privacy policy URL.
- [ ] **You — App Privacy answers** (the "nutrition label"): health and
  fitness data, photos, contact info, used for app functionality, linked to
  the user, not used for tracking inside the app.
- [ ] **You — screenshots** for the 6.9-inch iPhone size (1320×2868 or
  1290×2796). The app is iPhone-only and portrait-only, so no iPad sets are
  needed.
- [ ] **You — age rating questionnaire** and **review notes**: the review
  account, and one line explaining that accounts are bought on the website
  (or that in-app purchase is offered, per decision 0).
- [ ] **You — TestFlight** on your own iPhone first, then submit for review.

## 4. Already done

- [x] App mode: no marketing pages, checkout, prices or bank details inside
  either app (`src/lib/access.ts`, `src/proxy.ts`).
- [x] Android shell: Bubblewrap project, signing, asset links route,
  black splash and icons, targetSdk 36.
- [x] iPhone shell: Capacitor project, user-agent marker, offline page,
  camera and photo permission wording, portrait-only, iPhone-only, icon
  and launch screen.
- [x] Offline page, service worker, native-feeling chrome (no zoom, no
  translate bar), camera-first meal scanner.
