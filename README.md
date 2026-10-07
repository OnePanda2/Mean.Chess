# Mean Chess

**Chess, but your king is allowed to eat his own army.**

Mean Chess is an independent chess variant. Checkmate isn't always the end, kings hunt each other,
and sometimes a king has to sacrifice his own pieces to survive.

**Play it at https://meanchess.siddheshthapa.com.** Two players share one device; there's nothing
to install and no account.

## The rules in one minute

Everything in standard chess applies, plus:

- **Royal Capture.** Only a king can capture a king, and it may do so from exactly two squares away
  in a straight line (rank, file or diagonal) when the square between is empty. That wins at once,
  even while in check.
- **Royal Kill Zone.** Standing two squares from the enemy king is legal and isn't check, but if the
  enemy king can capture yours on its turn, it will. The board won't warn you: spotting it is part of
  the game.
- **Royal Slaughter.** If one of your own *eligible* pieces stands between the kings, your king eats
  it and captures the enemy king in one move.
- **Sacrifice tiers.** Pawns, then knights and bishops, then rooks, then promoted queens. Only your
  lowest remaining tier is eligible. The original queen can never be sacrificed.
- **Royal Cannibalism.** A king in check with no safe way out may eat an adjacent eligible piece of
  its own to escape.
- **Draws.** Stalemate, threefold repetition, the fifty-move rule or agreement. Material alone never
  draws: in Mean Chess a lone knight can force a win.

The full specification is [docs/RULES.md](docs/RULES.md), and the site has an illustrated rules page.

## Features

- A rules engine that is complete and heavily tested (see *Testing* below).
- Move hints for normal moves, captures, sacrifices and winning royal captures, with every special
  move explained. Deliberately, nothing reveals the Kill Zone.
- Scenario Lab: curated positions for every rule, plus importing and sharing positions (MeanFEN) and
  whole games.
- Original piece artwork in four themes: **Mean**, **Sugar** (pink), **Arcade** (8-bit, pixel
  pieces) and **Picnic** (gingham).
- Animated moves, captures, Royal Capture and Royal Cannibalism. This can be switched off, and
  reduced-motion settings are respected.
- Undo, board flip, draw, resign, autosave, keyboard navigation, screen-reader labels, and layouts
  for phones and desktops.

## Running it locally

Requires Node.js 22.12 or newer (24 LTS recommended).

```bash
npm ci
npm run dev
```

Then open http://localhost:5173.

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm test` | All tests (engine and interface) |
| `npm run test:coverage` | Tests with the enforced engine coverage thresholds |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build |
| `npm run perft -- start 4` | Count move-tree leaves (engine check) |

## How it's built

- **Engine:** `src/engine`, pure TypeScript with no React or DOM, deterministic, and reusable by a
  future AI or game server. See [docs/ENGINE.md](docs/ENGINE.md).
- **Interface:** React 19, Vite 8, plain CSS with theme tokens. Two real pages: `/` (play) and
  `/rules/`.
- **Testing:** Vitest. Over 260 tests:
  - every rule and the original brief's acceptance scenarios;
  - published perft numbers;
  - Mean perft values predicted by an independent implementation;
  - about 20,000 positions cross-checked against chess.js;
  - invariants over about 43,000 random Mean moves.
- **Deployment:** GitHub Actions runs lint, type checks, tests and the build, then publishes to GitHub
  Pages. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Documents

- [docs/RULES.md](docs/RULES.md): Mean Chess Rules v0.1, the canonical specification.
- [docs/DECISIONS.md](docs/DECISIONS.md): every interpretation and trade-off.
- [docs/ENGINE.md](docs/ENGINE.md): engine architecture, formats and testing.
- [docs/ROADMAP.md](docs/ROADMAP.md): what comes next (AI, then online play).
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): hosting, domain and HTTPS.
- [docs/BLUEPRINT.md](docs/BLUEPRINT.md): the pre-build plan and research.

## Known limitations

- Local play only: no AI opponent and no online play yet (see the roadmap).
- Moves are made by tapping or clicking; drag-and-drop isn't supported yet.
- No sound.

## Licence

MIT. See [LICENSE](LICENSE). The piece artwork is original to this project. Fonts and libraries are
credited in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Mean Chess is an independent chess variant and is not affiliated with FIDE or any chess
organisation.
