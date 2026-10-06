# MEAN CHESS — Claude Desktop Master Build Handoff

**Project:** Mean Chess  
**Website:** `https://meanchess.siddheshthapa.com`  
**Local Windows path:** `F:\Projects\Mean Chess`  
**GitHub repo:** `https://github.com/OnePanda2/Mean.Chess`  
**Repository owner:** `OnePanda2`  
**Primary deployment target:** GitHub Pages  
**Current repo status:** Public repository, `main` branch, currently essentially empty: one commit and a 1-byte `h.txt`. Preserve existing work until inspected.

---

# 0. EXECUTION INSTRUCTION TO CLAUDE

You are the primary implementation agent for this project.

Read this entire file before modifying anything.

Build the first production-quality playable version of **Mean Chess** in one coherent pass. Do not turn this into a theoretical architecture exercise. Actually create the files, implement the engine, implement the UI, run tests, run the production build, fix failures, and leave the repository in a deployable state.

Do not ask the user unnecessary clarification questions. The rules below are the authoritative specification. Where a minor implementation detail is not explicitly specified, make the simplest reasonable choice, document it in `docs/DECISIONS.md`, and continue.

Priorities, in order:

1. **Rule correctness**
2. **Engine test coverage**
3. **Playable UX**
4. **Responsive visual quality**
5. **Deployability**
6. **Nice-to-have features**

Do not sacrifice correctness for visual polish.

Do not add online multiplayer in this first version. GitHub Pages can host the static frontend, but it is not a general-purpose backend server. Build the architecture so multiplayer can be added later without rewriting the engine.

---

# 1. PRODUCT CONCEPT

Mean Chess is a chess variant based on standard chess with two major mechanics:

1. **Royal Cannibalism:** In a desperate checkmate situation, the king may destroy one of its own pieces according to a fixed sacrifice hierarchy.
2. **Royal Capture:** Only a king may capture the opposing king. A king can capture the opposing king from up to two squares away in any of the eight directions.

The personality of the game is:

> In normal chess, your own pieces protect the king.  
> In Mean Chess, when the kingdom is doomed, the king may eat his own soldiers to survive.

And:

> The enemy king is not merely something to checkmate. It is something your king can hunt down and kill.

The original queen is effectively the king's untouchable wife. A promoted queen is not.

---

# 2. AUTHORITATIVE RULES

These rules are the source of truth for the implementation.

## 2.1 Standard chess baseline

Use normal chess rules unless specifically overridden below.

Standard rules retained:

- Board: 8×8
- White moves first
- Standard piece movement
- Standard captures
- Pawn initial two-square move
- Pawn promotion
- En passant
- Castling
- Check
- Checkmate
- Stalemate
- Standard draw conditions where practical
- Turn order
- Legal-move constraints
- A king cannot move onto an adjacent square to the enemy king

Do not silently invent additional variant rules.

---

# 3. RULE OVERRIDE A — ROYAL CANNIBALISM

## 3.1 When may the king kill its own piece?

A king may self-capture **only when it is in check and has no ordinary legal move that resolves the check**.

"Ordinary legal move" means:

- normal king movement/capture
- normal movement/capture of any other friendly piece
- castling where legal
- en passant where legal
- promotion where legal
- any other standard chess move

Royal Capture of the enemy king is a winning move and is checked separately.

Only if no non-self-capture move can save the king may Royal Cannibalism be considered.

This prevents players from casually eating their own pieces whenever convenient.

---

## 3.2 Sacrifice hierarchy

The king does NOT get to choose any friendly piece arbitrarily.

Sacrifice tiers:

### Tier 1 — Pawns
### Tier 2 — Knights and Bishops
### Tier 3 — Rooks
### Tier 4 — Promoted Queens
### Never — Original Queen
### Never — King

The hierarchy is based on **fixed piece class**, not dynamic chess evaluation.

Do NOT use conventional point values such as 1/3/3/5/9 for legality.

---

## 3.3 Global hierarchy condition

The hierarchy is global across that player's pieces.

If the player has at least one pawn anywhere on the board, the king may self-capture **only a pawn**.

If no pawns remain, but at least one knight or bishop remains, the king may self-capture only a knight or bishop.

If no pawns, knights, or bishops remain, but a rook remains, the king may self-capture only a rook.

If no lower tier remains, a promoted queen may be self-captured.

The existence of a higher-tier piece elsewhere on the board does not matter.

Example:

- White has a pawn on a7.
- White king is next to its own bishop.
- King is otherwise checkmated.

The bishop cannot be self-captured because White still has a pawn.

If the pawn on a7 is removed, the bishop may become eligible.

---

## 3.4 Only adjacent pieces can normally be self-captured

Royal Cannibalism is a king move.

Therefore the king cannot magically remove a friendly piece across the board.

A normally self-capturable friendly piece must be on one of the king's eight adjacent squares.

The king moves onto that square and removes the friendly piece.

---

## 3.5 Self-capture legality

A self-capture is legal only if:

1. The king is currently in check.
2. No ordinary legal move resolves the check.
3. The target friendly piece belongs to the currently eligible sacrifice tier.
4. The friendly piece is adjacent to the king.
5. The resulting position is legal under the normal king-safety rules.
6. The move does not violate the adjacent-kings restriction.

The resulting position must be re-evaluated for check.

If removing the piece exposes the king to an attack that still exists, the self-capture is illegal.

---

# 4. RULE OVERRIDE B — ORIGINAL QUEEN VS PROMOTED QUEEN

This distinction is mandatory.

A queen created through pawn promotion is **not equivalent** to the original queen for Mean Chess rules.

Every queen must carry origin metadata:

```ts
type QueenOrigin = "original" | "promoted";
```

A queen that started the game as the queen is:

```text
origin = original
```

A queen created by promotion is:

```text
origin = promoted
```

## Original queen

The king can NEVER self-capture the original queen.

No exception.

## Promoted queen

A promoted queen belongs to Tier 4 and may be self-captured once all lower sacrifice tiers have disappeared.

This distinction must survive:

- move generation
- undo
- redo/history if implemented
- game serialization
- position hashing
- saved games
- tests

Two visually identical queens can represent different game states.

---

# 5. RULE OVERRIDE C — ROYAL CAPTURE

## 5.1 Only kings can capture kings

No piece other than a king may capture a king.

A rook, bishop, knight, queen, or pawn can still give "check" according to normal chess attack geometry, but it may not directly execute the terminal king capture.

The UI must never allow a non-king to capture a king.

---

## 5.2 Royal Capture range

A king may capture the opposing king from a maximum distance of **two squares** in any of the eight directions.

Distance 2 is allowed horizontally, vertically, and diagonally.

Distance 1 remains prohibited because adjacent kings are illegal.

Use Chebyshev distance:

```text
distance = max(abs(fileDelta), abs(rankDelta))
```

Royal Capture is available at distance exactly 2.

Examples:

From H1, the enemy king can be captured on:

```text
F1
F2
F3
G1
G2
H2
H3
```

Not:

```text
E1
E2
E3
D4
```

Also not adjacent squares because kings cannot be adjacent.

Important: the Royal Kill Zone is **not a forbidden zone**.

A king may voluntarily move into the opponent's two-square Royal Kill Zone.

Doing so exposes it to immediate capture.

---

# 6. RULE OVERRIDE D — ROYAL KILL ZONE

The opponent's two-square Royal Capture range is a **danger zone**, not an illegal area.

Therefore:

Legal:

```text
White King at H1
Black King at F3
```

This means White has a Royal Capture available.

Black was allowed to move to F3.

White can immediately capture Black's king and win.

The game engine must NOT reject a non-adjacent king position merely because the kings are within two squares.

Only adjacent kings remain illegal.

---

# 7. RULE OVERRIDE E — NO JUMPING

A king cannot normally jump over a piece to execute Royal Capture.

If the enemy king is exactly two squares away, inspect the intervening square.

### Empty intermediate square

Normal Royal Capture:

```text
K . K
```

The king captures the enemy king.

### Friendly piece on intermediate square

Example:

```text
K P K
```

The king is blocked.

However, if that friendly piece is legally eligible for Royal Cannibalism under the sacrifice hierarchy, a special combined move exists.

---

# 8. RULE OVERRIDE F — ROYAL SLAUGHTER

**Royal Slaughter** is the special two-stage-looking capture represented as one move.

If:

```text
Friendly King
   ↓
Eligible friendly piece
   ↓
Enemy King
```

and the kings are exactly two squares apart, the king may:

1. remove its own eligible blocking piece, and
2. capture the enemy king beyond it,
3. ending the game immediately.

This is one atomic move from the engine's perspective.

Example:

```text
White King — White Pawn — Black King
```

If the pawn is the current eligible sacrifice tier:

```text
Royal Slaughter
```

White wins immediately.

---

## 8.1 Royal Slaughter restrictions

The intermediate piece must be:

- friendly
- on the exact intervening square
- eligible under the current hierarchy

If the intermediate piece is an enemy non-king piece, the king cannot jump through it.

If the intermediate piece is the original queen, Royal Slaughter is impossible because the original queen is never self-capturable.

If the intermediate piece is a higher-tier friendly piece while a lower-tier piece exists elsewhere, Royal Slaughter is impossible.

---

# 9. PRIORITY OF TERMINAL CONDITIONS

Royal Capture ends the game immediately.

This includes Royal Slaughter.

Therefore, if a king has a legal Royal Capture available, that move is a winning move.

Treat Royal Capture as a distinct terminal action rather than as ordinary checkmate.

Recommended engine ordering:

1. Generate Royal Capture / Royal Slaughter winning moves.
2. Generate normal legal moves.
3. Determine check status and checkmate/stalemate.
4. If in check and no ordinary legal move exists, generate legal Royal Cannibalism moves.
5. Re-evaluate resulting positions.

A practical implementation may generate all moves together, but the semantic distinction must remain explicit.

---

# 10. CHECK AND CHECKMATE MODEL

Do NOT remove traditional check/checkmate from Mean Chess.

Traditional pieces still create check according to normal chess attack geometry.

The difference is that checkmate now has an additional escape layer.

Definition:

> A king is checkmated only when it is in check, has no ordinary legal move to escape, has no legal Royal Capture available, and has no legal Royal Cannibalism escape.

Stalemate remains a draw if the side has no legal move and is not in check.

---

# 11. IMPORTANT KING-CAPTURE EDGE CASE

If the side to move has a legal Royal Capture of the opposing king, it can win immediately.

This should remain true even if the side's king is currently under attack by an ordinary piece.

Reason: Royal Capture is the terminal winning action of this variant.

Document this design decision clearly.

---

# 12. ADJACENT KING RULE

Kings may not occupy adjacent squares.

That remains exactly like standard chess.

Distance 1:

```text
K K
```

Illegal.

Distance 2:

```text
K . K
```

Legal, but the king with the move may Royal Capture.

This is intentional.

---

# 13. CASTLING

Keep normal castling rules unless directly contradicted by the rules above.

Important:

- The king still moves two squares when castling.
- Castling remains distinct from Royal Capture.
- Royal Capture is the only other normal king action involving a two-square destination.
- The king may be castled into a Royal Kill Zone because entering the two-square danger zone is allowed.
- The king may NOT castle into an adjacent square to the enemy king.
- During castling, standard attack/path rules still apply for conventional checks.

Document the exact interaction in tests.

---

# 14. PROMOTION

Use normal chess promotion rules.

For the initial implementation, support:

- Queen
- Rook
- Bishop
- Knight

Track queen ancestry exactly.

If a pawn promotes to a queen:

```text
origin = promoted
```

If a game state starts with the normal queen:

```text
origin = original
```

Do not infer ancestry from position later.

---

# 15. DRAW RULES

Implement standard draw conditions where practical.

At minimum:

- stalemate
- threefold repetition if the engine architecture supports it
- fifty-move rule

Also support insufficient-material logic where meaningful.

Important: the game ends immediately on Royal Capture, even if a conventional draw condition might otherwise apply on that move.

---

# 16. ENGINE ARCHITECTURE

Do NOT make the React UI responsible for chess rules.

Create a standalone engine package/module.

Suggested architecture:

```text
src/
├── app/
│   ├── App.tsx
│   └── routes/
├── components/
│   ├── ChessBoard.tsx
│   ├── Square.tsx
│   ├── Piece.tsx
│   ├── MoveList.tsx
│   ├── GameStatus.tsx
│   ├── CapturedPieces.tsx
│   ├── PromotionDialog.tsx
│   ├── RulesPanel.tsx
│   └── GameControls.tsx
├── engine/
│   ├── types.ts
│   ├── constants.ts
│   ├── board.ts
│   ├── attacks.ts
│   ├── movement.ts
│   ├── legalMoves.ts
│   ├── checks.ts
│   ├── meanRules.ts
│   ├── royalCapture.ts
│   ├── cannibalism.ts
│   ├── promotion.ts
│   ├── castling.ts
│   ├── notation.ts
│   ├── serialization.ts
│   ├── hashing.ts
│   └── game.ts
├── tests/
│   ├── standardRules.test.ts
│   ├── cannibalism.test.ts
│   ├── royalCapture.test.ts
│   ├── royalSlaughter.test.ts
│   ├── queenOrigin.test.ts
│   ├── checkmate.test.ts
│   ├── castling.test.ts
│   ├── promotion.test.ts
│   ├── drawRules.test.ts
│   └── regression.test.ts
├── styles/
│   └── ...
└── main.tsx
```

Adjust filenames if a cleaner structure is technically better.

---

# 17. TECHNOLOGY CHOICE

Recommended stack:

- React
- TypeScript
- Vite
- Plain CSS or CSS Modules
- Vitest for tests
- ESLint
- GitHub Actions
- GitHub Pages

Prefer minimal dependencies.

## Chess library guidance

Do not make the project dependent on a standard chess library whose legality model fundamentally rejects the Mean Chess king rules.

You may use `chess.js` or another MIT-compatible library as a **standard-chess comparison/oracle** for portions of the normal rules if useful.

Do not force Mean Chess rules into a library abstraction that was designed to forbid king capture.

A custom Mean Chess engine is acceptable and likely clearer.

`chessops` is variant-aware and technically attractive, but its current package is GPL-3.0-or-later. Do not introduce GPL licensing into this repository without explicitly documenting the consequence and obtaining approval.

---

# 18. INTERNAL BOARD STATE

Use a typed representation.

Suggested:

```ts
type Color = "white" | "black";

type PieceType =
  | "pawn"
  | "knight"
  | "bishop"
  | "rook"
  | "queen"
  | "king";

type QueenOrigin = "original" | "promoted";

type Piece = {
  id: string;
  color: Color;
  type: PieceType;
  queenOrigin?: QueenOrigin;
  hasMoved: boolean;
};
```

Only queens need `queenOrigin`.

Use stable piece IDs because piece ancestry and history matter.

---

# 19. MOVE TYPES

Do not represent every move as a generic capture.

Use explicit move kinds, for example:

```ts
type MoveKind =
  | "normal"
  | "capture"
  | "castle-kingside"
  | "castle-queenside"
  | "en-passant"
  | "promotion"
  | "self-capture"
  | "royal-capture"
  | "royal-slaughter";
```

A move should contain enough metadata for:

- undo
- notation
- animation
- history
- debugging
- testing
- serialization

Example:

```ts
type Move = {
  kind: MoveKind;
  from: Square;
  to: Square;
  pieceId: string;
  capturedPieceId?: string;
  selfCapturedPieceId?: string;
  promotion?: PieceType;
  notation?: string;
};
```

---

# 20. POSITION SERIALIZATION

Do not rely on standard FEN alone because FEN does not encode original-vs-promoted queen ancestry.

Create a custom serializable Mean Chess state.

For example:

```ts
type MeanPosition = {
  board: Board;
  sideToMove: Color;
  castlingRights: CastlingRights;
  enPassantSquare: Square | null;
  halfmoveClock: number;
  fullmoveNumber: number;
  moveHistoryHash: string;
};
```

Ensure queen origin is serialized through the piece data.

A URL-shareable position format can be added after the core engine works.

---

# 21. POSITION HASHING / REPETITION

The position hash must distinguish:

- board placement
- side to move
- castling rights
- en passant state
- original vs promoted queen identity

Do not hash only a normal FEN string.

If two positions look identical but differ in queen ancestry, they are different Mean Chess states.

---

# 22. MOVE NOTATION

Use readable human-facing notation.

Standard moves can resemble SAN.

Variant moves should be explicit.

Examples:

```text
e4
Nf3
O-O
Qxf7+
K×own P
K×own N
K×K
K×own P×K
```

Possible preferred labels:

- `K×P (own)`
- `K×N (own)`
- `K×B (own)`
- `K×R (own)`
- `K×Qp (own)` for promoted queen
- `K×K`
- `K×P×K` for Royal Slaughter

Do not pretend these are official SAN. Label the history as Mean Chess notation.

The exact notation can be refined after engine correctness.

---

# 23. TESTING STRATEGY

Testing is not optional.

The highest-risk area is the rules engine.

Create deterministic unit tests for every Mean Chess rule.

## 23.1 Royal Capture tests

Test:

- horizontal distance 2
- vertical distance 2
- diagonal distance 2
- distance 1 forbidden
- distance 3 forbidden
- exact corner cases
- kings can legally be within distance 2
- Royal Capture immediately ends game
- non-king cannot capture king
- Royal Capture can win when the moving king is currently in ordinary check

---

## 23.2 King adjacency tests

Test:

- kings cannot occupy adjacent squares
- king cannot move adjacent to opposing king
- king can move into distance-2 Royal Kill Zone
- distance-2 position is not automatically illegal

---

## 23.3 Royal Slaughter tests

Test:

```text
K P K
```

with:

- eligible pawn
- ineligible knight while a pawn remains
- ineligible bishop while a pawn remains
- ineligible rook while lower tier remains
- promoted queen only after lower tiers are absent
- original queen must never permit Royal Slaughter
- enemy piece as blocker must not be jumped
- empty square performs ordinary Royal Capture
- diagonal blockers
- vertical blockers
- horizontal blockers

---

## 23.4 Cannibalism hierarchy tests

Explicitly test:

### Pawn exists
Can kill pawn: yes  
Can kill knight: no  
Can kill bishop: no  
Can kill rook: no  
Can kill promoted queen: no  
Can kill original queen: no

### No pawns, knight exists
Can kill knight: yes  
Can kill bishop: yes  
Can kill rook: no  
Can kill promoted queen: no

### No pawns/minors, rook exists
Can kill rook: yes  
Can kill promoted queen: no

### Only promoted queen remains
Can kill promoted queen: yes

### Original queen only
Cannot self-capture it.

---

# 24. CHECKMATE ESCAPE TESTS

Create positions where conventional chess says checkmate, but Mean Chess should allow survival.

Minimum cases:

- back-rank mate with eligible pawn
- smothered-mate-like position with eligible pawn
- king trapped by its own pawn
- king trapped by knight/bishop after all pawns are gone
- rook-tier sacrifice
- promoted-queen sacrifice
- original-queen trap where no legal cannibalism is possible

Create corresponding positions where self-capture is visually possible but illegal because the hierarchy blocks it.

---

# 25. STANDARD CHESS REGRESSION TESTS

The variant must not break ordinary chess.

Test:

- pawn movement
- pawn double move
- pawn captures
- knights
- bishops
- rooks
- queens
- kings
- castling
- en passant
- promotion
- pins
- discovered checks
- double check
- ordinary check
- ordinary checkmate
- stalemate

For standard positions that contain no Mean Chess-specific move, results should agree with a trusted standard implementation where practical.

Use `chess.js` as a comparison oracle if helpful.

---

# 26. PERFT-STYLE TESTING

Build a small perft utility for the Mean Chess engine.

At minimum support:

```text
perft(position, depth)
```

Use it for known standard positions and Mean Chess-specific positions.

The purpose is to detect move-generation bugs where UI testing might miss subtle illegal moves.

Print:

- total nodes
- captures
- promotions
- castles
- en passant
- self-captures
- Royal Captures
- Royal Slaughters

This also creates the foundation for a future Mean Chess AI.

---

# 27. UI PRODUCT REQUIREMENTS

The website should immediately communicate that this is a chess variant, not another generic chess clone.

Homepage/play screen should have:

- Mean Chess title
- chess board
- turn indicator
- game status
- move list
- captured pieces
- New Game button
- Undo button if engine history supports it
- Rules button
- board coordinates
- last-move highlight
- check highlight
- Royal Kill Zone visual indication when relevant
- clear special-move indication

When the current king is allowed to self-capture, the eligible friendly pieces should receive a distinct visual treatment.

When a king is inside the opponent's Royal Kill Zone, show a subtle warning such as:

```text
ROYAL KILL ZONE
```

Do not make the board visually chaotic.

---

# 28. USER EXPERIENCE FOR SPECIAL RULES

The user should never have to guess why a move is legal or illegal.

When selecting a king:

- ordinary legal moves are shown normally
- legal self-capture squares are shown with a distinct indicator
- Royal Capture target is strongly highlighted
- Royal Slaughter target is strongly highlighted
- unavailable self-capture pieces should not be highlighted

On hover/click of a special move, show a small explanation:

Example:

```text
Royal Capture
Your king can capture the opposing king from two squares away.
```

Example:

```text
Royal Cannibalism
You are in checkmate under normal chess rules.
Your king may sacrifice this pawn to escape.
```

Example:

```text
Blocked Royal Capture
The piece between the kings is eligible for sacrifice.
Royal Slaughter is available.
```

---

# 29. RULES PAGE

Create `/rules` or an equivalent in-app rules modal/page.

It should explain:

1. Standard chess basics
2. Royal Cannibalism
3. Sacrifice hierarchy
4. Original vs promoted queen
5. Royal Capture
6. Royal Kill Zone
7. Adjacent kings restriction
8. Royal Slaughter
9. How the game ends

Use diagrams/examples.

Do not write jokes into the formal rules text. The game can have personality elsewhere.

---

# 30. LANDING PAGE / BRANDING

Brand:

# MEAN CHESS

Suggested tagline:

> **Chess, but your king is allowed to eat his own army.**

Secondary explanation:

> A chess variant where checkmate isn't always the end, kings can hunt each other, and sometimes the king has to sacrifice his own pieces to survive.

Style direction:

- dark, premium, slightly sinister
- strong typography
- chess-board visual language
- restrained color palette
- no cartoonish gaming aesthetic
- responsive
- fast

The landing page should have a clear primary CTA:

```text
PLAY MEAN CHESS
```

And secondary actions:

```text
HOW IT WORKS
```

---

# 31. INITIAL GAME MODE

Version 1 should support:

## Local 2-player

Same browser/device.

No account required.

No backend required.

The first successful version should let two people sit at the same computer and play an entire Mean Chess game correctly.

Optional:

## Practice vs basic AI

Only implement this if the engine is completely correct and the AI does not delay the launch of the core game.

Do NOT let AI work block deployment.

---

# 32. FUTURE ARCHITECTURE

Design the core engine so future modes can be added:

```text
Local 2-player
      ↓
Engine API
      ↓
AI
      ↓
Online multiplayer backend
      ↓
Accounts / rating / games
```

The frontend should call an engine API rather than embedding rules directly into visual components.

Future backend candidates:

- Supabase
- Cloudflare Workers
- Vercel
- Render
- WebSocket server

Do not implement these in v1.

---

# 33. FILE STRUCTURE

Preferred final repository:

```text
Mean.Chess/
├── public/
│   ├── favicon.svg
│   └── CNAME
├── src/
│   ├── app/
│   ├── components/
│   ├── engine/
│   ├── styles/
│   └── main.tsx
├── tests/
├── docs/
│   ├── RULES.md
│   ├── DECISIONS.md
│   ├── ENGINE.md
│   └── ROADMAP.md
├── .github/
│   └── workflows/
│       └── deploy.yml
├── .gitignore
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── README.md
└── LICENSE
```

Use an existing repository file such as `h.txt` only if inspection shows that it contains something meaningful. Otherwise preserve it initially, but it may be removed or archived during cleanup with a documented commit.

---

# 34. DEPLOYMENT

Use GitHub Pages.

Create:

```text
.github/workflows/deploy.yml
```

The workflow should:

1. checkout repository
2. install Node dependencies
3. run lint
4. run unit tests
5. run production build
6. deploy `dist/` to GitHub Pages

The project must build successfully in a clean environment.

---

# 35. CUSTOM DOMAIN

The target domain is:

```text
meanchess.siddheshthapa.com
```

Create:

```text
public/CNAME
```

containing exactly:

```text
meanchess.siddheshthapa.com
```

Keep the CNAME in source control for clarity and compatibility, but do NOT assume the CNAME file alone configures the domain when publishing through a custom GitHub Actions workflow. The GitHub Pages repository setting for the custom domain must also be configured.

Configure Vite for the production custom-domain path.

Do not assume GitHub controls DNS.

The user will need to create a DNS record with the DNS provider:

```text
Type: CNAME
Name: meanchess
Target: OnePanda2.github.io
```

Then GitHub Pages must be configured to use:

```text
meanchess.siddheshthapa.com
```

Enable HTTPS once GitHub reports that the custom domain is verified.

If GitHub pages configuration cannot be automated from the available environment, document the remaining manual clicks in `docs/DEPLOYMENT.md`.

---

# 36. LOCAL PATH / GIT WORKFLOW

The project must live locally at:

```text
F:\Projects\Mean Chess
```

Expected workflow:

```powershell
cd "F:\Projects\Mean Chess"
git status
git remote -v
```

Remote should point to:

```text
https://github.com/OnePanda2/Mean.Chess.git
```

If the folder does not yet contain the repository, clone it there.

If the folder exists and is already a Git working tree, inspect it before doing anything destructive.

Do not delete user files blindly.

---

# 37. GIT COMMITS

Use meaningful commits.

Suggested final commits:

```text
feat: bootstrap Mean Chess web app
feat: implement Mean Chess rules engine
test: add comprehensive Mean Chess rule coverage
feat: build playable Mean Chess UI
docs: add rules and developer documentation
ci: add GitHub Pages deployment
```

Push to `main` only after the local test suite and production build pass.

---

# 38. README

README should contain:

- Mean Chess description
- live website
- rule summary
- screenshots if easy
- local setup
- development commands
- test commands
- deployment architecture
- known limitations
- roadmap
- licensing
- note that the project is an independent chess variant

Suggested commands:

```bash
npm install
npm run dev
npm test
npm run build
npm run preview
```

Also include a command for linting.

---

# 39. DOCUMENT THE RULESET AS A VERSIONED SPEC

Create:

```text
docs/RULES.md
```

Title:

# Mean Chess Rules v0.1

Treat this as the canonical written specification.

Do not let implementation behavior silently become the rules.

When a rule changes later, update:

```text
docs/RULES.md
```

and the corresponding tests.

---

# 40. DESIGN DECISIONS DOCUMENT

Create:

```text
docs/DECISIONS.md
```

Record important interpretations, including:

- self-capture only after normal escape options fail
- hierarchy is global
- original queen is permanently protected from self-capture
- promoted queen is sacrificial
- adjacent kings remain illegal
- two-square King Kill Zone is legal
- Royal Capture is terminal
- Royal Capture takes priority over conventional game continuation
- Royal Slaughter is atomic
- GitHub Pages is static hosting, not a backend
- online multiplayer is deferred

This file exists so future developers do not have to reverse-engineer the founder's brain from commit history.

---

# 41. ENGINE DOCUMENTATION

Create:

```text
docs/ENGINE.md
```

Explain:

- board representation
- piece identity
- queen origin metadata
- move generation
- legal move filtering
- check/checkmate detection
- Royal Capture
- Royal Slaughter
- Royal Cannibalism hierarchy
- position hashing
- repetition handling
- serialization

---

# 42. QUALITY BAR

The build is NOT complete merely because:

```text
npm run dev
```

opens a board.

It is complete only when all are true:

### Engine
- Standard chess movement works.
- Mean Chess rules work.
- Illegal moves are rejected.
- Special moves are represented distinctly.
- Game-end conditions are correct.
- Queen ancestry is tracked.

### Testing
- Test suite passes.
- Edge cases are covered.
- Standard-chess regression tests pass.
- Perft-style checks are available.

### UI
- Game is playable.
- Special moves are clearly visible.
- Illegal moves are not selectable.
- Rules are understandable.
- Mobile layout works.
- Desktop layout works.

### Deployment
- Production build passes.
- GitHub Actions workflow is present.
- GitHub Pages deployment is configured.
- CNAME exists.
- README is usable.

---

# 43. ACCEPTANCE TEST: THE FOUNDATIONAL SCENARIO

Before calling the project complete, manually verify this scenario.

1. Put White King on H1.
2. Put Black King on F3.
3. Ensure no adjacent-kings violation exists.
4. Confirm Black is legally allowed to move/stay on F3.
5. On White's turn, White has a visible Royal Capture against F3.
6. White selects the king and sees F3 as a terminal winning move.
7. White executes the move.
8. Game immediately ends.
9. Move history records Royal Capture.
10. No ordinary piece is allowed to capture a king.

Then test:

```text
White King — White Pawn — Black King
```

where the kings are exactly two squares apart.

If the pawn is the active sacrifice tier:

- Royal Slaughter must be available.
- Executing it removes the pawn.
- Black's king is captured.
- Game immediately ends.

Then repeat with:

```text
White King — White Knight — Black King
```

while a white pawn exists elsewhere.

Royal Slaughter must NOT be available.

Remove the pawn.

Royal Slaughter becomes available.

Then repeat the blocker test with an original queen.

Royal Slaughter must never be available.

Then repeat with a promoted queen after all lower tiers are exhausted.

Royal Slaughter must be available.

---

# 44. ACCEPTANCE TEST: CHECKMATE ESCAPE

Construct a position that is conventional checkmate but where the king has an adjacent eligible pawn.

Expected behavior:

- Standard chess would call it checkmate.
- Mean Chess must show the pawn as a legal Royal Cannibalism escape.
- Executing the self-capture continues the game.
- The pawn is removed.
- The move history identifies it as self-capture.

Then construct the same type of position with:

- eligible knight
- eligible bishop
- eligible rook
- promoted queen
- original queen

Verify the hierarchy in each case.

---

# 45. ACCEPTANCE TEST: KING KILL ZONE

Verify:

### Legal
```text
K . K
```

### Illegal
```text
K K
```

### Legal winning move
A king at distance 2 captures the enemy king.

### Illegal capture
A king at distance 3 cannot capture.

### Blocked
```text
K . enemy-piece K
```

if more than two squares away, no Royal Capture.

### Royal Slaughter
```text
K own-eligible-piece K
```

works.

---

# 46. UI VISUAL LANGUAGE

Use three levels of emphasis:

### Normal legal move
Subtle square indicator.

### Special Mean Chess move
Stronger indicator, preferably with an icon/label.

### Immediate win
Very strong target highlight and post-move game-over state.

Do not rely solely on color because of accessibility.

Use text or symbols as secondary cues.

---

# 47. OPTIONAL NICE-TO-HAVE FEATURES

Only after the core game is correct:

- sound effects
- move animations
- board theme selector
- light/dark mode
- game export
- position sharing
- keyboard controls
- move history copy
- basic AI
- tutorial mode
- "Why can I do this?" rule explanations
- game statistics

Do not let these delay the core launch.

---

# 48. AI ROADMAP

A Mean Chess AI is NOT part of the mandatory v1.

But make the engine suitable for one.

Future evaluation should understand:

- material
- king safety
- Royal Kill Zone control
- Royal Capture threats
- Royal Slaughter opportunities
- sacrificial hierarchy
- original queen value
- promoted queen value
- king mobility
- forced cannibalism
- mating nets
- opposition-like king hunting

Standard Stockfish is not automatically a valid Mean Chess engine because its rules assume standard king safety and no king capture.

A future AI should be built against the Mean Chess engine itself.

---

# 49. ONLINE MULTIPLAYER ROADMAP

Not v1.

Future architecture:

```text
Browser
  |
  v
Mean Chess Engine
  |
  v
Game State
  |
  +---- Local game
  |
  +---- WebSocket transport
             |
             v
         Game Server
             |
             +---- Matchmaking
             +---- Rooms
             +---- Reconnect
             +---- Game persistence
```

The engine must be deterministic so the server can validate moves.

Do not place authoritative rules only in React components.

---

# 50. SECURITY / RELIABILITY

Even though v1 is local/static:

- no secrets in repository
- no hard-coded API keys
- no unnecessary backend dependencies
- no remote code injection
- no untrusted HTML rendering
- validate serialized positions before loading
- avoid arbitrary code evaluation
- keep dependency count small

---

# 51. LICENSING

Use a permissive project license unless otherwise instructed.

Preferred default:

```text
MIT
```

Before adding third-party chess libraries, inspect their licenses.

Do not accidentally convert the project into a GPL-dependent application without documenting it.

---

# 52. FINAL BUILD CHECKLIST FOR CLAUDE

Before stopping, execute:

```powershell
cd "F:\Projects\Mean Chess"
git status
npm install
npm test
npm run build
```

Then inspect the generated production output.

Run the app locally and manually play:

- opening
- normal captures
- castling
- promotion
- check
- checkmate
- self-capture
- hierarchy changes
- Royal Capture
- Royal Slaughter
- stalemate

Fix every error discovered.

Then:

```powershell
git status
git add .
git commit -m "feat: launch Mean Chess v0.1"
git push origin main
```

Only push after tests/build pass.

---

# 53. FINAL REPORT CLAUDE MUST RETURN

At the end of the implementation, return a concise report containing:

## Build
- what was built
- stack
- major files

## Rules
- confirmation that each Mean Chess rule is implemented

## Tests
- number of tests
- pass/fail
- notable edge cases tested

## Deployment
- GitHub Pages status
- custom domain status
- exact remaining manual DNS/GitHub clicks, if any

## Local
- exact command to run the project locally

## Git
- final commit hash
- branch
- remote

## Known limitations
- anything intentionally deferred

Do not claim the custom domain is live unless it was actually verified.

---

# 54. IMPORTANT: DO NOT OVERENGINEER V1

This is a chess variant, not a Silicon Valley infrastructure summit.

The product goal is:

> **A person opens meanchess.siddheshthapa.com and can immediately play Mean Chess correctly.**

Do not spend the first build implementing:

- accounts
- payments
- social graphs
- matchmaking
- databases
- microservices
- Kubernetes
- analytics pipelines
- cloud event buses
- an AI supercomputer

Those are future problems.

The first problem is making sure a king can eat the correct pawn at the correct moment without the entire board bursting into flames.

---

# 55. PROJECT SUCCESS DEFINITION

Mean Chess v0.1 is successful when:

1. The game is playable in a browser.
2. The engine correctly enforces standard chess.
3. The engine correctly enforces Royal Cannibalism.
4. The hierarchy is enforced exactly.
5. Original and promoted queens are distinguished.
6. Kings cannot be adjacent.
7. Kings can voluntarily enter the two-square Royal Kill Zone.
8. Only kings can capture kings.
9. Royal Capture works at distance two.
10. Royal Slaughter works through an eligible friendly blocker.
11. Royal Capture ends the game immediately.
12. Checkmate requires checking the cannibalism escape layer.
13. The project builds cleanly.
14. Tests pass.
15. The repository is deployable through GitHub Pages.
16. The custom-domain configuration is ready.

---

# 56. ONE-SENTENCE PRODUCT DEFINITION

Use this internally as the simplest description of the game:

> **Mean Chess is standard chess where a desperate king can sacrifice its own army according to a strict hierarchy, while kings can hunt and capture each other from two squares away.**

Build this version first. Everything else comes later.
