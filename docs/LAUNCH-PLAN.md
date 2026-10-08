# Launch plan: releases, build order, rollout, founder steps (Phase 2)

**Status: approved by the founder on 8 October 2026. Nothing here is built yet.**
This turns the Phase 2 design into an ordered plan. Overview and master roadmap:
[PHASE-2-BLUEPRINT.md](PHASE-2-BLUEPRINT.md). Track B steps: [DISCOVERY-AND-LISTING.md](DISCOVERY-AND-LISTING.md).

---

## 1. Release sequence

The brief suggested lobby (v0.4) → accounts (v0.5) → ratings (v0.6). **This plan changes the order:
clocks come before any public lobby.** Strangers matched without clocks can stall forever. Friends
playing a casual invite game can live without clocks for a release; a public lobby can't. Accounts move
behind the lobby too: nothing in the first three online releases needs an identity beyond a seat token.

| Version | Objective | In | Explicitly out | Launch criteria |
|---|---|---|---|---|
| **v0.2.1** (tag only) | Mark what's live today | The welcome page and tutorial (D-48), plus "nothing points out royal wins" (D-46), already on `main` | Anything new | Founder approves the tag (F8) |
| **v0.2.2** Auto difficulty | The computer picks a fair level for each player | An **Auto** level (P2-33) in the New game dialog, the default for new players: starts at Nice, steps up after two wins in a row, down after two losses. Stored only on the player's device. | Online play | Staircase tests; founder tries it (F14 approved 9 October 2026) |
| **v0.3.0** Play a friend online | Two people on different devices reliably finish a game of Mean Chess | `/online/`: create (pick a colour), invite link and code, join with a click, server-validated moves, reconnects, draw offers, resignation, abort, claim after the opponent leaves, rematch, finished-game share link (30 days), the daily capacity guard with the computer fallback, the "server lost" fallback, privacy page, metrics | Clocks, lobby, quick match, chat, names, accounts, ratings, spectators, takebacks, custom start positions | ONLINE-TEST-PLAN.md §10, all 15 lines |
| **v0.3.x** Hardening | Fix what the beta finds | Bug fixes, limit tuning, "continue on another device" link, preset messages if wanted, CSP meta tag, Turnstile if abuse appears | New modes | No open critical bugs; desync count still zero |
| **v0.4.0** Clocks | Timed games between friends | Server-authoritative Fischer clocks (ONLINE-PROTOCOL.md §10), first-move abort timer, timeout endings | Lobby | Clock tests (flag by alarm, increments, disconnect while timed) and a load test with clocks |
| **v0.5.0** Lobby and quick match | Play strangers | Public "open challenges" list, quick match by time control, optional display names (with a blocklist), live spectating | Accounts, ratings | Enough traffic to make it worthwhile: **≥ 20 online games a day from non-founder players for 2 weeks**, else it opens into an empty room |
| **v0.6.0** Optional accounts and history | Keep your games across devices | Optional sign-in (candidates: passkeys, or "Sign in with Lichess" OAuth; decided then), game history page, D1 index | Ratings | Privacy page updated; deletion flow |
| **v0.7.0** Ratings | Competitive play | Glicko-2 ratings for rated lobby games, fair-play review basics (ONLINE-SECURITY.md §7) | Tournaments | Fair-play tooling ready |

Later, if ever: tournaments, puzzles from real games, an analysis board.

## 2. Build order for v0.3 (Track A milestones)

Each milestone ends green (lint, typecheck, tests, build) and is committed separately. Production code
is **not** touched before A1. **A0 needs the founder's Cloudflare account** for its second half.

| # | Milestone | Depends on | Deliverables | Exit criteria |
|---|---|---|---|---|
| **V7** | Auto difficulty, released as v0.2.2 (independent of the server; runs while the founder sets up Cloudflare) | F14 approved | `src/app/autoLevel.ts`, an **Auto** option in the New game dialog, tests | Tests green; founder tries it; deployed as v0.2.2 |
| **A0** | **Spike: prove the platform** (throwaway branch `spike/online`, not merged) | Blueprint approved; A0b needs F-A1 to F-A6 | (a) Locally: a Worker plus `GameRoom` object with hibernation, importing `src/engine`, replaying fixture games in `wrangler dev`. (b) Deployed to a Free account: measure CPU per message and per restore (Workers Logs `cpuTime`); check whether the Rate Limiting binding works on Free; measure how long until `webSocketClose` fires after a client vanishes silently; observe a deploy dropping sockets; confirm the compatibility date and auto-response. Re-check `@cloudflare/vitest-plugin` for Vitest 5. | A one-page spike report appended to this document. Each open question answered: (1) restore CPU vs 10 ms; (2) rate limits on Free; (3) silent-drop detection time; (4) test harness choice. P2 decisions confirmed or amended. |
| **A1** | Shared protocol | Approval | `src/online/protocol.ts`, `limits.ts`, `ids.ts`; lint boundary; Vitest project `online` | ONLINE-TEST-PLAN.md §2 protocol tests; coverage thresholds |
| **A2** | RoomCore and restore | A1 | `server/src/room.ts` (pure state machine), fixtures from the standard start (Royal Capture, Slaughter, Cannibalism, mate, draws), restore ≡ replay property tests | §2 RoomCore tests and §3 engine tests, all green |
| **A3** | Worker and Durable Object adapter | A2, A0 | `server/` (routing, CORS, Origin, rate limits, SQLite schema and migrations, hibernation, alarm, metrics, logs, the `DailyCapacity` guard), local integration harness, `npm run test:server` | §4 and §5 integration and failure tests green locally |
| **A4** | Online client core | A1 (with a fake server); A3 for integration | `src/app/online/connection.ts` (hello, heartbeat, reconnect, pending-move reconciliation), `onlineState.ts` reducer | Reducer and connection tests with a fake WebSocket; one integration run against A3 |
| **A5** | Online page | A4 | `online/index.html`, `src/online.tsx`, `OnlineApp.tsx`: create, join (with quick rules), waiting, play, away, finished (share, rematch), errors; the "online full" and "server lost" states with the computer fallback (labelled, Auto level); invite Open Graph tags; finished-game view; phone layouts in all themes; accessibility | UI tests (jsdom); manual checks at 375 px and desktop; **no Kill Zone hints** (assertions copied from `play.test.tsx`) |
| **A6** | End-to-end tests and CI | A3, A5 | Playwright set (ONLINE-TEST-PLAN.md §6); CI: `test:server`, E2E smoke; `deploy-online` job (production deploy step gated until A9) | All of §6 green locally; CI green |
| **A7** | Staging | A6; founder steps F-A1 to F-A6 | Staging Worker deployed; `tools/loadtest.ts`; `tools/metrics.ts` report | §7 load tests pass; metrics and logs visible; cost per game measured and compared with the model |
| **A8** | Privacy, analytics, kill switch, docs | A7 (can overlap) | `/privacy/` page; the agreed analytics (F6); kill switch tested; docs updated "as built" (these Phase 2 docs, DECISIONS.md entries D-50+, ENGINE/README/ROADMAP) | Founder approves the privacy text (F7) |
| **A9** | Production, dark launch | A7, A8; founder approval | Backend in production; site deployed with `/online/` **unlisted** (no links from other pages) | Founder and Claude finish 3 games on different networks; health and metrics fine |
| **A10** | Private alpha (Stage 2) | A9 | 3–8 invited testers, 1–2 weeks; fixes as v0.3.0-alpha.N | §3 stage 2 exit criteria |
| **A11** | Public beta (Stage 3) | A10; founder approval | "Play online (beta)" linked from the welcome and play pages; if the capacity guard closes on 2+ days a week, the founder chooses between upgrading and keeping the guard; Track B Tier 2 posts after a week of stable beta | §3 stage 3 exit criteria |
| **A12** | v0.3.0 stable (Stage 4) | A11 | Tag `v0.3.0`; release notes; handover updated | ONLINE-TEST-PLAN.md §10, all lines |

Why this order:
1. The **contract** (A1) comes before anything that speaks it.
2. The **authoritative state machine** (A2) comes before storage and sockets (A3).
3. The **server** comes before the UI depends on it (A4–A5 can start against a fake).
4. The UI comes before the browser tests that drive it (A6).
5. Staging comes before real people (A7 → A10).
6. The privacy page comes before strangers (A8 → A11).

The UI is never built before the authoritative state is defined.

## 3. Staged rollout

| Stage | Who | Entry | Duration | Exit criteria (all required) | Rollback |
|---|---|---|---|---|---|
| **1. Internal and staging** | Claude (automated) and the founder | A6 green | Until it passes | All automated tests green; load tests (§7 of the test plan) pass on staging; the deploy-during-play test passes; restore CPU within the free limit (zero-replay resume if needed) | n/a (nothing public) |
| **2. Private alpha** | Founder plus 3–8 invited testers on their own devices and networks | A9 dark launch working | 1–2 weeks | ≥ 30 complete games; **0 desyncs**; **0 illegal moves accepted**; 0 `internal` errors in the last 3 days; reconnect worked in every reported drop; each of Royal Capture, Royal Slaughter and Royal Cannibalism seen; round-trip p95 ≤ 500 ms; every critical bug fixed | `wrangler rollback`; or the kill switch, which leaves the page up showing "paused" |
| **3. Public beta** | Anyone; linked as "Beta" | Stage 2 passed; privacy page live; founder approval | 2–4 weeks | ≥ 100 complete games, ≥ 50 of them between non-founder players; 0 desyncs; 0 critical bugs open; no free quota ran out (the capacity guard closed first), and the guard closed on fewer than 2 days a week (else the founder decides about upgrading); 0 `internal` errors in the final 7 days; at least one production deploy during the beta with 0 lost moves | Kill switch plus rollback; remove links (back to dark launch) |
| **4. Stable v0.3.0** | Everyone | Stage 3 passed | — | ONLINE-TEST-PLAN.md §10, all 15 lines; tag `v0.3.0` | As stage 3 |

## 4. What Claude does vs what the founder does

**Claude (locally, with the founder's standing approvals for pushes and deploys):**
- all code, tests, configuration (`wrangler.jsonc`, CI), docs, research;
- spike measurements;
- staging deploys and load tests;
- the production deploy *after* the founder's go-ahead for each stage;
- the privacy page draft;
- the press kit and assets for Track B;
- metrics reports;
- the handover file.

**Founder (personally, because it needs their identity, money, accounts or public voice):**
- creating and securing accounts (Cloudflare, Reddit, Chess.com and so on);
- the API token and GitHub secret;
- approving each stage gate, and deciding on a paid upgrade if a trigger ever fires (saying no is fine);
- choosing the public contact (done: GitHub Issues, F7);
- recruiting alpha testers;
- writing and publishing community posts (DISCOVERY-AND-LISTING.md §9);
- accepting any terms of service.

## 5. Founder steps, click by click

Dashboards change over time. If a label below doesn't match, search the dashboard (Cloudflare has a
search box at the top) for the quoted name.

**F-A1. Create a Cloudflare account** (free; no card):
1. Go to https://dash.cloudflare.com/sign-up.
2. Enter your email and a strong, unique password. Click **Sign up**.
3. Open the verification email from Cloudflare and click the link.
4. If Cloudflare asks you to add a domain or website, **skip it**: we don't need one.

**F-A2. Turn on two-factor authentication** (important: this account will run every online game):
1. Click the person icon (top right), then **Profile**.
2. Click **Authentication**.
3. Under **Two-Factor Authentication**, click **Set up**, then scan the code with an authenticator app
   (Google Authenticator, 1Password, Authy…).
4. Enter the 6-digit code to confirm.
5. **Save the backup codes** somewhere safe (not in the repo).

**F-A3. Choose the `workers.dev` subdomain:**
1. In the left menu, open **Workers & Pages** (under **Compute** in the newer dashboard).
2. On the overview page, find **Subdomain** in the right-hand panel, then click **Change** (or **Set
   up**).
3. Type `meanchess`. If it's taken, try `meanchess-game`. Click **Continue** or **Save**.
4. Tell Claude the subdomain. The game server's address will be
   `https://meanchess-online.<subdomain>.workers.dev`.

**F-A4. Create the deploy token for GitHub Actions:**
1. Person icon (top right) → **Profile** → **API Tokens** → **Create Token**.
2. Next to **Edit Cloudflare Workers**, click **Use template**.
3. Under **Account Resources**: **Include** → your account.
4. Under **Zone Resources**: leave **All zones** (you have none; nothing is affected).
5. Click **Continue to summary** → **Create Token**.
6. **Copy the token now.** Cloudflare shows it only once. Don't paste it into chat, a document or the
   repo; go straight to F-A5.

**F-A5. Give GitHub the token:**
1. Open https://github.com/OnePanda2/Mean.Chess → **Settings** (repository tab bar) → in the left
   sidebar, **Secrets and variables** → **Actions**.
2. On the **Secrets** tab, click **New repository secret**.
   - Name: `CLOUDFLARE_API_TOKEN`
   - Secret: paste the token.
   - Click **Add secret**.
3. Switch to the **Variables** tab and click **New repository variable**.
   - Name: `CLOUDFLARE_ACCOUNT_ID`
   - Value: your **Account ID**. In Cloudflare, go to **Workers & Pages**; it's in the right-hand
     panel, with a copy button.
   - Click **Add variable**.

**F-A6. Let this computer deploy to staging** (one time; Claude runs the command, you click):
1. Claude runs `npx wrangler login` in the project folder, and a browser tab opens on Cloudflare.
2. Check that it's your account, then click **Allow**.
3. Close the tab when it says you're logged in.

**F-A7. Only if a trigger fires *and* you decide to pay: upgrade to Workers Paid** ($5/month plus
usage; triggers are in ONLINE-ARCHITECTURE.md §8). **You never have to do this.** If you stay on Free,
on very busy days the capacity guard stops new online games until 00:00 UTC, games in progress
finish, and players are offered the computer instead. If any other screen during setup asks for a card, stop and tell Claude: nothing else
in this plan needs one.
1. **Workers & Pages** → **Plans** (or the **Upgrade** button) → choose **Workers Paid** →
   **Purchase**.
2. Add a card.
3. Set a spending alert: **Notifications** (left menu, or search "Notifications") → **Add** → choose
   the **Usage Based Billing** alert → threshold **$10** → your email → **Save**.

**F-A8. Cloudflare Web Analytics** (approved, F6a; free):
1. **Analytics & Logs** → **Web Analytics** → **Add a site**.
2. Hostname: `meanchess.siddheshthapa.com`.
3. Choose the **JavaScript snippet** option (no DNS change).
4. Copy the token shown in the snippet and give it to Claude. It isn't secret: it ends up in the page.

**F-A9. Public contact: decided.** GitHub Issues, https://github.com/OnePanda2/Mean.Chess/issues (F7).
Revisit a dedicated email later.

**F-A10. Recruit 3–8 alpha testers.** People who will play at least two games, on different
devices: ideally one iPhone, one Android, one laptop on another network. Send them the unlisted link
Claude gives you at A9.

## 6. Failure modes: what can go wrong (both tracks)

| Failure | Prevention | Detection | Recovery |
|---|---|---|---|
| WebSocket disconnects | Heartbeat; deploys only off-peak | `presence` and reconnect metrics | Automatic reconnect plus `state` snapshot |
| Backend unavailable (Cloudflare incident) | Nothing (rare); the static site stays up | Health check; player reports | After 30 s the page offers **Keep waiting** or **Finish this position against the computer**; games resume when it's back |
| Storage errors | Writes in one implicit transaction; output gates [S5] | `internal` errors in logs | The object restarts from the last durable state; the client resyncs |
| Stale client (old tab, old position) | `ply` precondition; protocol versions | `stale` rejection counts | `state` snapshot; reload prompt if the protocol is too old |
| Duplicated move | `mid` idempotency | Duplicate counter | No change by construction |
| Malicious move | Engine validation; size and shape checks | `illegal-move` and abuse metrics | Rejected; floods closed with 1008 |
| Room takeover | 256-bit tokens; never in URLs | `not-authenticated` counts | Without the token there's nothing to take over; an open invite can be cancelled |
| Invite leak (a stranger takes the open seat) | Join needs a click; previews can't claim; the creator sees who joined (a seat filled while their friend is still asking) | Creator notices | Abort (allowed before move 2), new invite |
| Game state corruption | One writer; engine validation; restore check against `current_fen`; property tests | `restore_mismatch` logs; desync metric | Full replay from the history (the truth); kill switch plus rollback if systemic |
| Bad deploy | CI gates; staging first; additive schemas | Error metrics after deploy | `wrangler rollback`; Pages: revert and push |
| DNS problem | **None to have**: `workers.dev`, and the site's DNS is untouched | — | — |
| Browser cache (old client after a deploy) | Server accepts two protocol versions | `unsupported-protocol` counts | Reload prompt |
| Frontend and backend versions incompatible | Backend deploys first; additive protocol changes | Version mismatch errors | Rollback whichever side moved |
| Migration failure | Additive, transactional, tested migrations | `internal` on wake | Rollback the code; the old code ignores new columns |
| A free quota runs out mid-day | **The capacity guard** (daily and per-address caps) closes new games first; limits; monitoring | Guard closures; quota graphs | Games in progress finish; new online games reopen at 00:00 UTC, with the computer offered meanwhile; an optional upgrade (F-A7), only if you choose |
| Unexpected cost (Paid) | Rate limits; billing alert at $10; cost model per game | Billing notification | Kill switch; investigate; tune |
| `workers.dev` blocked on some networks | — | Testers can't connect from school or office | Optional branded domain (move DNS to Cloudflare; ONLINE-ARCHITECTURE.md §7) |
| Community rejection (posts removed, downvoted) | Follow each venue's rules; lead with rules and a question, not a pitch (DISCOVERY-AND-LISTING.md) | Mod messages; post score | Ask the mods; fix the post; wait the cooldown; move on to other channels |
| Submission delay (Chess Variant Pages) | Submit early; full, well-formatted page | No editor response in 3 weeks | One polite comment on the submission; email an editor after 6 weeks |
| Spam flag (a new account posting a link) | Founder participates in the community first; one post per venue; disclose that it's your game | Post removed or filtered | Message the mods; don't repost the same text |
| Platform policy changes (pricing, community rules) | Dated sources; re-check before acting [PHASE-2-SOURCES.md] | Re-check at each stage gate | Adjust the plan; the escape hatch to a Node server (ONLINE-ARCHITECTURE.md §9) |
