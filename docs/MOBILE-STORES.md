# Store requirements: everything Google Play and the App Store ask for

**Status: updated with the founder's decisions (26 October 2026).** The companion to
[MOBILE-BLUEPRINT.md](MOBILE-BLUEPRINT.md). It lists every account requirement, form, field, asset
and policy the two stores need for Mean Chess, with **the answer to give** for app 1.0. App 1.0 is
**free with ads** (AdMob, consent-based personalisation), has **online play by invite link**, uses
**anonymous usage counters**, has no accounts or chat, and is for ages **13+**. Android goes first;
iOS waits for an Apple device (M2). Store facts change: §12 has the sources, and §11 says what to
re-check before every release.

---

## 1. Accounts

### 1.1 Google Play Console (personal account)

| Requirement | Detail |
|---|---|
| Fee | 25 USD, one time, by card |
| Identity | Legal name, legal address, contact email and phone (both verified by one-time code), and a **developer email shown on Google Play**. Google verifies identity (an ID document may be requested). |
| Shown publicly | **Legal name, country, developer email** (the founder's personal Gmail, M5). Google's help says the full address is also shown for accounts that monetise through Google Play (paid apps, in-app purchases); whether ad-only income triggers it isn't stated. **Assume the address may become public**, especially once the supporter purchase arrives. In the EU, trader status (M15) shows address and phone anyway. |
| Must stay working | Contact email, phone and developer email, for the life of the account |
| New personal account rule | Before production: a **closed test with at least 12 testers opted in for 14 continuous days**, then a short application (questions about the test). Until then, production and pre-registration are locked. |
| Website (optional) | https://meanchess.siddheshthapa.com |
| Separate from the Play account | Google's **Android developer verification** for apps distributed *outside* Google Play (enforcement starting around September 2026). Not needed for Play-only distribution; if the founder ever shares APKs directly, register the package name there. |

### 1.2 Apple Developer Program (individual)

| Requirement | Detail |
|---|---|
| Fee | 99 USD a year, in local currency, auto-renewing |
| Where (India) | **Only in the Apple Developer app** (on an iPhone, iPad or Mac). Not on the web. |
| Identity | Apple Account with two-factor authentication; of legal age; **legal name** (no nicknames: it becomes the seller name). Pay with **your own card** that can be charged in USD; anyone else's card triggers an ID check and delay. |
| Shown publicly | Seller name = legal name. As an EU trader (M15): address, phone and email on EU product pages. |
| D-U-N-S number | Not for individuals (organisations only) |
| Agreements | The Program License Agreement (accept in the app). Ads income goes through AdMob, not Apple, so the **Paid Apps agreement, tax and banking** forms are only needed when the supporter purchase (in-app purchase) arrives. |
| Status | **Waiting:** no Apple device for the app-only enrolment yet (M2). |
| Known India issues (forum reports, 2026) | Address-validation errors and "not available in your region" at payment. Fix: enter the address exactly as the bank has it; use a card enabled for international USD payments; open a support case if it persists. |

## 2. Google Play Console: every "App content" declaration

Play Console → **Policy → App content**. Answers for app 1.0:

| Section | Answer |
|---|---|
| **Privacy policy** | `https://meanchess.siddheshthapa.com/privacy/` |
| **Ads** | **"Yes, my app contains ads."** The store then shows "Contains ads". |
| **App access** | "All functionality is available without special access" (no login; online play needs only an invite link, which the review notes explain) |
| **Content rating** | IARC questionnaire (§5.2). Category: Game. Email: the founder's Gmail (M5). |
| **Target audience and content** | Age groups: **13–15, 16–17, 18 and over** (M9). "Could your store listing unintentionally appeal to children?": **No.** The cute themes are optional skins; the listing and screenshots aim at chess players. If Google decides otherwise, the Families ad requirements apply: switch AdMob to certified ad networks and child-directed settings. |
| **News app** | No |
| **Data safety** | §6.2 (ads, counters, online play) |
| **Government app** | No |
| **Financial features** | "My app doesn't provide any financial features" |
| **Health** | "My app does not have any health features" |
| **Advertising ID** | **"Yes, my app uses advertising ID"**, for **Advertising or marketing** and **Analytics** (AdMob). The `AD_ID` permission is in the merged manifest (from the ads SDK). |
| **Photo and video permissions** | Not used |
| **Foreground services, exact alarms, accessibility services, VPN, SMS or call log** | Not used |
| **EU Digital Services Act trader status** | **Trader** (M15): legal name, address, phone and email, shown to EU users |

**Main store listing** (Grow → Store presence → Main store listing): §3.1 and §4.1.
**Store settings:** App category **Game → Board**; tags (up to 5) such as Board, Chess, Strategy,
Puzzle and Casual (pick from Google's list); contact email = M5; website = the site.

### 2.1 Release tracks

| Track | Who | Review | Use |
|---|---|---|---|
| Internal testing | Up to 100 testers by email list | None (minutes) | Every CI build lands here first |
| **Closed testing** | An email list or Google Group | Yes (short) | **The 12-tester, 14-day requirement runs here** |
| Open testing | Anyone with the link | Yes | Optional, after production access |
| Production | Everyone | Yes (new accounts: up to several days) | Staged rollout 20%, then 50%, then 100% |

**Pre-launch report:** after each upload to a testing track, Google runs the app on real devices for
free. Read it for crashes and accessibility warnings before promoting a build.

### 2.2 Technical rules (checked by Play on upload)

- Android App Bundle (`.aab`), signed with the upload key; **Play App Signing** enabled (the
  default for new apps).
- `targetSdkVersion` **36** (required for new apps and updates since 31 August 2026; an extension to
  1 November 2026 was possible). This moves every August: re-check yearly.
- `versionCode` increases with every upload.
- **16 KB memory page support** applies to apps with native code (`.so` libraries). Capacitor core
  ships none; if a plugin adds native libraries, check Play Console's App bundle explorer, which flags
  it.

## 3. Listing text (drafts; the founder approves)

Store copy is product copy, like the website's (founder-written posts are a different matter: F11).
**Never use other apps' or companies' names (Chess.com, Lichess) in titles or keywords:** both
stores forbid it.

### 3.1 Google Play

| Field | Limit | Draft |
|---|---|---|
| App name | 30 | **Mean Chess** |
| Short description | 80 | **Chess with a deadlier king: it kills the enemy king from two squares away.** (74) |
| Full description | 4,000 | Below |
| Release notes (1.0) | 500 | "Mean Chess is here: chess where kings kill kings. Learn in 16 lessons, then play the computer at four levels, a friend on one phone, or a friend online with an invite link." |

**Full description (both stores):**

> Mean Chess is chess with a deadlier king.
>
> Everything you know still applies: the pieces move as always, check and checkmate still matter. But
> your king has three new powers, and so does your opponent's.
>
> ROYAL CAPTURE: only a king can capture a king. When the two kings stand exactly two squares apart in
> a straight line with nothing between them, the king to move takes the other and wins on the spot,
> even while in check.
>
> ROYAL SLAUGHTER: if one of your own pieces stands between the kings, your king can eat it and take
> the enemy king in a single move.
>
> ROYAL CANNIBALISM: checkmated? Not yet. A trapped king may eat one of its own pieces next to it to
> escape. Pawns go first, then knights and bishops, then rooks, then promoted queens. Your original
> queen can never be eaten.
>
> Fool's mate doesn't work any more. A bare king can be hunted down. Every piece between the kings is
> both a shield and a weapon.
>
> WHAT'S INSIDE
> • A 16-lesson interactive tutorial that starts from the basics
> • Play the computer at four levels (Nice, Mean, Ruthless, or Auto, which adapts to you)
> • Play a friend on the same phone or tablet, or online
> • Four themes: Mean, Sugar, Arcade and Picnic
> • Scenario Lab: load any position or saved game
> • Original piece artwork, smooth animations, and a dramatic ending for every game
> • Play a friend online with an invite link, no account needed
> • Works offline (everything but online play). No account. Ads never appear during a game.
>
> Mean Chess is free and open source, supported by ads. Rules, tutorial and more at
> meanchess.siddheshthapa.com.

(about 1,650 characters; both stores allow 4,000)

### 3.2 App Store

| Field | Limit | Draft |
|---|---|---|
| Name | 30 | **Mean Chess** |
| Subtitle | 30 | **Chess where kings kill kings** (28) |
| Promotional text | 170 | **Learn the variant in 16 hands-on lessons, then hunt the enemy king. Play the computer, a friend on one device, or a friend online.** (about 125; can be changed without a review) |
| Description | 4,000 | As in §3.1 |
| Keywords | 100 (comma-separated, no spaces needed) | `variant,board game,strategy,king,two player,offline,tactics,puzzle,tutorial,brain,classic` (88). Don't repeat words already in the name or subtitle. |
| What's New (1.0) | 4,000 | As the Play release notes |
| Support URL | — | `https://meanchess.siddheshthapa.com/support/` |
| Marketing URL | — | `https://meanchess.siddheshthapa.com/` |
| Privacy policy URL | — | `https://meanchess.siddheshthapa.com/privacy/` |
| Copyright | — | `2026 Siddhesh Thapa` |
| Category | — | Primary **Games**, subcategories **Board** and **Strategy** |

## 4. Graphic assets

All generated by Claude with the existing tooling (`media/recorder/still.mjs` at exact sizes, plus
caption templates like `media/press/card.html`). They show the real app UI: **no device frames,
nothing the app doesn't do.**

### 4.1 Google Play

| Asset | Spec | Plan |
|---|---|---|
| App icon | 512×512 PNG, 32-bit with alpha, max 1 MB | From the M16 icon |
| Feature graphic | 1024×500, JPEG or 24-bit PNG (no alpha) | The press-kit card, re-laid out at 1024×500 |
| Phone screenshots | 2–8; JPEG or 24-bit PNG; each side 320–3840 px; long side at most 2× the short; max 8 MB | **7 at 1080×1920** (portrait 9:16) |
| 7-inch and 10-inch tablet screenshots | Same rules; needed to be featured as tablet-ready | 4 each: 1200×1920 portrait, 2560×1600 landscape (M10) |
| Promo video | YouTube URL (optional) | Optional: the founder uploads `royal-slaughter.mp4` or the vertical clip to YouTube |

### 4.2 App Store

| Asset | Spec | Plan |
|---|---|---|
| App icon | 1024×1024, no transparency; inside the build's asset catalogue | From M16, generated by `@capacitor/assets` |
| iPhone screenshots | Up to 10. Required size: 6.9-inch, **1320×2868** portrait (1290×2796 is also accepted). Apple scales them down for smaller iPhones. | **7 at 1320×2868** |
| iPad screenshots | Up to 10; **13-inch, 2064×2752** (2048×2732 also accepted) | 4 at 2064×2752 (M10) |
| App previews (video) | Optional; strict capture specs | Skip in 1.0 |

### 4.3 The seven screenshots (same story on both stores)

| # | Caption (on a band above the screenshot) | Screen |
|---|---|---|
| 1 | **Kings kill kings.** | A Royal Slaughter mid-slice (the press-kit moment) |
| 2 | **Checkmated? Eat your own piece and live.** | Tutorial lesson 1: Fool's mate with the glowing pawns |
| 3 | **Learn it in 16 hands-on lessons** | A tutorial lesson ("Pawns first") |
| 4 | **Beat the computer: Nice, Mean, Ruthless or Auto** | The New game dialog |
| 5 | **Four themes. Original art.** | Four themes (a 2×2 grid inside one screenshot) |
| 6 | **Every game ends with a bang** | The end badges and the "White wins" banner |
| 7 | **Play a friend online: just send a link** | The online invite screen (once Phase 2 exists) |

## 5. Age ratings

### 5.1 Apple (the questionnaire since 2025; required since 31 January 2026)

| Question group | Answer for 1.0 |
|---|---|
| In-app controls (parental controls, age assurance) | None |
| Capabilities: unrestricted web access | **No** (external links leave the app for the system browser) |
| Capabilities: user-generated content | No |
| Capabilities: messaging and chat | No (online play sends moves only; no chat) |
| Capabilities: advertising | **Yes** (AdMob; maximum ad content rating T) |
| Medical or wellness topics | None |
| Profanity or crude humour | None |
| Horror or fear themes | None |
| Alcohol, tobacco or drugs | None |
| Sexual content or nudity | None |
| **Cartoon or fantasy violence** | **Infrequent/Mild** (the Royal Slaughter slice with red liquid; captured kings fade). With M8(c), None. |
| Realistic violence; prolonged graphic or sadistic violence | None |
| Guns or other weapons | None (the "blade" is an abstract light stroke) |
| Simulated gambling, contests, loot boxes | None |
| Made for Kids | No |

**Expected: 9+** (M8: blood kept). Advertising doesn't raise the age band by itself. Chat would
change these answers; chat is not planned.

### 5.2 Google Play (IARC questionnaire)

- Category: **Game** (all other content types: no).
- Violence: **yes**, against fantasy characters, non-realistic. Blood: **yes, a small amount,
  unrealistic** (red liquid from a sliced chess piece). Not repeated, not detailed.
- Interactive elements:
  - **users can interact: yes**, because online play matches two players, though they exchange only
    moves (no chat, no user content);
  - shares location: no;
  - digital purchases: no in 1.0 (yes once the supporter purchase ships; update then);
  - unrestricted internet: no.
- Everything else: no (sexual content, language, controlled substances, gambling).
- **Expected:** PEGI 7 (possibly PEGI 12 because of the blood), ESRB Everyone 10+, USK 6, IARC 7+,
  with the "Users Interact" note.
  Rating authorities can adjust it after review.
- **Answer exactly what's in the app.** Misrepresenting content is grounds for removal. If M8(b) or
  (c) is chosen, update the answers.

## 6. Privacy

What app 1.0 sends off the device (the basis of every form):

| Source | What | Why | Stored by us? |
|---|---|---|---|
| **Google AdMob SDK** | Advertising ID or device identifiers, IP address (approximate location), app interactions with ads, diagnostics and performance data | Ads, ad measurement, fraud prevention | No: Google processes it, under its policy. Personalised only with consent. |
| **Usage counters** (M19) | Four or five anonymous event counts with a platform tag; no identifiers | Analytics | Aggregated counts only |
| **Online play** (Phase 2) | Game moves, a random seat token, the game's state; IP addresses in transit (Cloudflare) | App functionality | Game records, for a limited time (Phase 2 data model: unfinished games abandoned after 7 days; finished games kept for share links, about 30 days) |

**Confirm the AdMob list against Google's "Google Play data disclosure" page for the exact SDK
version pinned** (§12). It changes between versions.

### 6.1 Apple: App Privacy (when iOS resumes)

- Data **used to track you** (if the player allows tracking): Identifiers (device ID); Usage data
  (advertising data).
- Data **not linked to you:** Usage data (product interaction: the counters); Diagnostics (from the
  ads SDK); Location (coarse, derived from IP by the ads SDK).
- Data linked to you: none (no accounts).
- An App Tracking Transparency prompt before any personalised ad; Google's ads SDK ships its own
  privacy manifest. The app's `PrivacyInfo.xcprivacy` covers the counters and online play.

### 6.2 Google Play: Data safety

- **Collects or shares data: Yes.** Encrypted in transit: **Yes** (HTTPS and WSS everywhere).
  Users can request deletion: **Yes, by email** (online games also expire on their own); no account
  exists to delete.
- Declare, following Google's AdMob disclosure for the pinned SDK version:

  | Data type | Collected | Shared | Purpose | Optional? |
  |---|---|---|---|---|
  | Device or other IDs | Yes | Yes (Google, ads) | Advertising or marketing; Analytics; Fraud prevention | Required for ads (personalisation is consent-based) |
  | Location: approximate (from IP) | Yes | Yes (Google, ads) | Advertising; Fraud prevention | — |
  | App activity: app interactions | Yes (ads SDK and our counters) | Yes (ads SDK only) | Analytics; Advertising | — |
  | App info and performance: diagnostics, crash logs | Yes (ads SDK) | Yes (Google) | Analytics | — |
  | App activity: other actions (online game moves) | Yes | No (only the other player sees them) | App functionality | — |
- "Is data processed ephemerally?": for online-play IP addresses, yes (not stored by Mean Chess).

### 6.3 Privacy policy (`/privacy/`, both stores require it)

Contents, in plain language:
1. **Who:** Mean Chess by Siddhesh Thapa; contact email (M5).
2. **On your device:** games, settings, tutorial progress and the Auto level stay on the device
   (deleted with the app).
3. **Ads (apps only):** Google AdMob shows ads and collects the data in §6. Personalised ads only
   with consent; how to change it ("Privacy choices for ads" in About); links to Google's policies and
   ad settings. The website has no ads.
4. **Usage counters:** what's counted, that it's anonymous, and that it can't identify anyone.
5. **Online play:** what the server receives and how long it's kept; Cloudflare as the host.
6. **The website:** GitHub Pages server logs (GitHub's privacy statement).
7. **Children:** the apps are for ages 13 and over; no knowingly collected data from children.
8. **Your rights and contact:** how to ask about or delete data (email).
9. **Changes:** dated versions and a change log. Effective date.

## 7. Review notes (paste into both consoles)

> Mean Chess is a chess variant: standard chess plus three new king powers (Royal Capture, Royal
> Slaughter, Royal Cannibalism). No login is needed, and everything except online play works offline.
>
> How to see each feature:
> • Tutorial: home → "Tutorial" → "I know how chess works". 16 interactive lessons, each solved on
> the board.
> • Play the computer: home → "Play" → "New game" → "The computer" → choose a level → start.
> • A Royal Slaughter in one move: open Scenarios → "Royal Slaughter" → "King, pawn, king" → tap
> the white king on e1, then e3.
> • Royal Cannibalism (Fool's mate fails): Tutorial lesson 1.
>
> The app is a complete game that runs on the device: a rules engine, a computer opponent in a
> background thread, two-player mode, four themes, and a position editor. It uses native haptics,
> the share sheet and the system back button. The website at meanchess.siddheshthapa.com is ours and
> shares the same code.
>
> Online play: on one device, "Play" → "New game" → "Online" → "Create invite" and copy the link;
> open it on a second device (or a second browser at meanchess.siddheshthapa.com) to join. No account
> needed.
>
> Ads: a banner appears only on menu screens; a full-screen ad may appear after every third finished
> game when starting a new one. Ads never appear during a game or a lesson. In the EEA and UK a
> consent form appears on first launch; "About → Privacy choices for ads" reopens it.
>
> The red "blood" in the Royal Slaughter animation is a brief stylised effect on a sliced chess piece;
> it is declared in the age rating.

App Store review contact: first and last name (legal), phone (with country code), email (M5).
Sign-in required: **No.**

## 8. Testing before review

| Store | Step | Notes |
|---|---|---|
| Google Play | Internal testing | The founder plus a few friends, straight from CI |
| Google Play | **Closed testing: 12+ testers, 14 days** | Testers join by email list or Google Group, accept the opt-in link, install from Play, and **stay opted in**. Keep an eye on the count. |
| Google Play | Apply for production | Answer the questions about the test honestly (what was tested, the feedback, what changed) |
| App Store | TestFlight on the founder's iPhone | Builds appear about 15–30 minutes after upload. Install the TestFlight app. |
| App Store | External TestFlight (optional) | Up to 10,000 testers by public link; the first build needs a short Beta App Review |
| App Store | Submit for review | Usually reviewed within about a day. Choose **manual release** so launch day is ours. |

## 9. Policies to respect (and how Mean Chess meets them)

| Policy | Mean Chess |
|---|---|
| Apple 2.1, app completeness | No placeholders, no broken links, no "coming soon" features; online play isn't shown until it works |
| Apple 2.3, accurate metadata | Screenshots show the real app; keywords and description describe only what exists |
| Apple 2.3.7 and Play metadata policy: no other brands in metadata | No "Chess.com" or "Lichess" in the name, subtitle, keywords or description |
| Apple 4.2 and Play spam/minimum functionality | MOBILE-BLUEPRINT.md §5.4 |
| Apple 4.1, copycats | Original name, art and rules |
| Apple 5.1.1 and Play user data | No data collected; privacy policy online; no account, so no account-deletion requirement |
| Apple 5.2, intellectual property | Original art; fonts under the SIL Open Font License (listed in THIRD_PARTY_NOTICES.md and the app's About) |
| Apple 3.1, payments | Nothing to buy in 1.0. The later supporter purchase uses each store's own billing (Play Billing, Apple IAP); never a link to outside payment. |
| **Play Ads policy and AdMob programme policies** | No ads during play or near the board; interstitials only at a natural break (after a finished game, on "New game"), never unexpected and never on launch; no ad blocks app use; ads are closable; never encourage clicks; ad content capped at T. |
| **Apple 5.1.2 and ATT** (iOS later) | Ask for tracking permission before any personalised ad; the app works the same if refused. |
| Consent laws (GDPR/UK and US states) | Google UMP consent form; "Privacy choices for ads" always reachable. |
| Play: deceptive behaviour | The app does what the listing says; no hidden features |
| Both: external links | Open in the system browser; no links to payment pages |

## 10. Pre-submission checklist (tick each, note evidence in the handover)

1. ☐ Lint, typecheck, `test:coverage`, `build`, `build:app` all green on the release commit.
2. ☐ Version and build numbers written (`versionName` / `MARKETING_VERSION` = package.json;
   build = CI run number).
3. ☐ Offline check on a real device: a full game against the computer, a tutorial lesson, a friend
   game.
4. ☐ No console errors (Chrome remote debugging for Android; Safari Web Inspector or the simulator
   log for iOS).
5. ☐ Privacy and support pages live; their URLs match the consoles.
6. ☐ Data safety, App Privacy, age ratings, target audience and DSA status match §2, §5 and §6.
7. ☐ Screenshots match the current UI; text has no typos; no other brands.
8. ☐ Merged Android manifest permissions are exactly `INTERNET`, `ACCESS_NETWORK_STATE` and `AD_ID`
   (Play Console → App bundle explorer).
8a. ☐ Release build uses the **real** AdMob app ID and ad unit IDs; debug builds use test IDs.
8b. ☐ `https://meanchess.siddheshthapa.com/app-ads.txt` is live and AdMob shows the app as verified.
8c. ☐ The AdMob consent message (GDPR and US states) is published; the in-app "Privacy choices for
    ads" entry works; maximum ad content rating is T.
8d. ☐ Ads appear only where MOBILE-BLUEPRINT.md §5.11 allows (checked on a test device with test
    ads).
9. ☐ iOS: `ITSAppUsesNonExemptEncryption` false; privacy manifest present; no usage-description
   strings.
10. ☐ Review notes pasted; review contact correct; "sign-in required" = No.
11. ☐ Play pre-launch report: no crashes; accessibility warnings looked at.
12. ☐ Release mode: Play staged rollout; App Store manual release.
13. ☐ Handover updated with the build numbers, dates and links.

## 11. After launch: obligations

| When | What |
|---|---|
| Always | Keep the public email and phone working (Play removes accounts with dead contact details). Read store emails: policy notices have deadlines. |
| Every update | Re-check both stores' "upcoming requirements" pages. Update Data safety, App Privacy, age rating and the privacy policy if features change (online play especially). |
| Every August (Google) | Raise `targetSdkVersion` to the newly required level (Capacitor upgrade if needed). |
| Every spring (Apple) | Build with the newly required Xcode or SDK (it was Xcode 26 from April 2026). |
| Every year (Apple) | Renew the 99 USD membership, or the app is removed from sale. |
| Ongoing | Reply to store reviews politely (founder); watch Android vitals and App Store crash reports. |
| AdMob | Keep `app-ads.txt` live; complete tax and payment details before the first payout; re-check the Data safety answers when the ads SDK is updated; never tap your own live ads. |

## 12. Sources (checked 26 October 2026)

- Google Play target API level: [developer.android.com: target SDK requirements](https://developer.android.com/google/play/requirements/target-sdk) and [Play Console Help 11926878](https://support.google.com/googleplay/android-developer/answer/11926878)
- Testing requirements for new personal accounts (12 testers, 14 days): [testerscommunity.com guide (2026)](https://www.testerscommunity.com/guides/how-many-testers-do-you-need-google-play); confirm in Play Console Help, "App testing requirements for new personal developer accounts"
- Play developer identity and public details: [Play Console Help 13628312](https://support.google.com/googleplay/android-developer/answer/13628312)
- Android developer verification (outside Play): [developer.android.com: early access](https://developer.android.com/developer-verification/guides/early-access)
- Play store listing assets: [Play Console Help 9866151](https://support.google.com/googleplay/android-developer/answer/9866151) and [AppRadar screenshot guide (2026)](https://appradar.com/blog/android-app-screenshot-sizes-and-guidelines-for-google-play)
- Play content ratings: [Play Console Help 9859655](https://support.google.com/googleplay/android-developer/answer/9859655) and [188189](https://support.google.com/googleplay/android-developer/answer/188189)
- Play registration fee (25 USD, one time): [choicely.com cost overview](https://www.choicely.com/tutorials/how-much-does-it-cost-to-publish-an-app)
- Apple enrolment (India only through the Apple Developer app; fee; legal name; own card): [developer.apple.com/support/enrollment](https://developer.apple.com/support/enrollment/)
- India enrolment problems (forum reports): [Apple Developer Forums thread 837697](https://developer.apple.com/forums/thread/837697), [832616](https://origin-devforums.apple.com/forums/thread/832616)
- Apple SDK minimum (Xcode 26 from 28 April 2026): [developer.apple.com/news/upcoming-requirements](https://developer.apple.com/news/upcoming-requirements/)
- Apple age ratings (13+, 16+, 18+; questionnaire by 31 January 2026): [9to5Mac](https://9to5mac.com/2025/07/24/apple-notifies-developers-of-new-app-store-age-rating-system/)
- App Store screenshot sizes: [Adalo 2026 guide](https://studio.adalo.com/blog/app-store-screenshot-sizes-2026); confirm on Apple's "Screenshot specifications" page
- Guideline 4.2 and web wrappers: [MobiLoud](https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper), [Capgo: passing review in 2026](https://capgo.app/blog/how-to-pass-app-store-review-2026/)
- EU DSA trader status (Apple): [Apple Developer Forums 748465](https://developer.apple.com/forums/thread/748465?page=2)
- Capacitor 8 requirements: [capacitorjs.com/docs/updating/8-0](https://capacitorjs.com/docs/updating/8-0), [environment setup](https://capacitorjs.com/docs/next/getting-started/environment-setup)
- Capacitor edge-to-edge and SystemBars: [Capawesome guide](https://capawesome.io/blog/capacitor-edge-to-edge-and-safe-areas-guide/)
- Capacitor privacy manifest: [capacitorjs.com/docs/next/ios/privacy-manifest](https://capacitorjs.com/docs/next/ios/privacy-manifest)
- GitHub Actions free for public repositories (standard runners): [docs.github.com: Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
- AdMob data disclosure for Play's Data safety form: [developers.google.com/admob/android/privacy/play-data-disclosure](https://developers.google.com/admob/android/privacy/play-data-disclosure)
- UMP consent SDK data disclosure: [developers.google.com/admob/ump/android/play-data-disclosure](https://developers.google.com/admob/ump/android/play-data-disclosure)
- AdMob app-ads.txt: [AdMob Help 9363762](https://support.google.com/admob/answer/9363762)
- Play: when the full address is shown (merchant accounts): [Play Console Help 13634081](https://support.google.com/googleplay/android-developer/answer/13634081)
- Capacitor AdMob plugin (Capacitor 8, UMP methods): [Capgo guide](https://capgo.app/blog/admob-gdpr-consent-capacitor/); confirm on npm `@capacitor-community/admob`
