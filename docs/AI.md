# The computer opponent

`src/ai` is Mean Chess's computer opponent. Like the rules engine it is pure TypeScript with no
React, DOM, clock or randomness of its own (ESLint enforces this): the caller passes a millisecond
clock and a seed, so any search can be replayed exactly. In the browser it runs in a Web Worker
(`src/workers/computer.worker.ts`), so the page never freezes while it thinks.

The rules engine stays the only authority on the rules. The computer proposes a move in coordinate
notation, and the game plays it through the engine's `play()`, which rejects anything illegal.

## Why it has its own board

The engine favours clarity: immutable positions, piece objects, a new board per move. That gives
about 45,000 positions a second, enough for rules but too slow for search. `board.ts` implements
the same rules for speed:

- Pieces are small integers in a `Uint8Array`, and moves are integers: from, to, kind, promotion.
- Make/unmake replace new objects, with an undo stack in typed arrays.
- Zobrist hashing is incremental: two 32-bit halves, seeded, so every run hashes alike.
- Material and piece-square scores are kept incrementally for the middlegame and endgame, plus the
  game phase.
- Legality is checked by changing only the squares. A full make/unmake is used only to test for
  desperation, which can happen only in check.
- Royal moves are generated but never made: they end the game.

It reaches about 3 million perft leaves a second.

**It is proven equal to the engine** (`tests/ai/board.test.ts`):

- **Perft:** it matches every standard perft value, and the Mean-specific values predicted before
  either board existed (for example, start position perft(5) = 4,865,625).
- **Random games:** 240 seeded games from 30+ start positions, including every Scenario Lab
  position. At every position (over 20,000) the two boards agree on:
  - the legal moves;
  - check;
  - royal moves;
  - the full state, against a fresh conversion;
  - the incremental hash, against one recomputed from scratch.

  Make then unmake must restore everything exactly.

## The search

`search.ts`: iterative deepening, negamax alpha-beta with principal variation search, a
transposition table, and quiescence search.

- **A royal move available is a win** (score `WIN − ply`), checked before anything else. Moves are
  never flagged as suicidal: after one, the opponent's node simply finds its royal move and wins.
  That is all the Kill Zone needs.
- **Checks and royal threats** (the opponent could capture the king if it were their turn) extend
  the search by a ply. In quiescence both are answered with every legal move, up to 4 plies deep.
- **Cannibalism** arrives through the legal move generator whenever the king is desperate.
- **Draws:** the fifty-move rule and any repetition score 0. A checkmate on the hundredth half-move
  still wins, as in Rules §2.6.
- **Move ordering:** transposition-table move first, then captures (most valuable victim, least
  valuable attacker), queen promotions, two killer moves per ply, cannibalism, and the history
  heuristic.
- **Pruning:** late move reductions, and null-move pruning. Null moves are only tried with the
  kings more than 4 squares apart (royal tactics are full of zugzwang) and with pieces besides
  pawns on the board.
- **Time:** the first iteration always completes. The search then stops at the deadline and keeps
  the last completed iteration's move, and it does not start an iteration once half the time is
  spent.

## The evaluation

`evaluate.ts` and `weights.ts`, in centipawns from the side to move's view:

- **Material.** The original queen is worth 960 and a promoted one 940, since only the original is
  never sacrificable.
- **Piece-square tables,** blended by game phase. They follow Tomasz Michniewski's *Simplified
  Evaluation Function* (Chess Programming Wiki), with Mean Chess's own pawn tables.
- **Pawn structure:** doubled, isolated and passed pawns.
- **Pieces:** the bishop pair, and rooks on open and half-open files.
- **Winning endgames:** a push of the losing king towards the edge, and of the kings together.
  Mean Chess has no insufficient-material draws: a cornered king soon has only suicidal moves.
- **Tempo:** a small bonus for the side to move.

The evaluation is tested for symmetry: mirroring a position and swapping colours gives the same
score.

## Levels

`levels.ts`:

| Level | Depth | Time | Character |
|---|---|---|---|
| Nice (easy) | 2 plies | 0.5 s | Picks among good-enough moves with ±120 of noise. On 35% of its moves it is "blind": it neither sees nor fears royal moves, like a beginner missing the Kill Zone. |
| Mean (medium) | 4 plies | 1.2 s | Picks among moves within 12 of the best, plus ±20 of noise. Always sees the Kill Zone. |
| Ruthless (hard) | up to 40 plies | 2 s | Plays its best move. Reaches 7–10 plies in the middlegame on a desktop. |

"Nice" and "Mean" score every root move exactly before choosing, so their randomness never picks a
blunder by accident. Forced wins and losses are never blurred.

`npm run selfplay -- ruthless mean 10` plays games between two levels for tuning. On the
development machine, with short time limits:

- Ruthless beat Mean 3 of 4.
- Mean beat Nice 4 of 4, including a Royal Capture and a cannibalism escape.

### Auto (D-50)

**Auto** isn't a fourth strength. It picks one of the three for each game, from the player's results
on this device (`src/app/autoLevel.ts`, stored as `mean-chess:skill:v1`):
- It starts at Nice.
- Two wins in a row at the current level or above move it up; two losses in a row at the current
  level or below move it down; a draw resets the count.
- A finished game counts only when the next game starts (or a position is loaded), so Undo can still
  take a result back. A game abandoned for a new one never counts, and neither do tutorial games.

Auto is the default in the New game dialog for anyone who hasn't chosen a level. The result dialog
says when the next Auto game changes level.

## In the app

- `src/app/computer.ts` is the client. It sends `{ start, moves, level, seed }` to the worker and
  waits for a reply in coordinate notation. Requests are cancellable: undo or a new game terminates
  a busy worker, and a fresh one starts on demand.
- Without module workers (and in tests) an in-page client loads the AI on first use. In browsers
  it gets a small budget.
- The play page asks for a move whenever it is the computer's turn. It plays the reply only if the
  game has not moved on. A reply never appears sooner than 450 ms, so the computer seems to think.
- **Undo** takes back the computer's reply together with the player's move. **Resign** always
  resigns for the player.
- **Draw offers** are accepted only if the computer judges itself at least 1.5 pawns down, or
  nothing but the kings is left.
- Loading a scenario switches to a game between friends.
- The opponent is saved with the game, so a reload resumes it.
- The board never reveals the Kill Zone to the player (D-39). The computer, of course, sees it.

## Testing

`npm test` runs everything; the AI suite alone is `npx vitest run --project ai`.

- **`tests/ai/board.test.ts`:** perft, the random-game comparison with the engine, null moves,
  repetition and long games.
- **`tests/ai/search.test.ts`:**
  - Royal Capture and Royal Slaughter, never walking into the Kill Zone, and escaping a Slaughter
    threat.
  - Cannibalism, mate, material, and blind mode.
  - The fifty-move rule, and reproducibility.
  - Every level in every Scenario Lab position.
  - Draw offers, and evaluation symmetry.
  - Self-play games validated move by move by the engine.
- **`tests/ui/computer.test.tsx` and `tests/ui/gameState.test.ts`:** the play page against the
  computer, and the game-state rules behind it.

Coverage thresholds for `src/ai` are 95% of lines, functions and statements, and 75% of branches.
Its typed-array reads carry `?? 0` guards that strict index checking requires but that never fire.
