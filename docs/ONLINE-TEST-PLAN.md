# Online test plan and launch criteria (Phase 2, Track A)

**Status: approved by the founder on 8 October 2026. Nothing here is built yet.**
Online play has more ways to fail than the local game: two clients, a network, a server that restarts
on every deploy, and a hostile internet. This plan lists what is tested, with which tools, and the
measurable bar each stage must clear. Protocol: [ONLINE-PROTOCOL.md](ONLINE-PROTOCOL.md).
Rollout: [LAUNCH-PLAN.md](LAUNCH-PLAN.md).

---

## 1. Test stack

| Layer | Tool | Runs where | When |
|---|---|---|---|
| Protocol validators, ids, limits | Vitest 5 (`node` environment), new project `online` | Node | Every push (CI) |
| RoomCore (pure room logic) | Vitest 5 with an injected fake clock | Node | Every push |
| Engine parity and restore ≡ replay | Vitest 5 property tests on the existing random-game and self-play generators | Node | Every push |
| Worker plus Durable Object integration | Vitest 5 tests driving a **locally started Worker** (wrangler's programmatic dev server, or `wrangler dev` spawned from `globalSetup`) with Node's built-in `WebSocket` client | workerd, locally; no Cloudflare account needed | Every push |
| Client connection and state reducer | Vitest 5 (`jsdom`), with a fake WebSocket | Node | Every push |
| End to end | Playwright, **two browser contexts** (two independent players), against local dev servers; later against staging | Chromium (plus WebKit for Safari behaviour) | Every push for the smoke set; full set before each stage gate |
| Load | `tools/loadtest.ts`: N scripted players over real WebSockets | Node → **staging** | Manually, before each stage gate |
| Manual | Checklist in §8 | Real phones and browsers | Before each stage gate |

**Why not `@cloudflare/vitest-plugin`?** It's the official way to run tests inside workerd, but it
requires Vitest ^4.1 [S16], and this project is on Vitest 5. Downgrading the whole test suite for one
project isn't worth it. A locally started Worker gives the same fidelity for integration tests: the
real runtime, real SQLite, real WebSockets. Re-check the plugin at M0 and switch if it supports
Vitest 5 by then.

Test-only hooks: with `ENVIRONMENT=test`, the Worker exposes `POST /__test/rooms/:id/alarm` (run the
alarm now) and `POST /__test/rooms/:id/evict` (drop in-memory state, to simulate a wake). The Worker
refuses these routes in every other environment, and a unit test asserts that.

Coverage: `src/online/**` and `server/src/room.ts` join the enforced thresholds: 95% lines, functions
and statements, 90% branches, like the engine.

## 2. Unit tests

**Protocol (`tests/online/protocol.test.ts`).** Every message type accepted with valid fields and
rejected with each invalid one:
- wrong type, missing field, out-of-range `ply`, malformed UCI or `mid`;
- extra fields ignored;
- oversized input refused before parsing;
- unknown `t` → `unknown-type`.

Game id generation, normalisation (`o`→`0`, `l`→`1`, hyphens) and rejection (`U`, wrong length).

**RoomCore (`tests/server/room.test.ts`), pure, with a fake clock:**

- Lifecycle: create, join, active, every ending (§3 of the protocol), rematch, retention deadlines.
  Each transition checks the new state, the events per seat, the rows to write, and the next alarm.
- Authorisation matrix (ONLINE-SECURITY.md §2):
  - every action from the wrong seat, an unauthenticated socket, or in the wrong status is rejected
    with the right code;
  - every allowed action succeeds.
- Ordering: `rev` increases by exactly 1 per broadcast change, and never otherwise. `state` and
  `rejected` replies carry the current `rev` without changing it.
- Idempotency: duplicate `mid` → no change and a re-sent `moved`; stale `ply` → `stale` plus `state`.
- Draw offers: limits, implicit decline by moving, and the "opponent must move first" rule after a
  decline.
- Reconnect logic: presence, `absentSince`, `claimableAt`, and the lazy liveness check:
  - a socket whose last heartbeat is 76 s old is closed;
  - a claim at 119 s is refused and at 120 s accepted.
- Alarms: waiting expiry at 24 h, idle abandonment at 7 days, deletion at 30 days. Each handler is a
  no-op when its deadline no longer applies (for example a move happened at 6 days 23 hours).
- Move limit: the 2,000th ply ends the game as `move-limit`.

**Capacity guard (`tests/server/capacity.test.ts`), pure:**
- the soft cap refuses the 81st new invite with `online-full` and the right `reopensAt`;
- joins of existing invites, and moves in running games, are never refused;
- rematches pass the soft cap but stop at the hard cap;
- the 21st game from one address is refused;
- a new UTC day reopens;
- the day's object deletes itself 48 hours after the day ends.

**Auto difficulty (`tests/ui/autoLevel.test.ts`):**
- starts at Nice;
- two wins in a row step up, and two losses in a row step down;
- draws reset the streak;
- never above Ruthless or below Nice;
- games at other levels count as described in P2-33.

## 3. Engine integration tests (server side)

| Test | How |
|---|---|
| Real Mean moves are validated | RoomCore plays scripted games, built from the standard start and verified by the engine when the fixtures are generated (`tests/server/fixtures.ts`). They end in **Royal Capture**, **Royal Slaughter**, **Royal Cannibalism** (the Fool's-mate line: 1.f3 e5 2.g4 Qh4+ and the king eats its own pawn), checkmate, stalemate, threefold and fifty-move. Each must produce the engine's result. |
| Illegal moves are rejected | Moving into an adjacent-king square; a royal move through an **enemy** piece (D-47); cannibalism when a non-suicidal escape exists; sacrificing out of tier order; sacrificing the **original queen** (D-08); a promotion without its letter; a move after the game ended. Each → `illegal-move`, with nothing written. |
| Queen origin survives storage | A game in which a pawn promotes to a queen that is later eligible for sacrifice (tier 4), checked across an eviction: `Q~` in the checkpoint MeanFEN, same legal moves after the restore. |
| **Restore ≡ replay (property)** | Over 2,000 random games (reusing the engine's random-game generator and `tools/selfplay.ts` positions), at every ply: rebuild from (checkpoint, tail) and from (start, all moves), then compare legal-move UCI sets, `outcome`, MeanFEN and the repetition count of the current key. Plus targeted fixtures: threefold repetition straddling a checkpoint, fifty-move draws, promotion then sacrifice. |
| MeanFEN round-trip | For every position reached above: `parseMeanFen(toMeanFen(p))` succeeds, with an equal `positionKey` and equal legal moves |
| Runtime parity | The integration suite plays the fixture games through the real Worker (workerd) and compares every `moved.fen` with Node's engine |
| Export | Every finished fixture game's `GET /v1/games/:id` record loads with `loadGame` and reproduces the same result |

## 4. Multiplayer integration tests (real Worker, real WebSockets)

Two (sometimes three) scripted clients against the locally started Worker:

| # | Scenario | Expected |
|---|---|---|
| 1 | Create, join, `hello` from both | Both get `state` (active); seats as chosen; the creator's random colour is truly random over many runs |
| 2 | Both players play 10 moves | Both receive identical `moved` sequences (same `rev`, `ply`, `uci`, `fen`) |
| 3 | Illegal move | Sender gets `rejected` (`illegal-move`); the opponent gets nothing; `rev` unchanged |
| 4 | Duplicate move (same `mid`) | Applied once; the sender gets the same `moved` again |
| 5 | Stale move (old `ply`) | `rejected` (`stale`) plus `state` |
| 6 | Out-of-turn move | `not-your-turn` |
| 7 | Reconnect mid-game (close socket, reopen, `hello`) | `state` equals the pre-disconnect game; the opponent sees `presence` flip twice |
| 8 | Draw offer, decline, offer again before the opponent moves, accept | Second offer refused until the opponent moves; acceptance ends the game (agreement) on both sides |
| 9 | Resignation | Both get `ended` with the right winner; further moves → `game-over` |
| 10 | Royal capture | The capturing move's `moved` carries `result` (`royal-capture`); both sides finished |
| 11 | Abort rules | Allowed at ply 0 and 1, refused at ply 2 |
| 12 | Claim | Opponent closes all sockets; claim at <120 s refused, ≥120 s accepted (fake time via the test hook) |
| 13 | Rematch | Offer plus accept → both get `next` with colours swapped; both connect to the new game with their old tokens; the new game starts at ply 0 |
| 14 | Third party | A third client with no token: `hello` → close 4401. `join` on a full game → 409 `game-full`. |
| 15 | Two tabs of one seat | Both receive events; a move from either applies once; a fourth socket closes the oldest (4409) |
| 16 | Join retry | Same `joinNonce` → same seat, fresh token; the old token stops working |
| 17 | Finished game view | `GET /v1/games/:id` returns the SavedGame record; it loads with `loadGame` |
| 18 | Capacity guard | With the soft cap set to 2 in the test environment, the third create gets 503 `online-full` with `reopensAt`. The two games already created can still be joined and played to the end. |

## 5. Failure tests

| Failure | How it's produced | Expected |
|---|---|---|
| Player disconnects without a close frame | Kill the client socket abruptly | The lazy liveness check marks the seat absent after 75 s of silent heartbeat (fake time); a claim becomes possible at 120 s |
| Server restart | Dispose and restart the local Worker with persistent local storage | Clients reconnect; `state` is identical; play continues; no lost or duplicated moves |
| Eviction (memory lost) | `/__test/rooms/:id/evict` | The next move restores from (checkpoint, tail); results identical (also covered by the property test) |
| Stale socket | Keep an old socket open after reconnecting | Events on both are consistent; duplicates ignored by `rev` |
| Duplicate packet | Send the identical `move` twice | Applied once |
| Out-of-order or missing event | Client reducer test: deliver `rev` 5 then 7 | Client sends `sync`, rebuilds from `state` |
| Malformed requests | Invalid JSON, wrong types, binary frames, 3 KB frames, unknown types | 400 / `rejected` / close 1009 as specified; the room is unaffected |
| Flood | 100 messages in one second on one socket | Close 1008; other sockets and games unaffected |
| Rate limits | Creates beyond the limit from one client | 429 with `Retry-After` (whether the binding works locally is checked at M0; otherwise tested on staging) |
| Room expiry | Alarm hook on a waiting room older than 24 h | Rows deleted; `GET` → 404; `hello` → 4404 |
| Quota or kill switch | `ONLINE_ENABLED=false` | 503 on create and join; running games continue |
| Version mismatch | `hello` with protocol 0, or `rules: "0.2"` | `unsupported-protocol` / `rules-mismatch`, then close |
| Desync detector | Feed the client a `moved` whose `fen` is wrong | Client reports `desync` and resyncs (test-only fault injection) |

## 6. End-to-end browser tests (Playwright, two contexts)

Each test opens **two independent browser contexts**: two players, with separate storage.

1. **Full game:** Alice creates (White), copies the link; Bob opens it, sees the quick rules, clicks
   **Join**. They play a scripted line to a **Royal Slaughter** by clicking squares. Both pages show the
   same result; the move lists match; no console errors in either context.
2. **Refresh mid-game:** Bob reloads at move 6; the board, move list and turn are identical; play
   continues.
3. **Network loss:** `context.setOffline(true)` for 8 s on Alice. "Reconnecting…" appears; then she is
   back online, resyncs, and her move made before going offline was either confirmed or re-sent, never
   lost or duplicated.
4. **Opponent leaves:** Bob closes his page; Alice sees "Opponent left", and after the (shortened, test
   configuration) delay, **Claim win** works.
5. **Rematch:** after the result, both click **Rematch**; the new game opens with colours swapped.
6. **Phone layout:** 375×812, both players: no horizontal scroll; the invite and join screens fit;
   every theme.
7. **No Kill Zone leakage:** while a royal move is available to Bob, his page shows nothing special,
   and Alice's page shows no warning when she steps into the Kill Zone (D-39, D-46). The same assertions
   as the existing `tests/ui/play.test.tsx`.
8. **Online full:** with the test caps at their limit, Alice clicks **Create a game** and sees the
   "full for today" panel with **Play the computer**. No error text appears anywhere. The computer game
   opens at her Auto level and is labelled as the computer.
9. **Server lost mid-game:** block the API in Bob's context for 35 s. The banner offers **Keep
   waiting** and **Finish this position against the computer**. The second opens the local board at
   exactly the same position, against the labelled computer. When the block lifts, the online game
   resumes for whoever returns to it.

## 7. Load tests (`tools/loadtest.ts`, against staging)

Each simulated game is two WebSocket clients choosing random legal moves with the engine. It checks
every `moved.fen` and records round-trip times.

| Test | Load | Pass when |
|---|---|---|
| Steady play | 50 concurrent games (100 sockets), one move per second each, for 5 minutes | 0 desyncs; 0 illegal moves accepted; 0 lost or duplicated moves; server processing p95 ≤ 20 ms; round trip p95 ≤ 400 ms from the founder's region; unexpected closes < 0.5% of sockets |
| Idle rooms | 200 games with sockets open, one move per minute, for 10 minutes | Objects hibernate between moves (duration in the dashboard ≈ the model in ONLINE-ARCHITECTURE.md §8); 0 errors |
| Deploy during play | Steady play, then `wrangler deploy --env staging` mid-run | Every client reconnects within 5 s; 0 lost moves; 0 desyncs |
| Creation burst | 100 creates in 10 s from one machine | Rate limits engage as configured; no errors other than 429 |

Budget check: the steady test uses about 2,000 GB-s and under 1,000 requests, a fraction of one day's
Free quota [S1].

## 8. Manual checklist (before the alpha and the beta)

- Two real devices on **different networks** (home Wi-Fi and a phone on mobile data): create, join,
  play to the end, rematch.
- Browsers: Chrome (desktop and Android), Safari (macOS and iOS), Firefox, Edge.
- Phone locked for 2 minutes mid-game, then unlocked: resumes.
- Switch Wi-Fi to mobile data mid-game: resumes.
- Close the tab, reopen from history: resumes.
- Invite link pasted into WhatsApp or Discord: the preview appears and **does not claim the seat**.
- The share sheet on iOS and Android.
- All four themes on the online page; reduced motion respected.
- Screen reader smoke test: moves announced as in local play; nothing announces Kill Zone or royal
  opportunities.

## 9. CI integration

| Job step | Contents |
|---|---|
| `npm run lint`, `npm run typecheck` | Plus the `server/` project and the new lint boundaries |
| `npm run test:coverage` | Engine, AI, UI, plus the new `online` project, with the extended thresholds |
| `npm run test:server` | Starts the Worker locally and runs §4–§5 |
| `npm run test:e2e:smoke` | Playwright test 1 only, headless Chromium |
| Full E2E, load tests | Manually before stage gates (they need staging and take longer) |

## 10. v0.3 launch criteria (measurable)

v0.3.0 is "stable" only when every line holds. A browser merely connecting doesn't count.

| # | Criterion | Measured by | Bar |
|---|---|---|---|
| 1 | Remote players can create, join and finish | Alpha runs on different networks | **10 of 10** attempts succeed |
| 2 | Move latency | Analytics Engine: server processing, and client round trip from `stats` | Server p95 ≤ 20 ms; round trip p50 ≤ 200 ms and p95 ≤ 500 ms |
| 3 | Server-accepted moves are legal | Tests in §3–§5, plus the desync metric | 100% (no illegal move accepted, ever) |
| 4 | Survives refresh | Manual and E2E test 2 | 20 of 20 refreshes |
| 5 | Reconnect restores the exact state | Integration test 7, failure tests, E2E 3 | All pass; **0 desyncs** reported in alpha |
| 6 | Royal Capture, Royal Slaughter, Royal Cannibalism online | Integration and E2E fixtures | All pass, and each occurs at least once in alpha play |
| 7 | No game ends differently on the two clients | Server-decided results; E2E assertions; desync metric | 0 occurrences |
| 8 | No critical console errors | Playwright console capture; alpha reports | 0 |
| 9 | No critical backend errors | Logs: `internal` errors | 0 in the final 7 days of the beta |
| 10 | Load test | §7 | All four tests pass on staging |
| 11 | Deploys don't hurt games | §7 deploy test, plus at least one real production deploy during the beta | 0 lost moves |
| 12 | Security checks | §4 #14, §5 (floods, malformed, limits, unauthenticated) | All pass |
| 13 | No free quota ever runs out | Cloudflare dashboard; capacity-guard metrics | 0 days on which a quota ran out (the guard closes first). The guard closed on fewer than 2 days a week, or the founder has decided about upgrading. |
| 14 | Founder sign-off | Founder plays at least 3 full online games, one on a phone | Yes |
| 15 | Players never see a raw error | E2E tests 8–9; manual checklist; alpha reports | Every failure shows a friendly state with a next step: wait, retry, or play the computer |
