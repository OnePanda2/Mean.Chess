# Mean Chess Phase 2 Blueprint

**Written 8 October 2026 and approved by the founder the same day (F1–F12 answered). Updated 9 October
2026 with the founder's "seamless experience" request: the capacity guard, the computer fallback and
Auto difficulty, which the founder approved the same day (F13–F14, see "Open Founder Decisions").
Nothing in Phase 2 has been built, deployed, posted or purchased yet.** The historical v0.1 plan stays in
[BLUEPRINT.md](BLUEPRINT.md). The canonical rules are still [RULES.md](RULES.md), unchanged.

Phase 2 has two tracks:
- **Track A:** turn Mean Chess into a real online game, where two people on different devices play
  each other through a server that enforces the rules.
- **Track B:** get Mean Chess listed and discussed where chess-variant players look.

| Document | What it holds |
|---|---|
| This file | The summary, decisions, roadmap, checklists and final recommendation |
| [ONLINE-ARCHITECTURE.md](ONLINE-ARCHITECTURE.md) | Backend comparison, architecture, engine reuse, repository layout, deployment, domains, cost model, observability |
| [ONLINE-PROTOCOL.md](ONLINE-PROTOCOL.md) | Game lifecycle, HTTP and WebSocket messages, races, reconnects, online-only rules questions, clocks (v0.4), chat |
| [ONLINE-DATA-MODEL.md](ONLINE-DATA-MODEL.md) | Storage schema, snapshots, restore, retention, migrations |
| [ONLINE-SECURITY.md](ONLINE-SECURITY.md) | Threat model, authentication, validation, abuse, fair play, privacy |
| [ONLINE-TEST-PLAN.md](ONLINE-TEST-PLAN.md) | Test stack, test cases, load tests, v0.3 launch criteria |
| [LAUNCH-PLAN.md](LAUNCH-PLAN.md) | Release sequence, build order, staged rollout, founder steps click by click, failure modes |
| [DISCOVERY-AND-LISTING.md](DISCOVERY-AND-LISTING.md) | Track B: channels, ranking, submissions, press kit, positioning, traction loop, analytics, metrics |
| [PHASE-2-DECISIONS.md](PHASE-2-DECISIONS.md) | 30 decisions (P2-01 to P2-30) in the brief's format |
| [PHASE-2-SOURCES.md](PHASE-2-SOURCES.md) | Every external source, with the date checked |

---

## Executive Summary

- **What v0.3 is:** "Play a friend online."
  1. You create a game and send a link.
  2. Your friend clicks **Join**, and you play a full game of Mean Chess.
  3. Every move is checked by the same engine that runs in the browser today, now running on a server.
  4. Refreshes, network drops, sleeping laptops and server deploys don't lose the game.
  5. When it ends, you can rematch or share the finished game.

  No accounts, no clocks, no chat, no lobby. Those come later, in a deliberate order.
- **How:**
  - one **Cloudflare Durable Object per game**, behind a small Cloudflare Worker on `workers.dev`;
  - the object runs the **existing engine unchanged**, stores the game in its own SQLite database, and
    pushes moves to both players over WebSockets;
  - the website stays on GitHub Pages, untouched, plus one new page, `/online/`;
  - **no DNS change** and no new account besides Cloudflare.
- **Cost:**
  - **$0, with no card on file.** On Cloudflare's free plan, going over a daily limit makes requests
    fail until 00:00 UTC; it never produces a bill [S1].
  - So that no game is ever cut off, a **daily capacity guard** stops *new* online games long before
    that point. Games in progress always finish, anyone turned away is offered the computer at a
    difficulty picked for them, and nobody sees an error.
  - The free plan carries about 130 online games a day: roughly 1,000–2,000 monthly online players.
    Players who only use the tutorial, the computer or local play never touch the server, so they cost
    nothing at any scale.
  - Paying is only ever optional. It comes to about **$12.50/month at 10,000** monthly players and
    about **$125/month at 100,000**, and only if the founder wants more online capacity on the busiest
    days. Upgrading is a 2-minute dashboard action with no code change.
- **Unknowns first:** the very first milestone (A0) is a spike that measures the three things the
  docs leave unclear:
  - whether the Free plan's 10 ms CPU limit applies to game objects;
  - whether the Rate Limiting binding works on Free;
  - how quickly a silently vanished player is detected.

  The design already works around each one.
- **Where this plan disagrees with the brief's suggested roadmap:**
  - **clocks must come before any public lobby**, because strangers without clocks can stall forever;
  - **accounts come after the lobby**, because nothing before them needs an identity;
  - **no quick match in v0.3**, because a niche variant's lobby would open into an empty room.
- **Track B in one line:** no major platform can host Mean Chess as a native variant:
  - Chess.com's custom variants can't express it;
  - Lichess adds no variants;
  - PyChess needs Fairy-Stockfish, which can't express it either.

  So the plan is to **list it** (the Chess Variant Pages, the GitHub repository) and **get it
  discussed** (r/chessvariants, Chess.com forums now; a Lichess blog and Show HN once online play
  works), always pointing at meanchess.siddheshthapa.com.
- **Two findings that change how promotion must be done:**
  - The Chess Variant Pages were **unreachable on 8 October 2026**, so that listing may be delayed.
  - Lichess blogs and r/chessvariants now explicitly **ban AI-generated posts**. The founder must
    write community posts personally; Claude prepares the facts, images and skeletons.
- **What the founder must do:**
  - approve this blueprint and answer 12 decisions (done on 8 October 2026);
  - create a free Cloudflare account and a deploy token (click-by-click steps in LAUNCH-PLAN.md §5);
  - approve each launch stage;
  - recruit a few alpha testers;
  - write and publish the community posts.

## Current Project State

**Verified in the repository on 8 October 2026** [M2]:
- `main` is at `9956dc0`, clean, and pushed to `origin`.
- Tags: `v0.1.0` and `v0.2.0`. `main` is 2 commits past `v0.2.0`.
- `package.json` version: 0.2.0.
- **342 tests in 29 files pass.**

| Area | State |
|---|---|
| Live site | https://meanchess.siddheshthapa.com on GitHub Pages: `/` welcome, `/play/` game, `/tutorial/` 8 lessons, `/rules/` |
| Engine | `src/engine/`: pure deterministic TypeScript, lint-enforced, with no DOM, clock or randomness. API: `newGame`, `play(game, uci)` (throws on illegal moves), `resign`, `agreeDraw`, `undo`, `legalMoves`, `positionKey`, MeanFEN `parseMeanFen`/`toMeanFen`, SavedGame v1 `saveGame`/`loadGame` (replays and validates, at most 2,000 moves). Outcomes: royal → mate/stalemate → fifty-move → threefold → agreement/resignation; no insufficient-material draws. Measured: **0.09 ms per move**, 22 ms for a 300-ply replay [M1]. |
| Computer opponent | `src/ai/`: its own fast board, proven equal to the engine; a Web Worker; Nice, Mean and Ruthless levels |
| Presentation rulings | No Kill Zone hints (D-39); nothing points out a winning royal move (D-46); an enemy piece between the kings blocks every royal move (D-47) |
| CI/CD | GitHub Actions on every push to `main`: lint, typecheck, tests with coverage thresholds, build, then GitHub Pages deploy |
| Hosting and DNS | GitHub Pages; Namecheap DNS (`meanchess` CNAME); HTTPS enforced |

**Discrepancies found** (none changes the project; recommendations given):

| # | Discrepancy | Newer | Recommendation |
|---|---|---|---|
| 1 | Handover §3 lists pages as "`/` (play) and `/rules/`"; there are now four (D-48) | Repo | Handover corrected this session |
| 2 | Handover §2 and §8 still list "a guided tutorial" as future work; it shipped (D-48) | Repo | Corrected this session |
| 3 | Handover §11 says "D-01 to D-45"; DECISIONS.md runs to D-49 | Repo | Corrected this session |
| 4 | Handover §11's theme-script note names only `index.html` and `rules/index.html`; `play/` and `tutorial/` carry the same script | Repo | Corrected this session |
| 5 | The brief calls the current release v0.2.0, but two later features are live (D-46, D-48) | Repo | **Tag v0.2.1** on the current `main` (F8, approved) |
| 6 | The brief describes Royal Cannibalism as needing "no Royal Capture"; RULES.md (D-04) says "no **royal move**" (which also excludes Royal Slaughter) | RULES.md is canonical | No change. Recorded in ONLINE-PROTOCOL.md §9 so nobody "fixes" the engine. |
| 7 | ROADMAP.md's v0.3 section ("Durable Objects or Supabase Realtime… then accounts and ratings") predates this research | This blueprint | Update ROADMAP.md **after** approval |

## Research Findings

The full evidence, with dates and links, is in [PHASE-2-SOURCES.md](PHASE-2-SOURCES.md). The findings
that decided the plan:

**Track A**
1. **Durable Objects run on Cloudflare's Free plan** since April 2025, explicitly aimed at multiplayer
   games [S6]. Free: 100,000 requests, 13,000 GB-s, 100,000 rows written and 5 GB per day. Exceeding a
   limit makes operations fail; it's never billed [S1].
2. **Hibernating WebSockets make idle games free.** The object sleeps 10 s after the last event while
   sockets stay open [S3]. Incoming messages are billed 20:1; outgoing messages and pings are free [S1].
3. **Correctness comes from the platform.** One object per game session [S5][S19]. Input gates
   serialise events. Output gates hold every outgoing message until the storage write is durable [S5].
4. **Every deploy disconnects every WebSocket** [S4]. Reconnecting is a core feature, not an edge case.
5. **The Free-plan CPU limit for objects is ambiguous**: 30 s per message on the limits page, but "the
   same per invocation CPU limits as any Workers", which is 10 ms on Free [S2][S9]. The design bounds
   restores to about 100 plies (≤ 9 ms), and the spike measures it.
6. **The alternatives fall short for this project:**
   - Supabase Free pauses after a week of inactivity, and Pro is $25 [S20].
   - Firebase needs a paid plan for server functions [S22].
   - Render's free tier sleeps and restarts [S23].
   - Fly.io has no free tier [S24].
   - Vercel's WebSockets are in beta, with about a 5-minute cap [S25].
7. **A custom domain for the Worker would mean moving all of siddheshthapa.com's DNS to Cloudflare**
   [S11]. `workers.dev` avoids touching the live site.
8. **Cloudflare's own test plugin doesn't support Vitest 5 yet** [S16]. Integration tests will drive a
   locally started Worker instead.

**Track B**
9. **No native hosting anywhere:**
   - Chess.com custom variants are fixed modules [S45];
   - Lichess supports standard chess plus 8 variants, with no process for more [S46];
   - PyChess's new user-created variants (7 Jul 2026) still require Fairy-Stockfish [S51][S52][S53].
10. **The Chess Variant Pages:**
    - membership, a submission form, editor approval, a unique title, graphic diagrams, and a queue of
      weeks [S40];
    - **unreachable on 8 Oct 2026** [S42].
11. **r/chessvariants** (about 14,000 members, growing):
    - promotion at most once every two weeks;
    - the variant's name in the title;
    - full rules in the post;
    - "No AI slop" [S49].
12. **Lichess blogs** allow some promotion, but limit its reach and ban mostly AI-generated content
    [S47].
13. **Chess Stack Exchange** isn't a promotion channel [S54][S55]. **BoardGameGeek** excludes digital
    variants of chess from its database [S57]. **Show HN** suits a free, no-sign-up game [S56].

### DELTA

**What changed recently?**

| Date | Change | Source |
|---|---|---|
| Apr 2025 | Durable Objects on the Free plan; SQLite storage in objects GA | [S6] |
| Sep 2025 | The Workers Rate Limiting binding became generally available | [S12] |
| Jan 2026 | SQLite storage billing started on paid plans | [S7] |
| Mar 2026 | Chess.com Community Policy updated (spam, ads, copy-paste, club promotion) | [S43] |
| Apr 2026 | WebSocket close auto-reply (compatibility date 2026-04-07) | [S4] |
| Jun 2026 | Vercel Functions WebSockets entered public beta | [S25] |
| Jul 2026 | New Durable Object namespaces must use SQLite; PyChess opened user-created variants (and ended its moratorium on new ones) | [S8][S52] |
| Aug–Oct 2026 | Cloudflare's Workers test plugin renamed and re-versioned, still on Vitest 4; Vitest 5 released; the Web Analytics beacon now sends OS and browser versions | [S16][S28] |
| 2 Oct 2026 | Cloudflare announced new observability pricing from 1 Dec 2026 (Free: 0.5 GB/day of logs, 7-day retention) | [S14] |
| 2026 (ongoing) | Community venues adopted explicit bans on AI-generated posts (Lichess blog etiquette; r/chessvariants "No AI slop") | [S47][S49] |
| 8 Oct 2026 | The Chess Variant Pages were unreachable | [S42] |

**What can we do now that was harder or more expensive before?**
- Run a **stateful, authoritative game server with storage for $0 fixed cost**: per-game objects with
  hibernation on the Free plan. Before 2025 this needed a paid plan or a server to run.
- **Reuse the browser engine unchanged on the server**: the edge runtime runs plain modern
  JavaScript, and the engine was built to be pure.
- **Count events without a database or a tracking cookie**: Analytics Engine (free, billing not active)
  and cookieless Web Analytics [S13][S28].
- Build and test a backend with a very small team: this project's engine and AI were built with AI
  assistance and checked by large automated test suites. The same approach covers the server.

**What is likely to matter in the next 6 months?**
- Cloudflare's **logging price change on 1 Dec 2026**, and the eventual **Analytics Engine billing**
  [S13][S14]. The plan keeps log volume small and metrics independent of logs.
- Whether the docs clarify the **Free-plan CPU limit** for objects (the spike answers it for us).
- **Vitest 5 support** in Cloudflare's test plugin [S16].
- **Vercel WebSockets reaching general availability**. That doesn't change the decision, because rooms
  still need a state store.
- **Whether the Chess Variant Pages return**, and how long their queue is.
- **Community attitudes to promotion and AI text**, which are tightening. Human-written, rules-first
  posts are the only kind that will work.

---

## Track A — Online Multiplayer

### Product Scope

**v0.3.0 "Play a friend online"** — the core loop:

1. Open `/online/` (or click "Play a friend online" after the tutorial or a computer game).
2. **Create a game** (pick White, Black or random), which gives an invite link and a code.
3. Share the link (copy, or the phone's share sheet).
4. The friend opens the link, sees the three key rules, and clicks **Join**.
5. The server starts the game. Both browsers receive the same state.
6. Every move is validated by the engine on the server and broadcast to both players.
7. Draw offers, resignation, abort (before each side has moved), and claiming the win if the opponent
   has gone for 2 minutes.
8. The game ends, the result is recorded, and both players see the same result.
9. **Rematch** (colours swap), or **share** the finished game (the link shows it for 30 days).

**Seamless by design** (founder request, 9 October 2026):
- A **daily capacity guard** keeps the free quota from ever running out mid-game (P2-31). On a very
  busy day, new online games wait until 00:00 UTC, with a friendly "full for today" message and a
  one-click **Play the computer**. Games in progress and invites already sent are never affected.
- If the server is ever unreachable mid-game, the page offers **Keep waiting** or **Finish this
  position against the computer**; the online game resumes when the server is back (P2-32).
- The computer gets an **Auto** level that picks Nice, Mean or Ruthless from the player's results on
  this device (P2-33). It can ship first, as v0.2.2.
- The computer is always labelled as the computer, never presented as a person (P2-32, F13).

**Deliberately not in v0.3:**
- accounts, names, chat, ratings;
- lobby, quick match, live spectators;
- clocks, takebacks, custom start positions;
- tournaments, payments.

They're listed with their target versions under "Deferred Features" below.

### Recommended Architecture

**Final architecture decision:**

| | |
|---|---|
| **Frontend** | The existing React 19 + Vite 8 multi-page static site on **GitHub Pages**, unchanged, plus a new `/online/` page |
| **Backend** | A **Cloudflare Worker** (TypeScript) named `meanchess-online`: routing, CORS, Origin checks, rate limits |
| **Realtime** | **WebSockets** that end inside **one Durable Object per game**, using the **Hibernation API** |
| **Persistence** | **SQLite inside each game's Durable Object** (a game row plus the moves table). No central database in v0.3; D1 when accounts arrive. |
| **Authentication** | **Guests only.** Per-game 256-bit seat tokens: hashed on the server, kept in `localStorage`, sent in the first WebSocket message. No cookies, no accounts. |
| **Deployment** | GitHub Actions: `wrangler deploy` (backend first, path-filtered), then GitHub Pages. A staging Worker. A dark launch for the alpha. |
| **Repository** | One repository. `src/engine/` (shared, unchanged), `src/online/` (shared protocol), `server/` (Worker, Durable Object, RoomCore), `src/app/online/` (UI). |
| **Domain** | `meanchess.siddheshthapa.com` (site, unchanged) plus `meanchess-online.<subdomain>.workers.dev` (API and WebSocket on one origin). **No DNS change.** |
| **Engine** | Imported unchanged. `play()` validates every move. Restores are bounded by a MeanFEN checkpoint after each irreversible move plus a short tail of moves. |
| **Testing** | Vitest 5 (unit, RoomCore with a fake clock, property tests); integration against a locally started Worker with real WebSockets; Playwright with two browser contexts; a Node load test on staging |
| **Monitoring** | Structured Workers Logs; Analytics Engine counters; client latency and desync reports; `/v1/health`; a weekly metrics report; billing alerts on Paid |
| **Cost** | **$0/month to start** (Workers Free). About $12.50/month at 10,000 monthly players; about $125/month at 100,000. |

Diagram and request flow: [ONLINE-ARCHITECTURE.md](ONLINE-ARCHITECTURE.md) §2–§3.

### Backend Comparison

Six options were compared on the brief's 27 criteria (ONLINE-ARCHITECTURE.md §4).

**Cloudflare Workers + Durable Objects wins because:**
- it's the only option where **our engine runs on every move** with **transactional storage in the
  same place**;
- it's free when idle;
- there's nothing to operate.

**Rejected:**
- **Supabase:** Realtime is a relay; authority needs three moving parts; Free projects pause after a
  week; Pro is $25.
- **Firebase:** server validation needs the paid Blaze plan.
- **A Node server on a VM:** good, but a server to run, with no free tier. **It's the documented
  escape hatch.**
- **Render free:** sleeps, restarts, no disk.
- **Vercel:** WebSockets in beta with about a 5-minute cap.
- **partyserver:** an unfinished wrapper over the same thing.

### Game Lifecycle

`waiting → active → finished`, plus expiry and deletion. Every transition, who may trigger it, and
every ending (engine endings plus resignation, agreement, abort, claim, abandoned and move-limit) are
in ONLINE-PROTOCOL.md §3.

### Realtime Protocol

**HTTP:**
- `POST /v1/games` (create);
- `POST /v1/games/:id/join`;
- `GET /v1/games/:id` (status, or the finished game);
- `GET /v1/games/:id/ws` (WebSocket);
- `/v1/health`.

**WebSocket client messages:** `hello`, `move`, `draw-offer`, `draw-answer`, `resign`, `abort`,
`claim`, `rematch-offer`, `rematch-answer`, `sync`, `stats`, plus a literal `ping`.

**Server events:** `state` (full snapshot), `moved` (with the MeanFEN after the move, as a desync
check), `rejected`, `presence`, `draw`, `ended`, `rematch`, `error`.

Each event specifies its schema, who may send it, preconditions, idempotency, errors and close codes
(ONLINE-PROTOCOL.md §4–§7).

### Data Model

One game row (status, seats as token hashes, start, current and checkpoint MeanFEN, `ply`, `rev`,
offers, absence times, result, timestamps, expiry) plus a moves table (UCI, colour, move id, server
time). The move list is the truth; the checkpoint bounds restores. Full schema:
[ONLINE-DATA-MODEL.md](ONLINE-DATA-MODEL.md) §2.

**Races** are prevented by:
- one single-threaded authority per game;
- `ply` as an optimistic precondition;
- `mid` for idempotency;
- `rev` for ordering;
- output gates, so nothing is confirmed before it's saved.

Each scenario the brief listed is walked through in ONLINE-PROTOCOL.md §8.2.

### Reconnect Strategy

| Situation | Result |
|---|---|
| Refresh, network change, deploy, short Wi-Fi loss | Automatic reconnect (0, 1, 2, 4, 8 s, then every 15 s), then a full snapshot; the opponent sees nothing for under 5 s |
| Tab closed, laptop asleep | The game stays alive. The opponent sees "left" after 5 s and may **claim** a win or draw after **120 s** |
| Back after 10 s, 5 min or 30 min | Resumes exactly, unless the opponent claimed in the meantime |
| Never returns | The opponent claims; if nobody does anything, **abandoned** after 7 days |
| Lost site data or a new device | Seat lost (no accounts): a known v0.3 limit, with a v0.3.x fix candidate |

There are no clocks in v0.3, so nothing runs down while someone is away. Exact rules:
ONLINE-PROTOCOL.md §8.3.

### Security

- Hostile clients are assumed.
- 256-bit seat tokens, never in URLs, stored as hashes.
- An authorisation matrix tested action by action.
- Size caps before parsing.
- Hand-written validators.
- Bound SQL parameters only.
- No user-written text displayed in v0.3.
- An Origin allow-list for CORS and WebSockets.
- Rate limits at the edge and inside rooms.
- A kill switch.
- Two-factor authentication on the founder's accounts.

Details: [ONLINE-SECURITY.md](ONLINE-SECURITY.md).

### Anti-Cheat

**v0.3 guarantees:**
- every accepted move is legal under the engine;
- only the side to move moves;
- results come only from the server;
- history can't be edited;
- there's no hidden information to leak (the server sends no hints, so the Kill Zone rulings hold).

**v0.3 does not detect engine assistance**: impossible in a browser, and irrelevant while games are
casual and unrated. Move timestamps are stored now, for fair-play tooling when ratings arrive (v0.7).

### Persistence

| | Survives? |
|---|---|
| Refresh, outage, hibernation, eviction | Yes |
| Restart, deploy, rollback | Yes |
| A quota stop | Prevented by the capacity guard. If it happened anyway: yes, with the computer offered meanwhile |
| Retention | Unjoined invites: 24 h. Finished games: 30 days. Untouched games: closed after 7 days. |

### Deployment

- **Environments:**
  - local (`wrangler dev`, no account needed);
  - a staging Worker;
  - a production Worker.
- **Secrets:** `CLOUDFLARE_API_TOKEN` in GitHub secrets; that's the only secret.
- **Order:** backend first, then Pages.
- **Rollback:** `wrangler rollback` and additive-only schemas.

Details: ONLINE-ARCHITECTURE.md §7.

### Cost Model

Estimated per game:
- **≤ 100 GB-s of duration**, the main driver;
- about 20 object requests;
- about 250 rows written;
- 10 KB stored for 30 days.

| Monthly players | Plan | ≈ Monthly cost (base) | Heavy use (3×) |
|---|---|---|---|
| 100 | Free | **$0** | $0 |
| 1,000 | Free (busiest days near the ~130 games/day ceiling) | **$0** | $0–6 |
| 10,000 | Paid | **≈ $12.50** | ≈ $37.50 |
| 100,000 | Paid | **≈ $125** | ≈ $405 |

**Founder-friendly starting configuration:**
- Workers Free;
- production and staging Workers;
- Analytics Engine;
- logs at full sampling;
- no domain, database or add-ons;
- **$0**, no card.

**Growth thresholds:**
- **Stay on Free** while the busiest day stays under ~65 online games (about 1,000–2,000 monthly
  online players).
- **Offer the upgrade to Paid ($5 plus usage)** when the capacity guard closes on two or more days
  in a week. **The founder decides** (F5). Staying free is always allowed: on those days new online
  games wait until 00:00 UTC, games in progress finish, and everyone else gets the computer. Upgrading
  before Show HN is optional too.
- **Review costs** above $50/month for two months (only relevant after an upgrade).
- **Architecture review** at around 100,000 monthly players.

Full model and assumptions: ONLINE-ARCHITECTURE.md §8.

### Testing

- Unit tests: protocol, RoomCore, authorisation, reconnect logic, lifecycle.
- Engine integration: Royal Capture, Slaughter and Cannibalism fixtures from the standard start;
  illegal-move cases; queen origin across restores; a **restore ≡ replay property test** over 2,000
  random games.
- 18 multiplayer integration scenarios and 13 failure tests on a real local Worker.
- 9 two-player Playwright tests.
- 4 load tests on staging.
- **15 measurable launch criteria**, including 10/10 remote games, 0 desyncs, 100% legal accepted
  moves, and "players never see a raw error".

All in [ONLINE-TEST-PLAN.md](ONLINE-TEST-PLAN.md).

### Observability

- One structured log line per significant event (game id, seat, ply, code); never IPs or tokens.
- Error ids shown to players.
- Unsampled counters in Analytics Engine: lifecycle, end reasons (including royal capture, slaughter
  and cannibalism), rejections, reconnects, latency.
- Desync reports from clients.
- `/v1/health`.
- A weekly report script.

No dashboard to build. Details: ONLINE-ARCHITECTURE.md §10.

### Risks

Risk register, highest priority first. P = probability, I = impact.

| # | Risk | P | I | Early warning sign | Mitigation | Fallback |
|---|---|---|---|---|---|---|
| 1 | Free-plan CPU limit (10 ms) applies to game objects, and restores or moves exceed it | Med | High | Spike: CPU p99 > 5 ms; "exceeded CPU" errors | Bounded restore (checkpoint plus ≤ 100-ply tail); measured in A0 before any build | A zero-replay resume (store the repetition keys with each move), which is free; Workers Paid ($5/month) only as a last resort, and only with the founder's agreement |
| 2 | Client and server states diverge (desync) | Low–Med | High | Desync metric > 0; mismatched results reported | Same engine and commit; `fen` in every move event; restore property tests; E2E assertions | Resync from server history; kill switch if widespread |
| 3 | Reconnects fail in real conditions (mobile Safari, half-open sockets) | Med | High | Alpha reports of stuck games; high reconnect counts; many abandoned games | Heartbeat; lazy liveness check; reconnect loop; tests on real devices and networks | "Retry now" button; a refresh always works because state is on the server |
| 4 | Frontend and backend protocol mismatch after deploys (cached old pages) | Med | Med | `unsupported-protocol` counts | Current plus previous protocol accepted; additive changes; backend deploys first | Reload prompt |
| 5 | Abuse uses up the day's online capacity | Low–Med | Low–Med | Spikes in creations; the guard closing early; many 429s | Capacity guard with per-address caps; edge and room rate limits; kill switch; Turnstile prepared | Turnstile on; games in progress unaffected; new games reopen at 00:00 UTC; upgrading is optional |
| 6 | Unexpected bill on Paid | Low | Med | Billing notification at $10 | Per-game cost measured on staging; limits | Kill switch; cost review; the Node server escape hatch |
| 7 | Clock handling (v0.4): flags, lag, disconnects | Med | Med | Disputed timeouts in testing | Deferred to v0.4 with a written spec; alarm-based flags; tests | Ship v0.4 untimed-only until fixed |
| 8 | Deploys interrupt live games | High (certain) | Low | Player complaints | Reconnect in 1–3 s; deploy off-peak; check active games first | — |
| 9 | `workers.dev` blocked on some networks | Low–Med | Med | Testers can't connect from school or office | Alpha on diverse networks | Branded domain by moving DNS to Cloudflare (F10) |
| 10 | Nobody plays online (empty room) | Med–High | Med | < 10 non-founder online games in 4 weeks | Invite-first design; tutorial-to-invite prompts; rules on the join screen; no lobby until traffic exists | Lean on computer play and content (puzzles, examples); keep promoting |
| 11 | Chess Variant Pages stay down or slow | Med–High | Med | Still unreachable after 4 weeks; no editor response in 6 | Don't wait: Reddit and Chess.com go ahead | Fandom wiki and GitHub as interim listings; retry monthly |
| 12 | Community posts removed or seen as spam | Med | Med | Removal, downvotes, mod messages | Rules read on the day; participate first; founder-written; rules in the post; one post per venue | Message the mods; wait the cooldown; other venues |
| 13 | Founder time for Track B | Med | Med | Posts slipping by weeks | Skeletons and assets ready; small steps | A slower schedule; Tier 1 only |
| 14 | Seat lost when site data is cleared or the device changes | Med | Low–Med | Support requests | Claim rules let the opponent finish | v0.3.x "continue on another device" link |
| 15 | Pricing or policy changes (Cloudflare logs 1 Dec 2026, community rules) | Med | Low–Med | Dated sources re-checked at each gate | Logs kept small; metrics separate | Adjust the plan; escape hatch |
| 16 | A security bug (authorisation bypass) | Low | High | Unexpected `hello` successes; odd results | Authorisation matrix tests; hashed tokens; review | Kill switch; rollback; fix and test |
| 17 | The founder rejects the online-only endings (claim, abort, abandoned) after they're built | Low | Low | — | Decided up front (F2) before A2 | Constants and end reasons are easy to change |
| 18 | Privacy complaint | Low | Med | A GitHub issue or message | Minimal data; privacy page; short retention | Answer; delete the game |
| 19 | The capacity guard closes on many days (a sign of success) | Med | Low–Med | The guard closes on 2+ days a week | Caps tuned from measured usage; the computer offered meanwhile | The founder decides on Workers Paid (F5) |
| 20 | Players feel short-changed by the computer fallback | Med | Low | Feedback; few fallback games started | Clear labelling; the reopening time shown; invites keep working | Tune the caps; consider the upgrade |

### Rollout

| Stage | Who | Exit |
|---|---|---|
| **1. Internal and staging** | Automated tests, staging | All tests and load tests pass; restore CPU within the free limit |
| **2. Private alpha** | Founder plus 3–8 testers, 1–2 weeks | ≥ 30 complete games; 0 desyncs; 0 illegal moves accepted; each royal mechanic seen; round trip p95 ≤ 500 ms |
| **3. Public beta** | Everyone, labelled "Beta", 2–4 weeks | ≥ 100 complete games (≥ 50 between non-founder players); 0 critical bugs; no free quota ran out (the capacity guard closed first); a production deploy with 0 lost moves |
| **4. Stable v0.3.0** | Everyone | All 15 launch criteria |

Rollback at every stage: the kill switch, `wrangler rollback`, and removing links (back to the dark
launch). Details: LAUNCH-PLAN.md §3.

---

## Track B — Discovery & Variant Distribution

Being **listed** (permanent, findable) and being **discussed** (players arrive, feedback flows) are
different goals. Listings are slow, so they start first; discussions bring the first players.

### Chess Variant Pages

The canonical variant encyclopedia (since 1995, volunteer editors):
- register;
- use the member submission form;
- a unique title;
- four core sections plus notes;
- graphic diagrams (PNG or GIF);
- editor approval;
- a queue of weeks.

**Unreachable on 8 Oct 2026**, so check weekly and don't wait on it. The full checklist and the
Mean Chess page outline (fitted to the site's sections, every statement matching RULES.md, 7 diagrams
from existing Scenario Lab positions) are in DISCOVERY-AND-LISTING.md §5.

### Chess.com

- **Mean Chess cannot be a Chess.com custom variant:** fixed rule modules, no custom code. Don't try.
- Post **one** discussion thread in the variants forum:
  - founder-written;
  - different words from Reddit (the Community Policy bans copy-paste);
  - one image and one link;
  - a disclosure;
  - a question.
- No club until there's an audience. Details: DISCOVERY-AND-LISTING.md §7.

### Lichess

- **Native inclusion is not realistic:** standard chess plus 8 variants, no process, and the engine
  and UI work would be large. So it's not a milestone.
- **Realistic:** one founder-written blog post, a design story with puzzles, once online play exists.
  Lichess limits the reach of mostly promotional posts and bans AI-written ones.
- Forum participation only where genuinely relevant. DISCOVERY-AND-LISTING.md §8.

### Reddit

**r/chessvariants** (about 14,000 members) is the best feedback channel. The first post:
- the founder's own words;
- the variant name in the title;
- **the full rules in the post**;
- one GIF;
- one link;
- two specific questions;
- flair "New Variant";
- after 1–2 weeks of participating in the sub.

A second post no sooner than two weeks later. r/chess and r/chessbeginners: no. Skeleton:
DISCOVERY-AND-LISTING.md §6.

### Other Variant Communities

- **The GitHub repository:** topics, website, social preview. Tier 1, cheap.
- **Show HN:** Tier 2, after online play.
- Short videos: optional.
- **PyChess:** user variants since July 2026 can't express Mean. Tier 3.
- **Chess Stack Exchange:** answers only, with disclosure.
- **BoardGameGeek:** no database entry for chess variants.
- **Fandom wiki:** Tier 3.
- **Not at all:** Wikipedia and a Discord server.

The full ranking table is in DISCOVERY-AND-LISTING.md §3.

**Final discovery strategy:**

| Tier | Channels |
|---|---|
| **1: do immediately** | Press kit and site metadata (Open Graph image, meta tags, GitHub settings) → Chess Variant Pages submission → r/chessvariants post → Chess.com forum thread |
| **2: after online multiplayer exists** | r/chessvariants follow-up, Lichess blog post, Show HN, a reply in the Chess.com thread, optional short videos |
| **3: later** | PyChess community, Chess Stack Exchange answers, BoardGameGeek Chess forum, fandom wiki, itch.io or Product Hunt |

Every Tier 1 channel's site, purpose, post type, account, materials, exact content, link destination,
friction and next action: DISCOVERY-AND-LISTING.md §4.

### Submission Assets

One press kit serves every venue:
- `docs/PRESS-KIT.md` for the texts;
- `public/press/` for the images, served from the site.

It contains:
1. a one-sentence description;
2. a 50-word description;
3. a rules summary;
4. "What makes it different";
5. screenshots;
6. two short clips;
7. the live link;
8. the rules link;
9. the tutorial link;
10. the creator;
11. the version;
12. the contact;
13. the source code;
14. an example game;
15. the example special moves;
16. plus Open Graph and social-preview images.

Drafts of the texts: DISCOVERY-AND-LISTING.md §10.

### Positioning

> Mean Chess is standard chess with a deadlier king: it can kill the enemy king from two squares away,
> and eat its own army to survive.

Lead with the king's three powers (Royal Capture, Royal Slaughter, Royal Cannibalism), the strict
sacrifice order and the untouchable original queen. Then the hook: every piece between the kings is
its owner's shield *and* weapon, and Fool's mate doesn't work. Tagline: **"Kings kill kings."**
Never "chess with self-capture", and no claims to be first.

### Launch Content

Five demonstrations that **already exist** as engine-verified Scenario Lab deep links. Each matches a
tutorial lesson:

1. Royal Capture while in check;
2. Royal Slaughter ("King, pawn, king");
3. the sacrifice order;
4. Royal Cannibalism (back-rank escape);
5. Fool's mate fails.

They become the diagrams, clips and post images. DISCOVERY-AND-LISTING.md §12.

### Founder Actions

Click-by-click instructions:
- GitHub settings (F-B1);
- Reddit (F-B2);
- the Chess Variant Pages (F-B3);
- Chess.com (F-B4);
- the Lichess blog (F-B5);
- Show HN (F-B6).

All are in DISCOVERY-AND-LISTING.md §9. Cloudflare and Web Analytics steps are in LAUNCH-PLAN.md §5.
**Every community post is written by the founder**: two venues ban AI-generated posts, and readers
notice.

---

## Recommended Release Sequence

| Version | What |
|---|---|
| **v0.2.1** | Tag what's live (welcome page, tutorial, no royal-win hints) |
| **v0.3.0** | Play a friend online: invite links, server-validated games, reconnects, rematch, sharing |
| v0.3.x | Hardening from beta data; "continue on another device"; CSP; Turnstile if needed |
| **v0.4.0** | Clocks (server-authoritative, Fischer increment) |
| **v0.5.0** | Public lobby, quick match, names, live spectators. **Only when there are ≥ 20 non-founder games a day.** |
| v0.6.0 | Optional accounts and game history (D1; sign-in method decided then) |
| v0.7.0 | Ratings and fair-play tooling |

Objectives, inclusions, exclusions and launch criteria for each: LAUNCH-PLAN.md §1.

## Exact Build Order

**First, independent of the server** (F14, approved): **V7**, the Auto difficulty, released as
v0.2.2 while the founder sets up Cloudflare.

**Track A** (each milestone ends green and committed):

| # | Milestone | Depends on |
|---|---|---|
| A0 | Spike: CPU on Free, rate limits on Free, silent-drop detection, test harness (throwaway branch) | Approval; Cloudflare account |
| A1 | Shared protocol (`src/online/`) | Approval |
| A2 | RoomCore plus restore ≡ replay property tests | A1 |
| A3 | Worker plus Durable Object adapter plus local integration tests | A2, A0 |
| A4 | Client connection core (reconnect, pending moves) | A1 (A3 for integration) |
| A5 | `/online/` page | A4 |
| A6 | Playwright E2E plus CI | A3, A5 |
| A7 | Staging, load tests, metrics report | A6; founder's Cloudflare steps |
| A8 | Privacy page, analytics, kill switch, docs | A7 |
| A9 | Production dark launch | A7, A8; founder approval |
| A10 | Private alpha | A9 |
| A11 | Public beta | A10; founder approval |
| A12 | v0.3.0 stable | A11 |

**Track B**, running alongside:

| Step | What | When |
|---|---|---|
| B1 | Press kit plus Open Graph tags | Alongside A1–A3 |
| B2 | Web Analytics plus GitHub settings | — |
| B3 | Founder participates in r/chessvariants | — |
| B4 | Chess Variant Pages submission | When the site is reachable |
| B5 | Reddit post | — |
| B6 | Chess.com post | — |
| B7 | Feedback loop | — |
| B8 | Tier 2 posts | After the beta has been stable for a week |
| B9 | 8-week review | — |

Dependencies explained in LAUNCH-PLAN.md §2: the contract before the logic, the logic before storage
and sockets, the server before the UI, the UI before browser tests, staging before people, the privacy
page before strangers.

## Decision Log

The 30 decisions in full format (options, evidence, choice, reasons, trade-offs, reversibility, date):
[PHASE-2-DECISIONS.md](PHASE-2-DECISIONS.md). In short:

| ID | Decision | Chosen |
|---|---|---|
| P2-01 | Backend | Cloudflare Workers plus a SQLite Durable Object per game |
| P2-02 | Realtime | WebSockets with the Hibernation API |
| P2-03 | Engine on the server | Unchanged import; bounded restore by checkpoint |
| P2-04 | Database | Per-game SQLite; no central database in v0.3 |
| P2-05 | Auth / guests vs accounts | Guests only, with per-game seat tokens |
| P2-06 | Room model | Private invite link plus code; no lobby in v0.3 |
| P2-07 | Clocks | None in v0.3; v0.4, before any lobby |
| P2-08 | Disconnects and online-only endings | Claim after 120 s; abort before move 2; abandoned after 7 days; move-limit draw (**F2**) |
| P2-09 | Spectators | None live; finished games viewable by link for 30 days |
| P2-10 | Chat and social | Rematch and share only |
| P2-11 | Fair play | Legality and results guaranteed; no assistance detection before ratings |
| P2-12 | Repository | One repository; `server/` plus `src/online/` |
| P2-13 | Domains | `workers.dev`; no DNS change; no cookies |
| P2-14 | Environments | Local → staging → production; dark-launch alpha |
| P2-15 | Versioning | Protocol N and N−1; additive changes |
| P2-16 | Plan and cost | Free until a trigger; Paid; review above $50/month |
| P2-17 | Analytics | Web Analytics, server counters, optional anonymous beacons (**F6**) |
| P2-18 | Retention | 24 h / 30 days / 7 + 30 days |
| P2-19 | Testing | Vitest 5, local Worker integration, Playwright with two contexts, a load script |
| P2-20 | Release order | Clocks before lobby; accounts after lobby |
| P2-21 | Community strategy | List and discuss; founder-written posts; no native-platform chase |
| P2-22 | Rate limits | Binding (if available on Free), room limits, kill switch, Turnstile ready |
| P2-23 | Online page | New `/online/` page; join takes a click |
| P2-24 | Takebacks | None online in v0.3 (**F4**) |
| P2-25 | Rematch | New game, colours swapped, same tokens |
| P2-26 | Validators | Hand-written |
| P2-27 | Game ids | 10-character Crockford base32 |
| P2-28 | Positioning | "Kings kill kings"; no novelty claims |
| P2-29 | Demo content | Reuse Scenario Lab and tutorial positions |
| P2-30 | Tag v0.2.1 | Yes (**F8**) |
| P2-31 | Keeping the free plan seamless | A daily capacity guard: new games stop early; games in progress always finish |
| P2-32 | Fallback when online can't run | The computer, one click, **always labelled** (**F13**) |
| P2-33 | Difficulty | An **Auto** level from the player's results on this device (**F14**); can ship as v0.2.2 |
| P2-34 | Funnel events | Batched per visit, sampled 1 in 4 |

## Open Founder Decisions

The founder answered F1–F12 on 8 October 2026:

| # | Decision | Founder's answer |
|---|---|---|
| F1 | Approve the blueprint and the architecture | **Approved** |
| F2 | Online-only endings | **Approved, all four:** claim a win or draw after 120 s of the opponent's absence; abort before both sides have moved; abandoned after 7 days of inactivity; a draw at 2,000 plies. These are platform policies; RULES.md is unchanged. |
| F3 | Timeouts once clocks exist (v0.4) | **Approved:** running out of time always loses |
| F4 | Takebacks online | **Approved:** none in online games; local games keep Undo |
| F5 | Cloudflare plan | **Approved, trigger-based:** stay on Free; upgrade only when a defined quota trigger is reached |
| F6 | Analytics | **Approved, all three, kept anonymous and minimal:** Cloudflare Web Analytics; server-side game counters; anonymous funnel events |
| F7 | Public contact | **GitHub Issues** (https://github.com/OnePanda2/Mean.Chess/issues); revisit a dedicated email later |
| F8 | Tag v0.2.1 | **Approved:** tag the current live code `v0.2.1` and bump `package.json` to 0.2.1 |
| F9 | `workers.dev` subdomain | **`meanchess`**; `meanchess-game` only if that's taken |
| F10 | Branded API domain | **Not now.** Keep the Namecheap DNS and the `workers.dev` address; revisit only if `workers.dev` causes a real problem. |
| F11 | Community posts | **Approved:** from the founder's personal accounts, in the founder's own words. Claude prepares research, facts, assets and outlines. |
| F12 | Public creator name | **"Siddhesh Thapa"** |

**Two new decisions, from the founder's idea of 9 October 2026, approved the same day:**

| # | Decision | Founder's answer |
|---|---|---|
| F13 | When online play is full or the server can't be reached, offer the computer instead, **always clearly labelled as the computer** (never presented as a human opponent) | **Approved, labelled.** v0.3 games are invites to a specific friend, so a disguised bot couldn't stand in for them anyway. Players care whether an opponent is human, and being caught faking opponents would cost the game its reputation in a small community. |
| F14 | An **Auto** difficulty that picks Nice, Mean or Ruthless from the player's results on this device | **Approved:** ship it first as v0.2.2, while Cloudflare is being set up |

## Deferred Features

**Do not build yet** (target version in brackets):
- clocks [v0.4];
- a public lobby, quick match, display names, live spectators [v0.5];
- accounts, profiles, game history [v0.6];
- ratings, Elo or Glicko, fair-play detection [v0.7];
- chat or messaging (preset phrases at the earliest, v0.4+);
- friends lists, social feeds, clans, achievements, recommendation systems;
- tournaments, simuls, correspondence play;
- takebacks online, premoves, custom start positions online, an online analysis board;
- computer opponents in online play, and "bots" in a lobby;
- native mobile apps, an installable PWA, email or push notifications;
- subscriptions, ads, donations, any payments;
- large-scale analytics, A/B testing, session recording;
- a Discord server, a Wikipedia article;
- moving DNS to Cloudflare, Supabase, a separate backend repository.

## Master Roadmap (both tracks)

| Phase | Objective | Depends on | Tasks | Deliverables | Tests | Founder | Claude | Gate | Rollback |
|---|---|---|---|---|---|---|---|---|---|
| **0. Research and preparation** | Agree the plan; prove the platform | — | This blueprint; decisions F1–F12; tag v0.2.1; Cloudflare account; spike A0 | Approved blueprint; spike report | Spike measurements | Read and approve; F-A1 to F-A6 (account, 2FA, subdomain, token, GitHub secret, wrangler login) | Commit the docs; tag; run the spike; report | Blueprint approved **and** spike questions answered | Nothing to roll back |
| **1. Multiplayer foundation** | The authoritative core, fully tested, not deployed | Phase 0 | V7 Auto difficulty (v0.2.2); A1 protocol; A2 RoomCore and restore; A3 Worker and adapter, with the capacity guard. Track B: B1 press kit and Open Graph tags; B2 analytics and GitHub settings; B3 join r/chessvariants | `src/online/`, `server/`, integration harness; press kit; `og.png` | Unit, property, integration and failure tests (test plan §2–§5) | Approve the B1 site deploy; F-A8; F-B1; start participating on Reddit | Code and tests; press kit; site metadata | CI green; coverage thresholds met | Revert commits (nothing user-facing except metadata) |
| **2. Online private games** | Two people can play end to end, locally and on staging | Phase 1 | A4 client core; A5 `/online/` page; A6 E2E and CI. Track B: B4 Chess Variant Pages (if reachable); B5 Reddit post | Online page; Playwright suite; CI jobs | E2E (test plan §6); UI tests; "no Kill Zone hints" assertions | Review screenshots of the online page; write and post on Reddit | Build and test | All E2E green; founder happy with the UI | Not deployed publicly yet |
| **3. Multiplayer hardening** | Real infrastructure and real people, privately | Phase 2 | A7 staging and load tests; A8 privacy page, kill switch, docs; A9 dark launch; A10 private alpha. Track B: B6 Chess.com post; B7 feedback loop | Staging; load-test report; privacy page; unlisted production | Load tests (§7); manual checklist (§8) | Approve the privacy text (F7); approve the dark launch; recruit testers; post on Chess.com | Deploy; measure; fix; report | **Stage 2 exit criteria** (LAUNCH-PLAN.md §3) | Kill switch; `wrangler rollback`; unlink |
| **4. Public beta** | Open to everyone, labelled Beta | Phase 3 | A11: links from the welcome and play pages; watch quotas; offer the upgrade only if a trigger fires; then A12 v0.3.0 | Public online play; tag `v0.3.0` | Launch criteria (test plan §10) | Approve the beta; decide on an upgrade only if a trigger fires (F-A7) | Monitor; fix; weekly metrics | **Stage 3 exit criteria**, then all 15 launch criteria | Remove links; kill switch; rollback |
| **5. Variant community distribution** | Tier 2 channels, with online play as the reason to come | Phase 4 stable ≥ 1 week | B8: Reddit follow-up, Lichess blog, Show HN (after a quota check), Chess.com thread reply; Chess Variant Pages follow-ups | Posts live; listing published | Traffic and feedback per metrics | Write and publish posts | Facts, images, skeletons; watch load | Posts done per plan | Posts can't be unpublished: follow up with corrections; kill switch if overloaded |
| **6. Early growth** | Learn from data; make games timed | Phase 5 | v0.3.x fixes; **v0.4 clocks**; B9 8-week review; decide whether the lobby is warranted (≥ 20 non-founder games a day) | v0.4.0; metrics review | Clock tests; load test with clocks | Decide the clock presets; lobby go or no-go | Build v0.4; analyse | v0.4 launch criteria | Untimed games stay available |
| **7. Future platform** | Strangers, identity, competition | Phase 6 plus traffic | v0.5 lobby and quick match; v0.6 accounts and history (D1); v0.7 ratings and fair play; cost and architecture review at thresholds | v0.5–v0.7 | Per release | Sign-in choice; moderation stance | Design notes, then builds | Per release | Per release |

## Final Master Checklist

**Phase 0**
- [x] Founder reads this blueprint and answers F1–F12 (8 October 2026)
- [x] Founder answers F13–F14 (the computer fallback, Auto difficulty) (9 October 2026)
- [ ] Claude commits the Phase 2 docs (docs only) and updates the handover
- [ ] Tag `v0.2.1` (if F8 approved)
- [ ] Founder: Cloudflare account, 2FA, subdomain, API token, GitHub secret and variable, `wrangler login` (F-A1 to F-A6)
- [ ] Claude: A0 spike and report; amend any decisions it disproves

**Phase 1**
- [ ] V7 Auto difficulty, released as v0.2.2 (F14 approved)
- [ ] A1 protocol · [ ] A2 RoomCore and restore property tests · [ ] A3 Worker and adapter with integration and failure tests
- [ ] B1 press kit, `og.png`, meta tags (deployed with approval) · [ ] F-A8 Web Analytics, snippet added · [ ] F-B1 GitHub settings
- [ ] Founder starts participating in r/chessvariants

**Phase 2**
- [ ] A4 client core · [ ] A5 online page · [ ] A6 Playwright and CI
- [ ] Founder reviews the online page · [ ] B5 Reddit post · [ ] B4 Chess Variant Pages (when reachable)

**Phase 3**
- [ ] A7 staging and load tests and metrics report · [ ] A8 privacy page (F7 approved), kill switch, docs
- [ ] A9 dark launch (approved) · [ ] A10 alpha with 3–8 testers; stage 2 exit criteria met
- [ ] B6 Chess.com post · [ ] B7 feedback log running

**Phase 4**
- [ ] A11 public beta (approved); Paid if triggered · [ ] Stage 3 exit criteria · [ ] A12 tag `v0.3.0`

**Phase 5–7**
- [ ] B8 Tier 2 posts · [ ] B9 8-week review · [ ] v0.4 clocks · [ ] lobby go or no-go · [ ] v0.5–v0.7 as warranted

**Every session:** update `F:\Projects\Handovers\PROJECT-HANDOVER Mean Chess.md`.

---

## Your final recommendation

Build online play as **"play a friend by link"**, on **Cloudflare**:
- one small server object per game;
- running the engine you already have, unchanged;
- your website stays exactly where it is.

It costs nothing and needs no card. On the free plan it can't run up a bill, and a daily capacity
guard makes sure no game is ever cut off: on a very busy day, new online games wait until midnight
UTC, while the computer (at a level picked for each player) keeps everyone playing. Paying for more
capacity is your choice, never a requirement.

**Leave out** accounts, clocks, chat and matchmaking for the first online release. They each add more
risk than value right now. Do clocks next, and only open a public lobby once enough people are
playing that it won't be empty.

**Start the community work now, not after online play is finished.** The game already has a
tutorial, rules and a computer opponent, which is plenty for variant fans to try it and react. Submit
to the Chess Variant Pages as soon as the site is back (it's slow, so start early). Post once on
r/chessvariants and once on the Chess.com forums, **written by you**: those communities reject
AI-written posts. Save the Lichess blog and Hacker News for when online play works; they'll land
better with it.

Don't chase Chess.com, Lichess or PyChess to host Mean Chess natively. None of them can, and the
time is better spent bringing people to your own site.

## The exact next build sequence

1. **You:** read this blueprint and answer F1–F12. **Done on 8 October 2026.**
2. **Claude:** commit the Phase 2 documents (docs only); update the handover; tag and push `v0.2.1`.
3. **You:** create the Cloudflare account and its two-factor authentication, choose the subdomain,
   create the API token, add the GitHub secret and variable, and click **Allow** on `wrangler login`
   (LAUNCH-PLAN.md §5, F-A1 to F-A6). Meanwhile, **Claude** builds the Auto difficulty (V7) and ships
   it as v0.2.2 (F14, approved).
4. **Claude:** A0 spike, locally then on your Free account. Report the measurements and confirm or
   amend P2-03, P2-16, P2-19 and P2-22.
5. **Claude:** A1 shared protocol, then A2 RoomCore with the restore property tests, then A3 the Worker
   and Durable Object with integration tests. Each is committed green.
6. **Meanwhile (Track B):**
   - Claude builds the press kit, `og.png` and meta tags (B1), and deploys them with your approval;
   - you set up Web Analytics and the GitHub settings (F-A8, F-B1);
   - you start taking part in r/chessvariants (B3).
7. **Claude:** A4 client core, then A5 the `/online/` page, then A6 Playwright tests and CI. You review
   the page.
8. **You:** publish the r/chessvariants post (B5), at least 1–2 weeks after joining. Submit to the Chess
   Variant Pages whenever the site is back (B4).
9. **Claude:** A7 staging deploy, load tests and the metrics report; A8 privacy page, kill switch and
   docs (you approve the privacy text).
10. **You:** approve the dark launch. **Claude:** A9 production deploy with `/online/` unlisted; you
    and Claude play 3 games on different networks.
11. **You:** invite 3–8 testers. Run the private alpha for 1–2 weeks (A10), and fix what it finds. Post
    on the Chess.com forum (B6).
12. **You:** approve the public beta once the stage 2 criteria are met. **Claude:** A11 adds "Play
    online (beta)" links and watches the quotas. If the capacity guard starts closing on 2+ days a
    week, you decide: upgrade ($5/month), or stay free and keep the guard.
13. After a stable week of beta: **you** publish the Tier 2 posts (B8).
14. When all 15 launch criteria hold: **Claude** tags `v0.3.0` (A12) and updates the docs and the
    handover.
15. Eight weeks after the first post: review the discovery metrics (B9), then start **v0.4 clocks**.
