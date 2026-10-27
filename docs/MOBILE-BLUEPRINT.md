# Mobile apps blueprint (Phase 3): Google Play and the App Store

**Status: approved plan. The founder answered all decisions on 26 October 2026 (§2A). Nothing is
built, bought or submitted yet.** Where an older paragraph and §2A disagree, §2A wins.

This is the plan for publishing Mean Chess as an Android app on Google Play and an iPhone and iPad
app on Apple's App Store. It is written so that later sessions can follow it **step by step at low
effort**: every decision is listed with a recommendation, every task has exact steps and a "done when"
check, and every store fact that matters has been researched and dated.

Companion documents:
- [MOBILE-STORES.md](MOBILE-STORES.md): every store requirement, form, field, asset and policy, with
  draft listing text and the answers to give.
- [MOBILE-RUNBOOK.md](MOBILE-RUNBOOK.md): the founder's click-by-click steps (accounts, testers,
  consoles), the release procedure for every update, and key custody.

---

## 0. The 60-second version

- **What ships, and when:** **Android first.** It launches **together with online play** (Phase 2;
  decision M11), as **version 1.0.0** of both app and website (M17). It contains the whole game:
  - rules, the 16-lesson tutorial, the computer at every level and Auto;
  - a friend on one device, and online play by invite link;
  - themes and Scenario Lab;
  - new sound effects (on the website too), haptics, and an occasional "rate us" prompt.

  Everything except online play works offline.
- **iOS waits** until an Apple device is available: in India, Apple enrolment works only in the Apple
  Developer app (M2: none yet). The iOS work is fully planned here, ready to resume.
- **Money:**
  - Google Play costs **25 USD once**.
  - The app is **free with ads**: a banner on menu screens, and at most one full-screen ad after every
    3rd finished game. Never during a game or the tutorial. Personalised only with consent.
  - An optional supporter purchase (e.g. "remove ads") comes later (M7).
  - Apple's 99 USD a year comes later.
- **How:** [Capacitor 8](https://capacitorjs.com) wraps the existing React/Vite build in a native
  shell. Google AdMob through a Capacitor plugin, with Google's consent tool (UMP). No rewrite. The
  rules engine and the computer opponent don't change.
- **Builds without a Mac:** GitHub Actions (free for this public repository).
- **What the founder accepts:** the public contact email is the founder's personal Gmail (M5).
  Earning from ads makes the founder an EU **trader**, so the **legal address and phone number are
  shown** on EU store pages (M15).
- **Biggest blockers:**
  1. **Online play must be built first** (Phase 2; it needs the founder's Cloudflare setup).
  2. **12 testers opted in for 14 days** (Google, new personal accounts). The founder will recruit
     friends and fill the gap through tester-exchange communities (§2A, "Tester plan").
  3. **The AdMob account** must be approved, with `app-ads.txt` on the website, before ads serve.
- **Calendar:** the Android shell, sounds, ads and store material (about 6–8 Claude sessions) can be
  built **in parallel** with online play. The **closed test can start before online play is
  finished**, testing everything else, so the 14-day clock runs while the server is built. Launch
  follows online play by about a week (production review).

## 1. Scope

**In app 1.0 (Android; the same build later on iOS):**
- Everything on the website: the welcome page, the 16-lesson tutorial, the computer (Nice, Mean,
  Ruthless, Auto), a friend on the same device, Scenario Lab, the four themes, the full rules, Undo,
  saved games.
- **Online play by invite link** (Phase 2 v0.3 scope, renumbered into 1.0 by M17). Invite links open
  the app if it's installed (§5.9).
- **Sound effects** (new, original, synthesised; on the website too), with a mute switch (§5.12).
- **Native touches:** haptics; the system share sheet; the Android back button; status bar per theme;
  safe areas; icon and splash screen. External links open in the phone's browser.
- **Ads** (AdMob): a banner on menu screens and at most one full-screen ad after every 3rd finished
  game. Never during a game or a lesson. A consent form where the law requires it (§5.11).
- **A "rate us" prompt** through the stores' own in-app review dialogs, rarely and never mid-game
  (§5.13).
- **Anonymous usage counters** (the F6b beacons from Phase 2, P2-34), declared in the privacy forms
  (M19).
- Website pages: `/privacy/`, `/support/` and `/app-ads.txt` (§5.7).

**Not in app 1.0:** accounts, chat, purchases (the supporter purchase comes later: M7), push
notifications, Game Center or Play Games, widgets, languages other than English (M21), over-the-air
code updates.

## 2. Founder decisions

The founder answers these once (like F1–F14 for Phase 2). **Recommended answers are first.**

| # | Decision | Options (recommended first) | Why it matters |
|---|---|---|---|
| **M1** | Which stores, in what order | **(a) Android first, iOS as soon as M2 and M3 allow**; (b) both together; (c) Android only for now | Android costs 25 USD once and needs no Apple device. iOS needs 99 USD a year and an Apple device in India. |
| **M2** | Apple device | **Which of these do you have or can borrow:** an iPhone, an iPad or a Mac? | **In India, Apple Developer enrolment works only through the Apple Developer app**, on an iPhone, iPad or Mac. Testing on a real iPhone is strongly recommended too (TestFlight). Without one, iOS waits. |
| **M3** | Fees | **(a) Pay Google's 25 USD now; decide on Apple's 99 USD a year when iOS is ready**; (b) pay both now; (c) neither yet | These are the only unavoidable costs. Apple renews yearly; if it lapses, the app leaves the App Store. |
| **M4** | Account type | **(a) Personal (individual) accounts in your legal name**; (b) organisation accounts (needs a registered business and a D-U-N-S number) | Personal accounts are quicker and cheaper. On Google Play, new personal accounts must run the **12-tester, 14-day closed test**. On both stores **your legal name is shown as the developer or seller**. |
| **M5** | Public contact email | **(a) A new address only for the apps, e.g. `meanchess.app@gmail.com`**; (b) your personal email | Both stores show a developer email publicly, and it must keep working for the life of the account. A dedicated address keeps spam out of your personal inbox. |
| **M6** | App name and ID | **Name: "Mean Chess". ID: `com.siddheshthapa.meanchess`** | The ID (package name and bundle ID) **can never change** after the first upload. If "Mean Chess" is taken in a store, the fallback is "Mean Chess: Kings Kill Kings". |
| **M7** | Price and money | **(a) Free, no ads, no purchases** (as the website); (b) free with an optional "supporter" purchase later; (c) paid | Free with nothing to sell keeps the forms simple: no payments profile, no tax forms, and EU "non-trader" status (M15). Anything else adds banking, tax and public-address requirements. |
| **M8** | The blood in Royal Slaughter | **(a) Keep it, and answer the age-rating forms honestly** (expected: Apple 9+, PEGI 7, ESRB Everyone 10+); (b) add a "gentle mode" setting that swaps blood for sparks, still declared; (c) remove blood in the apps | The red liquid counts as mild cartoon or fantasy violence. It raises the age rating from the lowest band to about 9+ / 7+ / 10+. It does not block publishing. |
| **M9** | Target audience (Google Play) | **(a) 13 and over**; (b) include children under 13 | Choosing under-13 enters Google's Families programme, which brings extra rules and review. Chess is fine for kids, but the 13+ choice keeps v1 simple; it can widen later. |
| **M10** | Tablets | **(a) Yes: phones and tablets, iPad included**; (b) phones only | The layout already adapts. Supporting iPad needs one set of iPad screenshots (Claude generates them). |
| **M11** | Online play timing | **(a) Ship app 1.0 now with today's features; add online play in an update**; (b) wait for online play | (a) gets the apps live weeks earlier. The 14-day Android test can start while the server is built. |
| **M12** | Native extras in 1.0 | **(a) Haptics, share sheet, back button, status bar, splash**; (b) also sound effects (new original sounds, on web too); (c) also an in-app "rate us" prompt | (a) is the minimum to feel native and pass Apple's 4.2. Sounds are a bigger design task and could come in 1.1. |
| **M13** | Testers | **You recruit 12+ friends or family with Android phones and Google accounts, who stay opted in for 14 days** (more is safer: recruit 15) | Google's rule for new personal accounts. **If anyone leaves and the count drops below 12, the 14 days start again.** It's the longest single wait in the plan. |
| **M14** | Support channel | **(a) GitHub Issues plus the public email from M5**; (b) email only | Both stores require a support URL. The site gets a `/support/` page that points to both. |
| **M15** | EU "trader" status (Digital Services Act) | **(a) Non-trader** (a free hobby project with no income); (b) trader (your address and phone number are shown publicly in the EU) | Both stores ask before distributing in the EU. Being free with no ads or purchases points to non-trader. It's a legal judgement, so it's yours. |
| **M16** | App icon | **Claude draws 3 icon sketches (crown, Warlord king, kill shot); you pick one** | It's the first thing anyone sees in the store. Original art, as always (D-32). |
| **M17** | Version numbers | **(a) The store launch becomes 1.0.0 for app and website together; online play becomes 1.1.0**; (b) keep 0.x (the stores accept it) | People read 0.x in a store as "unfinished". With (a), ROADMAP's v0.3 to v0.7 become 1.1 to 1.5; the order is unchanged. |
| **M18** | Repository | **(a) Stays public** (free macOS builds; signing keys stay in GitHub's encrypted secrets, never in code); (b) private (macOS build minutes are no longer free) | Public keeps iOS builds free. |
| **M19** | Analytics in the apps | **(a) None in 1.0** (the store privacy forms say "no data collected"); (b) anonymous counters as planned for the web (P2-34), declared in the forms | (a) is the simplest honest answer and avoids an extra review risk. |
| **M20** | Store countries | **(a) All countries both stores allow**; (b) a chosen list | No reason to exclude anyone. English only in 1.0 (decision M21 can add languages later). |
| **M21** | Languages | **(a) English only for 1.0**; (b) also Hindi or other languages | Translating the app, tutorial, rules and store text is a separate project. |

### 2A. The founder's answers (26 October 2026)

| # | Answer | Consequences in this plan |
|---|---|---|
| M1 | **Android first**, iOS when possible | Milestones C2 and D3 (iOS) wait for M2 |
| M2 | **No Apple device yet** | iOS enrolment is impossible for now (India: app-only enrolment). Everything iOS stays planned; resume when a device can be used or borrowed for enrolment and testing. |
| M3 | **Google's 25 USD now; Apple later** | — |
| M4 | **Personal accounts** | The legal name is public; 12 testers × 14 days |
| M5 | **The founder's personal Gmail** as the public developer email | It appears on Google Play, the privacy policy and `/support/`. The address itself is recorded in the handover. |
| M6 | **"Mean Chess", `com.siddheshthapa.meanchess`** | Permanent |
| M7 | **Free with some ads; optional supporter purchase later** | AdMob, consent (UMP), `app-ads.txt`, AD_ID permission, ads declared in every form (MOBILE-STORES.md). The supporter purchase (Play Billing, later Apple IAP) is a later release with its own plan. Ads only in the apps; **the website stays ad-free** (assumption: the founder asked about the apps; confirm before changing the website). |
| M8 | **Keep the blood**, rate honestly | Apple 9+, PEGI 7 (maybe 12), ESRB E10+ |
| M9 | **13 and over** | Not in the Families programme. AdMob's maximum ad content rating is set to **T (Teen)**. |
| M10 | **Phones and tablets** | Tablet screenshots for Play (and iPad later) |
| M11 | **Wait for online play** | The apps launch with online play. Phase 2 (Cloudflare setup, then A0–A11) is now on the critical path. The shell and closed test run in parallel. |
| M12 | **Basics + sound effects + rate-us prompt** | §5.12, §5.13; tasks B6 and B8 |
| M13 | **Hard to find 12 testers** | Tester plan below |
| M14 | **GitHub Issues + email** | `/support/` page |
| M15 | **EU trader**, accepting public details | Legal address and phone are shown on EU store pages. Asked in Play Console and App Store Connect. |
| M16 | **3 icon sketches**, founder picks | Task B4 |
| M17 | **1.0.0 for app and website** | ROADMAP renumbering: online play is part of **1.0.0**; clocks 1.1, lobby 1.2, optional accounts 1.3, ratings 1.4 |
| M18 | **Repository stays public** | Free macOS builds later |
| M19 | **Anonymous counters** (P2-34) | Declared as "App interactions, analytics, not linked to the user" (MOBILE-STORES.md §6) |
| M20 | **All allowed countries** | Including the EU (as a trader) |
| M21 | **English only** | — |
| Ad style | **Never during a game:** a banner on menu screens; at most one full-screen ad after every 3rd finished game; none in the tutorial | §5.11 |
| Ad privacy | **Ask consent; personalise if yes** | Google UMP consent form (EEA, UK, Switzerland, and US states that require one); later on iOS, the App Tracking Transparency prompt |
| Tester plan | **Friends + tester-exchange groups** | Runbook §2.5: the founder recruits friends first and fills the rest from free communities where developers test each other's apps (the founder tests theirs in return). Recruit to **15–20** for safety. |

Founder actions that aren't decisions (the email, accounts, payment, testers) are in
[MOBILE-RUNBOOK.md](MOBILE-RUNBOOK.md) §1–§4.

## 3. Costs

| Item | Cost | When | Notes |
|---|---|---|---|
| Google Play developer account | **25 USD, one time** | Before the first upload | Card payment in Play Console. Non-refundable. |
| Apple Developer Program (individual) | **99 USD a year**, charged in rupees during enrolment | Before the first iOS upload | Auto-renews. If it lapses, the app is removed from sale until it's renewed. |
| Apple device for enrolment and testing | Already owned or borrowed (M2) | Before enrolment | No Mac needed to build: CI does it. |
| Capacitor, fastlane, Android tools, Xcode (on CI) | $0 | — | Open source or free. |
| GitHub Actions builds (Android on Linux, iOS on macOS) | $0 | Every build | Free for public repositories on standard GitHub-hosted runners. Never pick "larger" runners: those are always billed. |
| Store listings, screenshots, icons | $0 | — | Claude generates them (§6.7). |
| Domain, hosting, privacy page | $0 | — | Already in place (GitHub Pages). |
| Google AdMob account | $0 (it pays out instead) | Before ads go live | Payouts once earnings pass AdMob's threshold; AdMob asks for tax and bank details first (runbook §2.9) |
| **Total** | **25 USD for Android now; 99 USD a year more for iOS later** | | |

## 4. Facts this plan relies on (checked 26 October 2026)

The full list with links is in [MOBILE-STORES.md](MOBILE-STORES.md) §12. **Re-check the "upcoming
requirements" pages of both stores on the day of each release.**

| Fact | Consequence |
|---|---|
| New Google Play apps and updates must **target Android 16 (API 36)** from 31 August 2026 | Capacitor 8 targets API 36 by default. |
| New **personal** Google Play accounts (created after 13 November 2023) must run a **closed test with at least 12 testers opted in for 14 continuous days** before applying for production | Recruit 15 testers (M13); budget 3 weeks. |
| Google Play shows the developer's **legal name, country and developer email**; with monetisation, the full address too | Use a dedicated email (M5); stay free (M7). |
| App Store uploads must be built with **Xcode 26 and the iOS 26 SDK** (since 28 April 2026) | Use a macOS runner image with Xcode 26; Capacitor 8 requires Xcode 26. |
| **Apple enrolment in India works only through the Apple Developer app** | Needs an Apple device (M2). |
| Apple individual enrolment: an Apple Account with two-factor authentication, **legal name** as seller, **your own card** (otherwise ID checks and delays); 99 USD a year in local currency | See the runbook, §3. |
| Apple's age ratings now include 13+, 16+ and 18+; the new questionnaire has been mandatory since 31 January 2026 | Answer the new questions (MOBILE-STORES.md §5). |
| Apps that are "a website in a box" are a common rejection under **App Store guideline 4.2** | §5.4 lists what makes Mean Chess an app. |
| Every iOS app needs a **privacy manifest** (`PrivacyInfo.xcprivacy`) declaring any "required reason" APIs it uses (e.g. UserDefaults) | Task B3. |
| At **target API 36, Android edge-to-edge can't be switched off**; Capacitor 8's built-in SystemBars handles the insets | Task B2 (safe areas). |
| Capacitor 8: Android minSdk 24, compile and target 36, Java 21; iOS 15.0 or later; Xcode 26; Node 22+ | Fits the current toolchain (Node 24). |

## 5. Architecture

### 5.1 One codebase, three targets

```
src/ (unchanged React app, rules engine, computer opponent)
  └─ src/platform/          NEW: one small adapter: web or native (haptics, share, links, storage)
vite build                  → dist/            (website, as now)
vite build --mode app       → dist-app/        (same pages, app flags on)
npx cap sync                → android/ ios/    (native shells, committed to the repo)
GitHub Actions              → .aab for Google Play, .ipa for App Store Connect (TestFlight)
```

- **The rules engine (`src/engine`) and the computer (`src/ai`) are untouched.** The lint boundary
  stays as it is.
- **No server is needed for app 1.0.** All play is on the device, as on the website.
- **`android/` and `ios/` are committed** (as Capacitor intends). Generated build output inside them
  is git-ignored.

### 5.2 The app build (`--mode app`)

A Vite mode sets `import.meta.env.VITE_TARGET = 'app'`. Only `src/platform/` and a few call sites
read it:

| Concern | Web | App |
|---|---|---|
| Page links (`/play/`, `/tutorial/`, `/rules/`) | As now | Spike A0 checks whether Capacitor's local server resolves `/play/` to `play/index.html`. If not, a `pageHref()` helper returns `/play/index.html` in the app. |
| External links (Lichess and Chess.com guides, GitHub source) | `target="_blank"` | Opened in the **system browser** (Safari or Chrome), leaving the app. Not an in-app browser: Apple's age-rating form asks about "unrestricted web access", and this keeps the answer a clear "no". |
| "Share game" / "Copy position" in Scenario Lab | Clipboard, as now | `@capacitor/share`: the system share sheet (copy remains) |
| Haptics | None | `@capacitor/haptics`: light tap on every move; medium on captures and sacrifices; heavy on Royal Capture, Royal Slaughter and checkmate. Off when "Animate moves" is off. |
| Saved data (`mean-chess:*:v1` keys) | `localStorage` | Kept in `localStorage`, which persists in Capacitor apps. Spike A0 confirms it survives app updates. If it doesn't, `@capacitor/preferences` mirrors the six keys (this needs the UserDefaults entry in the privacy manifest). |
| Status bar | `theme-color` meta tag | Capacitor SystemBars: light or dark icons per theme (Mean and Arcade dark; Sugar and Picnic light) |
| Back button (Android) | Browser back | `@capacitor/app` `backButton`: close an open dialog; otherwise go back a page; on the welcome page, exit |
| Ads | None (the website stays ad-free) | AdMob banner and interstitial through `src/platform/ads.ts` (§5.11) |
| Usage counters (M19) | The Phase 2 beacons (P2-34) | The same beacons, tagged `app-android` or `app-ios` |
| Sound effects (M12) | Web Audio, synthesised | The same code (§5.12) |
| Rate prompt (M12) | None | The store's in-app review dialog (§5.13) |
| Footer "Open source" link | As now | As now, opened in the system browser |

### 5.3 Native shell settings

`capacitor.config.ts` (task A1):
```ts
import type { CapacitorConfig } from '@capacitor/cli'
const config: CapacitorConfig = {
  appId: 'com.siddheshthapa.meanchess', // M6. Never change after the first upload.
  appName: 'Mean Chess',
  webDir: 'dist-app',
  backgroundColor: '#0b0b0d', // Mean theme --bg; no white flash at launch
  android: { allowMixedContent: false },
  ios: { contentInset: 'never' },
  plugins: {
    SplashScreen: { launchShowDuration: 600, backgroundColor: '#0b0b0d', showSpinner: false },
    SystemBars: { insetsHandling: 'native' },
  },
}
export default config
```
- **Android:** `minSdkVersion 24`, `compileSdkVersion 36`, `targetSdkVersion 36` (Capacitor 8
  defaults in `android/variables.gradle`). Orientation: phones portrait; tablets any (`android:screenOrientation`
  is left unset, and the CSS handles both). Permissions: `INTERNET` (online play
  and ads), plus what the ads SDK merges in: `ACCESS_NETWORK_STATE` and
  **`com.google.android.gms.permission.AD_ID`** (needed for personalised ads on Android 13+, and
  declared in Play's Advertising ID form). Nothing else: no location, contacts, camera or storage.
- **iOS:** deployment target 15.0. Devices: iPhone and iPad (M10). Phones portrait, plus portrait
  upside-down off; iPad all four orientations (Apple's rule for iPad multitasking). Info.plist:
  `ITSAppUsesNonExemptEncryption = false` (HTTPS only, so export-compliance exempt);
  `CFBundleDisplayName = Mean Chess`; `GADApplicationIdentifier` (the AdMob app ID);
  `NSUserTrackingUsageDescription` ("Allow tracking so the ads you see can be more relevant. Mean Chess
  works the same either way."); `SKAdNetworkItems` (Google's published list). No camera, microphone,
  location or photos keys.
- **Viewport:** add `viewport-fit=cover` to every page's viewport meta tag, and use
  `env(safe-area-inset-*)` paddings on the top bar, dialogs and the page bottom. It's harmless on the
  web.

### 5.4 Why it passes "minimum functionality" (Apple 4.2; Google's spam and minimum-functionality policy)

Write these into the App Review notes (MOBILE-STORES.md §7):
1. **Offline-first:** everything except online play (and ads) works in aeroplane mode. Nothing
   loads from the website at run time.
2. **A complete game, not a website:** a rules engine, a 16-lesson interactive tutorial, a computer
   opponent at four levels running in a background thread, two-player mode, four visual themes, a
   position editor and loader.
3. **Native integration:** haptics, the share sheet, the system back button, safe areas, splash
   screen.
4. **No sign-in, no web forms, no external payments.**
5. **We own the website it shares code with** (Google's policy bans wrapping other people's
   websites; ours is ours).

### 5.5 Icons and splash

- One 1024×1024 source (M16) → `@capacitor/assets` generates every Android (adaptive foreground and
  background) and iOS size, plus splash screens. Free and local.
- iOS icon: no transparency, no rounded corners drawn in (iOS rounds them). Android adaptive icon:
  keep the artwork inside the central 66% safe zone.
- Store icons: Google Play 512×512 PNG (32-bit, under 1 MB); App Store 1024×1024 (taken from the
  build's asset catalogue).

### 5.6 Signing and keys (never in the repository)

| Secret | Where it lives | Backup |
|---|---|---|
| Android **upload key** (`upload.jks`) and its passwords | GitHub Actions secrets `ANDROID_UPLOAD_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` | Founder keeps an offline copy (USB stick or password manager). **Play App Signing** holds the real app-signing key, so a lost upload key can be reset through Play support. |
| Google Play API access (to upload builds) | Service account JSON → secret `PLAY_SERVICE_ACCOUNT_JSON` | Can be re-created any time |
| App Store Connect API key (`.p8`, key ID, issuer ID) | Secrets `ASC_KEY_P8_BASE64`, `ASC_KEY_ID`, `ASC_ISSUER_ID` | The `.p8` downloads **only once**: the founder keeps an offline copy. It can be revoked and re-issued. |
| iOS signing certificate and provisioning profile | Created automatically during the CI build: `xcodebuild -allowProvisioningUpdates` authenticated with the API key. No Mac and no manual certificates. | Re-created on demand |

Runbook §5 has the exact steps to create each one.

### 5.7 Pages the website gains (both stores require URLs)

- **`/privacy/`: privacy policy.** Plain language, covering the apps and the website: what stays
  on the device; **ads** (Google AdMob: what its SDK collects, consent, and how to change privacy
  choices); the **anonymous usage counters**; **online play** (moves, the random seat token, IP
  addresses seen by Cloudflare, and how long they're kept); GitHub Pages server logs; children; the
  contact email; dates and a change log. Claude drafts it from MOBILE-STORES.md §6.3; the founder
  approves. It must be live before the first upload.
- **`/support/`: support.** How to report a problem (GitHub Issues, the email), the version
  shown in the app, and a link to the rules and tutorial.
- **`/app-ads.txt`:** the AdMob line (`google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0`
  with the founder's publisher ID), served from `public/app-ads.txt`. AdMob looks for it at the root of
  the **developer website listed in the store**, so the Play listing's website must be exactly
  `https://meanchess.siddheshthapa.com`.
- All three are linked from the footer on the web, and from a new "About" section in the app
  (version, privacy, support, privacy choices for ads, open-source licences).

### 5.8 Versioning

- **One version for website and apps** from the store launch (M17). `package.json` is the source of
  truth. A script writes it to `android/app/build.gradle` (`versionName`) and the iOS project
  (`MARKETING_VERSION`).
- **Build numbers** (`versionCode` on Android, `CURRENT_PROJECT_VERSION` on iOS) = the GitHub Actions
  run number. It always increases, so a build is never rejected for reusing a number.
- The app's About section shows "Version 1.0.0 (build 57)". Support requests quote it.

### 5.9 Online play later (Phase 2) in the apps

Online play is part of 1.0 (M11, M17). For it to work in the apps:
- **The Worker's allowed origins** must add the apps' origins: `https://localhost` (Capacitor
  Android) and `capacitor://localhost` (Capacitor iOS). Update `docs/ONLINE-SECURITY.md` accordingly.
- **Invite links should open the app if it's installed:**
  - Android **App Links**: `/.well-known/assetlinks.json` on the website, with the Play app-signing
    certificate's SHA-256.
  - iOS **Universal Links**: `/.well-known/apple-app-site-association`, plus the Associated Domains
    entitlement `applinks:meanchess.siddheshthapa.com`.
  - Both files are served from `public/.well-known/` on GitHub Pages. Confirm the content type and
    that there are no redirects at that time.
- **Store forms change:** Data safety and App Privacy must then declare what online play sends (game
  moves, a random seat token, and IP addresses seen by Cloudflare). Update the privacy policy first.
- **Age rating:** answer "no" to unrestricted chat or user-generated content, which stays true as long
  as there's no chat.

### 5.10 Updates

- Every change ships through the stores (review is usually under a day on both).
- **No over-the-air code-push service** in 1.0: it adds a dependency, cost and review risk. Revisit
  only if review times become a problem.
- The website can still change at any time. **Keep the apps and the site on the same version** by
  releasing them together (MOBILE-RUNBOOK.md §6).

### 5.11 Ads (M7, ad style, ad privacy)

- **Network:** Google AdMob, through `@capacitor-community/admob` (version 8.x for Capacitor 8;
  confirm the release notes and pin the exact version at task B7). It wraps the Google Mobile Ads SDK
  and Google's **UMP** consent SDK.
- **Placements** (all in `src/platform/ads.ts`; the game code only calls `ads.screen(name)` and
  `ads.gameFinished()`):

  | Where | Ad | Rule |
  |---|---|---|
  | Welcome page, rules page, the end of the tutorial ("You're ready") | **Adaptive banner** at the bottom, inside the safe area | Hidden whenever a board is on screen |
  | Play page, during a game | **None** | Never. No banner either. |
  | After a game ends | **Interstitial**, at most once per **3 finished games** and at most once every 3 minutes | Only when the player taps "New game" or "Play again" after the result. Never over the result itself or the ending animation. |
  | Tutorial lessons, Scenario Lab, dialogs | None | — |
  | Offline or no fill | Nothing; the space collapses | No placeholders, no errors (seamless UX) |
- **Consent:** on the first launch, `requestConsentInfo` → if required (EEA, UK, Switzerland, some US
  states), `showConsentForm`. The About section has **"Privacy choices for ads"**
  (`showPrivacyOptionsForm`, required by Google where consent applies). Players who refuse get
  non-personalised or limited ads. **No ad request before consent is resolved.**
- **iOS later:** the App Tracking Transparency prompt, shown after UMP and before the first ad.
- **Safety settings in AdMob:**
  - maximum ad content rating **T (Teen)** (M9: 13+);
  - block sensitive categories such as gambling, dating and alcohol;
  - **test ads in every debug build** (AdMob test IDs);
  - **never tap your own live ads** (invalid traffic gets AdMob accounts banned; testers see test
    ads).
- **App IDs and ad unit IDs** are public identifiers, not secrets. They live in the app config,
  never mixed up between debug and release.

### 5.12 Sound effects (M12)

- Original sounds, **synthesised with the Web Audio API** (no recordings, no third-party files): a
  soft wooden tap for a move, a sharper knock for a capture, a crunch for a sacrifice, a low "thrum"
  plus slash for Royal Slaughter, a regal sting for a win, a short descending tone for check.
- Per-theme flavour (Arcade: square-wave chiptune versions).
- On by default in the apps, **off by default on the website** (autoplay etiquette). A switch sits in
  the Themes dialog next to "Animate moves". Stored in `mean-chess:appearance:v1`. Silent when the
  page is hidden.
- The founder approves the sounds from a short demo page before they ship (like the king sketches).

### 5.13 The rate-us prompt (M12)

- The stores' own dialogs: Google Play's **In-App Review API** and later Apple's
  `SKStoreReviewController`, through a pinned Capacitor plugin (chosen at task B8). The stores
  decide whether it actually appears; it can't be forced, and the app never asks for a specific number
  of stars.
- **When:** after the player's **3rd win against the computer, or 5th finished game**, on the result
  screen once the result box has opened. At most once per app version and once every 90 days. Never
  during a game, a lesson or the first session.

### 5.14 Usage counters (M19)

- Exactly the Phase 2 anonymous beacons (P2-34: tutorial started, tutorial completed, computer game
  started, friend game started), plus `online game started`. Batched, sampled 1 in 4, no identifiers,
  sent to the Phase 2 Worker. Each carries a `platform` field (`web`, `app-android`, `app-ios`).
- Declared in the store forms (MOBILE-STORES.md §6) and in the privacy policy.

## 6. Build order

Each task: **goal → steps → done when.** Claude does the A, B and C tasks; F tasks are the founder's
(runbook). Tasks in the same group can be done in one session.

### Milestone A: "it runs on a phone" (1–2 sessions, $0, before any account exists)

**A0 Spike (throwaway branch `spike/capacitor`)**
1. `npm i @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios` (Capacitor 8.x, exact
   versions pinned).
2. `npx cap init "Mean Chess" com.siddheshthapa.meanchess --web-dir dist-app`; add
   `vite build --mode app --outDir dist-app` as `npm run build:app`.
3. `npx cap add android` and `npx cap add ios`.
4. CI job (`ubuntu-latest`, JDK 21): `npm ci && npm run build:app && npx cap sync android &&
   cd android && ./gradlew assembleDebug`. Upload the `.apk` as a workflow artifact.
5. The founder installs the debug APK on their Android phone (runbook §2.1). Claude checks the
   same build in an emulator screenshot on CI if possible.
6. Questions the spike answers, written into this document:
   (a) do `/play/`, `/tutorial/` and `/rules/` links resolve, or is `pageHref()` needed;
   (b) does the computer's module Worker start (or does the in-page fallback take over: it must
   work either way);
   (c) does `localStorage` survive closing and reopening the app, and installing an update over it;
   (d) do the fonts and animations look right;
   (e) is there any console error.

   *Done when:* all five are answered and the APK plays a full game against the computer offline.

**A1 Make it permanent**
- Merge the spike's working parts.
- `capacitor.config.ts` as in §5.3; the `src/platform/` adapter (web and native implementations)
  with unit tests for the web side.
- `npm run build:app` in CI.
- `.gitignore` the build output under `android/` and `ios/`.
- *Done when:* lint, typecheck, tests and the web build pass unchanged; the app builds in CI.

### Milestone B: "it feels like an app" (1–2 sessions)

- **B1 Native touches:** haptics; share sheet; external links open in the system browser; Android back button
  behaviour (dialogs, then pages, then exit); status bar style per theme; no text selection or
  long-press menus on the board; no pull-to-refresh or overscroll bounce on the page.
- **B2 Safe areas and orientation:** `viewport-fit=cover` plus `env(safe-area-inset-*)`. Check a
  notched iPhone (simulator screenshot), an Android gesture-navigation phone, and a tablet in landscape.
- **B3 iOS privacy manifest (when iOS resumes):** `ios/App/App/PrivacyInfo.xcprivacy` declares the
  app's own data use: usage counters and online play. Google's ads SDK ships its own manifest, which
  covers tracking for personalised ads. Accessed API types: only what the build uses (UserDefaults
  `CA92.1` if `@capacitor/preferences` is used).
- **B4 Icon and splash:** three icon sketches for M16 → the chosen one at 1024 → `@capacitor/assets
  generate`.
- **B5 Website pages:** `/privacy/` and `/support/` (new Vite pages), footer links, the app's "About"
  section, a test that both pages exist.
- **B6 Sounds (§5.12):** `src/app/sound.ts` (Web Audio synthesis, unit tested for "never throws
  without audio"); a demo page for the founder's approval; the switch in the Themes dialog; website and
  app.
- **B7 Ads (§5.11):** pinned AdMob plugin; `src/platform/ads.ts` with the placement rules (unit tests
  for the "every 3rd finished game, 3 minutes apart" counter); consent flow; About → "Privacy choices
  for ads"; test IDs in debug; `public/app-ads.txt`.
- **B8 Rate prompt (§5.13):** pinned plugin; the rule in `src/platform/review.ts` with unit tests.
- **B9 Usage counters (§5.14):** once Phase 2's events endpoint exists (Phase 2 task A9 or equivalent).
- *Done when:* the founder has tried the debug APK and approves the feel, the sounds and the ad
  placements (test ads). iOS simulator screenshots from CI look right.

### Milestone C: "ready for the stores" (2 sessions)

- **C1 Android release pipeline:** `.github/workflows/mobile-android.yml` on tags `v*` or a manual
  run:
  1. `npm ci`, test, `build:app`, `cap sync android`;
  2. write the version and build numbers;
  3. decode the upload keystore from secrets;
  4. `./gradlew bundleRelease`, signing from the keystore;
  5. upload the `.aab` to the **internal** track with fastlane `supply` (or
     `r0adkll/upload-google-play`, pinned) using `PLAY_SERVICE_ACCOUNT_JSON`.

  The first `.aab` is uploaded by hand in Play Console (runbook §2.4); Google requires that.
- **C2 iOS release pipeline:** `.github/workflows/mobile-ios.yml` on a macOS runner with Xcode 26
  (pin the image, e.g. `macos-26`, and select the Xcode version explicitly):
  1. `npm ci`, `build:app`, `cap sync ios`;
  2. write the version and build numbers;
  3. `xcodebuild archive` with automatic signing, `-allowProvisioningUpdates`, and the App Store
     Connect API key passed through `-authenticationKeyPath` / `-authenticationKeyID` /
     `-authenticationKeyIssuerID`;
  4. export the `.ipa` (`method app-store-connect`);
  5. upload to TestFlight with fastlane `pilot` (API key auth).
- **C3 Store screenshots and graphics:** generated with `media/recorder/still.mjs` at the exact store
  sizes (MOBILE-STORES.md §4), with captions rendered from `media/press/card.html`-style templates:
  6 phone screenshots per store, iPad and Android tablet sets (M10), and the Google Play feature
  graphic. They live in `store/` (committed: screenshots plus caption sources).
- **C4 Listing text:** final copy for both stores from MOBILE-STORES.md §3, approved by the founder,
  stored in `store/listing/` (fastlane `metadata` layout, so the CI can upload it).
- **C5 Pre-flight:** the pre-submission checklist in MOBILE-STORES.md §10, item by item, with the
  evidence noted in the handover.
- *Done when:* a signed build sits in Play's internal track and in TestFlight, and every listing field
  is ready.

### Milestone D: launch (founder-driven, mostly waiting)

**Dependency (M11):** production launch waits for **online play** (Phase 2) to be finished and stable.
The closed test (D1) **starts as soon as milestone C is done**, even before online play is ready:
the 14-day clock runs on everything else, and later builds add online play to the same track.

- **D1 Android closed test:** 12+ testers (M13) for 14 days. Claude fixes anything they report and
  pushes builds to the same track; updating a build doesn't reset the clock.
- **D2 Android production:** the founder applies for production access (Play Console asks about the
  test). Then a staged rollout: 20%, then 50%, then 100% over a few days, watching Android vitals and
  crashes.
- **D3 iOS:** TestFlight on the founder's iPhone (external testing needs a short Beta App Review),
  then submit for App Review with the notes from MOBILE-STORES.md §7, then release manually.
- **D4 Announce:** website banner "Get it on Google Play / Download on the App Store" (official
  badges, used per each store's badge guidelines), README, press kit update, founder posts.

## 7. Test plan

| Area | How | Pass |
|---|---|---|
| Rules and AI | The existing suites (376 tests) run on every app build | All green |
| App shell | Spike questions (A0); founder's phone; Play's **pre-launch report** (Google tests on real devices automatically, free) | No crashes; no console errors; every page reachable |
| Offline | Aeroplane mode: full game against the computer at each level, tutorial lesson 16, a friend game, Scenario Lab load | Everything works |
| Storage | Play a game, close the app, reopen; install an update over it; change theme; finish the tutorial | Game, theme, tutorial progress and Auto level all survive |
| Back button (Android) | From a dialog, a page, the welcome page | Closes the dialog; goes back; exits |
| Safe areas | iPhone with notch (simulator); Android gesture navigation; tablet landscape | Nothing under the notch or home bar; no clipped dialogs |
| Accessibility | TalkBack and VoiceOver on the board and dialogs; system font size enlarged | Squares are announced (existing labels); text doesn't overflow |
| Performance | Ruthless level on a mid-range Android phone | The UI never freezes (the worker thinks off the main thread) |
| Low-end WebView | Android 7 (API 24) emulator, if CI time allows | Loads, or shows a clear "update Android System WebView" message, never a blank screen |
| Ads | Debug build with test ads: banner on the welcome page and gone on the play page; interstitial only after the 3rd finished game, on "New game"; nothing in lessons | Placements exactly as §5.11; no ad over a board, the result or an animation |
| Consent | A device set to an EEA country (or UMP debug geography): the form shows; refusing still allows play; "Privacy choices for ads" reopens it | The rules in §5.11 hold |
| Sounds | Each sound per theme; the switch; with the phone muted; with the app in the background | No sound when hidden; respects the switch |
| Rate prompt | A debug flag simulates 3 wins | Appears once, on the result screen, never mid-game |
| Online play | Phase 2's test plan, run against the app build (Android origin `https://localhost`) | Invite link → app opens to the game |

## 8. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Apple rejects under 4.2 | Medium | §5.4 features, plus detailed review notes. If rejected anyway: reply in Resolution Center pointing to offline play and native features; add sound or haptic polish if asked. |
| Testers drop out and the 14 days restart | Medium | Recruit 15; the founder checks the tester count every 2–3 days. |
| Apple enrolment problems in India (forums report address and payment errors) | Medium | Use your own card that can be charged in USD; the address exactly as on your bank records; Apple support case if blocked. Android goes ahead regardless. |
| No Apple device available | **Certain for now** (M2: none) | Android launches alone; the iOS tasks (B3, C2, D3) resume when a device can be used or borrowed for the app-only enrolment. |
| A Capacitor path or worker quirk | Low to medium | Spike A0 answers it before anything is committed. |
| Upload key lost | Low | Play App Signing allows a reset; offline backup. |
| Store rules change | Medium over time | Re-check each store's "upcoming requirements" before every release (runbook §6). |
| Policy strike from wrong form answers | Low | The answers are pre-written in MOBILE-STORES.md and checked against the build. |
| AdMob account not approved, or ads limited | Medium | `app-ads.txt` live before launch; the listing's website matches it; the app works the same without ads (no revenue is assumed). |
| AdMob invalid-traffic suspension | Low | Never tap your own live ads; testers get test ads; no ad near the board. |
| Ads hurt the experience | Medium | Strict placements (§5.11); watch reviews; the supporter "remove ads" purchase later. |
| Online play delays the launch | High | The closed test and all other work run in parallel; online play is the only thing launch waits for. |
| Not enough testers | Medium | Tester plan in §2A; recruit 15–20; check the count every 2–3 days. |

## 9. Working at low effort (for later sessions)

- **Start each session by reading:** this file's §2 (the answered decisions), the handover's "next
  actions", and the one task card being worked on.
- **Don't re-research the facts in §4** unless a release is close or a store rejects something.
  Before a release, open only the two "upcoming requirements" pages linked in MOBILE-STORES.md §12.
- **Always run** lint, typecheck, `test:coverage` and both builds (`build`, `build:app`) before
  committing. Never commit secrets.
- **Never change** the app ID, the signing setup or store forms without the founder's say-so.
- **Ask the founder only for** money, accounts, legal choices and anything visible in the stores.
