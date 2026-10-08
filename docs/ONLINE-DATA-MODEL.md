# Online data model and persistence (Phase 2, Track A)

**Status: approved by the founder on 8 October 2026. Nothing here is built yet.**
How an online game is stored, restored, retained and deleted. Messages: [ONLINE-PROTOCOL.md](ONLINE-PROTOCOL.md).
Architecture: [ONLINE-ARCHITECTURE.md](ONLINE-ARCHITECTURE.md). Sources: [PHASE-2-SOURCES.md](PHASE-2-SOURCES.md).

---

## 1. What v0.3 stores, and where

| Option | What it means | Consequence |
|---|---|---|
| No persistence | Rooms in memory only | A refresh survives, but an eviction or deploy kills every game. **Rejected.** |
| Ephemeral room state | In memory, plus the socket attachments | The same; Cloudflare evicts idle objects [S3] and deploys restart them [S4]. **Rejected.** |
| **Durable per-game state** | **SQLite inside each game's Durable Object** | Survives refresh, outages, restarts, evictions, deploys and rollbacks. **Chosen** (P2-04). |
| Cross-game history | A central database of all games and players | Needs identities, which v0.3 doesn't have. **Deferred** to accounts (v0.6), probably D1 [S15]. |

**Why a room object instead of a conventional database.** A game has exactly one writer: its room.
Nothing in v0.3 queries across games: no lobby, no history, no leaderboard. Keeping each game's rows
inside its own object puts storage in the same single-threaded process as the logic. Validation and
writes then happen in one atomic step, and nobody is told about a move before it's saved [S5][S19].
There's no connection pool, schema server or network hop to a database, and nothing to pay for when
idle. The cost of this choice: questions like "how many games were played this week?" are answered by
metrics (Analytics Engine), not SQL. That's acceptable until the lobby and history need a shared table.

## 2. Schema (per game object)

```sql
-- Storage bookkeeping
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL                -- 'schema_version' → '1'
);

-- Exactly one row: the game
CREATE TABLE IF NOT EXISTS game (
  id                TEXT PRIMARY KEY,           -- game id, 10 chars Crockford base32 (also the room code)
  protocol          INTEGER NOT NULL,           -- protocol version at creation (1)
  rules             TEXT NOT NULL,              -- RULES_VERSION at creation ('0.1')
  status            TEXT NOT NULL,              -- 'waiting' | 'active' | 'finished'
  creator_color     TEXT NOT NULL,              -- 'white' | 'black'
  white_token_hash  TEXT,                       -- hex SHA-256 of the seat token; NULL = seat open
  black_token_hash  TEXT,
  join_nonce        TEXT,                       -- last successful join attempt (idempotent retries)
  start_fen         TEXT NOT NULL,              -- MeanFEN; START_MEAN_FEN in v0.3
  current_fen       TEXT NOT NULL,              -- MeanFEN after the last move (consistency check, quick reads)
  checkpoint_fen    TEXT NOT NULL,              -- MeanFEN after the last irreversible move (or the start)
  checkpoint_ply    INTEGER NOT NULL,           -- moves played at that checkpoint
  ply               INTEGER NOT NULL,           -- moves played = rows in `moves`
  rev               INTEGER NOT NULL,           -- event revision (+1 per broadcast state change)
  draw_offer        TEXT,                       -- 'white' | 'black' | NULL
  draw_offers_white INTEGER NOT NULL DEFAULT 0,
  draw_offers_black INTEGER NOT NULL DEFAULT 0,
  rematch_offer     TEXT,                       -- 'white' | 'black' | NULL
  rematch_offers_white INTEGER NOT NULL DEFAULT 0,
  rematch_offers_black INTEGER NOT NULL DEFAULT 0,
  rematch_game_id   TEXT,                       -- set once a rematch exists
  white_absent_since INTEGER,                   -- epoch ms; NULL while present (or never connected)
  black_absent_since INTEGER,
  result_winner     TEXT,                       -- 'white' | 'black' | NULL (draw, abort or none)
  result_reason     TEXT,                       -- EndReason (ONLINE-PROTOCOL.md §7); NULL while open
  created_at        INTEGER NOT NULL,           -- epoch ms (server clock)
  started_at        INTEGER,                    -- second seat claimed
  last_move_at      INTEGER,
  updated_at        INTEGER NOT NULL,
  finished_at       INTEGER,
  expires_at        INTEGER NOT NULL            -- the next retention deadline; mirrors the alarm
);

-- The authoritative history
CREATE TABLE IF NOT EXISTS moves (
  ply    INTEGER PRIMARY KEY,                   -- 0-based move index
  uci    TEXT NOT NULL,                         -- coordinate notation, as in saved games
  color  TEXT NOT NULL,                         -- who moved
  mid    TEXT NOT NULL,                         -- client move id (idempotency)
  at     INTEGER NOT NULL                       -- server time, epoch ms
);
```

How each item in the brief maps to the schema:

| Brief item | Where |
|---|---|
| Game id, room code | `game.id`; the code is the id, shown as `7KQ2M-X9FTA` |
| Player 1, player 2, colours | `creator_color`; seats are `white_token_hash` and `black_token_hash`. No names in v0.3. |
| Spectator policy | No live spectators in v0.3; a finished game is readable by anyone with the link until deletion |
| Starting MeanFEN | `start_fen` |
| Current state | `current_fen` (plus `checkpoint_*` for restore) and `status` |
| Move history | `moves` |
| Current turn | Derived: the side to move in `current_fen` |
| Clocks | Not in v0.3. v0.4 adds `clock_initial_ms`, `clock_increment_ms`, `white_ms`, `black_ms`, `turn_started_at` in an additive migration (ONLINE-PROTOCOL.md §10). |
| Connection state | Live: the object's authenticated sockets per seat (these survive hibernation [S4]). Persisted: `*_absent_since`, so absence survives eviction. |
| Last activity | `last_move_at`, `updated_at` |
| Result, termination reason | `result_winner`, `result_reason` |
| `created_at`, `updated_at` | as named |
| Version, sequence, server revision | `rev` (events), `ply` (moves), `meta.schema_version` (storage) |
| Expiry (TTL) | `expires_at` plus the object's alarm (§6) |

Socket attachment (via `serializeAttachment`, which survives hibernation [S4]):
`{ seat: 'white' | 'black' | null, connectedAt: number }`. The per-socket rate-limit bucket is kept in
memory only. A socket that hibernated was idle for 10 s or more, so its bucket would be full anyway.

### The daily capacity counter (one small object per UTC day)

The capacity guard (ONLINE-ARCHITECTURE.md §8, P2-31) keeps one `DailyCapacity` Durable Object per UTC
date, named `YYYY-MM-DD`:

```sql
CREATE TABLE IF NOT EXISTS day (
  date     TEXT PRIMARY KEY,   -- 'YYYY-MM-DD' (UTC)
  created  INTEGER NOT NULL,   -- new games created today (soft cap)
  started  INTEGER NOT NULL,   -- games created today plus rematches (hard cap)
  salt     TEXT NOT NULL       -- random, generated for this day only
);
CREATE TABLE IF NOT EXISTS addresses (
  hash     TEXT PRIMARY KEY,   -- SHA-256(salt + client address); never the address itself
  created  INTEGER NOT NULL    -- new games from this address today (per-address cap)
);
```

Its alarm deletes the whole object (`deleteAll()`), salt and hashes included, 48 hours after the day
ends.

## 3. History, snapshots, or both? Both, with different jobs

- **The move list is the truth.** `start_fen` plus `moves` rebuilds the complete game, deterministically,
  with the engine's own replay (`loadGame`, D-24). Exports, the finished-game view and any audit use the
  full history.
- **The checkpoint bounds work on wake.** `checkpoint_fen` is the position right after the last
  *irreversible* move: one that resets the halfmove clock (a pawn move, a capture, or a cannibalism
  move, D-14). It's rewritten with every such move. So it's a snapshot taken after every irreversible
  move, and never more than 100 plies behind, because the fifty-move rule ends the game at 100.
- **`current_fen`** is written with every move: a cheap consistency check after a restore, and a quick
  answer for status reads.

## 4. Restoring a game after hibernation or eviction

The constructor runs again whenever the object wakes [S3]. The Durable Objects FAQ says objects "have the
same per invocation CPU limits as any Workers do", which is 10 ms on the Free plan [S2][S9]. A full
replay of a 300-ply game takes 22 ms [M1]. So **replay must be bounded**:

```
constructor:  ctx.blockConcurrencyWhile(() => migrate())        // tiny: reads one meta row

first command that needs the game (lazily):
  row  = SELECT … FROM game
  tail = SELECT uci FROM moves WHERE ply >= row.checkpoint_ply ORDER BY ply
  g    = newGame(parseMeanFen(row.checkpoint_fen).position)      // the engine's public API, unchanged
  for uci of tail: g = play(g, uci)                               // ≤ 99 plies ≈ ≤ 9 ms, usually < 2 ms
  check toMeanFen(currentPosition(g)) === row.current_fen         // else: full replay from start_fen, log `restore_mismatch`
  this.game = g
```

While the object is awake, it keeps exactly the same shape. After an irreversible move it re-bases its
in-memory record on the new position (`this.game = newGame(currentPosition(next))`). An awake room and a
restored room therefore run the same code path, and can't disagree.

**Why the tail gives the same results as the full game.** For any position after the checkpoint:
- **Legal moves** depend only on the position. The checkpoint MeanFEN carries everything that matters:
  placement, queen origin (`Q~`), side to move, castling rights, en passant and the halfmove clock.
  Piece ids aren't hashed and don't affect legality (D-18, D-19).
- **The royal ending** depends only on the last move.
- **Checkmate and stalemate** depend on the position.
- **The fifty-move rule** uses the halfmove clock, which is in the position.
- **Threefold repetition** counts equal keys. No position before an irreversible move can ever recur
  after it: captures and cannibalism remove material for good, and pawns only move forward. So the keys
  dropped with the old history can never match a later one, and the counts are identical.

**Proved by tests, not just argued** (ONLINE-TEST-PLAN.md §3):
1. Over thousands of random games (the existing self-play and random-game generators), at every ply,
   restoring from (checkpoint, tail) gives the same legal moves (UCI sets), outcome, MeanFEN and
   repetition count as the full record.
2. `parseMeanFen(toMeanFen(p))` round-trips every reachable position: equal `positionKey` and legal
   moves, and `validatePosition` accepts it.
3. Fixture games end in threefold repetition across a checkpoint, in the fifty-move rule, in all royal
   endings, and in promoted-queen sacrifices.

If the M0 spike shows the Free plan really enforces 10 ms on objects and even bounded restores come
close, the free fix is a **zero-replay resume**. With every move, also store the repetition keys since
the last irreversible move (at most 100 short strings, from the engine's `positionKey`). A sleeping game
then resumes straight from `current_fen` and those keys, with no replay at all. That needs either a
small, tested addition to the engine's public API (a `resumeGame(position, keys)` helper) or building
the record in RoomCore. The spike decides which, and the founder hears about it before the engine is
touched. The Workers Paid plan (30 s by default [S9]) is only a last resort, and only with the
founder's agreement: the founder is cost-sensitive, so free fixes come first (F5).

## 5. What survives what

| Event | Survives? | Why |
|---|---|---|
| Browser refresh | Yes | The seat token is in `localStorage`; the game is on the server |
| Short network outage | Yes | Reconnect plus `state` snapshot (ONLINE-PROTOCOL.md §8) |
| Object hibernation (10 s idle) | Yes | Sockets stay connected; memory is rebuilt lazily from SQLite |
| Object eviction or crash | Yes | Same; in-memory state is never the only copy [S5] |
| Backend redeploy | Yes, with a 1–3 s reconnect | Deploys close sockets [S4]; storage is untouched |
| Backend rollback | Yes | Schema changes are additive only (§7) |
| A free quota running out | **Prevented** by the capacity guard (ONLINE-ARCHITECTURE.md §8). If it happened anyway, stored games survive, and players can keep waiting or finish against the computer | Operations fail, but data isn't lost [S1][S6] |
| Player clears site data or changes device | The game survives; **that player loses their seat** | No accounts in v0.3 (ONLINE-PROTOCOL.md §8.3) |
| 30 days after finishing | **No: deleted** | Retention (§6) |

## 6. Retention, expiry and deletion

Each object has one alarm, always set to `expires_at`. Every handler that changes `status` recomputes
`expires_at` and calls `setAlarm`. The alarm handler re-reads the state and acts only if the deadline
still applies, so it's idempotent.

| Status | `expires_at` | When it fires |
|---|---|---|
| waiting | `created_at + 24 h` | Still waiting: `deleteAll()` (game gone; the link shows "not found") |
| active | `max(last_move_at, last presence change) + 7 days` | Nothing happened since: finish as `abandoned`, then set the 30-day deletion deadline |
| finished | `finished_at + 30 days` | `deleteAll()`, which removes the rows and the alarm |

Retention summary (also in [ONLINE-SECURITY.md](ONLINE-SECURITY.md) §8):
- unjoined invites: 24 hours;
- finished games: 30 days, readable by link meanwhile;
- untouched open games: closed after 7 days, deleted 30 days later;
- logs: Cloudflare's retention, 3 days now and 7 days from 1 Dec 2026 [S14];
- metrics: aggregate counters with no game ids;
- daily capacity counters, including salted address hashes: 48 hours.

## 7. Migrations

- `meta.schema_version` starts at 1. `migrate()` runs in the constructor under `blockConcurrencyWhile`
  [S5], applying each step from the stored version to the current one inside one transaction.
- **Additive only:** new tables, or new columns with defaults. Nothing is renamed or dropped until at
  least two releases later. Old code ignores new columns, which keeps `wrangler rollback` safe.
- An object that never wakes is never migrated. That's fine: it will be deleted by its own alarm.
- Class-level changes (a new Durable Object class) use wrangler's `migrations` list. v0.3 has one
  class, `GameRoom`, created with `new_sqlite_classes` [S8].

## 8. Sizes and limits

| Item | Size | Limit |
|---|---|---|
| A game row | < 1 KB | 2 MB per row [S2] |
| A move row | ~40 bytes | — |
| A 300-ply game | ~12 KB of rows; the SavedGame export is 2.2 KB [M1] | 10 GB per object (1 GB according to an older Free-plan FAQ line) [S2] |
| All games (100,000 per month, 30-day retention) | ~1 GB | 5 GB free [S1] |
| The `state` snapshot sent on reconnect | ≤ ~3 KB at 300 plies | 32 MiB per message [S2] |

## 9. Exports and the finished-game view

`GET /v1/games/:id` for a finished game returns the standard SavedGame v1 record:

```json
{ "format": "mean-chess-game", "version": 1, "rules": "0.1", "start": "<start_fen>",
  "moves": ["e2e4", "…"], "result": { "kind": "royal-slaughter", "winner": "black" } }
```

plus `{ "reason": "<EndReason>", "finishedAt": … }` for the online-only endings, which SavedGame's
`Outcome` doesn't cover. The page loads it with the existing `loadGame`, which replays and validates
every move. The game then appears read-only on the board, with the move list and the existing replay
controls, and an "Open in Scenario Lab" action. That's the "share this game" feature, built from parts
that already exist.

## 10. Later: data that spans games

These arrive with the versions that need them. Each needs its own design note at the time.

| Version | Need | Likely store |
|---|---|---|
| v0.5 lobby, quick match | A list of open challenges | One `Lobby` Durable Object (shard by time control if it ever gets hot) |
| v0.6 accounts, history | Players, game index by player | D1 [S15]. Each room writes a finished-game summary once, at the end. |
| v0.7 ratings | Ratings, rating history | D1, updated by the finishing room, with a per-player update order |

v0.3 writes nothing central, so there's nothing to migrate later. Old v0.3 games simply never appear in
a v0.6 history.
