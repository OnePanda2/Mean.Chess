# Decision log

Every interpretation, deviation and trade-off made while building Mean Chess, so that nobody has to
reverse-engineer them from the commit history. Rules decisions are reflected in [RULES.md](RULES.md);
the original planning is in [BLUEPRINT.md](BLUEPRINT.md).

"Founder" means a ruling made by the project owner on the date shown.

## Rules

| ID | Decision | Source |
|---|---|---|
| D-01 | Royal Capture: the 8 straight lines only, exactly 2 squares, through one midpoint. From h1: f1, f3, h3. (The handoff's example list and its "Chebyshev distance" wording were contradictory.) | Founder, 2026-10-07 |
| D-02 | Royal Slaughter is available whenever the midpoint piece is in the active tier. No check required. | Founder, 2026-10-07 |
| D-03 | Desperation ignores suicidal ordinary moves: a checked king whose only escapes walk into royal reach may use Royal Cannibalism. | Founder, 2026-10-07 |
| D-04 | Desperation also requires that there is no royal move. This resolves a contradiction between handoff §3.1 and §9 without changing any outcome. | Blueprint |
| D-05 | A suicidal move is an ordinary move after which the opponent has a royal move. It stays legal. Cannibalism moves may themselves be suicidal. | Blueprint |
| D-06 | No cannibalism outside check: stalemate stays stalemate. | Handoff §3.1 |
| D-07 | The hierarchy is global (lowest tier present anywhere). Promoted pieces are classed by their new type; only queens carry an origin. | Handoff §3, §14 |
| D-08 | The original queen can never be sacrificed. Loaded positions may contain at most one original queen per side. | Handoff §4, blueprint |
| D-09 | Royal reach is not an attack: it never affects legality, castling or check. | Handoff §6, §13 |
| D-10 | Royal moves are legal while in check and skip king-safety filtering. | Handoff §11 |
| D-11 | A royal move ends the game at once and overrides every other ending. | Handoff §9, §15 |
| D-12 | Checkmate means: in check with no legal moves after every Mean layer. | Handoff §10 |
| D-13 | Draws: stalemate, threefold repetition (automatic), fifty-move rule (automatic), agreement. **No insufficient-material draws**: a retrograde solve showed K+N vs K and K+B vs K are forced wins in Mean Chess, and bare kings can still capture each other (tools/research/endgames.mjs). | Blueprint (research) |
| D-14 | The halfmove clock also resets on a cannibalism move. | Blueprint |
| D-15 | The repetition key includes queen origin, side, castling, and en passant only when capturable. History lives in the game record, never in the position. | Handoff §21, blueprint |
| D-16 | Royal Slaughter through a queen cannot occur in a legal game (the queen would be giving check). It is tested at generator level, replacing the handoff's UI acceptance step for it. | Blueprint (research) |

## Engine and data

| ID | Decision | Source |
|---|---|---|
| D-17 | Promotion is a move field, not a move kind (a promotion can also capture). A move is identified by from, to and promotion. | Blueprint |
| D-18 | Pieces have stable ids that survive promotion (e.g. `wP@e2`). Ids are excluded from hashing. | Handoff §18, blueprint |
| D-19 | No `hasMoved` flag: castling rights and the pawn start rank carry all relevant history, and nothing unhashed affects legality. | Blueprint |
| D-20 | MeanFEN = FEN plus `~` after a promoted queen (`Q~`), the X-FEN / lichess convention for promoted pieces. | Blueprint (research) |
| D-21 | Mean Chess Notation per RULES.md §9, labelled as non-SAN. | Handoff §22, blueprint |
| D-22 | The engine is pure, deterministic TypeScript with no React, DOM, randomness or clock. ESLint enforces the boundary. | Handoff §16, §49 |
| D-23 | The suicidal-move check is skipped only when the kings are more than **4** squares apart. Castling moves the king two squares, so 3 would be wrong (O-O-O with the enemy king on a3 is suicidal from 4 away). Found and fixed during M3, with a test. | Build (M3) |
| D-24 | Saved games store the start MeanFEN and coordinate moves. Loading replays and validates every move and never trusts the stored result. | Blueprint |

## Tooling

| ID | Decision | Source |
|---|---|---|
| D-25 | TypeScript ~6.0.3: TypeScript 7 exists, but typescript-eslint supports only `<6.1`. Revisit when it widens. | Blueprint (research) |
| D-26 | ESLint 10 (as the handoff asked) rather than oxlint (Vite's new default). | Handoff §17 |
| D-27 | jsdom 29: jsdom 30 needs Node ≥ 24.15 and the main dev machine runs 24.14. | Build (M1) |
| D-28 | chess.js 1.4.0 (BSD-2) is a dev-only oracle. The differential test reads its internal move generator for speed; a guard test proves it agrees with chess.js's public API. chessops (GPL) is excluded. | Build (M2) |
| D-29 | Engine coverage is enforced at 95% lines, functions and statements and 90% branches. | Build (M3) |

## Product, interface and hosting

| ID | Decision | Source |
|---|---|---|
| D-30 | v0.1 is local two-player play on one device: unlimited single-move undo, draw by agreement, resignation, Scenario Lab and MeanFEN import. No accounts, backend or AI. | Handoff §31, blueprint |
| D-31 | Two real pages, `/` and `/rules/` (Vite multi-page build), so GitHub Pages needs no client-side router. `base` is `/`. | Blueprint |
| D-32 | **Original piece artwork** replaces the Cburnett set: a vector set and a 16×16 pixel set, coloured entirely by theme tokens. No third-party art ships. | Founder request, 2026-10-07 |
| D-33 | **Themes:** Mean (default, dark), Sugar (pink and pastel), Arcade (8-bit, PICO-8 palette, pixel pieces) and Picnic (red gingham). Themes deliberately contrast with the game's mean tone. Tokens are scoped by `[data-theme]`, so a preview element can render a different theme. The choice is stored per browser and applied before first paint. | Founder request, 2026-10-07 |
| D-34 | **Animations:** pieces slide; captured and sacrificed pieces leave a "ghost" that animates out; Royal Capture and Royal Cannibalism flash the board; promotions swell; undo brings pieces back. What to animate is derived from the game state (move, undo or reset), never from timers. A switch turns movement off, and `prefers-reduced-motion` always wins. | Founder request, 2026-10-07 |
| D-35 | Display fonts are self-hosted and SIL OFL licensed (Cormorant Garamond, Pacifico, Press Start 2P, Fredoka). The browser downloads a face only when the active theme uses it. | Build (M4) |
| D-36 | Hosting: GitHub Pages deployed by GitHub Actions, static only. Online multiplayer is deferred. | Handoff §31–32 |
| D-37 | The custom domain is set in the repository's Pages settings **before** the DNS record exists (prevents subdomain takeover). `public/CNAME` is kept for clarity, but Actions deploys ignore it. Verifying the apex domain with GitHub is recommended. | Blueprint (research) |
| D-38 | Project licence: MIT. | Handoff §51 |
| D-39 | **No Kill Zone help during play.** The board never reveals the Royal Kill Zone, before or after a move. **Reverses the v0.1 design** (blueprint §5.3). Removed: the warning icon on suicidal moves and its hover and screen-reader text; the "Doomed" banner; the alert and ring when the enemy king threatens yours; the "Kill zones" overlay button. The "Desperate" banner still explains Royal Cannibalism, without saying why ordinary moves fail. The player who *can* make a royal move is still shown it. The engine keeps `suicidal` and `threat`, because the rules and the computer opponent need them. The rules page and Scenario Lab still teach the Kill Zone. Reason: if the board warns you, nobody ever steps in and the mechanic is pointless. | Founder, 2026-10-07 |
| D-40 | **The computer opponent has its own fast board** (`src/ai/board.ts`: integer pieces, make/unmake, incremental hashing), because the engine's ~45,000 positions a second is too slow to search. It is proven equal to the engine by perft (standard and Mean-specific values) and by a move-for-move comparison over 20,000+ random-game positions. The engine stays the authority: every computer move is played through `play()`. | Build (v0.2) |
| D-41 | **Search:** a royal move available scores as an immediate win, so suicidal moves need no special handling (the reply finds the royal move). Checks and royal threats extend the search and are answered in full in quiescence. Null moves only with the kings more than 4 apart (Mean endings are full of zugzwang) and with pieces besides pawns. | Build (v0.2) |
| D-42 | **Levels:** Nice (easy: 2 plies, noisy choice, and on 35% of its moves blind to royal moves, like a beginner), Mean (medium: 4 plies, slight variety) and Ruthless (hard: iterative deepening for 2 seconds). Names keep the game's tone; each shows a plain description of its difficulty. | Build (v0.2) |
| D-43 | **Playing the computer:** Undo takes back the computer's reply with the player's move. Resign always resigns for the player. A draw offer is accepted only when the computer judges itself at least 1.5 pawns down, or only the kings remain. Loading a scenario switches to a game between friends. The opponent is saved with the game. Replies take at least 450 ms, so moves do not snap back instantly. | Build (v0.2) |
| D-44 | The computer runs in a **module Web Worker**. It sits behind the same lint boundary as the engine (no DOM, clock or randomness; both are passed in). An in-page fallback loads the AI only when needed, so the page's own bundle stays small. | Build (v0.2) |
| D-45 | Coverage for `src/ai`: 95% lines, functions and statements, 75% branches. Its typed-array reads need `?? 0` guards under strict index checking, and those never fire. | Build (v0.2) |
