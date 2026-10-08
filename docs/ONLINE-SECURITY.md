# Online security, fair play and privacy (Phase 2, Track A)

**Status: approved by the founder on 8 October 2026. Nothing here is built yet.**
The online service is a public, internet-facing API that anyone can call without signing in. This
document says what it protects, how, and what it deliberately doesn't attempt. Protocol:
[ONLINE-PROTOCOL.md](ONLINE-PROTOCOL.md). Sources: [PHASE-2-SOURCES.md](PHASE-2-SOURCES.md).

---

## 1. Threat model

| Asset | Threat | Main defence |
|---|---|---|
| Game integrity (moves, results) | A modified client sends illegal moves, moves out of turn, fake results | The server validates everything with the engine; clients never send results (§4, §7) |
| A player's seat | Someone else moves for you, resigns for you, or takes your seat | 256-bit seat tokens, sent only in message bodies; the server stores only their hashes (§2) |
| An open invite | A stranger takes the seat meant for your friend | 50-bit unguessable game ids; joining needs a deliberate click; the creator can cancel (§3) |
| Service availability and quota | Floods of game creation, connections or messages exhaust the Free quota ("denial of wallet" on Paid) | Rate limits at the edge and inside each room, small message caps, a kill switch, Cloudflare's network (§5) |
| Players' privacy | Collecting or leaking identifying data | Collect almost nothing: no accounts, names, cookies or stored IPs, and short retention (§8) |
| The founder's accounts | A stolen Cloudflare API token or account | Least-privilege token in GitHub secrets only; two-factor authentication (§9) |

Attackers assumed: curious players with browser devtools, scripted clients, and opportunistic bots.
Not in scope: nation-state attackers, or Cloudflare itself.

**Trust boundaries.**
- Everything that arrives at the Worker is hostile until validated.
- RoomCore trusts only its own state and the engine.
- The browser trusts only the server's events, and even those are checked: the `fen` desync check
  (ONLINE-PROTOCOL.md §7).

## 2. Authentication and authorisation

**Authentication: per-game seat tokens** (P2-05).
- The server creates a token when a seat is claimed: 32 bytes from `crypto.getRandomValues`, encoded
  base64url.
- It returns the token exactly once, in the `POST` response.
- It stores only `SHA-256(token)`, so a storage leak reveals no usable tokens.
- The client keeps the token in `localStorage` under `mean-chess:online:v1:<gameId>`, and deletes
  tokens for games more than 30 days old.
- The token travels only inside the first WebSocket message (`hello`). It is **never put in a URL**,
  where logs, history and the Referer header would expose it.
- No cookies: no CSRF surface, and no third-party cookie problems on `workers.dev`.
- A rematch reuses each player's token (P2-25, ONLINE-PROTOCOL.md §3), so no new secret is ever sent.

**Authorisation matrix** (enforced by RoomCore; tested in ONLINE-TEST-PLAN.md §2):

| Action | Allowed for |
|---|---|
| Create a game | Anyone (rate limited) |
| Claim the open seat | Anyone with the game id, while it's waiting (rate limited) |
| `hello` (attach a socket) | Holders of a seat token for this game |
| `move` | The seat whose turn it is, while the game is active |
| `draw-offer`, `resign`, `claim`, `sync`, `stats` | Either seat, under the conditions in ONLINE-PROTOCOL.md §6 |
| `draw-answer` | The seat that was offered the draw |
| `abort` | The creator while waiting; either seat while `ply < 2` |
| `rematch-offer` / `rematch-answer` | Either seat after the game has finished, with both connected |
| Read a finished game | Anyone with the game id, until deletion (30 days) |
| Read a live game | Nobody but the players (no live spectators in v0.3) |
| Change history, set a result, edit the position | **Nobody**: there is no such operation |

## 3. Identifiers and entropy

| Identifier | Entropy | Why it's enough |
|---|---|---|
| Game id | 50 bits (10 Crockford base32 characters) | Its only power is claiming a *still-open* seat or reading a *finished* game. With 1,000 open invites at once, one random guess succeeds with probability ~10⁻¹². At the connect rate limit (30 per minute per IP), that is centuries per IP. |
| Seat token | 256 bits | Unguessable. Compared as hashes. |
| Move id | 72 bits | Only for idempotency; no power on its own |
| Join nonce | 96 bits | Only for retrying a lost join response; useless without the original request |

Ids are generated on the server only. Unknown ids get `not-found`, and nothing is written for them. The
object a lookup touches stays empty and costs one request.

## 4. Input validation

Every message is checked by hand-written validators in `src/online/protocol.ts`, the same style as the
saved-game loader (P2-26), before RoomCore sees it:

- **Size first:** HTTP bodies and WebSocket frames are capped at 2,048 bytes. Larger ones are rejected
  before `JSON.parse` (close 1009 or HTTP 413). Binary frames are refused.
- **Shape:** `t` must be a known type; field types and ranges are exact (`ply` an integer from 0 to
  1,999, booleans really boolean). Strings must match regexes:
  - UCI: `^[a-h][1-8][a-h][1-8][qrbn]?$`;
  - `mid`: `^[A-Za-z0-9_-]{8,24}$`;
  - token: 43 base64url characters;
  - game id: 10 Crockford characters after normalising.

  Unknown fields are ignored, never stored.
- **Semantics:** RoomCore checks seat, status and `ply`, then the engine: `play()` throws on anything
  illegal, and the room answers `rejected` with code `illegal-move`. A malicious move can't reach
  storage, because only a move the engine accepted is written.
- **MeanFEN:** v0.3 accepts **no client-supplied positions**. Every game starts from `START_MEAN_FEN`.
  If custom starts arrive later (Scenario Lab online), they go through `parseMeanFen` (which already
  calls `validatePosition`), with a 100-character cap.
- **SQL injection:** every statement uses bound parameters (`sql.exec(query, ...values)`), with no
  string building. A lint rule (`no-restricted-syntax` on template literals passed to `sql.exec`)
  enforces it.
- **XSS:** v0.3 shows no user-written text: no chat, names or descriptions. React escapes everything,
  and the page turns server error codes into its own wording; server text is never rendered as HTML.

## 5. Rate limits and abuse

| Vector | Limit (initial; tune from metrics) | Where |
|---|---|---|
| Creating games | 10 per minute per client IP | Worker, Rate Limiting binding [S12] |
| Online games per day | 20 new games per address; 80 new invites and 100 games for everyone (P2-31) | `DailyCapacity` object, with salted, daily-rotated address hashes (ONLINE-ARCHITECTURE.md §8) |
| Joining | 20 per minute per IP | Worker, binding |
| WebSocket connects | 30 per minute per IP | Worker, binding |
| Optional `/v1/events` beacons | 30 per minute per IP | Worker, binding |
| Messages per socket | Bucket of 20, refilling at 5 per second; excess closes with 1008 | Inside the object |
| Sockets per game | 3 per seat plus 4 unauthenticated; unauthenticated sockets closed after 10 s | Inside the object |
| Draw and rematch offers | 3 each per player per game | RoomCore |
| Unjoined rooms | Deleted after 24 h | Alarm (ONLINE-DATA-MODEL.md §6) |
| Abandoned games | Closed after 7 days, deleted 30 days later | Alarm |

Notes:

- **IP keys.** Cloudflare advises against keying limits on IPs, because many people can share one
  [S12]. But an anonymous create button has no other identity. The limits are therefore generous (a
  school sharing an IP can still start ten games a minute), and the binding counts per Cloudflare
  location and is "permissive" [S12]. **It's not documented whether the binding exists on the Free plan.
  The M0 spike checks.** If it doesn't, the fallback is a small `Limiter` Durable Object keyed by a
  salted hash of the IP, sharded 16 ways; raw IPs are never stored.
- **Quota exhaustion.** On Free, a determined flood could try to use up a daily quota. That would stop
  online games until 00:00 UTC (no bill [S1]). The defences:
  - the capacity guard: daily caps plus 20 new games per address. At worst a flood closes *new* online
    games for the day; it never breaks games in progress, and players are offered the computer;
  - the edge limits above;
  - the kill switch;
  - **Turnstile, prepared but off** (Cloudflare's free, mostly invisible challenge). It is switched on
    for game creation only if abuse appears.

  On Paid, the same flood costs money, so set billing notifications (LAUNCH-PLAN.md §5).
- **DDoS.** Traffic to `workers.dev` passes through Cloudflare's network, which absorbs volumetric
  attacks. The per-game object design means one hot game can't slow down others.
- **Room exhaustion.** Creating rooms costs the attacker rate-limited requests. Unjoined rooms are
  deleted after 24 h and cost nothing while idle.

**Kill switch.** `ONLINE_ENABLED=false` (Workers → Settings → Variables in the dashboard):
- `POST /v1/games` and `/join` return `503 unavailable`;
- running games continue;
- the page shows "Online play is paused. Play the computer meanwhile."

## 6. Web platform details

| Topic | Decision |
|---|---|
| CORS | Allow-list exact origins (`ALLOWED_ORIGINS`); no wildcard; no credentials |
| WebSocket Origin | Checked on upgrade (403 if not allowed). Stops other websites from driving a visitor's browser into our API; not treated as authentication. |
| Transport | HTTPS and WSS only (`workers.dev` has TLS); the page refuses a non-TLS `VITE_ONLINE_URL` in production builds |
| Content Security Policy | Recommended for v0.3.x: a `<meta http-equiv="Content-Security-Policy">` on the online page, with `connect-src` limited to the API origin (and Web Analytics if adopted). GitHub Pages can't send headers, so the meta tag is the only option. |
| Clickjacking | GitHub Pages can't send `frame-ancestors`. Low risk: there's nothing valuable to trick a player into clicking. |
| Error details | Internal errors return only a code and an `errorId`; stack traces stay in logs |

## 7. Fair play (anti-cheat)

**What v0.3 guarantees:**

1. **Every accepted move is legal under the engine.** Target: 100%, verified by tests and the desync
   check.
2. Only the side to move can move, once per turn.
3. Results come only from the engine (on-board endings) or from explicit, validated server-side
   transitions (resignation, agreement, claim, abort, abandonment). **No client ever reports a result.**
4. History can't be edited: the only write path is "append one legal move".
5. Nobody can act for an opponent without their token.
6. **There is no hidden information to leak.** Chess is a game of perfect information, and the server
   sends no analysis, threat or hint. The Kill Zone rulings (D-39, D-46) therefore hold online too.

**What v0.3 does not and cannot guarantee:**

- **Engine assistance.** A player can consult the site's own computer opponent in another tab (load
  the position through Scenario Lab), or any other tool. Nothing in a browser can prevent this, and the
  engine being open source doesn't change that: security never relies on hiding code. v0.3 games are
  casual and unrated, between people who invited each other, so this is accepted.
- **Stalling while connected.** Without clocks, a present player can simply never move. The opponent
  can abort before the second move, or leave. Clocks (v0.4) solve it properly; the claim rule covers
  absent players.
- Collusion and multiple accounts: irrelevant without ratings.

**Prepared now, used later.** Each move's server timestamp is stored (`moves.at`), so move-time
patterns can be analysed once ratings exist. That's when assistance detection becomes worth building:
- move-time consistency;
- agreement with the Ruthless engine;
- a report button;
- manual review.

None of it before v0.7 (ratings).

**Devtools.** The client is assumed hostile. All client-side checks (local legality, disabled buttons)
are user experience, not security.

## 8. Privacy

**Data inventory (v0.3):**

| Data | Stored by us? | Where | Retention | Purpose |
|---|---|---|---|---|
| Online game records (moves, server timestamps, results) | Yes | The game's Durable Object (Cloudflare) | 30 days after the game ends (24 h if nobody joins; 7 days idle, then 30 days) | Playing, reconnecting, the share link |
| Seat tokens | Hash only on the server; the token itself in the player's browser | Object; `localStorage` | With the game; the client prunes tokens after 30 days | Proving a seat |
| IP addresses | **Not as such.** Cloudflare processes them to deliver traffic, absorb attacks and apply rate limits; our code never logs or stores them. It keeps only the salted hashes in the next row. | Cloudflare | Cloudflare's own | Delivery, abuse prevention |
| Salted address hashes | Yes: SHA-256 of a random daily salt plus the address, used only to cap new online games per address per day | The day's `DailyCapacity` object | 48 hours (salt and hashes are deleted with the day's object) | Stop one address from using up everyone's online capacity |
| Names, emails, accounts, payment data | **None** | — | — | — |
| Cookies | **None** | — | — | — |
| `localStorage` | Existing: autosave, theme, settings, tutorial progress. New: seat tokens. | The player's device | Until cleared | Features the player asked for |
| Logs | Event lines with game ids and codes; no IPs, tokens or bodies | Workers Logs | 3 days (7 from 1 Dec 2026) [S14] | Debugging |
| Metrics | Aggregate counts, no identifiers | Workers Analytics Engine [S13] | Cloudflare's retention | Decisions about the product |
| Page analytics (approved, F6a) | Aggregate page views, referrers, countries; cookieless | Cloudflare Web Analytics | Cloudflare's own | Knowing which community posts bring visitors |
| Funnel events (approved, F6b) | Four anonymous counts (tutorial started or completed, computer or friend game started); no ids, nothing stored on the device | Workers Analytics Engine | Cloudflare's retention | Knowing whether the tutorial works |

**Consent and banners.** No cookies, no cross-site tracking, and `localStorage` used only for features
the player uses. The usual reading of EU rules exempts storage that's strictly necessary for a service
the user requested, so **no consent banner is planned**. Cookieless, aggregate page analytics are
commonly treated the same way. This is a recommendation, not legal advice. The founder may want it
checked before serious growth. The founder will revisit this along with a dedicated email (F7).

**Before the public beta, the site gets a short plain-English privacy page** (`/privacy/`, linked in
the footer). It covers:
- what's stored, from the table above;
- why, and for how long;
- that there are no accounts, ads, selling or tracking cookies;
- who processes data: GitHub (hosting), and Cloudflare (game server, metrics, page analytics);
- how to ask a question or request deletion of a game: **GitHub Issues** on the repository (F7).
  Issues are public, so the page asks people not to post personal details.

**Deletion.** Games are anonymous and expire by themselves. A deletion request ("delete game
7KQ2M-X9FTA") is handled by the founder. If requests ever arrive, a small admin endpoint protected by a
Worker secret is added (about 30 minutes of work), not before.

**Children.** Chess has young players. v0.3 has no chat and no names, and collects no personal data,
which is the safest possible position.

## 9. Secrets, accounts and supply chain

- **Cloudflare API token.** Created from the "Edit Cloudflare Workers" template, limited to the one
  account. Stored only as the GitHub Actions secret `CLOUDFLARE_API_TOKEN`. Rotate it yearly, or
  immediately if it may have leaked. It's never in the repository, logs or chat.
- **Two-factor authentication** on Cloudflare and GitHub (founder action, LAUNCH-PLAN.md §5). Losing
  the Cloudflare account would mean losing every live game.
- **Local deploys.** The founder runs `npx wrangler login` once, which stores an OAuth token in the user
  profile, outside the repository.
- **Dependencies.**
  - `wrangler` is pinned to an exact version and installed with `npm ci`.
  - No new runtime dependencies.
  - GitHub Dependabot security alerts on (the founder can check the repository's security settings).
  - The engine stays dependency-free.

## 10. Incident playbook

| Incident | First move | Then |
|---|---|---|
| Abuse flood (create or connect spam) | Kill switch on | Read logs and metrics; tighten limits, or switch on Turnstile; kill switch off |
| The capacity guard closes early, or a free quota runs out anyway | Nothing urgent: new online games reopen at 00:00 UTC; players get the computer meanwhile; games in progress resume | Check per-game usage and the caps. If it recurs, offer the founder the upgrade (LAUNCH-PLAN.md §5); staying free is acceptable. |
| A bug corrupts games or crashes rooms | Kill switch on (new games stop) | `wrangler rollback`; fix; ship a test that reproduces it; kill switch off |
| A desync alert (client and server disagree) | Treat as critical: kill switch on if it's widespread | Engine or protocol fix plus a regression test. Server history is the truth, so games are recovered by `sync`. |
| API token may have leaked | Revoke it in Cloudflare (My Profile → API Tokens) | New token into GitHub secrets |
| Cloudflare outage | Nothing to do: local and computer play are unaffected (static site) | — |
