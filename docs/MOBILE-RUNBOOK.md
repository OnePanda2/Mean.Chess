# Mobile runbook: the founder's steps, and the release routine

**Status: updated with the founder's decisions (26 October 2026).** Click-by-click steps for everything only the founder can do
(accounts, payments, testers, console forms), and the routine for every release. It goes with
[MOBILE-BLUEPRINT.md](MOBILE-BLUEPRINT.md) (the plan) and [MOBILE-STORES.md](MOBILE-STORES.md) (the
answers to give). Screens change: if a button has moved, look for the same words nearby.

**Never paste a password, key file or code into the chat.** Secrets go straight into GitHub (§4) or
a password manager.

---

## 0. At a glance: the founder's to-do list, in order

| # | Step | When | Time |
|---|---|---|---|
| 1 | ~~Answer decisions M1–M21~~ Done 26 October 2026 | — | — |
| 2 | **Phase 2:** the Cloudflare setup (LAUNCH-PLAN.md §5, F-A1 to F-A6). Online play is now needed for launch (M11). | Now | 30 min |
| 3 | Start recruiting testers: friends first, then tester-exchange groups (§2.5). Aim for 15–20. | Now: it's the slowest part | Ongoing |
| 4 | Try the test app on your Android phone (§2.1) | After Claude's milestone A | 10 min |
| 5 | Approve the icon sketch, the sounds and the ad placements (Claude shows them) | Milestone B | 15 min |
| 6 | Create the Google Play developer account and pay 25 USD (§2.2) | After milestone B | 30 min, plus verification |
| 7 | Create the AdMob account and app (§2.9) | Right after 6 | 30 min |
| 8 | Create the app in Play Console and do the first upload (§2.3–§2.4) | After milestone C | 30 min |
| 9 | Start the closed test (§2.5); check the tester count every 2–3 days for 14 days | Right after 8, even before online play is done | 2 weeks |
| 10 | Fill in the store forms with MOBILE-STORES.md (§2.6), including trader details | During the test | 1 hour |
| 11 | Apply for production (§2.7) once the test is done **and online play is finished** | After 9 and Phase 2 | 20 min |
| 12 | Release (§6) | When approved | 10 min |
| — | **Apple (later):** §3, once an iPhone, iPad or Mac can be used (M2) | Later | — |

## 1. The public email (M5: your personal Gmail)

1. Make sure two-step verification is on: https://myaccount.google.com/security → **2-Step
   Verification**.
2. Remember that this address will be **shown publicly** on Google Play (and later the App Store) and
   in the privacy and support pages, and must keep working. Expect some spam. A filter or label for
   "Mean Chess" helps (Gmail → Settings → Filters).

## 2. Google Play

### 2.1 Try a test build on your phone (no account needed)

1. Claude sends a link to the GitHub Actions run. Open it, scroll to **Artifacts**, download
   `mean-chess-debug-apk` and unzip it.
2. Copy the `.apk` to your phone (USB, Google Drive or email it to yourself).
3. On the phone, open the file. Android asks to allow installs from that app (Files or Drive): tap
   **Settings → Allow from this source**, then go back and tap **Install**.
4. Play a game, try the tutorial, turn on aeroplane mode and play again. Tell Claude anything odd.
5. Later, uninstall it before installing the Play Store version (they're signed differently).

### 2.2 Create the developer account (25 USD)

1. Go to https://play.google.com/console/signup and sign in with your **personal** Google account
   (the same Gmail is also the public contact, M5).
2. Choose **Yourself** (a personal account), not an organisation.
3. Enter your **legal name and address** exactly as on your ID; enter the contact email and phone and
   verify both with the codes sent; enter the **developer email = your Gmail** (§1). Website:
   `https://meanchess.siddheshthapa.com`.
4. Pay **25 USD** by card. A card that works for international payments is safest.
5. Complete **identity verification** if asked (photo of an ID document). Wait for the email; it can
   take from minutes to a few days.

### 2.3 Create the app

1. Play Console → **Create app**.
2. App name **Mean Chess**; default language **English (United States)**; **Game**; **Free**.
3. Tick the declarations (developer program policies, US export laws) → **Create app**.
4. Play Console then shows a **Dashboard** checklist. Work through "Set up your app" with MOBILE-STORES.md
   §2 (App content) and §3–§4 (store listing). Claude provides all text and images in `store/`.

### 2.4 The first upload (by hand; Google requires it once)

1. Claude sends the link to the release build run. Download the `mean-chess-release-aab` artifact
   and unzip it to get `app-release.aab`.
2. Play Console → **Test and release → Testing → Internal testing → Create new release**.
3. When asked about app signing, keep **Use Google-generated key** (Play App Signing).
4. Upload `app-release.aab`. Release name: leave the suggestion. Release notes: from MOBILE-STORES.md
   §3.1 → **Next → Save and publish**.
5. **Testers** tab → create an email list "Me" with your own Google account → save → copy the
   **join link**, open it on your phone, accept, and install from Play.
6. Then do §2.8 so later uploads are automatic.

### 2.5 The closed test: 12 testers for 14 days

1. **Recruit 15–20** (12 is the minimum, and the 14 days restart if the count drops below 12):
   - **friends and family first:** anyone with an Android phone; collect the Gmail address they use in
     the Play Store;
   - **then tester-exchange communities** (M13): developers in the same situation test each other's
     apps. Look on Reddit for communities such as r/AndroidClosedTesting or r/TestersCommunity (check
     their rules and that they're active).
     - You install and keep their apps for 14 days in return; keep a list of who you promised.
     - Prefer people who will actually open the app: Google is reported to check that testers really
       use it.
     - **Never pay for fake installs or "guaranteed" testers.** Paid services are allowed but cost
       money and sometimes drop out (your M13 choice was free groups).
2. Play Console → **Testing → Closed testing → Create track** (or use "Alpha") → **Testers** →
   create an email list "Testers" and paste all addresses → **Save**.
3. **Create new release** on the closed track: add the same build from the library (or the newest) →
   **Save and publish**. Wait for the short review.
4. Copy the **join on the web** link and send it to the testers with this note: "Open this link,
   tap *Become a tester*, then install Mean Chess from the Play Store. Please keep it installed and
   stay in the test for at least 14 days, and play a game or two. Tell me anything that feels wrong."
5. **Every 2–3 days**, check the number of testers in Play Console. If it drops below 12, invite
   more at once.
6. Note feedback (Claude fixes it; new builds go to the same track without resetting the clock).

### 2.6 Store forms

Fill each section of **Policy → App content** and **Grow → Store presence** exactly as in
MOBILE-STORES.md §2–§4. The content rating questionnaire sends a certificate to your Gmail.

**EU trader status (M15):** when Play Console asks (account settings or a policy prompt), choose
**trader** and confirm the legal address, phone and email that will be shown to EU users.

### 2.7 Production

1. After 14 days with 12+ testers, Play Console unlocks **Apply for production**. Answer the
   questions honestly: who tested, for how long, what feedback came in, what changed. Claude drafts
   the answers from the handover.
2. Once approved: **Production → Create new release** → add the latest build → release notes →
   **Staged rollout 20%** → **Save and publish**.
3. Over the next days: if there are no crashes in **Android vitals**, increase to 50%, then 100%.

### 2.8 Automatic uploads from GitHub (a service account; one time)

1. Go to https://console.cloud.google.com, create a project "mean-chess-play" (no billing needed).
2. **APIs and services → Library →** search "Google Play Android Developer API" → **Enable**.
3. **IAM and admin → Service accounts → Create service account** "play-uploader" → **Done** (no
   roles). Open it → **Keys → Add key → JSON** → a file downloads. **Keep it secret.**
4. Play Console → **Users and permissions → Invite new users** → paste the service account's email
   (ends in `iam.gserviceaccount.com`) → app permissions: Mean Chess → **Release apps to testing
   tracks** (and later **Release to production** if you want CI to do it) → **Invite user**.
5. Add the JSON file's whole content as the GitHub secret `PLAY_SERVICE_ACCOUNT_JSON` (§4). Delete the
   downloaded file afterwards, or keep it only in your password manager.

### 2.9 AdMob (ads; one time)

1. Go to https://admob.google.com and sign in with the **same Google account** as Play Console.
   Choose your country (India) and time zone; accept the terms.
2. **Apps → Add app → Android →** "Is the app listed on a supported app store?" Choose **No** until
   the Play listing is public, then link it later (**App settings → Add app store details**). App name
   **Mean Chess** → **Add app**. Copy the **App ID** (`ca-app-pub-…~…`) and send it to Claude (it's
   public, not a secret).
3. **Ad units → Add ad unit:**
   - **Banner**, name "menu-banner";
   - **Interstitial**, name "after-game".

   Send Claude both **ad unit IDs** (also public).
4. **Blocking controls → Content:** maximum ad content rating **T (Teen)**. Under sensitive
   categories, block at least gambling, dating, and alcohol.
5. **Privacy & messaging:**
   - create a **European regulations (GDPR)** message for Mean Chess (Google's consent form; choose
     its default options), and a **US state regulations** message;
   - **publish** both.
6. **Account → Settings → Publisher ID** (`pub-…`) → send it to Claude for `app-ads.txt`. After the
   site update, AdMob → **Apps → View all apps → app-ads.txt** tab shows "verified" (it can take a
   day or more).
7. **Payments:** AdMob asks for tax details (whatever applies in India) and a bank account before
   paying out. Fill these in once earnings appear; payouts start after a minimum balance.
8. **Never tap your own live ads**, and don't ask friends to. AdMob suspends accounts for invalid
   clicks. Test builds always show test ads.

## 3. Apple App Store

**Later (M2):** these steps need an iPhone, iPad or Mac for enrolment (India), and ideally an iPhone
for TestFlight. Everything else is ready.

### 3.1 Enrol (India: only in the Apple Developer app)

1. On your iPhone, iPad or Mac: make sure your Apple Account has **two-factor authentication**
   (Settings → your name → Sign-In & Security).
2. Install **Apple Developer** from the App Store and open it → sign in → **Account → Enroll now**.
3. Enter your **legal name** exactly as on your ID, and your address exactly as your bank has it (the
   most common cause of errors in India).
4. Choose **Individual / Sole proprietor**. Accept the agreement.
5. Pay **99 USD** (shown in rupees) with **your own card**, enabled for international payments.
6. Wait for the welcome email (often 1–2 days). If enrolment stops with an error, open a case at
   https://developer.apple.com/contact/ and tell Claude what it said.

### 3.2 Create the app record

1. https://developer.apple.com/account → **Certificates, IDs & Profiles → Identifiers → +** → **App
   IDs → App** → description "Mean Chess", **Explicit** bundle ID `com.siddheshthapa.meanchess` (M6)
   → no capabilities needed → **Register**.
2. https://appstoreconnect.apple.com → **Apps → + → New App**: platform **iOS**; name **Mean Chess**;
   primary language **English (U.S.)**; bundle ID: the one above; SKU `meanchess-ios`; user access
   **Full access** → **Create**.
3. **Business** (in App Store Connect) → **EU Digital Services Act** → declare **trader** (M15) and confirm the address, phone and email shown to EU users.

### 3.3 The API key for automatic builds (one time)

1. App Store Connect → **Users and Access → Integrations → App Store Connect API → Team Keys** →
   **Generate API Key** (or **+**). Name "github-ci"; access **App Manager** → **Generate**.
2. **Download API Key** (`AuthKey_XXXXXX.p8`). **It can be downloaded only once**: keep a copy in your
   password manager.
3. Note the **Key ID** (in the list) and the **Issuer ID** (at the top of the page).
4. Add three GitHub secrets (§4): `ASC_KEY_ID`, `ASC_ISSUER_ID`, and `ASC_KEY_P8_BASE64`, the
   `.p8` file converted to base64. Claude gives you the exact command for your computer, which you run
   yourself so the key never passes through the chat.

### 3.4 TestFlight on your iPhone

1. Install **TestFlight** from the App Store.
2. When Claude says a build is uploaded: App Store Connect → **Apps → Mean Chess → TestFlight** → the
   build appears (after about 15–30 minutes of processing). If it asks about **Export Compliance**,
   the app already declares "no non-exempt encryption".
3. **Internal testing** → add yourself → open TestFlight on the iPhone → **Install**. Play through
   the same checks as §2.1.

### 3.5 Store forms

App Store Connect → Mean Chess:
1. **App Information:** subtitle, category, content rights, age rating questionnaire (MOBILE-STORES.md
   §3.2 and §5.1).
2. **Pricing and Availability:** **Free**; all countries (M20).
3. **App Privacy:** privacy policy URL; the data types in MOBILE-STORES.md §6.1 (ads tracking only with permission).
4. **The version page (1.0):** screenshots (from `store/`), promotional text, description, keywords,
   support and marketing URLs, copyright, **App Review Information** (your name, phone, your Gmail;
   sign-in not required; the notes from MOBILE-STORES.md §7), **Version Release: Manually release
   this version**.

### 3.6 Submit

1. On the version page, under **Build**, choose the TestFlight build Claude names → **Add for
   Review → Submit to App Review**.
2. Wait (usually within a day or two). Apple's email says "Ready for Distribution" or explains a
   rejection. On a rejection, paste the message to Claude: the reply goes in **Resolution Center**.
3. When approved: **Release This Version** on the day you choose.

## 4. GitHub secrets (one time, then occasionally)

https://github.com/OnePanda2/Mean.Chess → **Settings → Secrets and variables → Actions → New
repository secret**. Name exactly as listed; paste the value; **Add secret**.

| Secret | Value | Created in |
|---|---|---|
| `ANDROID_UPLOAD_KEYSTORE_BASE64` | The upload keystore, base64 | §5 |
| `ANDROID_KEYSTORE_PASSWORD` | Its password | §5 |
| `ANDROID_KEY_ALIAS` | `upload` | §5 |
| `ANDROID_KEY_PASSWORD` | The key password (can be the same) | §5 |
| `PLAY_SERVICE_ACCOUNT_JSON` | The service account JSON file's content | §2.8 |
| `ASC_KEY_ID` | App Store Connect API Key ID | §3.3 |
| `ASC_ISSUER_ID` | App Store Connect Issuer ID | §3.3 |
| `ASC_KEY_P8_BASE64` | The `.p8` file, base64 | §3.3 |

Secrets can't be read back from GitHub, only replaced. Workflows triggered from forks never receive
them.

## 5. The Android upload key (one time)

Claude checks first whether Java's `keytool` is on your computer (it comes with any JDK 21, which
Claude can help install). Then, in a terminal **you** run:

```
keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 4096 -validity 10000
```

- Choose a strong password (twice); answer the name questions (your name, "Mean Chess", your city and
  country).
- Convert it for GitHub (Claude gives the exact command for Windows) and add the four secrets (§4).
- **Keep `upload.jks` and the password safe** in two places (a password manager plus a USB stick). If
  they're lost, Play support can reset the upload key, which takes a few days.

## 6. The release routine (every update, both stores)

1. **Claude:**
   - re-checks both stores' upcoming-requirements pages (MOBILE-STORES.md §12);
   - updates the version (`npm version x.y.z`; 1.0.0 is the store launch, M17), ROADMAP and
     DECISIONS, the release notes in
     `store/listing/`, and the privacy policy if anything about data changed;
   - runs every check: lint, typecheck, `test:coverage`, `build`, `build:app`.
2. **Claude:** pushes to `main` (the website deploys as today) and tags `vX.Y.Z`. The tag runs the
   mobile workflows: Android lands in the internal track, iOS in TestFlight.
3. **Founder:** installs both test builds and plays for 5 minutes (a computer game, one lesson,
   aeroplane mode). Says "OK".
4. **Founder:** Play Console → promote the build to **Production** (staged 20%) with the release
   notes; App Store Connect → new version → choose the build → What's New → **Submit**.
5. When approved: App Store **Release**; Play rollout to 100% after a day or two without crashes.
6. **Claude:** updates the handover (versions, build numbers, dates, links).

## 7. When things go wrong

| Problem | What to do |
|---|---|
| **Apple rejects the app** | Paste the full message to Claude. Usually: reply in Resolution Center (e.g. explaining offline play), or fix and resubmit. Don't argue on 4.2; show what the app does. |
| **Play rejects or removes for policy** | Read the email; fix the form or the app; appeal through the link in the email if it's a mistake. |
| **Testers dropped below 12** | Invite more at once. The 14 days restart from when the count is back at 12. |
| **Lost Android upload key** | Play Console → Setup → App signing → **Request upload key reset**; Claude helps create a new key. |
| **Apple membership expiring** | Renew in the Apple Developer app before the date; the app leaves the store if it lapses. |
| **A store email with a deadline** | Forward it to Claude in a new session; most are form updates. |
| **CI build fails** | Claude reads the log; the website is unaffected (separate workflow). |
