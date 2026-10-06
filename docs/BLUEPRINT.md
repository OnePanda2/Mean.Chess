# MEAN CHESS — Final Blueprint

**Version:** 1.0 · 2026-10-07
**Built from:** `docs/archive/HANDOFF-v0.md` (founder brief, originally `MEAN_CHESS_CLAUDE_HANDOFF.md`), research done on 2026-10-07 (evidence in `tools/research/`), and three founder decisions recorded on 2026-10-07
**Precedence:** where this document and the handoff disagree, this document wins. Every deviation is listed in §1.
**Location:** `docs/BLUEPRINT.md` (moved here from the project root at M0, 2026-10-07). §2 becomes `docs/RULES.md` (*Mean Chess Rules v0.1*), and §12 seeds `docs/DECISIONS.md`.

---

## 0. Summary

**Product.** A fast, static web app at `https://meanchess.siddheshthapa.com` where two people at one device can play a complete Mean Chess game with the rules enforced correctly. Mean Chess is standard chess plus:
- **Royal Capture and Royal Slaughter:** kings kill kings from two squares away.
- **Royal Cannibalism:** a desperate king eats its own lowest-tier piece to survive.

**Founder decisions (2026-10-07).** These resolve the handoff's contradictions:

1. **Royal Capture works along the 8 straight lines only.** The enemy king must be exactly two squares away on a rank, file or diagonal, with one midpoint square between the kings.
2. **Royal Slaughter is available whenever the midpoint piece belongs to the active sacrifice tier.** No check is required.
3. **Suicidal escapes don't count.** A move that hands the opponent an immediate Royal Capture does not count as an escape when deciding whether Royal Cannibalism is allowed.

**What the research changed:**

| # | Finding | Consequence |
|---|---|---|
| 1 | The handoff's Royal Capture example list from H1 is wrong. | Correct squares from h1: **f1, f3, h3** |
| 2 | **Royal Slaughter through a queen can never happen in a legal game.** A queen between the kings always attacks the enemy king. The same is true for a rook on a rank or file, a bishop on a diagonal, and a pawn on its capture diagonal. | The handoff's promoted-queen Slaughter UI acceptance step becomes an engine-level unit test (§2.8, D-16) |
| 3 | **K+N vs K and K+B vs K are forced wins** in Mean Chess (≈99.9% and ≈100% of positions with the stronger side to move). Even bare K vs K has forced corner wins. | **No insufficient-material draws** in v0.1 (D-13) |
| 4 | **Fool's mate is not mate.** The king escapes with K×d2 or K×e2. Scholar's mate still mates. | Rules-page material and regression tests |
| 5 | Mean perft equals standard perft only up to the first checkmate inside the search tree. | Exact predicted Mean perft values provided (§3.3), e.g. start position perft(5) = **4,865,625** |
| 6 | TypeScript 7 is out, but typescript-eslint supports only `<6.1`. | Pin **TypeScript 6.0.3** + ESLint 10 (D-23) |
| 7 | GitHub ignores the `CNAME` file for Actions deploys. The domain must be set in repo settings **before** the DNS record exists, to prevent takeover. | Deployment runbook §8 |
| 8 | DNS for `siddheshthapa.com` is at **Namecheap**. `taxcal.siddheshthapa.com` already uses the same CNAME → `onepanda2.github.io` pattern. | One DNS record for you to add |
| 9 | The `gh` CLI token lacks the `workflow` scope. Git pushes via Git Credential Manager, which normally has it. | Fallback documented in §8 |

**Your manual steps.** I can do everything else.
1. Approve the outward-facing GitHub actions when we reach them: enabling Pages, setting the custom domain, pushing to `main`.
2. Add one record at Namecheap: `CNAME meanchess → onepanda2.github.io.`
3. *(Recommended)* Add a TXT record that verifies `siddheshthapa.com` with GitHub, as takeover protection.
4. Enforce HTTPS once GitHub issues the certificate. I can flip the setting by API.

---

## 1. Handoff review: corrections, contradictions, gaps

| # | Handoff § | Issue | Resolution |
|---|---|---|---|
| 1 | §1, §5.2, §7 | "Eight directions" plus a single "intervening square" contradicts "use Chebyshev distance" | Founder: 8 straight lines (D-01) |
| 2 | §5.2 | The example list from H1 includes G1, G2, H2 (adjacent, which the next sentence forbids) and F2 (knight-shaped), and omits G3 | Corrected list: **F1, F3, H3** |
| 3 | §7–§8 | "Legally eligible for Royal Cannibalism" could mean tier-only or full cannibalism legality (check required) | Founder: tier only (D-02) |
| 4 | §3.1 | Literally, a king step into the Kill Zone is an "ordinary legal move", so it would forbid Cannibalism even when the only escape is suicide | Founder: suicidal moves don't count (D-03). This adds the defined term **suicidal move** |
| 5 | §3.1 vs §9 | §3.1 allows Cannibalism only if "no non-self-capture move can save the king" (a Royal Capture would). §9 step 4 ignores royal moves | Desperation requires *no royal move* (D-04). This doesn't change outcomes, and it avoids offering a sacrifice when the king can simply win |
| 6 | §23.3, §43 | "Royal Slaughter through a promoted queen must be available" is impossible in any legal position | Engine unit test with position validation bypassed. Documented as a consequence (D-16) |
| 7 | §15 | "Insufficient material where meaningful" | Research shows it is never meaningful (§3.1), so there are no material draws (D-13) |
| 8 | §18 | `hasMoved` duplicates castling rights and would be state the position hash doesn't see | Dropped. Castling rights plus the pawn start rank carry all relevant history (D-19) |
| 9 | §19 | `promotion` as a `MoveKind` can't express a capture-promotion | Promotion is a separate field (D-17) |
| 10 | §20 | `moveHistoryHash` inside the position | A position is pure state. Repetition history lives in the game record (D-15) |
| 11 | §22 | `K×own P` has no square, so it is ambiguous with two adjacent pawns | Mean Chess Notation includes the square: `K×e2(own P)` (D-21) |
| 12 | §16 vs §33 | Tests in `src/tests/` vs root `tests/` | Root `tests/` (§33 is the "preferred final repository") |
| 13 | §26 | Use standard perft positions for the Mean engine | Valid only up to the first internal checkmate. Predicted Mean values in §3.3 |
| 14 | §35 | Order: DNS first, then the GitHub setting | GitHub's docs say the reverse: set the domain in Pages settings first, then DNS |
| 15 | §36 | "Clone it there" | The folder exists, isn't a git repo, and holds the handoff. Adopt the remote history in place. The local git default branch is `master`, so use `main` explicitly |
| 16 | §43 step 1 | "Put White King on H1…" needs position setup in the UI | **Scenario Lab + MeanFEN import** are part of v0.1 |
| 17 | §17 | ESLint | Kept. Vite's own template has moved to oxlint, and ESLint forces TS ≤ 6.0 today |
| 18 | §52 | `npm install` | `npm ci` in CI, using the lockfile |
| 19 | §33 | `h.txt` | It contains a single newline. Delete it in a documented commit |

---

## 2. Mean Chess Rules v0.1 (canonical specification)

> This section becomes `docs/RULES.md`. The implementation follows it, never the other way round. Any rule change updates this text and the matching tests in the same commit.

### 2.1 Baseline
Standard FIDE chess applies, except where this section says otherwise. That covers board, setup, movement, captures, castling, en passant, promotion to Q/R/B/N, check, checkmate, stalemate and turn order. No other rule is changed.

### 2.2 Definitions
- **Attack, check.** Standard attack geometry applies, and a king attacks its 8 adjacent squares. A king is *in check* when an enemy piece attacks its square. **Royal reach (2.3) is not an attack.** It never makes a move illegal and never counts as check.
- **Royal distance and midpoint.** Two kings are at *royal distance* when they stand exactly two squares apart on the same rank, file or diagonal, so |Δfile|, |Δrank| ∈ {(2,0), (0,2), (2,2)}. The *midpoint* is the square between them. From h1, the royal-distance squares are f1, f3 and h3.
- **Sacrifice tiers.**
  - Tier 1: pawns
  - Tier 2: knights and bishops
  - Tier 3: rooks
  - Tier 4: promoted queens

  The **original queen** and the **king** belong to no tier and can never be sacrificed.
- **Active tier.** For each side, the lowest tier in which that side has at least one piece anywhere on the board. Only active-tier pieces are **eligible**. A side with no tiered pieces has nothing eligible.
- **Queen origin.** A queen in the starting position is *original*. A queen created by promotion is *promoted* for the rest of the game. Promoted rooks, bishops and knights are plain rooks, bishops and knights.
- **Ordinary move.** Any standard chess move that is legal under standard rules, including castling, en passant and promotion. It must not leave the mover's king in check, which also keeps the kings from ever being adjacent.
- **Royal move.** A Royal Capture or Royal Slaughter (2.3).
- **Suicidal move.** An ordinary move after which the opponent has a royal move. Suicidal moves are legal.
- **Royal Kill Zone.** A king is *in the Kill Zone* when the opponent would have a royal move against it if it were the opponent's turn. Standing in it, entering it, and castling into, out of or through it are all legal.

### 2.3 Royal Capture and Royal Slaughter
1. Only a king can capture a king. All other pieces still give check normally.
2. **Royal Capture.** If the enemy king is at royal distance and the midpoint is empty, your king may capture it.
3. **Royal Slaughter.** If the enemy king is at royal distance and the midpoint holds one of **your own eligible** pieces, your king may remove that piece and capture the enemy king. This is one move.
4. In every other case there is no royal move on that line. That includes an enemy piece on the midpoint, or one of your pieces that isn't eligible (such as the original queen). Kings never jump.
5. Royal moves are available at any time, including while your king is in check. They are not subject to king-safety rules.
6. A royal move **ends the game immediately**, and the capturing side wins.

### 2.4 Desperation and Royal Cannibalism
1. You are **desperate** when all three hold:
   - (a) your king is in check;
   - (b) you have no royal move;
   - (c) every ordinary legal move you have is suicidal, or you have none.
2. While desperate, and only then, your king may make a **Royal Cannibalism** move: it steps onto an adjacent square occupied by one of your **eligible** pieces and removes that piece.
3. A cannibalism move is legal only if your king is not in check afterwards. That also means it can't end adjacent to the enemy king. It may end in the Kill Zone, which is legal but suicidal.
4. While desperate, your suicidal ordinary moves stay legal. Cannibalism is an extra option.
5. If you are not in check, there is no cannibalism, even with no legal moves. That position is stalemate.

### 2.5 Legal moves

```
legal(P) = royal(P) ∪ ordinary(P) ∪ (desperate(P) ? cannibalism(P) : ∅)
```

### 2.6 End of the game (evaluated in this order)
1. **Royal Capture or Royal Slaughter**: the capturing side wins at once. This overrides everything below.
2. The side to move has **no legal moves**: if in check, that's **checkmate** and they lose; otherwise it's **stalemate**, a draw.
3. **Fifty-move rule.** 100 consecutive plies without a pawn move, a capture (including en passant) or a cannibalism move end the game as a draw, automatically.
4. **Threefold repetition.** The same position (2.7) occurring for the third time is a draw, automatically.
5. **Agreement or resignation**, from the local play controls.

There is **no insufficient-material draw** (see 2.8).

### 2.7 Same position
Two positions are the same when they have the same piece placement (including queen origin), the same side to move, the same castling rights, and the same en-passant possibility. En passant only counts if an en-passant capture is actually legal.

### 2.8 Consequences and clarifications (non-normative)
- A king in check may make a royal move and win.
- **Which blockers can ever be slaughtered?** It's impossible to have the opponent in check on your own turn, so the midpoint piece must not attack the enemy king from where it stands. That leaves:
  - **pawns**: on a rank or file, or on the diagonal *behind* the pawn;
  - **knights**: on any line;
  - **bishops**: on ranks and files only;
  - **rooks**: on diagonals only;
  - **queens**: never.
- The active tier never goes back down during a game, because pawns can't be created.
- A lone knight or bishop wins against a bare king, and a bare king can be lost in a corner. That's why material alone never draws.
- Fool's mate fails because the king escapes with K×d2 or K×e2. Scholar's mate still mates.
- At most one royal move exists in any position, since there is one enemy king and one line between the kings.

### 2.9 Mean Chess Notation (MCN)
This is human-facing notation, labelled "Mean Chess notation" and not official SAN.

```
move      := castle | ordinary | cannibal | royal
castle    := "O-O" | "O-O-O"                      [suffix]
ordinary  := standard SAN (Nf3, exd6, e8=Q, Qxf7) [suffix]
cannibal  := "K×" square "(own " tier ")"         [suffix]   K×e2(own P)   K×g1(own Q~)
royal     := "K×K" | "K×" tier "×K"                          K×K   K×P×K   K×N×K
tier      := "P" | "N" | "B" | "R" | "Q~"
suffix    := "+" (gives check) | "#" (Mean checkmate)
```
- Ordinary captures use `x`. Mean-only captures use `×`. The ASCII export writes both as `x`; `(own` and `×K` keep them distinct.
- Storage and transport use coordinate moves: `e2e4`, `e7e8q`, `h1f3`. Under the 8-line rule, (from, to, promotion) identifies every legal move uniquely.

---

## 3. Research findings (evidence)

### 3.1 Endgame theory under Mean rules
These come from a retrograde solve of every legal position, with no 50-move limit (`tools/research/endgames.mjs`).

| Material | Side to move | Result |
|---|---|---|
| K vs K (3,612 positions) | either | Wins at once in 336 positions (royal distance). Forces a corner zugzwang in 32 more. **Lost in 8** (cornered at knight's distance, e.g. Ka1 vs Kc2). Drawn in 3,236 (89.6%). |
| K+N vs K | knight side | **Wins in 99.9%** of 205,496 positions. Longest forced win: 36 plies |
| K+N vs K | lone king | Loses 81.8%, draws 9.0%, wins 9.2% |
| K+B vs K | lone king | Loses 82.4%, draws 8.4%, wins 9.2% |
| K+B vs K | bishop side | **Wins in ≈100%** of 193,284 positions. Longest forced win: 22 plies |

**Why:** the attacking king controls its 8 neighbours (illegal for the defender) and its 8 royal-distance squares (suicidal for the defender). With one extra piece to cut off escape squares, it forces zugzwang. A minor piece standing between the kings also enables Royal Slaughter, while blocking the defender's own capture. In standard chess these endings are dead draws. Here they are wins. Hence D-13.

### 3.2 Royal Slaughter: which blockers are reachable
Verified on positions B1–B12 (§6.2). A blocker that attacks the enemy king from the midpoint makes the position illegal on the slaughtering side's turn.

| Blocker | Rank/file line | Diagonal line |
|---|---|---|
| Pawn | ✔ | ✔ only when the enemy king is *behind* the pawn (B12). ✘ on its capture diagonal (B11) |
| Knight | ✔ | ✔ |
| Bishop | ✔ | ✘ |
| Rook | ✘ | ✔ |
| Queen (original or promoted) | ✘ | ✘ (B10) |

### 3.3 Perft: where Mean equals standard, and predicted Mean values
Mean adds moves only (a) at royal distance, (b) when a suicidal move is possible (kings ≤ 3 apart), or (c) at a standard checkmate. So Mean perft(*d*) equals standard perft(*d*) whenever every internal node has the kings ≥ 4 squares apart and is not a standard checkmate. These figures were measured with chess.js plus a thin Mean layer (`tools/research/perft_safety.mjs`).

| Position | Standard perft (depth 1 …) | Mean = standard through | Predicted first divergence |
|---|---|---|---|
| Start | 20 · 400 · 8,902 · 197,281 · 4,865,609 | depth 4 | **perft(5) = 4,865,625** (+16: the 8 fool's-mate positions at ply 4 each gain K×d2 and K×e2) |
| Kiwipete | 48 · 2,039 · 97,862 · 4,085,603 | ≥ depth 4 | The single ply-3 mate has no legal cannibalism, so perft(4) stays **4,085,603** |
| Position 3 | 14 · 191 · 2,812 · 43,238 · 674,624 | depth 4 | **perft(5) = 674,641** (+17 cannibalism escapes, e.g. Ka5×b5, across the 17 ply-4 mates) |
| Position 4 | 6 · 264 · 9,467 · 422,333 | depth 3 | **perft(4) = 422,373** (+40 escapes from 22 ply-3 mates) |
| Position 5 | 44 · 1,486 · 62,379 · 2,103,487 | depth 3 | **perft(4) = 2,103,500** (+13 escapes from 44 ply-3 mates) |
| Position 6 | 46 · 2,079 · 89,890 · 3,894,594 | ≥ depth 4 | none through depth 4 |

These predictions come from an independent implementation. If the engine disagrees, one of the two is wrong, and we investigate before accepting either.

### 3.4 Environment and repository (checked 2026-10-07)
- **Machine:** Node **24.14.0** (Active LTS), npm 11.9.0, git 2.55, gh 2.101 (logged in as `OnePanda2`). Git settings: `credential.helper=manager`, **`init.defaultBranch=master`**, **`core.autocrlf=true`**. We need `.gitattributes` with LF line endings.
- **Repo `OnePanda2/Mean.Chess`:** public, on `main` at `b7b677d` ("Create h.txt"). `h.txt` holds only `\n`. Pages is not enabled. No license file.
- **Local folder (before M0):** not a git repo. It contained the handoff, this blueprint and `research/` (now `docs/archive/`, `docs/` and `tools/research/`).
- **Your existing Pages sites:**
  - `siddheshthapa` (apex `siddheshthapa.com`, deployed by Actions, HTTPS enforced). Its workflow runs on Node 20, which is end-of-life, and uses older action majors.
  - `Tax.cal` → `taxcal.siddheshthapa.com` (CNAME → `onepanda2.github.io`).
  - `linkworld` (no custom domain).

### 3.5 Domain and DNS (checked 2026-10-07)
- Nameservers are `dns1/dns2.registrar-servers.com` (**Namecheap BasicDNS**).
- `meanchess.siddheshthapa.com` returns **NXDOMAIN** today. There's no wildcard record, which is good.
- There are no CAA records, so Let's Encrypt (GitHub's certificate issuer) is allowed.
- There's no `_github-pages-challenge-onepanda2` TXT record, so the domain is **not yet verified** with GitHub.
- GitHub's docs say:
  - a `CNAME` file is ignored for Actions deploys;
  - add the custom domain in Pages settings *before* creating the DNS record;
  - verifying the apex also covers its immediate subdomains, so `meanchess` and `taxcal` would both be protected.

### 3.6 Tooling versions (npm registry, 2026-10-07)

| Package | Version | Note |
|---|---|---|
| react / react-dom | 19.3.0 | MIT |
| vite | 8.3.3 | Rolldown-based. Multi-page uses top-level `input` (alias of `build.rolldownOptions.input`) |
| @vitejs/plugin-react | 6.1.2 | Peer: vite ^8 |
| typescript | **6.0.3 (pinned)** | 7.0.2 is the npm `latest`, but typescript-eslint's peer range is `>=4.8.4 <6.1.0`. Vite's own template pins `~6.0.2` |
| eslint / @eslint/js | 10.12.0 / 10.0.1 | Flat config |
| typescript-eslint | 8.71.1 | Supports ESLint 8–10 |
| eslint-plugin-react-hooks / -refresh | 7.1.1 / 0.5.7 | Support ESLint 10 |
| vitest / @vitest/coverage-v8 | 5.0.3 | Peers: vite 6.4–8. Node ^22.12 / ^24 |
| jsdom · @testing-library/react · /dom · /user-event | 30.1.2 · 16.3.3 · 10.4.2 · 14.6.7 | UI tests |
| chess.js | 1.4.0 | **BSD-2-Clause.** Dev-only test oracle |
| chessops | 0.15.1 | **GPL-3.0-or-later: excluded** |
| GitHub Actions | checkout **v7**, setup-node **v7**, configure-pages **v6**, upload-pages-artifact **v5**, deploy-pages **v5** | Matches Vite's current deploy guide |

### 3.7 Licensing
- **Project:** MIT.
- **Piece art:** Cburnett's chess SVGs on Wikimedia Commons are quad-licensed (GFDL, CC BY-SA 3.0, **BSD-3-Clause**, GPLv2+). We use them under **BSD-3** with attribution in `THIRD_PARTY_NOTICES.md`.
- **Fonts:** any display font must be OFL and self-hosted.
- **Libraries:** no GPL code anywhere. chess.js is dev-only, BSD.
- **Name check:** a web search found no existing variant called "Mean Chess".

### 3.8 Prior conventions adopted
- The `~` suffix for promoted pieces in FEN (`Q~`) is the established X-FEN / lichess / XBoard convention from crazyhouse. MeanFEN reuses it.

---

## 4. Architecture

### 4.1 Layers

```
 ┌──────────────── UI (React) ────────────────┐
 │ pages: Play (/) · Rules (/rules/)           │
 │ components render state, send intents       │
 └──────────────▲─────────────────────────────┘
                │ engine public API only (lint-enforced)
 ┌──────────────┴────── Game layer ────────────┐
 │ GameRecord: start + moves + positions,       │
 │ undo, outcome, repetition, (de)serialization │
 └──────────────▲─────────────────────────────┘
 ┌──────────────┴────── Rules engine ──────────┐
 │ pure, deterministic TypeScript, no DOM/React │
 │ positions · move gen · Mean layer · notation │
 └──────────────────────────────────────────────┘
 Future consumers of the same engine: AI (Web Worker), multiplayer server (validates moves).
```

### 4.2 Repository layout (target)

```
Mean.Chess/
├── .github/workflows/deploy.yml
├── .gitattributes  .gitignore  .nvmrc(24)  LICENSE(MIT)  README.md  THIRD_PARTY_NOTICES.md
├── index.html                 # Play page (landing hero + game)
├── rules/index.html           # Rules page (real URL /rules/, no router needed)
├── public/  CNAME  favicon.svg  404.html
├── src/
│   ├── engine/                # framework-free rules engine
│   │   ├── types.ts  constants.ts  squares.ts  tables.ts  position.ts
│   │   ├── attacks.ts  movement.ts  castling.ts  promotion.ts  apply.ts
│   │   ├── royalCapture.ts  hierarchy.ts  cannibalism.ts  legalMoves.ts  status.ts
│   │   ├── notation.ts  meanFen.ts  serialization.ts  hashing.ts
│   │   ├── game.ts  perft.ts  explain.ts  index.ts   # index.ts = the only public entry
│   ├── app/                   # PlayApp, RulesApp, gameStore (useReducer), persistence, scenarios
│   ├── components/            # Board, Square, PieceLayer, MoveHints, MoveList, GameStatus,
│   │                          # CapturedPieces, PromotionDialog, GameOverDialog, GameControls,
│   │                          # RulesPanel, ScenarioLab, Hero, MiniBoard
│   ├── assets/pieces/         # 12 Cburnett SVGs (BSD-3)
│   ├── styles/                # tokens.css base.css board.css layout.css rules.css
│   ├── main.tsx               # play entry
│   └── rules.tsx              # rules entry
├── tests/
│   ├── fixtures/positions.ts  # the §6.2 catalogue, shared by tests and Scenario Lab
│   ├── engine/*.test.ts       # node environment
│   └── ui/*.test.tsx          # jsdom environment
├── tools/  perft.ts  research/  (moved from ./research)
└── docs/   RULES.md  DECISIONS.md  ENGINE.md  ROADMAP.md  DEPLOYMENT.md  BLUEPRINT.md  archive/HANDOFF-v0.md
```

### 4.3 Engine data model

```ts
export type Color = 'white' | 'black';
export type PieceType = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';
export type QueenOrigin = 'original' | 'promoted';
export type Tier = 1 | 2 | 3 | 4;

export interface Piece {
  readonly id: string;               // stable; assigned at position creation; kept through promotion
  readonly color: Color;
  readonly type: PieceType;
  readonly queenOrigin?: QueenOrigin; // present iff type === 'queen'
}

export type Square = number;          // 0 = a1 … 7 = h1 … 63 = h8

export interface CastlingRights {
  readonly whiteKingside: boolean; readonly whiteQueenside: boolean;
  readonly blackKingside: boolean; readonly blackQueenside: boolean;
}

export interface Position {           // pure state: no history, no hasMoved
  readonly board: readonly (Piece | null)[];   // length 64
  readonly sideToMove: Color;
  readonly castling: CastlingRights;
  readonly enPassant: Square | null;
  readonly halfmoveClock: number;
  readonly fullmoveNumber: number;
}

export type MoveKind =
  | 'normal' | 'capture' | 'en-passant' | 'castle-kingside' | 'castle-queenside'
  | 'self-capture' | 'royal-capture' | 'royal-slaughter';

export interface Move {
  readonly kind: MoveKind;
  readonly from: Square;
  readonly to: Square;
  readonly pieceId: string;
  readonly promotion?: 'queen' | 'rook' | 'bishop' | 'knight';  // orthogonal to kind
  readonly captured?: Piece;          // enemy piece removed (incl. the king for royal moves)
  readonly sacrificed?: Piece;        // own piece removed (self-capture, royal-slaughter)
  readonly sacrificeSquare?: Square;  // = to for self-capture; = midpoint for slaughter
  readonly suicidal?: boolean;        // ordinary moves only; see Rules 2.2
}

export type Outcome =
  | { readonly kind: 'royal-capture' | 'royal-slaughter' | 'checkmate' | 'resignation'; readonly winner: Color }
  | { readonly kind: 'stalemate' | 'threefold' | 'fifty-move' | 'agreement'; readonly winner: null };
```

**Precomputed tables:**
- knight targets and king targets per square;
- 8 sliding rays per square;
- `ROYAL_LINES[sq]` = up to 8 `{ target, midpoint }` pairs at royal distance.

### 4.4 Move generation

```
legalMoves(P):
  us, them = P.sideToMove, opposite
  royal     = royalMove(P, us)                 // ≤ 1 move; no king-safety filter
  ordinary  = pseudoOrdinary(P, us)            // standard gen; never targets a king square
              .filter(m => !isAttacked(apply(P,m), kingSq(us), them))
  inCheck   = isAttacked(P, kingSq(us), them)
  for m in ordinary: m.suicidal = royalMove(apply(P,m), them) != null
        // shortcut: if chebyshev(kings) >= 4 before the move, nothing is suicidal
  desperate = inCheck && royal == null && ordinary.every(m => m.suicidal)
  cannibal  = desperate ? cannibalism(P, us) : []
  return [royal?, ...ordinary, ...cannibal]

royalMove(P, side):
  for {target, midpoint} in ROYAL_LINES[kingSq(side)] where target == kingSq(opp(side)):
    b = P.board[midpoint]
    if b == null                                  -> royal-capture
    if b.color == side && isEligible(P, side, b)  -> royal-slaughter (sacrificed = b)
    return null
  return null

activeTier(P, side) = min tier over side's pieces (pawn 1, knight/bishop 2, rook 3,
                      promoted queen 4; original queen and king excluded) or null
cannibalism(P, us)  = for each adjacent square s holding an own piece of activeTier:
                      Q = king to s, piece removed; legal iff !isAttacked(Q, s, them)
```

- `isAttacked` uses standard geometry, with the enemy king attacking only adjacent squares. Royal reach is never part of attack detection.
- `apply` is pure and returns a new position:
  - It updates castling rights when a king or rook moves, or when a rook is captured or sacrificed on its home square.
  - It sets the en-passant target after a double push.
  - It resets the halfmove clock on a pawn move, a capture, en passant or a self-capture.
  - It marks a pawn promoted to a queen as `queenOrigin: 'promoted'`.
  - A royal move removes the enemy king. The game layer records the outcome.

### 4.5 Game layer
- `GameRecord = { start: Position, moves: Move[], positions: Position[], keys: string[], outcome: Outcome | null }`.
- **Undo** pops the last move. It works after the game has ended too, and with immutable positions it's trivially correct.
- **Outcome** is computed after every move, in Rules §2.6 order.
- **Repetition** counts `positionKey` only since the last irreversible move: a pawn move, a capture, a cannibalism move, or a castling-rights change.

### 4.6 Serialization and validation

**MeanFEN.** Standard 6-field FEN plus `Q~`/`q~` for promoted queens. A queen without `~` is original. The parser is strict and rejects with a readable error message when:
- the format or characters are wrong;
- there isn't exactly one king per side, or the kings are adjacent;
- there's a pawn on rank 1 or 8;
- a side has more than one original queen (extra queens must be written `Q~`);
- **the side not to move is in check**;
- castling rights don't match king and rook home squares;
- the en-passant square is inconsistent;
- counters are malformed.

A position where the side to move has a royal move is valid. That player simply wins.

**Game JSON v1:**

```json
{ "format": "mean-chess-game", "version": 1, "rules": "0.1",
  "start": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "moves": ["f2f3", "e7e5", "g2g4", "d8h4", "e1e2"], "result": null }
```

- Loading **replays every move** through the engine. Any illegal move rejects the whole file.
- The result is recomputed rather than trusted.
- Size caps: at most 2,000 moves and 64 KB of input.
- Moves are never evaluated as code, and no HTML from loaded data is rendered.

**Position key (repetition).** The key is the MeanFEN placement (including `~`) + side + castling + en-passant square. The en-passant square is included only if an en-passant capture is legal. Piece IDs and counters are excluded. Zobrist hashing (with separate keys for original and promoted queens) is deferred to the AI milestone.

### 4.7 Engine public API (`src/engine/index.ts`)
- **Positions:**
  - `startingPosition()`
  - `parseMeanFen(text) → { ok, position } | { ok: false, error }`
  - `toMeanFen(p)`
  - `positionKey(p)`
- **Moves:**
  - `legalMoves(p)`
  - `analyze(p)`, returning `{ inCheck, royalMove, desperate, doomed, cannibalismMoves, activeTier: {white, black}, inKillZone, opponentRoyalThreat, blockedRoyal }`
  - `applyMove(p, m)`
  - `findMove(p, uci)`
- **Game:**
  - `newGame(start?)`
  - `play(game, move | uci)`
  - `undo(game)`
  - `outcome(game)`
  - `serializeGame(game)`
  - `deserializeGame(json)`
- **Text:**
  - `toMcn(p, m)`
  - `toUci(m)`
  - `explainMove(p, m)` returns `{ title, detail }` data for UX copy. The engine supplies the reasons, the UI renders them.
- **Tools:** `perft(p, depth) → { nodes, captures, enPassant, castles, promotions, checks, checkmates, selfCaptures, royalCaptures, royalSlaughters }`.

### 4.8 Engineering constraints
- **Deterministic:** no `Math.random`, `Date` or I/O in `src/engine`. ESLint `no-restricted-imports` and `no-restricted-globals` forbid React, the DOM, `window` and `localStorage` there.
- **TypeScript strictness:** `strict`, `noUncheckedIndexedAccess`, `erasableSyntaxOnly` (no enums), `verbatimModuleSyntax`. The engine can then also run directly under Node 24 type-stripping, e.g. `node tools/perft.ts`.
- **Performance budget:**
  - `legalMoves` well under 0.1 ms per typical position;
  - CI perft suite under 30 s;
  - deep perft is opt-in (`npm run perft`).

---

## 5. UI and UX

### 5.1 Pages
- **`/` Play.**
  - Slim top bar: wordmark, then Play · Rules · GitHub.
  - Compact hero: **MEAN CHESS**, "Chess, but your king is allowed to eat his own army.", the secondary line, and CTAs **PLAY MEAN CHESS** and **HOW IT WORKS**.
  - The live board and side panel.
  - Below the fold: three rule cards (Royal Capture, Royal Slaughter, Royal Cannibalism), each with a mini-board and a "Try it" button.
  - Once a game starts, the hero collapses so the board fits the viewport.
- **`/rules/` Rules.**
  - Covers the 9 topics in handoff §29, in order, with static diagrams rendered by the same board component in read-only mode.
  - Each diagram has a "Try this position" link (`/?scenario=<id>`).
  - Formal tone, no jokes.
- **Routing:** a Vite multi-page build, so both are real URLs that work on GitHub Pages without SPA tricks. `public/404.html` links back home.

### 5.2 Board
- **Structure:** a CSS grid of 64 square buttons with rank and file coordinates on the edges. A separate piece layer is keyed by **piece ID** and positioned with CSS transforms, which gives move animations almost for free (disabled under `prefers-reduced-motion`).
- **Input:** v0.1 uses click/tap to move. Pointer drag-and-drop is a stretch goal for v0.1 if time allows.
- **Promotion:** a dialog with Q/R/B/N. The queen option is labelled "promoted (sacrificable)".
- **Selection rules:**
  - Only pieces of the side to move can be selected.
  - Only legal destinations react. Illegal clicks deselect.
  - There is never any UI path to a non-king capturing a king.
- **Persistent highlights:** last move (from/to tint), check (crimson ring and "CHECK" in status), selected piece.
- **Promoted queens** carry a small pip so they're never confused with the original queen.

### 5.3 Visual language and copy

There are four levels of emphasis. Every level is also cued by shape or text, never colour alone.

| Level | When | Marker | Copy (tooltip on hover/focus; side panel on touch) |
|---|---|---|---|
| Normal | Ordinary move | Small dot (empty square) or ring (capture) | — |
| Danger | Suicidal move | Normal marker + crimson corner triangle | **Kill Zone.** After this move the enemy king can capture yours. |
| Special | Cannibalism target | Brass dashed ring + sacrifice glyph. Eligible pieces glow while desperate | **Royal Cannibalism.** Under normal chess rules this is checkmate. Your king may sacrifice this {piece} to escape. *(Variant when only suicidal moves exist:* Every normal move would let the enemy king capture yours.*)* |
| Win | Royal target | Solid crimson square + crown glyph + "WIN" | **Royal Capture.** Your king can capture the opposing king from two squares away. · **Royal Slaughter.** Your {piece} stands between the kings and is your eligible sacrifice. Your king eats it and captures the opposing king. |

**"Why not?" hints**, shown on hover or tap of an ineligible piece or blocked line:
- **Blocked:** "Kings can't jump over enemy pieces."
- **Not eligible:** "You still have pawns. Only a pawn can be sacrificed."
- **Original queen:** "The original queen can never be sacrificed."

**Status lines:**
- **ROYAL KILL ZONE:** the enemy king can capture yours next move.
- **ROYAL CAPTURE AVAILABLE.**
- **DESPERATE:** your king may sacrifice an eligible piece.
- **DOOMED:** every move exposes your king.
- **CHECKMATE / STALEMATE / DRAW (reason).**

The Kill Zone overlay of the enemy king's capture squares is off by default, behind a "Show Kill Zones" toggle, so the board stays calm.

### 5.4 Side panel and controls
- **Status:** turn indicator (colour disc + "White to move"), check/Kill-Zone state, and each side's **sacrifice tier** ("White sacrifices: Pawns").
- **Move list:** in MCN.
- **Captured pieces:** "Taken" (by the opponent) and "Eaten by own king" (sacrificed).
- **Controls:**
  - **New game** (confirms if a game is in progress)
  - **Undo** (one ply, unlimited)
  - **Flip board**
  - **Offer/accept draw** (local agreement)
  - **Resign** (confirms)
  - **Rules** (quick-reference drawer, keeps game state)
  - **Scenarios**
- **Game over:** a dialog with the result and reason (e.g. "White wins — Royal Slaughter"), offering New game / Undo / Review.
- **Persistence:** the current game autosaves to `localStorage`, wrapped in try/catch, and restores after validation.

### 5.5 Scenario Lab
- **Curated positions** from §6.2. Each has a one-line description, and some include a scripted first move. This is what makes handoff §43–45 testable by hand.
- **Import:** paste a MeanFEN; it's validated, with readable errors.
- **Export:** copy MeanFEN and copy moves.
- **Deep links:** `/?scenario=<id>` opens a scenario directly.

### 5.6 Brand
- **Look:** dark, premium, restrained. Near-black surfaces (`#0d0d0f` / `#16161a`) and bone text (`#ece7de`).
- **Board:** bone and umber squares.
- **Accents, one meaning each:** **crimson** (royal, check, danger) and **brass** (sacrifice).
- **Type:** one self-hosted OFL display serif for the wordmark and headings (final pick at build), and `system-ui` for body text.
- **Pieces:** the Cburnett SVG set.
- **No** sound, light theme or cartoon elements in v0.1.

### 5.7 Responsive and accessibility
- **Board size:** `min(100vw − 32px, 100dvh − chrome, 720px)`.
- **Layout:** side panel at ≥ 1024 px; stacked below that.
- **Verified viewports:** 360×640, 390×844, 768×1024, 1440×900. No horizontal scroll.
- **Square labels:** squares are buttons with labels such as "f3, black king, Royal Capture available".
- **Announcements:** an `aria-live` region reads out moves and status.
- **Focus and contrast:** visible focus rings and ≥ 4.5:1 text contrast.
- **Keyboard:** arrow-key navigation of the board is a stretch goal.

---

## 6. Test plan

### 6.1 Suites (target ≈ 250 tests; engine coverage ≥ 95% lines, ≥ 90% branches)

| Suite | Covers |
|---|---|
| standardRules | Each piece's movement and captures, pins, discovered and double check, check, checkmate, stalemate |
| castling | Rights and their loss, path and attack rules, Kill-Zone landing (D1), squares adjacent to the enemy king (D2) |
| enPassant / promotion / queenOrigin | Ep legality including pins. All 4 promotions. Origin survives apply, undo, MeanFEN, game JSON and position key |
| royalCapture | All 8 directions, edges and corners, distance 1/2/3, knight-shaped "stand-off", capture while in check, terminal outcome, non-king never captures king (validation-bypass test too) |
| royalSlaughter | The tier matrix for each blocker type and line orientation, enemy blocker, both colours, original/promoted queen at generator level (D-16) |
| killZone | Suicidal flagging for king moves, blocker moves, castling, and captures that arm an enemy Slaughter (G1) |
| cannibalism / desperation | Tier matrix (handoff §23.4), adjacency only, post-move safety, suicidal-escape trigger (C9), no cannibalism outside check (E1) |
| checkmate escapes | C1–C12 |
| drawRules | Threefold, including the original-vs-promoted queen distinction and en-passant nuance. Fifty-move, including the cannibalism reset. No material draws |
| notation | MCN for every move kind, disambiguation, suffixes, ASCII export, UCI round-trip |
| meanFen / serialization | Round-trips, every validation error, tampered game JSON rejected |
| perft | §3.3 values, standard and Mean |
| differential (chess.js oracle) | 500 seeded random games. Whenever the kings are ≥ 4 apart, the Mean ordinary moves must equal chess.js's moves, and the side is desperate exactly when chess.js reports checkmate |
| invariants (seeded property tests) | Kings never adjacent. Side not to move never in check. Active tier never decreases. Original queens ≤ 1 and never increase. Key equality ⇔ MeanFEN-key equality |
| acceptance | Handoff §43–45 scripted as engine tests |
| ui (jsdom) | Selection rules, hint levels, promotion dialog, game-over, scenario load, undo, persistence fallback |

### 6.2 Acceptance position catalogue (all verified, `tools/research/oracle_output.txt`)

| ID | MeanFEN | Expected (Mean) |
|---|---|---|
| A1 | `8/8/8/8/4k3/8/8/7K b - - 0 1` | Kf3 is legal and flagged suicidal (enters the Kill Zone) |
| A2 | `8/8/8/8/8/5k2/8/7K w - - 0 1` | Royal Capture h1×f3. The game ends 1-0 and history shows `K×K` |
| A3 | `8/8/8/8/8/5k2/8/r6K w - - 0 1` | White is in check (Ra1), yet Royal Capture h1×f3 is legal |
| A4 | `8/8/8/8/8/8/8/K2k4 w - - 0 1` | Distance 3: no capture. Kb1 is suicidal |
| A5 | `8/8/8/8/8/8/2k5/K7 w - - 0 1` | Knight-shaped distance: no capture. White's only move, Ka2, is suicidal (corner zugzwang) |
| B1 | `8/8/8/8/8/4k3/4P3/4K3 w - - 0 1` | Royal Slaughter e1×e3 through the pawn (`K×P×K`) |
| B2 | same, `b` to move | Black has no royal move (enemy pawn blocks). Black is in the Kill Zone |
| B3 | `8/8/8/8/8/4k3/P3N3/4K3 w - - 0 1` | Knight blocker with a pawn on a2: **no** Slaughter |
| B4 | `8/8/8/8/8/4k3/4N3/4K3 w - - 0 1` | No pawns: Slaughter through the knight. Knight moves are suicidal |
| B5 | `8/8/8/8/8/4k3/4B3/4K3 w - - 0 1` | Bishop on a file: Slaughter |
| B6 | `8/8/8/8/8/4k3/3R4/2K5 w - - 0 1` | Rook on a diagonal, rook tier: Slaughter c1×e3 |
| B7 | `8/8/8/8/8/4k3/3R4/2K4N w - - 0 1` | A knight elsewhere keeps the rook ineligible: **no** Slaughter |
| B8 | `8/8/8/8/8/4k3/4n3/4K3 w - - 0 1` | Enemy knight between the kings: White has no royal move |
| B9 | same, `b` to move | Black slaughters through its own knight, e3×e1 |
| B10 | `8/8/8/8/8/4k3/4Q~3/4K3 w - - 0 1` | **Invalid position** (Black is in check). Generator-level test only: Slaughter through a tier-4 promoted queen |
| B11 | `8/8/8/8/8/4k3/3P4/2K5 w - - 0 1` | **Invalid** (the pawn gives check) |
| B12 | `8/8/8/8/8/4K3/3P4/2k5 w - - 0 1` | Pawn on the diagonal behind it: Slaughter e3×c1 |
| C1 | `k7/8/8/8/8/8/5PPP/4r1K1 w - - 0 1` | Back-rank "mate": K×f2, K×g2, K×h2 (own P) |
| C2 | `k7/8/8/2b5/8/8/5PPP/4r1K1 w - - 0 1` | f2 covered by Bc5: only K×g2 and K×h2 |
| C3 | `4k3/8/8/8/8/8/5nBB/6NK w - - 0 1` | No pawns: K×g1 (N), K×g2 (B), K×h2 (B) |
| C4 | `4k3/8/8/8/8/8/P4nBB/6NK w - - 0 1` | The pawn on a2 blocks the hierarchy: **Mean checkmate** |
| C5 | `b2k4/8/8/8/8/8/5n1R/6RK w - - 0 1` | Rook tier: K×g1 and K×h2 (own R) |
| C6 | `b2k4/8/8/8/8/8/5n1R/N5RK w - - 0 1` | Knight on a1: **Mean checkmate** |
| C7 | `b2k4/8/8/8/7r/8/8/6Q~K w - - 0 1` | Promoted-queen tier: K×g1 (own Q~) |
| C8 | `b2k4/8/8/8/7r/8/8/6QK w - - 0 1` | Original queen: **Mean checkmate** |
| C9 | `8/8/8/8/5k2/8/6P1/r6K w - - 0 1` | The only escape, Kh2, is suicidal. Desperate, so K×g2 is allowed (D-03) |
| C10 | `rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3` | Fool's mate is not mate: K×d2 and K×e2 |
| C11 | `r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4` | Scholar's mate: **Mean checkmate** |
| C12 | `6rk/5Npp/8/8/8/8/8/K7 b - - 0 1` | Smothered mate: K×g7 and K×h7 (own P) |
| D1 | `8/8/8/8/8/6k1/P4N2/4K2R w K - 0 1` | O-O is legal and suicidal (lands at royal distance from g3) |
| D2 | `8/8/8/8/8/8/P4Nk1/4K2R w K - 0 1` | O-O is illegal (f1 is adjacent to the black king) |
| E1 | `K7/P7/8/8/8/4k3/8/1r6 w - - 0 1` | **Stalemate**, even though K×a7 would be safe |
| G1 | `8/7p/8/8/8/4k3/4n3/4K2R w - - 0 1` | Rxh7 is suicidal: taking Black's last pawn makes its knight eligible to slaughter |

### 6.3 Handoff acceptance scenarios mapped to the catalogue
- **§43 Royal Capture:** A1 → A2 (play …Kf3, then K×K, game over, history recorded).
- **§43 K–P–K:** B1.
- **§43 Knight with a pawn elsewhere, then without:** B3 → B4.
- **§43 Original or promoted queen blocker:** cannot occur legally (B10, D-16), so it's covered by generator tests instead.
- **§44 Checkmate escape:** pawn C1, minor pieces C3/C4, rook C5/C6, promoted queen C7, original queen C8.
- **§45 Kill Zone:** A2, A4, A5, B1, B8.

### 6.4 Manual QA before calling v0.1 done
In the built-in browser, at desktop size and at 390×844, I'll play through:
- opening and normal captures;
- castling, including D1 and D2;
- promotion with the origin pip;
- check and checkmate (C11);
- self-capture (C1, C10);
- hierarchy changes (C4 → remove the pawn);
- Royal Capture (A1/A2);
- Royal Slaughter (B1, B4);
- stalemate (E1);
- the three draws;
- undo across a royal win;
- reload restoring a game;
- importing an invalid MeanFEN (rejected cleanly).

---

## 7. Toolchain and configuration

```jsonc
// package.json (essentials)
{
  "name": "mean-chess", "private": true, "version": "0.1.0", "type": "module",
  "engines": { "node": ">=22.12" },
  "scripts": {
    "dev": "vite", "build": "tsc -b && vite build", "preview": "vite preview",
    "lint": "eslint .", "typecheck": "tsc -b",
    "test": "vitest run", "test:watch": "vitest", "test:coverage": "vitest run --coverage",
    "perft": "node tools/perft.ts"
  },
  "dependencies": { "react": "^19.3.0", "react-dom": "^19.3.0" },
  "devDependencies": {
    "@eslint/js": "^10.0.1", "@testing-library/dom": "^10.4.2", "@testing-library/react": "^16.3.3",
    "@testing-library/user-event": "^14.6.7", "@types/node": "^24", "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0", "@vitejs/plugin-react": "^6.1.2", "@vitest/coverage-v8": "^5.0.3",
    "chess.js": "1.4.0", "eslint": "^10.12.0", "eslint-plugin-react-hooks": "^7.1.1",
    "eslint-plugin-react-refresh": "^0.5.7", "globals": "^17.13.0", "jsdom": "^30.1.2",
    "typescript": "~6.0.3", "typescript-eslint": "^8.71.1", "vite": "^8.3.3", "vitest": "^5.0.3"
  }
}
```

- **Runtime dependencies:** only React (plus possibly one `@fontsource` font package).
- **TypeScript config:** project references mirroring the official template, split into `app` (src), `node` (vite.config, tools) and `test`.
- **Vite:** `base: '/'`, multi-page `input: { main: 'index.html', rules: 'rules/index.html' }`. A production-only CSP `<meta>` is injected with `default-src 'self'` (this is optional hardening).
- **Vitest:** `projects` named `engine` (node) and `ui` (jsdom), plus coverage thresholds on `src/engine`.
- **ESLint:** flat config with `@eslint/js` + `typescript-eslint` (type-checked) + react-hooks + react-refresh, plus the engine-boundary rules from §4.8.

```yaml
# .github/workflows/deploy.yml
name: CI and Deploy
on:
  push: { branches: [main] }
  pull_request:
  workflow_dispatch:
permissions: { contents: read }
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with: { node-version-file: .nvmrc, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
      - if: github.event_name != 'pull_request'
        uses: actions/configure-pages@v6
      - if: github.event_name != 'pull_request'
        uses: actions/upload-pages-artifact@v5
        with: { path: dist }
  deploy:
    if: github.event_name != 'pull_request' && github.ref == 'refs/heads/main'
    needs: verify
    runs-on: ubuntu-latest
    permissions: { pages: write, id-token: write }
    concurrency: { group: pages, cancel-in-progress: false }
    environment: { name: github-pages, url: '${{ steps.deployment.outputs.page_url }}' }
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
```

---

## 8. Deployment runbook (GitHub Pages and custom domain)

| Step | Who | Action |
|---|---|---|
| 1 | me (with your OK) | Enable Pages from Actions: `gh api -X POST repos/OnePanda2/Mean.Chess/pages -f build_type=workflow` |
| 2 | me (with your OK) | Set the domain **before** DNS exists: `gh api -X PUT repos/OnePanda2/Mean.Chess/pages -f cname=meanchess.siddheshthapa.com` |
| 3 | me (with your OK) | Push `main` and watch the workflow (`gh run watch`) |
| 4 | **you** | Namecheap → Domain List → siddheshthapa.com → Advanced DNS → Add record: **CNAME Record**, Host `meanchess`, Value `onepanda2.github.io.`, TTL Automatic |
| 5 | **you** (recommended) | GitHub → profile Settings → Pages → *Add a domain* → `siddheshthapa.com`. GitHub shows a TXT record, which you add at Namecheap (Host `_github-pages-challenge-onepanda2`), then click Verify. This also protects `meanchess` and `taxcal` |
| 6 | me | Poll `gh api repos/OnePanda2/Mean.Chess/pages` until DNS resolves and the certificate is issued (can take up to 24 h) |
| 7 | me (with your OK) | `gh api -X PUT repos/OnePanda2/Mean.Chess/pages -F https_enforced=true`, then confirm `https://meanchess.siddheshthapa.com` loads and plays |

**Notes:**
- The `public/CNAME` file is kept for clarity, but GitHub ignores it for Actions deploys. Step 2 is what actually sets the domain.
- `onepanda2.github.io/Mean.Chess/` redirects to the custom domain once step 2 is done.
- **If the push of `.github/workflows/*` is rejected for missing the `workflow` scope:** run `gh auth refresh -h github.com -s workflow` (a browser step for you), then `gh auth setup-git`, then retry.
- I will not claim the domain is live until steps 6–7 verify it.

---

## 9. Build sequence

Each milestone ends green on `lint`, `typecheck`, `test` and `build` before the next one starts. Nothing is pushed until M6.

| M | Deliverable | Commit(s) | Exit criteria |
|---|---|---|---|
| M0 | Adopt the repo in place: `git init -b main`, add origin, fetch, track `origin/main`. Add `.gitattributes` (LF), `.gitignore`, `.nvmrc`, `LICENSE`. Move the handoff to `docs/archive/`, this file to `docs/BLUEPRINT.md`, and `research/` to `tools/research/`. Delete `h.txt` | `chore: adopt repository, add blueprint and research` | `git log` shows the remote root commit + ours. Clean status |
| M1 | Scaffold Vite 8 + React 19.3 + TS 6.0 + ESLint 10 + Vitest 5, with the multi-page shells | `feat: bootstrap Mean Chess web app` | All four scripts pass on a clean `npm ci` |
| M2 | Engine standard core: positions, MeanFEN, attacks, move generation, castling, en passant, promotion with origin, apply, status, keys, 50-move and threefold, perft | `feat: implement standard chess core` | Standard perft matches through the §3.3 safe depths. Differential test (500 games) passes |
| M3 | Mean layer: royal moves, hierarchy, suicidal flags, desperation, cannibalism, outcome priority, MCN, game record, game JSON, explanations | `feat: implement Mean Chess rules engine` · `test: add comprehensive Mean Chess rule coverage` | The whole §6.2 catalogue behaves as listed. Mean perft predictions reproduced, or the discrepancy root-caused. Coverage targets met |
| M4 | Playable UI: board, hints, dialogs, side panel, Scenario Lab, persistence, hero, rules page, responsive layout, accessibility. Downloading the 12 Cburnett SVGs needs your OK first | `feat: build playable Mean Chess UI` | §6.4 manual QA passes on desktop and 390×844. UI tests green |
| M5 | README, RULES, DECISIONS, ENGINE, ROADMAP, DEPLOYMENT, THIRD_PARTY_NOTICES | `docs: add rules and developer documentation` | Docs match the code. README commands work |
| M6 | Workflow + `public/CNAME`. Runbook steps 1–3 | `ci: add GitHub Pages deployment` | Workflow green. Site served |
| M7 | Domain and HTTPS (runbook steps 4–7) | (no code) | HTTPS custom domain verified in a browser |
| M8 | Final QA on production, tag `v0.1.0`, final report (handoff §53) | `chore: release v0.1.0` | Report delivered with real test counts and the commit hash |

**Definition of done** (handoff §42 and §55):
- every rule in §2 has tests;
- standard regression and perft pass;
- the game is playable end-to-end on mobile and desktop;
- special moves are visible and explained;
- the production build is deployed by Actions;
- `CNAME` and the custom domain are configured;
- the README is usable.

---

## 10. Risks and mitigations

| Risk | Mitigation |
|---|---|
| A new rules edge case appears mid-build | Decide by RULES.md. If it isn't covered, pick the simplest reading, log it in DECISIONS.md, and flag it in the final report. Never silently |
| Engine and oracle disagree on perft | Treat it as a bug in one of them. Bisect with `perft divide` before trusting either |
| TS 7 / typescript-eslint mismatch | TypeScript pinned to `~6.0.3`. Revisit when typescript-eslint widens its peer range |
| Workflow push rejected (token scope) | GCM credential, or `gh auth refresh -s workflow` (§8) |
| First deploy runs before Pages is enabled | Enable Pages (runbook step 1) before pushing the workflow |
| Subdomain takeover window | Set the domain in GitHub first, then DNS. Verify the apex domain. No wildcard records |
| DNS or certificate delay (≤ 24 h) | Don't block the release. Report the status honestly |
| CRLF churn on Windows | `.gitattributes` with `* text=auto eol=lf` |
| Scope creep (AI, multiplayer) | Explicit non-goals. They live in the roadmap |
| Mobile tap ambiguity on special moves | One tap to select, one tap to move. Explanations are always listed in the side panel, so hover is never needed |

---

## 11. Roadmap (after v0.1)
- **v0.2:**
  - "Practice vs AI": alpha-beta search in a Web Worker, built against this engine. Stockfish and Fairy-Stockfish can't express these rules, and the latter is GPL.
  - Mean-aware evaluation: material with the original queen > a promoted queen, royal threats, Kill-Zone control, tier exposure, king hunting.
  - Zobrist hashing.
  - Drag-and-drop polish, sounds, Open Graph image, PGN-style export, tutorial mode.
- **v0.3:** online play, e.g. Cloudflare Durable Objects (WebSocket rooms) or Supabase Realtime. The server validates coordinate moves with the same deterministic engine. Accounts and ratings come later.
- **Research:** Mean endgame tablebases (K+P vs K and up), opening traps (which classic mates survive), and a Mean-specific notation review once real games exist.

---

## 12. Decision log (seed for `docs/DECISIONS.md`)

| ID | Decision | Source |
|---|---|---|
| D-01 | Royal Capture: 8 straight lines, exactly 2 squares, one midpoint. From h1: f1, f3, h3 | Founder, 2026-10-07 |
| D-02 | Royal Slaughter whenever the midpoint piece is in the active tier. No check required | Founder, 2026-10-07 |
| D-03 | Desperation ignores suicidal ordinary moves | Founder, 2026-10-07 |
| D-04 | Desperation also requires no royal move. Resolves §3.1 vs §9 without changing any outcome | Blueprint |
| D-05 | A suicidal move is an ordinary move after which the opponent has a royal move. It stays legal. Cannibalism moves may themselves be suicidal | Blueprint |
| D-06 | No cannibalism outside check: stalemate stays stalemate | Handoff §3.1 |
| D-07 | The hierarchy is global, lowest tier present. Promoted pieces are classed by their new type. Only queens carry origin | Handoff §3.2–3.3, §14 |
| D-08 | The original queen can never be sacrificed. At most one original queen per side in loaded positions | Handoff §4, blueprint |
| D-09 | Royal reach is not an attack. It never affects legality, castling or check | Handoff §6, §13 |
| D-10 | Royal moves are legal while in check and skip king-safety filtering | Handoff §11 |
| D-11 | A royal move ends the game at once and overrides every other ending | Handoff §9, §15 |
| D-12 | Checkmate means in check with no legal moves after all Mean layers | Handoff §10 |
| D-13 | Draws: stalemate, threefold (automatic), fifty-move (automatic), agreement. **No insufficient-material draws** (§3.1) | Blueprint (research) |
| D-14 | The halfmove clock also resets on cannibalism | Blueprint |
| D-15 | The repetition key includes queen origin, side, castling, and en passant only when capturable. History lives in the game record, not the position | Handoff §21, blueprint |
| D-16 | Royal Slaughter through a queen is unreachable in legal play. It is tested at generator level, replacing that handoff §43 UI step | Blueprint (research) |
| D-17 | Promotion is a move field, not a kind. A move is identified by (from, to, promotion) | Blueprint |
| D-18 | Stable piece IDs that survive promotion. IDs are excluded from hashing | Handoff §18, blueprint |
| D-19 | No `hasMoved` flag | Blueprint |
| D-20 | MeanFEN = FEN + `~` for promoted queens (X-FEN/lichess convention) | Blueprint (research) |
| D-21 | MCN notation per §2.9, labelled non-SAN | Handoff §22, blueprint |
| D-22 | The engine is pure, deterministic, framework-free, with a lint-enforced boundary | Handoff §16, §49 |
| D-23 | TypeScript ~6.0.3 (typescript-eslint doesn't support 7 yet) | Blueprint (research) |
| D-24 | ESLint rather than oxlint | Handoff §17 |
| D-25 | GitHub Pages via Actions, static only. Multiplayer deferred | Handoff §31–32 |
| D-26 | Domain set in Pages settings before DNS. CNAME file kept but not relied on. Apex verification recommended | Blueprint (research) |
| D-27 | Vite `base: '/'`. Multi-page `/` and `/rules/`, no client router | Blueprint |
| D-28 | chess.js (BSD-2) as a dev-only oracle. chessops (GPL) excluded | Handoff §17, §51 |
| D-29 | Cburnett pieces under BSD-3 with attribution. Project licence MIT | Blueprint (research) |
| D-30 | v0.1 = local hot-seat play. Unlimited one-ply undo, draw by agreement, resign. Scenario Lab and MeanFEN import included | Handoff §31, blueprint |
