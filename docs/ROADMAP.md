# Roadmap

## v0.1 (this release)

Local two-player Mean Chess in the browser: the complete rules engine, an interface that explains
every special move, Scenario Lab, original piece artwork in four themes (Mean, Sugar, Arcade,
Picnic), move and capture animations, the rules page, and deployment to GitHub Pages.

## v0.2: play against the computer

- A practice AI: alpha-beta search in a Web Worker, built on this engine (Stockfish and
  Fairy-Stockfish cannot express Mean rules, and the latter is GPL).
- A Mean-aware evaluation: material with the original queen worth more than a promoted one, royal
  threats, Kill Zone control, how exposed each side's sacrifice tier is, king hunting.
- Zobrist hashing and a transposition table.
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
