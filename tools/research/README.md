# Mean Chess — pre-build research scripts

Evidence behind the claims in [`docs/BLUEPRINT.md`](../../docs/BLUEPRINT.md) (sections 3 and 6). These are
**research tools, not the product engine**. Once the engine exists, its own tests are authoritative;
these scripts remain an independent cross-check.

They implement the rules exactly as decided on 2026-10-07 (8-line Royal Capture, Royal Slaughter
whenever the blocker is in the active tier, suicidal escapes don't block Cannibalism).

| Script | What it shows | Output |
|---|---|---|
| `oracle_positions.mjs` | chess.js (standard legality) plus a thin Mean layer, evaluated on the 33-position acceptance catalogue | `oracle_output.txt` |
| `perft_safety.mjs` | for the six standard perft positions: up to which depth Mean perft equals standard perft, and how many cannibalism escapes appear at the first internal checkmates | `perft_safety_output.txt` |
| `endgames.mjs` | retrograde solve of K vs K, K+N vs K, K+B vs K under Mean rules (independent of chess.js) | `endgames_output.txt` |

Reproduce from the repository root (Node 22.12+, after `npm ci`, which installs chess.js 1.4.0 as a
dev dependency):

```bash
node tools/research/oracle_positions.mjs
node tools/research/perft_safety.mjs start 5
node tools/research/endgames.mjs
```

`perft_safety.mjs` takes a position name (`start`, `kiwipete`, `pos3`, `pos4`, `pos5`, `pos6`)
and a depth. It reads chess.js internals (`_moves`, `_makeMove`) for speed, so it is pinned to
chess.js 1.4.0.
