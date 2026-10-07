# Third-party notices

The Mean Chess piece artwork (vector and pixel sets) is original to this project and covered by its
MIT licence.

## Fonts shipped with the site

All are self-hosted through the [Fontsource](https://fontsource.org) packages and licensed under the
[SIL Open Font License 1.1](https://openfontlicense.org). Each font file keeps its copyright and
licence metadata.

| Font | Designer | Used by |
|---|---|---|
| Cormorant Garamond | Christian Thalmann | Mean theme |
| Pacifico | Vernon Adams | Sugar theme |
| Press Start 2P | CodeMan38 | Arcade theme |
| Fredoka | Milena Brandão, Hafontia | Picnic theme |

## Libraries shipped with the site

| Library | Licence |
|---|---|
| React, React DOM | MIT |

## Ideas borrowed by the computer opponent

The computer opponent's piece-square tables follow Tomasz Michniewski's *Simplified Evaluation
Function*, as published on the [Chess Programming Wiki](https://www.chessprogramming.org). The pawn
tables, and everything Mean Chess adds, are this project's own.

## Development-only tools (not shipped)

Vite, Vitest, TypeScript, ESLint, Testing Library and jsdom are MIT or Apache-2.0. chess.js (BSD-2-Clause)
is used only in tests, as an independent standard-chess oracle.
