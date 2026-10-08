# Phase 2 decision log

Decisions forced by the Phase 2 research, in the format the planning brief asked for.
- **P2-01 to P2-30 were approved by the founder on 8 October 2026** (decisions F1–F12, under "Open
  Founder Decisions" in [PHASE-2-BLUEPRINT.md](PHASE-2-BLUEPRINT.md)).
- **P2-31 to P2-34 were added on 9 October 2026** after the founder asked for a seamless experience.
  The founder approved them the same day (F13, F14). The founder's main constraint is cost: **anything paid
is optional and needs the founder's explicit go-ahead**, and free engineering fixes come first. Once implemented, each one moves into
[DECISIONS.md](DECISIONS.md) as D-50 onwards. Sources are cited as [S#] from [PHASE-2-SOURCES.md](PHASE-2-SOURCES.md).

Reversibility scale: **easy** (a config or code change in a day), **moderate** (a milestone of work),
**hard** (data migration or user-visible breakage).

---

### P2-01 Backend platform
- **Options:**
  - Cloudflare Workers + Durable Objects;
  - Supabase (Realtime, Edge Functions, Postgres);
  - Firebase;
  - a Node WebSocket server on a VM (Fly.io, Railway);
  - Render free;
  - Vercel Functions;
  - PartyKit/partyserver.
- **Evidence:**
  - Durable Objects on Free since Apr 2025, aimed at multiplayer games [S6]; quotas and prices [S1];
    one object per game session is Cloudflare's own guidance [S5].
  - Supabase Free pauses after a week of inactivity; Pro is $25 [S20].
  - Firebase needs Blaze for Functions [S22].
  - Render sleeps and restarts [S23]; Fly has no free tier [S24].
  - Vercel's WebSockets are a beta, capped by function duration [S25].
  - Full matrix: ONLINE-ARCHITECTURE.md §4.
- **Chosen:** Cloudflare Workers plus one SQLite-backed Durable Object per game.
- **Why:**
  - The only option where our own code runs on every move, with transactional storage alongside it.
  - $0 at low traffic.
  - No servers to run.
- **Trade-offs:**
  - Cloudflare lock-in for the adapter layer.
  - Hard daily limits on Free.
  - The Free-plan CPU limit for objects is unclear [S2][S9].
  - Deploys drop sockets [S4].
- **Reversibility:** moderate. RoomCore and the protocol are platform-neutral; the Node server is the
  documented escape hatch (ONLINE-ARCHITECTURE.md §9).
- **Date:** 2026-10-08.

### P2-02 Realtime transport
- **Options:** WebSockets with the Hibernation API; plain WebSockets (no hibernation); Server-Sent
  Events plus POST; HTTP polling; Supabase Realtime channels.
- **Evidence:**
  - Hibernated objects aren't billed for duration; incoming messages are billed 20:1; pings are free
    [S1][S4].
  - The standard WebSocket API prevents hibernation [S3].
- **Chosen:** WebSockets with the Hibernation API, JSON text frames, and a literal `ping`/`pong`
  auto-response heartbeat.
- **Why:**
  - Instant both ways.
  - Cheapest when idle.
  - Works in every browser.
- **Trade-offs:** reconnect logic is mandatory (and it's needed for deploys anyway).
- **Reversibility:** moderate.
- **Date:** 2026-10-08.

### P2-03 Server authority and engine reuse
- **Options:**
  - the existing engine imported unchanged;
  - an engine npm package or workspace;
  - a separate server engine;
  - client-trusted moves with server relay.
- **Evidence:**
  - The engine is pure and deterministic, enforced by lint (D-22).
  - 89.9 µs per move; a 300-ply replay takes 22.4 ms [M1].
  - The Free plan may limit CPU to 10 ms per invocation [S2][S9].
- **Chosen:** the server imports `src/engine/index.ts` unchanged and validates every move with
  `play()`. Restores after hibernation are bounded by a MeanFEN checkpoint after the last irreversible
  move, plus a tail of at most about 100 plies (ONLINE-DATA-MODEL.md §4).
- **Why:**
  - One engine, so client and server can never disagree on rules.
  - The checkpoint keeps restores within even the strictest CPU limit, without changing the engine.
- **Trade-offs:** the restore equivalence must be proved by property tests (planned).
- **Reversibility:** easy. A full replay is always possible as a fallback.
- **Date:** 2026-10-08.

### P2-04 Persistence
- **Options:**
  - none or ephemeral;
  - per-game SQLite in the object;
  - D1 (a central SQLite);
  - Postgres (Supabase or Neon).
- **Evidence:**
  - Object storage is transactional and strongly consistent, next to the code [S19].
  - Output gates prevent unsaved confirmations [S5].
  - New namespaces must use SQLite [S8].
- **Chosen:** per-game SQLite inside each Durable Object. **No central database in v0.3.**
- **Why:**
  - One writer per game.
  - Atomic validate-and-write.
  - Nothing to pay for when idle.
  - v0.3 has no cross-game queries.
- **Trade-offs:** aggregate questions are answered by metrics, not SQL. History and ratings will need
  D1 later (v0.6).
- **Reversibility:** moderate.
- **Date:** 2026-10-08.

### P2-05 Identity: guests or accounts
- **Options:**
  - (A) guest-only;
  - (B) guests plus optional accounts;
  - (C) mandatory accounts.
- **Evidence:**
  - The brief's goal is "two humans… reliably play a complete game".
  - Accounts add password handling, a privacy burden and moderation.
  - Seat tokens give reconnects without accounts (ONLINE-SECURITY.md §2).
- **Chosen:** (A). Guests only, with 256-bit per-game seat tokens kept in `localStorage`, hashed on the
  server, and sent only in the first WebSocket message. No cookies. Optional accounts arrive in v0.6.
- **Why:**
  - Smallest friction: an invite link and one click.
  - Nearly no personal data.
  - Nothing to moderate.
- **Trade-offs:**
  - A player who clears site data or switches device loses that seat.
  - No history across games.
  - No usernames.
- **Reversibility:** easy (accounts can be added on top).
- **Date:** 2026-10-08.

### P2-06 Room model
- **Options:** private room code; shareable invite URL; public lobby; quick matchmaking; a
  combination.
- **Evidence:**
  - Low initial traffic.
  - A lobby without clocks invites stalling (P2-07).
  - Matchmaking with few players means empty waits.
- **Chosen:** for v0.3, a private **invite link** (`/online/?g=<id>`) plus the same id as a **typed
  code**. Joining takes a click. The lobby and quick match come in v0.5, only once there are 20 or more
  non-founder games a day.
- **Why:** it matches how a new variant spreads (friends teaching friends) and never opens into an
  empty room.
- **Trade-offs:** no way to find strangers in v0.3.
- **Reversibility:** easy.
- **Date:** 2026-10-08.

### P2-07 Clocks
- **Options:** none; a simple countdown; standard time controls; increment; server-authoritative
  clocks.
- **Evidence:**
  - Clocks need server time authority, alarm-based flag detection, lag policy and disconnect rules
    (ONLINE-PROTOCOL.md §10).
  - Background tabs throttle timers.
- **Chosen:** **no clocks in v0.3.** Server-authoritative Fischer clocks in v0.4, which must come before
  any public lobby (v0.5).
- **Why:**
  - v0.3's goal is reliability.
  - Friends can play untimed.
  - Strangers can't, which reorders the brief's roadmap.
- **Trade-offs:** a connected player can stall. Mitigated by abort (before move 2) and by v0.4.
- **Reversibility:** easy; the v0.4 columns are additive.
- **Date:** 2026-10-08.

### P2-08 Disconnects and online-only endings (**approved by the founder, F2**)
- **Options:**
  - forfeit on disconnect;
  - a grace period then automatic forfeit;
  - the opponent may claim after a grace period;
  - no rule.
- **Evidence:**
  - Refreshes, network changes and deploys all cause short disconnects [S4].
  - Untimed games need some way to end when someone leaves.
- **Chosen (approved):**
  - no automatic forfeit, ever;
  - the opponent may **claim a win or a draw after 120 s** of continuous absence;
  - **abort** while either side has yet to make a move;
  - **abandoned** (no winner) after 7 days with no moves or connections;
  - a **move-limit** draw at 2,000 plies, the saved-game limit.
- **Why:** it never punishes a refresh, and never leaves a game stuck.
- **Trade-offs:** these are new end reasons outside RULES.md. The founder approved them on 8 October
  2026. They're platform policy, not rules.
- **Reversibility:** easy (constants and end reasons).
- **Date:** 2026-10-08.

### P2-09 Spectators and sharing
- **Options:** no viewing; live spectators; finished-game view only.
- **Evidence:** spectators add sockets, rules and abuse surface. A finished-game view reuses the
  SavedGame loader.
- **Chosen:** no live spectators in v0.3. A **finished game is viewable read-only by its link for 30
  days**.
- **Why:** it makes memorable games shareable (traction) at almost no cost.
- **Trade-offs:** friends can't watch live.
- **Reversibility:** easy.
- **Date:** 2026-10-08.

### P2-10 Chat and social features
- **Options:** text chat; emojis or preset messages; rematch; friends; share buttons.
- **Evidence:**
  - Chat needs moderation and is a children's-safety surface.
  - v0.3 players already know each other.
- **Chosen:** **rematch** and **copy/share invite** only. No chat, names, reactions or friends in v0.3.
  Preset messages are a v0.4+ candidate.
- **Why:** only features that materially improve the core loop.
- **Trade-offs:** less social.
- **Reversibility:** easy.
- **Date:** 2026-10-08.

### P2-11 Fair-play scope
- **Options:** server legality only; plus engine-assist detection; plus reporting and review.
- **Evidence:**
  - Chess has no hidden information.
  - A browser can't stop a player consulting an engine.
  - Games are unrated.
- **Chosen:**
  - **guarantee** move legality and result integrity (the server is the only authority; no client
    results);
  - **don't attempt** assistance detection before ratings (v0.7);
  - store move timestamps now for later analysis.
- **Why:** honest, achievable guarantees.
- **Trade-offs:** casual games can be engine-assisted.
- **Reversibility:** easy.
- **Date:** 2026-10-08.

### P2-12 Repository structure
- **Options:** (A) one repository, frontend plus backend; (B) separate repositories.
- **Evidence:**
  - The engine must be shared, and one commit keeps the two in step.
  - The existing CI and Pages pipeline can extend.
- **Chosen:** (A). A `server/` Worker plus shared pure `src/online/`; the engine stays in `src/engine/`.
- **Why:**
  - No engine package to publish.
  - No version skew.
  - One pipeline.
- **Trade-offs:** CI grows; backend deploys must be path-filtered.
- **Reversibility:** moderate.
- **Date:** 2026-10-08.

### P2-13 Domains
- **Options:**
  - `*.workers.dev`;
  - `api.meanchess.siddheshthapa.com`, which means moving `siddheshthapa.com`'s DNS to Cloudflare;
  - separate `ws.` and `api.` hosts.
- **Evidence:** custom domains need an active Cloudflare zone; CNAME setup is Business or Enterprise
  only [S11].
- **Chosen:** `https://meanchess-online.<subdomain>.workers.dev` serves both HTTP and WebSocket. **No
  DNS changes. No cookies.**
- **Why:** it doesn't touch the live site or the founder's other domains.
- **Trade-offs:**
  - An unbranded URL.
  - Some networks filter `workers.dev`, to be watched in the alpha.
- **Reversibility:** easy. Moving DNS later is a founder decision (F10).
- **Date:** 2026-10-08.

### P2-14 Environments and deployment
- **Options:** production only; staging plus production; preview per pull request.
- **Evidence:**
  - Deploys drop sockets [S4].
  - Wrangler environments and rollback exist.
- **Chosen:**
  - local (`wrangler dev`), then a staging Worker, then a production Worker;
  - GitHub Actions deploys the backend before Pages, path-filtered;
  - the alpha is a **dark launch** on production (`/online/` unlisted).
- **Why:**
  - Staging for load tests.
  - Real infrastructure for testers.
  - Going public is just adding links.
- **Trade-offs:** no hosted staging frontend (local dev against staging is enough).
- **Reversibility:** easy.
- **Date:** 2026-10-08.

### P2-15 Protocol versioning
- **Options:** strict lockstep; the current plus the previous version; feature negotiation.
- **Evidence:** GitHub Pages caches HTML for about 10 minutes, and tabs stay open for hours.
- **Chosen:**
  - an integer `PROTOCOL_VERSION`;
  - the server accepts current and previous;
  - additive changes only within a version;
  - clients ignore unknown events;
  - rules version pinned per game.
- **Why:** deploys don't break open tabs.
- **Trade-offs:** the server carries compatibility code for one version.
- **Reversibility:** easy.
- **Date:** 2026-10-08.

### P2-16 Plan and cost thresholds
- **Options:** Free until forced; Paid from the start; trigger-based.
- **Evidence:**
  - Free supports about 130 games a day, limited by duration.
  - Paid costs about $12.50 a month at 10,000 players and about $125 at 100,000 (ONLINE-ARCHITECTURE.md
    §8) [S1][S10].
- **Chosen (approved, F5):**
  - start on **Free ($0, no card)**;
  - when any daily quota passes 50% on two days in a week, **offer** the upgrade to Paid. The founder
    decides, and staying free is always acceptable;
  - a CPU problem in the spike is solved for free (zero-replay resume, ONLINE-DATA-MODEL.md §4), not
    by paying;
  - **review** if an eventual bill exceeds $50 a month for two months.
- **Why:**
  - No fixed cost, ever, unless the founder chooses one.
  - On Free, Cloudflare fails requests over the limits instead of billing [S1].
  - Upgrading takes minutes and no code.
- **Trade-offs:** on Free, a very busy day closes *new* online games until 00:00 UTC (P2-31). Games in
  progress finish, and players get the computer instead.
- **Reversibility:** easy.
- **Date:** 2026-10-08.

### P2-17 Analytics (**approved by the founder, F6**)
- **Options:**
  - none;
  - Cloudflare Web Analytics;
  - server-side counters (Analytics Engine);
  - anonymous funnel beacons;
  - Google Analytics, PostHog or Plausible.
- **Evidence:**
  - Web Analytics is free and cookieless according to Cloudflare, with no DNS change [S28].
  - Analytics Engine is free, with billing not active [S13].
  - Track B can't be measured without referrers.
- **Chosen (approved; the founder asked to keep it anonymous and minimal):**
  - (a) **Web Analytics** from the first community post;
  - (b) **server-side online metrics** in v0.3;
  - (c) **four anonymous funnel beacons**.
  - No cookies, ids or third-party trackers.
- **Why:** the minimum needed to know what works.
- **Trade-offs:**
  - Visits, not people.
  - Ad blockers hide some.
  - No retention measure.
- **Reversibility:** easy.
- **Date:** 2026-10-08.

### P2-18 Retention
- **Options:** keep forever; time-boxed; delete at game end.
- **Evidence:**
  - Free storage is 5 GB [S1].
  - Privacy minimalism.
  - The share link needs some retention.
- **Chosen:**
  - unjoined invites: 24 h;
  - finished games: 30 days;
  - untouched open games: closed after 7 days, deleted 30 days later;
  - logs: Cloudflare's 3–7 days [S14];
  - metrics: aggregate only.
- **Why:** long enough to share a game, short enough to hold almost nothing.
- **Trade-offs:** no permanent archive until accounts exist.
- **Reversibility:** easy for future games (deleted games are gone).
- **Date:** 2026-10-08.

### P2-19 Testing stack
- **Options:**
  - `@cloudflare/vitest-plugin` (in-workerd tests);
  - Vitest 5 plus a locally started Worker;
  - Miniflare scripts;
  - Playwright for end-to-end.
- **Evidence:** the plugin requires Vitest ^4.1, and the project uses Vitest 5 [S16].
- **Chosen:**
  - Vitest 5 for pure code and RoomCore (with a fake clock);
  - integration tests against a **locally started Worker** with real WebSockets;
  - Playwright with **two browser contexts**;
  - a Node load-test script against staging.
- **Why:** real-runtime fidelity without downgrading the test framework.
- **Trade-offs:** a slower integration suite; harness details settled in the A0 spike.
- **Reversibility:** easy (switch to the plugin if it supports Vitest 5).
- **Date:** 2026-10-08.

### P2-20 Release order
- **Options:**
  - the brief's: v0.3 private → v0.4 lobby → v0.5 accounts → v0.6 ratings;
  - alternatives.
- **Evidence:**
  - A public lobby without clocks invites stalling.
  - No v0.3 feature needs an identity beyond a seat token.
- **Chosen:**
  - v0.2.1 (tag what's live);
  - **v0.3.0** private online games;
  - v0.3.x hardening;
  - **v0.4.0 clocks**;
  - **v0.5.0 lobby and quick match** (gated on traffic);
  - v0.6.0 optional accounts and history;
  - v0.7.0 ratings.
- **Why:** each release is usable on its own, and the lobby isn't opened into an empty room.
- **Trade-offs:** strangers wait longer for matchmaking.
- **Reversibility:** easy (it's a plan).
- **Date:** 2026-10-08.

### P2-21 Community strategy
- **Options:**
  - chase native support (Chess.com, Lichess, PyChess);
  - list and discuss, pointing to our site;
  - paid promotion.
- **Evidence:**
  - Chess.com custom variants can't express Mean [S45].
  - Lichess has no process for new variants [S46].
  - PyChess needs Fairy-Stockfish [S51][S53].
  - Lichess and r/chessvariants forbid AI-generated posts [S47][S49].
  - The Chess Variant Pages were unreachable on 8 Oct [S42].
- **Chosen:**
  - **Tier 1 now:** press kit, the Chess Variant Pages, r/chessvariants, the Chess.com forum.
  - **Tier 2 after the online beta:** the Lichess blog, a Reddit follow-up, Show HN.
  - **The founder writes every community post personally;** Claude prepares facts, images and
    skeletons.
  - No pursuit of native platform support.
- **Why:**
  - Quality audiences.
  - Venue rules followed.
  - Listings started early because they're slow.
- **Trade-offs:** slower and smaller than paid promotion, and depends on the founder's time.
- **Reversibility:** easy.
- **Date:** 2026-10-08.

### P2-22 Rate limiting and abuse
- **Options:** the Rate Limiting binding; Turnstile; a limiter Durable Object; in-object limits only.
- **Evidence:** the binding is GA, but its availability on Free isn't documented, and Cloudflare advises
  against IP keys [S12]. Floods could exhaust Free quotas [S1].
- **Chosen:**
  - the binding (if available on Free; checked at A0), with generous per-IP limits;
  - in-object limits on messages, sockets and offers;
  - a kill switch;
  - **Turnstile prepared but off**;
  - fallback: a sharded limiter object keyed by a salted IP hash.
- **Why:** proportionate to a casual game, and with a lever ready for real abuse.
- **Trade-offs:** shared IPs (schools) could hit limits; the limits are set high.
- **Reversibility:** easy.
- **Date:** 2026-10-08.

### P2-23 The online page
- **Options:** extend `/play/`; a new `/online/` page; a single-page router.
- **Evidence:**
  - The site is a multi-page Vite build without a router (D-31).
  - GitHub Pages can't route paths like `/online/<id>`.
- **Chosen:** a new `/online/` page (its own Vite entry). The invite is `/online/?g=<id>`; joining
  requires a click.
- **Why:**
  - No regression risk to local play.
  - Link previews and crawlers can't claim seats.
- **Trade-offs:** some UI wiring is duplicated (shared components are reused).
- **Reversibility:** easy.
- **Date:** 2026-10-08.

### P2-24 Takebacks online
- **Options:** none; a request-and-accept takeback; unlimited.
- **Evidence:** consent UI and protocol states would be needed; local play keeps its undo.
- **Chosen:** **none in v0.3** (approved by the founder, F4; local games keep Undo).
- **Why:** keeps the protocol and the "a move is final" model simple.
- **Trade-offs:** misclicks are final (standard online behaviour).
- **Reversibility:** easy (it can be added later).
- **Date:** 2026-10-08.

### P2-25 Rematch
- **Options:** a new invite from scratch; a server-created rematch with new tokens; with the same
  tokens.
- **Evidence:** sending a new secret over the socket risks loss if a player is offline at that moment.
- **Chosen:** on mutual agreement (both connected), the server creates a **new game** with colours
  swapped, **bound to the players' existing seat tokens**.
- **Why:** nothing secret is re-sent; a player who misses the event finds `rematch.next` in the old
  game's `state`.
- **Trade-offs:** a token is valid across a chain of rematches (same people, so acceptable).
- **Reversibility:** easy.
- **Date:** 2026-10-08.

### P2-26 Validators
- **Options:** hand-written; zod or valibot; JSON Schema.
- **Evidence:**
  - The saved-game loader is hand-written.
  - The project avoids new runtime dependencies.
- **Chosen:** hand-written validators in `src/online/protocol.ts`, with 95%/90% coverage.
- **Why:**
  - No dependency.
  - Small bundle.
  - Consistent style.
- **Trade-offs:** more test code.
- **Reversibility:** easy.
- **Date:** 2026-10-08.

### P2-27 Game ids
- **Options:**
  - UUIDs;
  - short random codes (8–12 characters);
  - word lists;
  - a check character.
- **Evidence:** ids only open open seats or finished games (ONLINE-SECURITY.md §3); codes are typed and
  spoken.
- **Chosen:** 10 Crockford base32 characters (50 bits), generated on the server, shown as `7KQ2M-X9FTA`,
  forgiving on input.
- **Why:** unguessable for its purpose, readable and typeable.
- **Trade-offs:** longer than a 6-character code.
- **Reversibility:** easy for new games.
- **Date:** 2026-10-08.

### P2-28 Positioning
- **Options:**
  - "chess with self-capture";
  - "kings kill kings";
  - "the king is the deadliest piece".
- **Evidence:** the brief warns against underselling; variant audiences value the rules themselves.
- **Chosen:**
  - lead with the king's three powers and the shield-and-weapon tension;
  - tagline "Kings kill kings."
  - no novelty claims (DISCOVERY-AND-LISTING.md §11).
- **Why:** accurate and memorable.
- **Trade-offs:** none of note.
- **Reversibility:** easy.
- **Date:** 2026-10-08.

### P2-29 Demonstration content
- **Options:** new demonstration material; reuse the tutorial and Scenario Lab.
- **Evidence:** Scenario Lab positions have deep links (`/play/?scenario=`) and are engine-verified;
  the tutorial covers the same mechanics.
- **Chosen:** reuse five Scenario Lab positions (§12 of the discovery doc) for diagrams, clips and posts.
  Optionally add `/tutorial/?lesson=` deep links.
- **Why:** zero new rule content to verify.
- **Trade-offs:** none.
- **Reversibility:** easy.
- **Date:** 2026-10-08.

### P2-30 Tag v0.2.1 (**approved by the founder, F8**)
- **Options:** leave `v0.2.0` as the latest tag; tag `v0.2.1` on `9956dc0`.
- **Evidence:** `main` is two commits past `v0.2.0`: D-46 (no royal-win hints) and D-48 (welcome page
  and tutorial), both deployed [M2].
- **Chosen (approved):** an annotated tag `v0.2.1` on the current `main`, and `package.json` 0.2.1.
- **Why:** the live site should match a tagged release before Phase 2 starts.
- **Trade-offs:** none.
- **Reversibility:** easy.
- **Date:** 2026-10-08.

### P2-31 Daily capacity guard (founder request: a seamless experience at $0)
- **Options:**
  - let free quotas run out (games break mid-way);
  - pay for Workers Paid from the start;
  - watch Cloudflare's usage and close new games when it's high;
  - count games per day and close new games at a safe cap.
- **Evidence:**
  - Over a free limit, "further operations of that type will fail with an error" until 00:00 UTC [S1].
  - Duration is the binding quota, at about 130 games a day (ONLINE-ARCHITECTURE.md §8).
  - On 9 Oct 2026 the founder asked for a seamless experience, at $0.
- **Chosen:**
  - a `DailyCapacity` object per UTC day;
  - a soft cap of 80 new invites, a hard cap of 100 games including rematches, and 20 per address;
  - existing invites and running games are never refused;
  - caps tuned from measured usage;
  - a friendly "full for today" panel offering the computer.
- **Why:** games in progress never break, nobody sees an error, and it stays $0.
- **Trade-offs:**
  - On the busiest days, new online games wait until 00:00 UTC.
  - One extra request per game.
  - Salted address hashes are kept for 48 hours.
- **Reversibility:** easy. They're settings; the caps can be raised after an upgrade.
- **Date:** 2026-10-09.

### P2-32 The computer as fallback, always labelled (founder's idea; approved, **F13**)
- **Options:** an error message; offer the computer, labelled; silently substitute a bot for the human
  opponent.
- **Evidence:**
  - The computer runs entirely in the browser (v0.2), so it works when the server is full or down.
  - v0.3 games are invites to a specific friend, so a substitute can't stand in for them.
  - Chess players care whether an opponent is human, and engine play is recognisable.
  - Future ratings, and honest feedback (Track B), depend on knowing who played whom.
- **Chosen (approved):**
  - Whenever online play can't start or continue (full for the day, kill switch, server lost
    mid-game), offer the computer in one click, at the player's Auto level.
  - It is **always clearly labelled as the computer** and never presented as a person.
  - In the v0.5 lobby, the same idea becomes "nobody accepted your challenge in 30 s: play the
    computer?"
- **Why:** seamless (no dead ends, no errors) without misleading anyone.
- **Trade-offs:** on a rare day, a player who wanted a human plays the computer until midnight UTC.
- **Reversibility:** easy.
- **Date:** 2026-10-09.

### P2-33 Auto difficulty (founder's idea; approved, **F14**)
- **Options:** fixed levels only; an Auto staircase from local results; a rating (needs accounts).
- **Evidence:**
  - Three levels exist (D-42).
  - There are no accounts in v0.3.
  - The device knows the player's results against the computer.
- **Chosen (approved):** an **Auto** level, the default for new players.
  - It starts at Nice.
  - Two wins in a row at the current Auto level or above step up; two losses in a row at the current
    level or below step down.
  - Draws reset the streak; resignations count as losses; undone or abandoned games don't count.
  - Stored only in `localStorage` (`mean-chess:skill:v1`). It shows the level it picked ("Auto:
    Mean").
  - Used by the fallback (P2-32).
  - It can ship before online play, as v0.2.2.
- **Why:** the right challenge for each player, with no accounts or tracking.
- **Trade-offs:** per device; only three steps.
- **Reversibility:** easy.
- **Date:** 2026-10-09.

### P2-34 Funnel events: batched and sampled
- **Options:** one request per event; batched per visit; sampled.
- **Evidence:** the Free plan's 100,000 Worker requests a day are shared across the account [S9]. A
  viral day with tens of thousands of visitors could otherwise crowd out game requests.
- **Chosen:** at most one `/v1/events` request per page visit, sent for 1 visit in 4; reports multiply
  by 4.
- **Why:** it protects online play while keeping the funnel measurable (F6: anonymous and minimal).
- **Trade-offs:** counts are estimates, rough at low volumes.
- **Reversibility:** easy.
- **Date:** 2026-10-09.
