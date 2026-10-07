# Roadmap

## v0.1 (released)

Local two-player Mean Chess in the browser: the complete rules engine, an interface that explains
every special move, Scenario Lab, original piece artwork in four themes (Mean, Sugar, Arcade,
Picnic), move and capture animations, the rules page, and deployment to GitHub Pages.

## v0.2 (this release): play against the computer

- A computer opponent at three levels, Nice, Mean and Ruthless (see [AI.md](AI.md)):
  - an alpha-beta search in a Web Worker, on its own fast board, proven equal to the engine
    (Stockfish and Fairy-Stockfish cannot express Mean rules, and the latter is GPL);
  - Zobrist hashing and a transposition table;
  - an evaluation that values the original queen above a promoted one and drives a beaten king into
    the corner, where its only moves are suicidal.
- The board no longer reveals the Royal Kill Zone during play (founder ruling, D-39).

## Next

- A richer Mean evaluation: Kill Zone control, how exposed each side's sacrifice tier is, king
  hunting in the middlegame.
- Drag-and-drop moves, sound effects, an Open Graph preview image, PGN-style export, and a guided
  tutorial built on Scenario Lab.

## v0.3: online play

- Rooms over WebSockets, for example Cloudflare Durable Objects or Supabase Realtime. The server
  validates coordinate moves with the same deterministic engine.
- Reconnection and persisted games, then accounts and ratings.

## Ideas and research

- More themes.
- Mean Chess endgame tablebases (K+P vs K and beyond), building on `tools/research/endgames.mjs`.
- An opening guide: which classic traps survive the cannibalism rule (Scholar's mate does, Fool's
  mate does not).
- A notation review once real games exist.
