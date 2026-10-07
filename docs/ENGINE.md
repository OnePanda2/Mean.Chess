# The Mean Chess engine

`src/engine` is a pure, deterministic TypeScript rules engine. It has no React, DOM, randomness or
clock (ESLint enforces this), so the same code can later run in a Web Worker for an AI or on a
server that validates online games. Everything outside the engine imports from
`src/engine/index.ts` only.

The rules it implements are in [RULES.md](RULES.md).

## Modules

| Module | Responsibility |
|---|---|
| `types.ts` | `Piece`, `Position`, `Move`, `MoveKind`, `CastlingRights`, … |
| `squares.ts` | Square indexing (0 = a1 … 63 = h8), names, Chebyshev distance |
| `tables.ts` | Precomputed knight, king, pawn-attack and ray tables, and `ROYAL_LINES`: every square at royal distance with its midpoint |
| `board.ts` | `pieceAt`, `findKing` |
| `attacks.ts` | `isSquareAttacked`, `isInCheck`. Standard geometry: royal reach is never an attack |
| `movement.ts` | Pseudo-legal ordinary moves. Never generates a capture of a king |
| `castling.ts` | Castling generation and castling-rights bookkeeping |
| `apply.ts` | `applyMove`, `boardAfter`, `promote`. Pure: always returns new objects |
| `hierarchy.ts` | Sacrifice tiers: `tierOf`, `activeTier`, `isEligible` |
| `royalCapture.ts` | `royalMove`, `blockedRoyal`, `royalReach` |
| `cannibalism.ts` | Royal Cannibalism moves (the caller decides desperation) |
| `legalMoves.ts` | The legal-move formula, `moveLayers`, suicidal flags |
| `analysis.ts` | `analyze` (everything the UI needs about a position) and player-facing explanations |
| `meanFen.ts` | MeanFEN parsing (strict validation, readable errors) and serialisation |
| `hashing.ts` | `positionKey` for repetition |
| `notation.ts` | Coordinate notation (`toUci`) and Mean Chess Notation (`toMcn`) |
| `game.ts` | `GameRecord`: play, undo, resign, agree draw, outcomes in priority order |
| `serialization.ts` | Saved-game JSON: export, and import by validated replay |
| `perft.ts` | `perft`, `perftDivide`, `perftDetailed` |

## Data model

- **Board:** 64 entries, `Piece | null`, indexed a1 = 0 … h8 = 63.
- **Piece:** `{ id, color, type, queenOrigin? }`. Ids are assigned when a position is created
  (`wP@e2` is the pawn that started on e2) and survive moves and promotion, so the UI can animate
  pieces by id. Ids never affect rules or hashing.
- **Queen origin:** only queens carry `queenOrigin: 'original' | 'promoted'`. A pawn promoted to a
  queen becomes `promoted`. Origin survives moves, undo, MeanFEN, saved games and repetition keys.
- **Position:** board, side to move, castling rights, en-passant square, halfmove clock, fullmove
  number. There is no history and no `hasMoved` flag: castling rights and pawn ranks carry
  everything that matters, so nothing outside the hash can change legality.
- **Move:** `kind` (`normal`, `capture`, `en-passant`, `castle-kingside`, `castle-queenside`,
  `self-capture`, `royal-capture`, `royal-slaughter`), `from`, `to`, the moving `piece`, and
  optionally `promotion`, `captured`, `sacrificed`, `sacrificeSquare` and `suicidal`.

## Legal moves

```
legal(P) = royal(P) ∪ ordinary(P) ∪ (desperate(P) ? cannibalism(P) : ∅)
```

1. **Royal move** (`royalMove`): look up whether the enemy king is on one of the at most 8 royal
   lines from our king. Midpoint empty → Royal Capture; midpoint is our own eligible piece → Royal
   Slaughter; anything else → none. There is at most one royal move.
2. **Ordinary moves** (`ordinaryLegalMoves`): standard pseudo-legal generation, then a king-safety
   filter (apply the move, then check our king is not attacked). These are exactly the legal moves
   of standard chess.
3. **Suicidal flags** (`markSuicidal`): an ordinary or cannibalism move is suicidal when, after it,
   the opponent has a royal move. This is skipped when the kings are more than 4 squares apart:
   one move changes their distance by at most 2 (castling), and a royal move needs exactly 2.
4. **Desperation:** in check, no royal move, and every ordinary move suicidal (or none).
5. **Cannibalism** (only when desperate): the king steps onto an adjacent own piece of the active
   tier, if it is not in check afterwards.

**Outcome order** (`game.ts`): a royal move ends the game; then no legal moves means checkmate or
stalemate; then the fifty-move rule; then threefold repetition. Resignation and agreement are
recorded on the game record, not derived from the position.

## Formats

- **MeanFEN:** FEN plus `Q~` / `q~` for a promoted queen. A queen without `~` is original.
  `parseMeanFen` rejects malformed input and illegal positions with readable messages: wrong king
  count, adjacent kings, pawns on the back ranks, more than one original queen per side, the side
  not to move in check, inconsistent castling rights or en-passant square.
- **Coordinate moves:** `e2e4`, `e7e8q`, `h1f3`.
- **Saved game (v1):** `{ format: 'mean-chess-game', version: 1, rules, start, moves, result }`.
  Loading replays every move through the engine and recomputes the result. Endings that are not
  moves (resignation, agreement) are restored only if the game is still open. Input is size-capped
  (64 KB, 2,000 moves).
- **Repetition key:** placement (with `~`) + side + castling + en-passant square only if an
  en-passant capture is legal.

## Testing

Run `npm test` (all) or `npx vitest run --project engine`.

- **Rule suites:** one file per rule area under `tests/engine/`, including the handoff's §43–45
  acceptance scenarios (`acceptance.test.ts`) and the verified position catalogue.
- **Differential oracle:** `differential.test.ts` plays ~20,000 seeded random-game positions and
  checks our *ordinary* moves equal chess.js's legal moves in every one. Mean only ever *adds* moves.
- **Perft:** published standard values for six positions at depths where Mean equals standard, and
  Mean values where it diverges, predicted independently before the engine existed
  (`tools/research/perft_safety.mjs`). Examples: start position perft(5) = 4,865,625 (standard:
  4,865,609; the 8 fool's-mate lines each gain two cannibalism escapes); position 4 perft(4) =
  422,373.
- **Invariants:** 150 seeded random Mean games (about 43,000 moves, including royal moves and
  cannibalism). After every move: valid position, kings never adjacent, the side that moved never in
  check, active tiers never decrease, original queens never increase, MeanFEN round-trips.
- **Coverage:** at least 95% lines, functions and statements and 90% branches, enforced by
  `npm run test:coverage`.

## Perft from the command line

```bash
npm run perft -- start 5
npm run perft -- kiwipete 3 --divide
npm run perft -- "8/8/8/8/8/5k2/8/7K w - - 0 1" 2 --detailed
```

On the development machine, start-position perft(5) takes about 4.6 seconds.

## Extending the engine

- **AI:** `legalMoves`, `applyMove` and `analyze` are all an alpha-beta search needs. Run it in a
  Web Worker. Zobrist hashing can be added next to `positionKey` (with separate keys for original
  and promoted queens).
- **Online play:** a server can validate coordinate moves with `play()`; the engine is
  deterministic, so client and server always agree.
