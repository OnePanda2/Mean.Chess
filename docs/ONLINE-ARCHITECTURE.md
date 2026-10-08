# Online architecture (Phase 2, Track A)

**Status: approved by the founder on 8 October 2026. Nothing here is built yet.**
Part of the Phase 2 blueprint ([PHASE-2-BLUEPRINT.md](PHASE-2-BLUEPRINT.md)). Sources are cited as [S1]
and so on ([PHASE-2-SOURCES.md](PHASE-2-SOURCES.md)); decisions as P2-01 and so on
([PHASE-2-DECISIONS.md](PHASE-2-DECISIONS.md)).

Companion documents: [ONLINE-PROTOCOL.md](ONLINE-PROTOCOL.md) (messages, lifecycle, reconnects),
[ONLINE-DATA-MODEL.md](ONLINE-DATA-MODEL.md) (storage), [ONLINE-SECURITY.md](ONLINE-SECURITY.md),
[ONLINE-TEST-PLAN.md](ONLINE-TEST-PLAN.md) and [LAUNCH-PLAN.md](LAUNCH-PLAN.md).

---

## 1. The decision in one paragraph

**Online games run on Cloudflare Workers with one SQLite-backed Durable Object per game** (P2-01). The
existing site stays exactly where it is, on GitHub Pages. A new page, `/online/`, opens a WebSocket to a
small Worker on `workers.dev`, which hands each game's traffic to that game's Durable Object. The object
runs the existing Mean Chess engine, unchanged, on every move. It stores the game in its own SQLite
database and broadcasts accepted moves to both players. The object hibernates between moves, so an idle
game costs nothing, and the whole thing fits in Cloudflare's free plan until roughly 1,000–2,000 monthly
online players.

**The free plan needs no card and can't produce a bill.** Over a daily limit, Cloudflare refuses
requests until 00:00 UTC [S1]. So **a daily capacity guard (§8) makes sure the limit is never
reached**:
- it stops *new* online games well before the limit;
- games in progress always finish;
- anyone turned away is offered the computer instead (P2-31, P2-32).

Beyond the free plan, the $5/month plan with usage pricing would come to about $12 a
month at 10,000 players, but **upgrading is always the founder's choice, never a requirement** (F5).

## 2. System diagram

```
                       ┌──────────────────────────────────────────────┐
  Browser              │ GitHub Pages (unchanged)                     │
  (React app)  ───────►│ meanchess.siddheshthapa.com                  │
     │   static files  │ /  /play/  /tutorial/  /rules/  + NEW /online/│
     │                 └──────────────────────────────────────────────┘
     │
     │ HTTPS (create, join, finished-game view)
     │ WebSocket (live game)
     ▼
  ┌───────────────────────────────────────────────────────────────────┐
  │ Cloudflare Worker "meanchess-online"                              │
  │ https://meanchess-online.<subdomain>.workers.dev                  │
  │ · routes /v1/*  · CORS + Origin allow-list  · rate limits         │
  │ · validates the Upgrade header, then forwards to the game object  │
  └──────────────────────────────┬────────────────────────────────────┘
                                 │ one object per game (name = game id)
                                 ▼
  ┌───────────────────────────────────────────────────────────────────┐
  │ Durable Object "GameRoom"                                         │
  │ · RoomCore: pure TypeScript game-room logic (no Cloudflare APIs)  │
  │ · the Mean Chess engine, imported from src/engine (unchanged)     │
  │ · both players' hibernatable WebSockets                           │
  │ · SQLite: one game row + the moves table (the authority)          │
  │ · one alarm: expiry, idle close, deletion                         │
  └───────────────┬───────────────────────────────┬───────────────────┘
                  ▼                               ▼
     Workers Analytics Engine              Workers Logs
     (unsampled counters)                  (structured, sampled when large)
```

Plus one tiny `DailyCapacity` object per UTC day, which counts the day's online games so the free
quota never runs out (§8). Nothing else: no database server, no Redis, no auth provider, no virtual
machine.

### Why one object per game

Cloudflare's own guidance is "one Durable Object per logical unit that needs coordination … a game
session" [S5]. Each object has a globally unique name, runs single-threaded, is created near the first
player, and keeps strongly consistent, transactional storage next to the code [S19]. For a chess game
this means:

- **One authority per game, never two.** Every request for game `7KQ2MX9FTA` reaches the same
  single-threaded object. There is nothing to lock and no split brain.
- **Moves are processed one at a time.** Input gates hold new events while a handler runs. The handler
  validates with the engine and writes SQLite synchronously, with no `await` in between [S5].
- **Nobody sees a move that wasn't saved.** Output gates hold outgoing messages until the storage write
  completes [S5]. That includes the broadcast of the move: if the write fails, nobody is told.
- **Idle games are free.** With the Hibernation API the object sleeps 10 s after the last event while
  both sockets stay open [S3], and hibernated objects are not billed for duration [S1].

## 3. A move, end to end

1. The player moves a piece. The page checks the move with its own copy of the engine, so feedback is
   instant. It draws the move as *pending* and sends `{"t":"move","ply":12,"uci":"e1e3","mid":"…"}`
   over the open WebSocket.
2. The socket is already attached to the game's object; the Worker only took part at connect time.
   `webSocketMessage` runs, and the object reads the sender's seat from the socket's attachment.
3. RoomCore checks the move against the room state. The game must be active, the sender must be the
   side to move, `ply` must equal the number of moves played, and `mid` must not be a duplicate. Then it
   calls the engine's `play(game, uci)`, which throws if the move is illegal.
4. The object inserts the move row and updates the game row: two synchronous SQL statements, committed
   as one implicit transaction [S5].
5. The object sends `{"t":"moved", "rev":…, "ply":12, "uci":"e1e3", "fen":"…", "result":{…}}` to every
   socket of both players. The output gate releases it once the write is durable.
6. Each page plays the same UCI move through its own engine and checks that it reaches the same MeanFEN
   (`fen`) as the server. A royal move is just a capture on screen; the result dialog explains what
   happened afterwards, exactly as in local play (D-39, D-46).

Measured cost of step 3: **about 0.09 ms of CPU per move** [M1].

## 4. Backend comparison

Six options were compared on the brief's criteria. Pricing and quotas are as of 8 October 2026.

| Criterion | **Cloudflare Workers + Durable Objects** | Supabase (Realtime + Edge Functions + Postgres) | Firebase (RTDB/Firestore + Functions) | Node WebSocket server on a small VM (Fly.io) | Render free web service | Vercel Functions |
|---|---|---|---|---|---|---|
| Realtime | WebSockets end inside the game's object; Hibernation API [S4] | Realtime channels relay between clients; our code is not in the loop | SDK listeners; our code is not in the loop | Full control | Full control while awake | WebSockets in public beta since 22 Jun 2026 [S25] |
| Authoritative server fit | **Excellent**: our code runs on every message, one object per game | Indirect: Edge Function per move, plus a Postgres transaction, plus a Realtime broadcast | Indirect: Functions validate writes (Blaze plan only) [S22] | Excellent | Excellent, until it sleeps | Poor: sockets live on short-lived instances |
| Persistent game state | SQLite inside the object, transactional with the logic [S19] | Postgres | RTDB or Firestore | Must add SQLite on a volume, plus backups | No disk [S23] | External store required |
| Authentication | None built in; we issue per-game seat tokens | Built in, including anonymous [S21] | Built in, including anonymous | DIY | DIY | DIY |
| Guests | Seat tokens, no SDK | Anonymous sign-ins | Anonymous auth | DIY | DIY | DIY |
| Reconnects | State lives in the object; **every deploy drops every socket** [S4], so clients must reconnect | Realtime client reconnects | SDK reconnects | Restarts drop sockets and in-memory rooms | Random restarts [S23] | ~5-minute duration cap [S25] |
| Latency and reach | Global; object created near the first player [S19] | One region per project | Regional | One region | One region, ~1 min to wake [S23] | Global edge, but sockets are pinned to an instance |
| Concurrency | Isolated per game; 1,000 req/s soft limit per object [S2] (a chess game needs ~1) | Free: 200 concurrent connections [S20] | Spark: 100 simultaneous RTDB connections [S22] | Thousands of sockets on a small VM | Small | Unclear in beta |
| Free tier | Yes, no card; daily limits **fail closed** rather than bill [S1][S6] | Yes, but **pauses after a week of inactivity** [S20] | Spark has no Functions [S22] | None for new organisations [S24] | Sleeps after 15 min [S23] | Hobby, non-commercial |
| Price after free | $5/month plus usage: ≈$12 at 10k players, ≈$125 at 100k (§8) | $25/month Pro [S20] | Pay as you go (Blaze) | ≈$2–5/month per small VM [S24] | Paid always-on instance needed | Usage based |
| Operations | Low: no servers, OS or database to run | Medium: schema, row-level security policies, functions | Medium | **High**: OS and runtime updates, supervision, TLS, backups | Medium | Medium |
| Deploy | `wrangler deploy` from CI | CLI plus migrations | CLI | Docker plus `flyctl` | Git push | Git push |
| Debugging and logs | `wrangler dev` runs the real runtime locally; Workers Logs; `wrangler tail` [S14] | Local Docker stack; dashboard logs | Emulators; Cloud Logging | Anything | Dashboard | Dashboard |
| Cold starts | Negligible: isolates, and fast wake from hibernation | Edge Function cold starts | Function cold starts | None (always on) | ~1 minute after sleeping | Function cold starts |
| Room coordination | **The object is the room** | Database rows plus channels | Database paths | In-process maps | In-process, lost on restart | External store needed |
| Rate limiting and abuse | Rate Limiting binding [S12] plus per-object limits; Turnstile available | Partial | App Check | DIY | DIY | Firewall |
| DDoS | Cloudflare's network | Provider level | Google | Basic proxy | Provider level | Provider level |
| TypeScript and the engine | Engine bundled unchanged (pure ES2023) | Engine would run in Deno Edge Functions | Node | Node | Node | Node |
| Fit with this repo | One `server/` folder that imports `src/engine` | Second runtime, SQL schema, policies, client SDK | Functions plus SDK | `server/` folder plus Dockerfile and ops | Same as VM | Same as VM, plus a store |
| Future lobby and matchmaking | One lobby object (shard later) | Queries plus channels | Queries | In-process | — | — |
| Future history and ratings | D1, Cloudflare's SQLite database [S15] | **Postgres (best)** | Firestore | Add a database | — | — |
| Lock-in | Medium for the adapter only; RoomCore and the protocol stay portable | Medium (Postgres is portable; Realtime and Auth are not) | High | Low | Low | Medium |
| Migration difficulty | Low–medium: swap the Durable Object adapter for Node `ws` plus SQLite | Medium | High | — | — | — |

### Why the alternatives were rejected

- **Supabase.** Realtime relays messages between clients; it is not a place where our engine runs on
  each move. Making it authoritative needs three moving parts per move (an Edge Function in Deno, a
  Postgres transaction with a row lock, a Realtime broadcast) plus row-level security policies to keep
  clients from writing directly. Free projects **pause after one week of inactivity** [S20], which is
  fatal for a niche game that may be quiet for a week, and the next step is $25/month. Its strengths,
  accounts and Postgres, are exactly what v0.3 deliberately leaves out.
- **Firebase.** Server-side validation needs Cloud Functions, which need the Blaze plan with a card
  [S22]. Security rules cannot express Mean Chess legality, so without Functions the client would be
  trusted. It is also the most locked-in option.
- **A Node WebSocket server on a VM (Fly.io, Railway, a VPS).** It's the simplest mental model and the
  most portable. But it is a server to operate: OS and Node updates, process supervision, SQLite on a
  volume with backups, TLS, one region, and restarts still drop every socket. There is no free tier
  [S24][S26]. **It is the planned fallback** if usage costs ever exceed it (§9), which is why RoomCore
  must stay free of Cloudflare APIs.
- **Render (free).** It sleeps after 15 minutes, takes about a minute to wake, may restart at any time,
  and has no disk [S23]. Games kept in memory would vanish, and the first player after a quiet spell
  would wait a minute.
- **Vercel Functions.** WebSockets only reached public beta in June 2026 and are tied to a function
  instance with a maximum duration; a test connection dropped at about 5 minutes [S25]. A 20-minute game
  would be cut off, and room state would need an external store.
- **PartyKit / partyserver.** It is built on the same Durable Objects, and Cloudflare now owns it [S18].
  It adds a dependency whose own README calls it unfinished [S17], over an API small enough to use
  directly.
- **Peer-to-peer (WebRTC).** No authority, NAT traversal problems, and trivially cheatable.
- **Plain HTTP polling** (Workers plus D1). It works, but every poll is a billed request with polling
  delay. Hibernating WebSockets are cheaper and instant.

**The honest weak spots of the choice:**
- Durable Objects are Cloudflare-specific.
- Free-plan limits fail hard, mid-day, with no bill but no service until 00:00 UTC [S1][S6].
- Whether the Workers Free plan's **10 ms CPU limit** applies to Durable Objects is not clear from the
  docs [S2][S9].
- Every deploy disconnects every live game [S4].

The design answers each one:
- the Cloudflare-specific code is a thin adapter (§5);
- a daily capacity guard stops new online games long before any free quota could run out, so games
  in progress finish and nobody sees an error. When the guard closes often, the founder is offered an
  upgrade, and may decline it (§8);
- restoring a game is bounded at about 100 moves of replay ([ONLINE-DATA-MODEL.md](ONLINE-DATA-MODEL.md)
  §4); the M0 spike measures real CPU before anything else is built; and if that's still too close,
  a free zero-replay resume removes replay altogether;
- reconnects are part of the core protocol, not an afterthought.

## 5. How the engine runs on the server

**No rewrite, no fork, no package extraction.** The engine in `src/engine/` is already pure,
deterministic TypeScript with no DOM, clock or randomness, enforced by lint (D-22). That is what lets
the server use it unchanged.

| Concern | Decision |
|---|---|
| Module strategy | The Worker imports the engine by relative path from its public entry, `src/engine/index.ts` (the same "index only" rule the app follows). Wrangler's bundler (esbuild) compiles the TypeScript, `.ts` import extensions included, into the Worker script. No npm package or workspace is needed while client and server live in one repository and deploy from the same commit. |
| Runtime | Cloudflare `workerd` (V8, ES2023). The engine uses only standard JavaScript. The M0 spike replays fixture games inside `wrangler dev` and compares MeanFEN, repetition keys and outcomes with Node. |
| Moves on the wire | Coordinate notation (UCI), the same format saved games use: regex `^[a-h][1-8][a-h][1-8][qrbn]?$`, matched with `findMove(legalMoves(position), uci)` inside `play()`. A promotion must carry its letter. |
| Validation | `play(game, uci)` is the only way a move enters a game. It throws on any illegal move, including after the game has ended. |
| Result detection | The engine's `outcome` (royal → mate/stalemate → fifty-move → threefold; D-11, D-13) decides every on-board ending. The server adds only the endings that aren't moves: resignation and agreement (the engine's own `resign`/`agreeDraw`), plus the online-only ones in ONLINE-PROTOCOL.md §9. |
| Position hashing | The engine's `positionKey` drives threefold repetition inside `play()`. The server never computes repetition itself. |
| MeanFEN | The source of truth is the start position plus the move list. The server also stores a MeanFEN *checkpoint* after each irreversible move, to bound replay on wake (ONLINE-DATA-MODEL.md §4). |
| Queen origin | Survives automatically: MeanFEN writes promoted queens as `Q~`, and replaying moves reproduces origins. Tests cover it (ONLINE-TEST-PLAN.md §3). |
| Game records | Finished games are exported in the existing SavedGame v1 format (`saveGame`/`loadGame`), so any online game can be loaded into the local board, Scenario Lab or a future analysis tool. |
| Deterministic replay | `start + moves` always rebuilds the identical game; `loadGame` already does this and never trusts a stored result (D-24). |
| Versions | Client and server ship from the same commit. Every connection checks `RULES_VERSION` (`'0.1'`) and the protocol version; a game records the rules version it was created under. A rules change would need a new rules version and a migration plan; none is planned. |

**What does not move:** `src/ai/` (the computer stays in the browser), React components, and everything
in `src/app/` except the new online page.

## 6. Repository structure

**One repository** (P2-12). Splitting frontend and backend would mean publishing the engine as a
package and keeping two copies in step: the "client engine A, server engine B" problem the brief warns
about. One repository means one commit, one engine and one CI pipeline.

```
src/
  engine/            unchanged: the shared rules engine (browser, AI tests, server)
  ai/                unchanged: browser only
  online/            NEW, shared pure TypeScript (browser + server), same lint boundary as the engine
    protocol.ts        message and event types, validators, error codes, PROTOCOL_VERSION
    limits.ts          shared constants: timeouts, size and rate limits, retention
    ids.ts             game id format, parsing and normalisation (random source injected)
  app/
    online/          NEW, browser only
      OnlineApp.tsx      the /online/ page: create, join, play, end screen, rematch
      connection.ts      WebSocket client: hello, heartbeat, reconnect with backoff, pending move
      onlineState.ts     reducer: server events → screen state, built on the existing gameState
  components/        reused: Board, SidePanel, dialogs; plus a few small online widgets
  online.tsx         NEW Vite entry
online/index.html    NEW page (theme pre-paint script like the others)
server/              NEW: the Cloudflare Worker; the only code that touches Cloudflare APIs
  src/
    index.ts           Worker: routing, CORS, Origin check, rate limits, upgrade forwarding
    GameRoom.ts        Durable Object adapter: SQLite, sockets, attachments, alarm
    room.ts            RoomCore: pure state machine (state + command + time → state, events, writes)
    storage.ts         schema, migrations, row ⇄ state mapping
    metrics.ts, log.ts thin wrappers for Analytics Engine and structured logs
  wrangler.jsonc       bindings, migrations, environments (staging, production)
  tsconfig.json        Workers types (generated by `wrangler types`), includes src/engine and src/online
tests/
  online/            NEW: protocol validators, ids
  server/            NEW: RoomCore unit tests (Node, fake clock), restore ≡ replay property tests,
                     integration tests against the Worker running locally (real WebSockets)
  e2e/               NEW (later milestone): Playwright, two browser contexts
tools/
  loadtest.ts        NEW: N concurrent games against staging
```

| Layer | Lives in | Runs in | May import |
|---|---|---|---|
| Rules engine | `src/engine/` | browser, Node, workerd | nothing outside itself |
| Protocol and limits | `src/online/` | browser, workerd | the engine |
| RoomCore | `server/src/room.ts` | workerd and Node tests | the engine, `src/online` |
| Durable Object adapter and Worker | `server/src/` | workerd only | RoomCore, `src/online`, Cloudflare APIs |
| Online UI | `src/app/online/`, `src/online.tsx` | browser only | the engine, `src/online`, components |

ESLint gains two boundaries: `src/online/**` follows the engine's rules (no DOM, clock or randomness),
and `server/src/room.ts` may not use Cloudflare globals. Vitest gains an `online` project in Node. The
`vitest.config.ts` coverage thresholds extend to `src/online` and `server/src/room.ts`: 95% lines,
functions and statements, and 90% branches.

New development dependencies, at implementation time:
- `wrangler`, pinned exactly; 4.36 or later is needed for rate limits [S12]; 4.148.0 is current [S17];
- later, `@playwright/test`.

**No new runtime dependencies** for the site or the server. Validators are hand-written, like the saved-game loader (P2-26).

## 7. Deployment, environments and domains

### Environments

| Environment | Backend | Frontend | Used for |
|---|---|---|---|
| Local | `wrangler dev` at `http://localhost:8787` (real workerd runtime, local SQLite, no account needed) | `npm run dev` at `http://localhost:5173` with `VITE_ONLINE_URL=http://localhost:8787` | Development, integration tests |
| Staging | Worker `meanchess-online-staging` → `https://meanchess-online-staging.<subdomain>.workers.dev` | Local dev server pointed at staging | Pre-release checks, load tests, deploy rehearsals |
| Production | Worker `meanchess-online` → `https://meanchess-online.<subdomain>.workers.dev` | GitHub Pages, built with `VITE_ONLINE_URL` set to the production URL | Alpha (unlisted `/online/` page), beta, release |

`<subdomain>` is the account's `workers.dev` subdomain, chosen once by the founder (LAUNCH-PLAN.md §5;
`meanchess` suggested). The private alpha runs on **production** with the `/online/` page unlisted (a
"dark launch"). Testers then exercise the real stack, and going public is just adding links.

### Configuration and secrets

| Item | Where | Secret? |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` ("Edit Cloudflare Workers" template, this account only) | GitHub → repository secrets | **Yes** |
| `CLOUDFLARE_ACCOUNT_ID` | GitHub → repository variables | No |
| `VITE_ONLINE_URL` (production Worker URL) | `deploy.yml` build step | No, it's public |
| `ALLOWED_ORIGINS`, `ENVIRONMENT`, `ONLINE_ENABLED` (kill switch) | `wrangler.jsonc` `vars`, per environment | No |
| Bindings: `GAME_ROOM` (Durable Object), `METRICS` (Analytics Engine), `CREATE_LIMIT`/`JOIN_LIMIT`/`CONNECT_LIMIT` (rate limits) | `wrangler.jsonc`, repeated in each environment (wrangler doesn't inherit bindings into environments) | No |

v0.3 needs **no Worker secrets**: seat tokens are random and stored as hashes, so there is nothing to
sign. Never commit tokens. On the development machine the founder runs `npx wrangler login` once, and
the OAuth token stays in the user profile.

A `wrangler.jsonc` sketch (illustrative; the final file is written at M0):

```jsonc
{
  "name": "meanchess-online",
  "main": "src/index.ts",
  "compatibility_date": "2026-10-01",            // ≥ 2026-04-07 for WebSocket close auto-reply [S4]
  "observability": { "enabled": true, "head_sampling_rate": 1 },
  "durable_objects": { "bindings": [{ "name": "GAME_ROOM", "class_name": "GameRoom" }] },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["GameRoom"] }],
  "analytics_engine_datasets": [{ "binding": "METRICS", "dataset": "meanchess_online" }],
  "ratelimits": [
    { "name": "CREATE_LIMIT", "namespace_id": "1001", "simple": { "limit": 10, "period": 60 } },
    { "name": "JOIN_LIMIT", "namespace_id": "1002", "simple": { "limit": 20, "period": 60 } },
    { "name": "CONNECT_LIMIT", "namespace_id": "1003", "simple": { "limit": 30, "period": 60 } }
  ],
  "vars": { "ENVIRONMENT": "production", "ONLINE_ENABLED": "true",
            "ALLOWED_ORIGINS": "https://meanchess.siddheshthapa.com" },
  "env": { "staging": { "name": "meanchess-online-staging" /* + the same bindings, staging vars */ } }
}
```

### CI and deploy order

The existing `.github/workflows/deploy.yml` gains:

1. **Verify job:**
   - `npm run test:online` (pure tests);
   - `npm run test:server` (integration against a locally started Worker);
   - type-checking of `server/`.
2. **A `deploy-online` job:**
   - runs on `main` only, after verify, and only when `server/`, `src/engine/` or `src/online/` changed;
   - runs `npx wrangler deploy` in `server/`, using the API token.
3. **The Pages deploy job** `needs` `deploy-online` when both run, so the backend always goes out
   first.

Compatibility rule: **the server accepts the current and the previous protocol version** (P2-15), and
clients ignore event types they don't know. A tab left open on an old build keeps working through one
upgrade. After that it gets "Mean Chess was updated. Reload to keep playing." GitHub Pages caches HTML
for about 10 minutes, so for a while after a deploy, new visitors may still load the old client.

Staging deploys are manual (`npm run deploy:staging`, which runs `wrangler deploy --env staging`) or a
`workflow_dispatch` run.

### Migrations

There are two kinds:
- **Durable Object class migrations** (`migrations` in `wrangler.jsonc`) happen only when a class is
  added or renamed.
- **SQLite schema migrations** live inside each object:
  - a `meta` table records `schema_version`;
  - when an object wakes, its constructor runs `migrate()` inside `ctx.blockConcurrencyWhile()`, which
    is what that API is for [S5];
  - migrations are **additive only**: add tables or columns with defaults, never rename or drop for at
    least two releases.

An object that never wakes again is never migrated, and that's fine: it is deleted by its retention
alarm anyway.

### Rollback

- **Backend:** `wrangler rollback`, or a re-deploy of the previous version from the dashboard
  (Workers → Deployments). Additive-only schemas make this safe, because old code ignores new columns.
  A rollback is a deploy, so sockets reconnect.
- **Frontend:** revert the commit and push; Pages redeploys in about 2 minutes. Or re-run an older
  successful workflow run.
- **Kill switch:** set `ONLINE_ENABLED=false` in the dashboard (Workers → Settings → Variables). New
  games and joins then get "Online play is paused". Running games still finish. Local and computer play
  are unaffected.

Deploys drop every socket [S4]. Clients reconnect in 1–3 seconds and lose nothing, but don't deploy the
backend during a busy hour: check the active-games metric first.

### Domains

| Question | Decision |
|---|---|
| Separate `api.` and `ws.` subdomains? | No. One origin serves both HTTP (`/v1/games…`) and WebSocket (`/v1/games/:id/ws`) traffic. |
| Which origin? | `https://meanchess-online.<subdomain>.workers.dev`. **No DNS change**, nothing at Namecheap, the live site untouched (P2-13). |
| Why not `api.meanchess.siddheshthapa.com`? | A Worker custom domain needs the whole `siddheshthapa.com` zone on Cloudflare; CNAME-only setup is a Business/Enterprise feature [S11]. Moving nameservers would touch every existing site (apex, `www`, `taxcal`, `meanchess`). It's reversible, but not worth it for v0.3. |
| TLS | Automatic on `workers.dev`. |
| CORS | `Access-Control-Allow-Origin` echoes the request origin only if it's in `ALLOWED_ORIGINS`. Methods `GET, POST, OPTIONS`; header `Content-Type`; no credentials. |
| Cookies | **None.** Seat tokens are kept in `localStorage` and sent inside the first WebSocket message. Cookies on `workers.dev` would be third-party from the site's point of view and blocked by Safari and others anyway. |
| WebSocket Origin | The Worker rejects upgrades whose `Origin` isn't allowed (403). This stops other websites from driving players' browsers. It is not authentication: non-browser clients can fake it. |
| Environment URLs | Production: `meanchess.siddheshthapa.com` → `meanchess-online.<sub>.workers.dev`. Local: `localhost:5173` → `localhost:8787`. Staging allows `http://localhost:5173` as an origin. |
| Later | Revisit a branded API domain (by moving DNS to Cloudflare) only if `workers.dev` turns out to be blocked on testers' school or office networks (some filters block it), or for v0.5+ branding. |

## 8. Cost model

### Resource use per game (estimated; alpha measures the real numbers)

Assumption: a game of about 80 plies with two players and one reconnect each.

| Resource | Per game | How it's counted |
|---|---|---|
| Durable Object requests | ≈ 20 | create + join (2) + 4 WebSocket connects + ~150 incoming messages ÷ 20 (8) + ~4 alarms and lookups [S1] |
| Durable Object duration | **≤ 100 GB-s** | The object stays awake at most ~10 s after each event [S3]: 80 plies × 10 s × 0.125 GB = 100 GB-s, and less for fast games. **This is the cost driver.** |
| Rows written | ≈ 250 | ~2 per move, plus creation and ending, plus deletion at the end of retention |
| Rows read | ≤ 1,000 | Restoring after a wake reads at most ~100 rows |
| Storage | ≤ 10 KB for 30 days | A 300-ply saved game is 2.2 KB [M1] |
| Worker requests | ≈ 7 | create, join, upgrades, finished-game view |
| Logs | ≈ 0.2 MB | Invocation logs at ~2 KB × ~100 messages; plus ~20 structured lines |
| Analytics Engine points | ≈ 8 | One per lifecycle event |

**Free-plan ceiling per day** [S1][S9][S14]:
- duration: 13,000 GB-s ÷ 100 = **≈130 games**, the binding limit;
- requests: 100,000 ÷ 20 = 5,000 games;
- rows written: 100,000 ÷ 250 = 400 games;
- logs, from 1 Dec 2026: 0.5 GB ÷ 0.2 MB ≈ 2,500 games.

So Free carries about 130 games a day, roughly 3,900 a month if spread evenly. A limit that runs out
stops that operation until 00:00 UTC [S6]. That costs nothing, but it would stop games in the middle,
so **the capacity guard below never lets it happen.**

### Staying seamless on the free plan: the capacity guard

A free quota that ran out mid-day would cut games off in the middle. That's not acceptable, so the
server stops *starting* online games long before it could happen (P2-31):

- **One counter per UTC day.** A tiny `DailyCapacity` Durable Object, named after the date, counts
  the day's new online games. It costs one request per game created.
- **Soft cap: 80 new invites a day.** That's about 60% of the binding duration quota at ≤ 100 GB-s per
  game. Once reached, `POST /v1/games` answers `online-full` with the reopening time. **Nothing
  already started is affected:** invites already sent can still be joined, and games in progress
  have the remaining ~40% of the quota to finish in.
- **Hard cap: 100 games a day, counting rematches.** A pair already playing can rematch past the soft
  cap. At the hard cap, the rematch offer becomes "play the computer instead".
- **Per-address cap: 20 new games a day**, so one person or script can't use up everyone's capacity.
  Addresses are kept only as salted hashes, with a new salt each day, and deleted after 48 hours.
- **Tuned from real numbers.** After the alpha, the caps are set to
  `0.6 × 13,000 GB-s ÷ measured p90 GB-s per game`. They're settings (`vars`), changeable without code.
- **What players see when it closes:** "Online play is full for today. It reopens in 3 h 20 min
  (00:00 UTC). Games already started aren't affected, and invites you've sent still work." Two
  one-click buttons: **Play the computer** (at the player's Auto level, P2-33) and **Play a friend on
  this device**. Never an error screen.
- **The other free quotas stay far away:**
  - requests: about 2,000 a day at the cap, against 100,000;
  - rows written: about 25,000, against 100,000.

  The account-wide Worker request quota (100,000 a day) is shared with the anonymous funnel events.
  Those are batched (at most one request per page visit) and sampled 1 visit in 4 (P2-34), so even a
  viral day can't crowd out games.
- **A safety net for the improbable:** a quota overrun despite the guard, or a Cloudflare incident.
  Clients hold the whole game, so after 30 s without the server the page offers **Keep waiting** or
  **Finish this position against the computer** (ONLINE-PROTOCOL.md §8.3). The server's copy resumes
  as soon as it's reachable.

On a normal day none of this is visible. The guard only closes on a day with more than about 80
online games (around 2,000+ monthly online players), and that is exactly when the founder is offered
the upgrade (below).

### Four scales

Assumption: **games per month = monthly players × 1** (the average player plays two online games a
month; every game has two players). The "heavy" column triples it. Prices from [S1][S10][S14].

| Monthly players | Games/month | Busiest day (≈3× average) | Plan | Duration | DO requests | Rows written | Storage | Logs | **≈ Monthly cost** | Heavy case (3×) |
|---|---|---|---|---|---|---|---|---|---|---|
| 100 | 100 | ~10 | Free | 10k GB-s | 2k | 25k | < 1 MB | tiny | **$0** | $0 |
| 1,000 | 1,000 | ~100 (near the ~130/day ceiling) | Free, watched | 100k GB-s | 20k | 250k | ~10 MB | ~0.2 GB | **$0** | $0 on Free if spread out; otherwise $5–6 on Paid |
| 10,000 | 10,000 | ~1,000 | Paid | 1.0M GB-s → $7.50 | 200k → $0 | 2.5M → $0 | ~0.1 GB → $0 | ~2 GB → $0 | **≈ $12.50** | ≈ $37.50 |
| 100,000 | 100,000 | ~10,000 | Paid | 10M GB-s → $120.00 | 2M → $0.15 | 25M → $0 | ~1 GB → $0 | ~22 GB → $0 | **≈ $125** | ≈ $405 (duration $370, rows written $25, logs $4.40, requests $0.75, plus $5) |

Other line items:
- **Bandwidth:** Workers don't charge for egress. The static site counts against GitHub Pages' 100 GB
  monthly soft limit [S27]. A first visit downloads roughly 0.2–0.4 MB compressed [M3], so that's
  around 300,000 visits a month.
- **Database:** none until history or ratings arrive. D1's free tier then covers the first stage [S15].
- **Analytics Engine:** free, and its billing is not active yet [S13].

### Founder-friendly starting configuration

- **Workers Free:** two Workers (production and staging), one Analytics Engine dataset, logs at 100%
  sampling.
- No custom domain, no D1, no paid add-ons.
- **Monthly cost: $0.** No card on file.

### Growth thresholds

| Signal | Action |
|---|---|
| The capacity guard rarely or never closes | Stay on Free. That covers roughly 1,000–2,000 monthly online players. |
| The capacity guard closes on two or more days in one week, **or** a big promotion is planned (for example Show HN) | **Offer the founder Workers Paid** ($5/month plus usage, with billing notifications; LAUNCH-PLAN.md §5), and raise the caps to match. No code change. **The founder may decline:** staying free means that on the busiest days new online games wait until 00:00 UTC, while games in progress finish and everyone else gets the computer. |
| Bill above $50/month for two months running (≈40,000 monthly players at the base rate), or measured per-game duration well above 100 GB-s | Review costs: sample logs, check what keeps objects awake. Compare with running RoomCore on a small always-on Node server, which costs about $5–20/month for thousands of concurrent games but has to be operated. |
| ~100,000 monthly players (≈$125–400/month) | **Architecture review required**, and with it the D1/Postgres question for history and ratings. |

## 9. Lock-in and the escape hatch

All game logic lives in pure code: the engine, `src/online/`, and RoomCore (`server/src/room.ts`).
RoomCore takes the room state, a command and the current time, and returns the new state, the events
to send, the rows to write and the next alarm. The Cloudflare-specific part (`GameRoom.ts`, `index.ts`)
only moves bytes between sockets, SQLite and RoomCore, and should stay a few hundred lines.

Moving to a Node server later means:
1. a `ws` server with one in-process room per game;
2. the same SQLite schema (via `better-sqlite3`) or Postgres;
3. timers in place of alarms.

The protocol, the client and every rule stay as they are.

## 10. Observability: the minimum

| Need | How |
|---|---|
| Structured logs | One JSON line per significant event from the Worker and the object: `{evt, gameId, seat, ply, code, ms, ver}`. Events: `game_created`, `seat_claimed`, `game_started`, `move_rejected` (with code), `game_ended` (reason), `socket_closed` (code), `reconnected`, `error`. Accepted moves are counted, not logged. **Never logged:** IP addresses, seat tokens, request bodies. |
| Game ids in logs | Every line from a room carries `gameId`. A player's report ("game 7KQ2M-X9FTA broke") finds everything. |
| Error ids | Every unexpected exception gets an 8-character `errorId`, logged and shown to the player ("Something went wrong (error 3F9KQ2MX)"). |
| Metrics | One Analytics Engine data point per lifecycle event [S13], unsampled. Fields: event, end reason, rejection code, environment, protocol version; numbers: server processing ms per move, plies, reconnect count. Read with the SQL API through `tools/metrics.ts` (daily report). |
| Active rooms and connections | Rooms are counted as started minus finished per day. Connections: the object reports `ctx.getWebSockets().length` with each connect and disconnect event. Peaks are good enough. |
| Move latency | The server measures receive-to-send time in the object. Each client measures the round trip (send → `moved`) and sends one `stats` message at game end (p50, p95, reconnects). |
| Capacity guard | Each day: games created, games started, whether and when the guard closed, and how many players were offered the computer instead. **This is the trigger for the upgrade conversation.** |
| Desyncs | Every `moved` event carries the MeanFEN after the move. A client whose engine disagrees reports a `desync` (critical metric) and resynchronises. **Target: zero.** |
| Rejected moves, reconnects, failed games, backend errors | Metrics plus logs as above. "Failed game" means one that ended `abandoned`, or by an error, before move 2 by both sides. |
| Health | `GET /v1/health` returns `{ok, protocol, rules, build}`. An external uptime check is optional (a free UptimeRobot account, founder's choice). |
| Alerts | Kept minimal. On Paid, Cloudflare billing notifications. On Free, the weekly `tools/metrics.ts` report plus the dashboard's quota graphs. |

Log volume: from 1 Dec 2026, Free logging stops for the day at 0.5 GB [S14]. If it gets close, lower
`head_sampling_rate`. Metrics come from Analytics Engine, so sampling logs never blinds the numbers.

## 11. What could change in the next 6–12 months

- **Cloudflare pricing.**
  - SQLite storage billing began in January 2026 [S7].
  - Log pricing changes on 1 Dec 2026 [S14].
  - Analytics Engine billing is announced but not active [S13].

  Re-check [S1], [S13] and [S14] before the public beta.
- **Testing tools.** `@cloudflare/vitest-plugin` may add Vitest 5 support [S16]. If it does, the
  integration tests could run inside workerd, through Vitest, rather than against a locally started
  Worker.
- **Vercel's WebSocket support** may reach general availability [S25]. That doesn't change the
  decision: rooms still need a state store.
- **The Free-plan CPU question** [S2][S9] may be clarified in the docs; the M0 spike answers it for us
  either way.
