# Roadmap

Phase 2, online play and getting Mean Chess listed, is planned in detail in
[PHASE-2-BLUEPRINT.md](PHASE-2-BLUEPRINT.md) (approved 8–9 October 2026).

## v0.1 (released)

Local two-player Mean Chess in the browser: the complete rules engine, an interface that explains
every special move, Scenario Lab, original piece artwork in four themes (Mean, Sugar, Arcade,
Picnic), move and capture animations, the rules page, and deployment to GitHub Pages.

## v0.2 (released): play against the computer

- A computer opponent at three levels, Nice, Mean and Ruthless (see [AI.md](AI.md)):
  - an alpha-beta search in a Web Worker, on its own fast board, proven equal to the engine
    (Stockfish and Fairy-Stockfish cannot express Mean rules, and the latter is GPL);
  - Zobrist hashing and a transposition table;
  - an evaluation that values the original queen above a promoted one and drives a beaten king into
    the corner, where its only moves are suicidal.
- The board no longer reveals the Royal Kill Zone during play (founder ruling, D-39), nor points out a
  winning royal move (D-46).

**v0.2.1** tags what shipped after v0.2.0: the welcome page and interactive tutorial (D-48), and
no more pointing out winning royal moves (D-46).

## v0.2.2 (released): automatic difficulty

- An **Auto** level for the computer. It picks Nice, Mean or Ruthless from the player's results on
  this device, starting at Nice: two wins in a row step up, two losses in a row step down
  (decisions D-50 and P2-33).

## v0.2.3 (released): the Warlord king, and how a game ends

- A new king, the Warlord, in all four themes: the cross on a spiked war crown and a heavy visored helm.
  It is bigger and meaner than the queen (D-51).
- The final move plays out before the result appears. Then badges land on the kings, Chess.com style:
  crown, skull, flag or ½. The result box opens a moment later (D-52).
- A Royal Slaughter slices the sacrificed piece in half, with blood, before the king strikes (D-52).
- Fixed: a piece moving to a later square jumped instead of sliding.

## v0.3: play a friend online

- Invite a friend with a link. Every move is checked by the same engine, running in one Cloudflare
  Durable Object per game. Games survive refreshes, dropped connections and server deploys. Rematch,
  and share finished games. Guests only: no accounts, no chat
  ([ONLINE-ARCHITECTURE.md](ONLINE-ARCHITECTURE.md), [ONLINE-PROTOCOL.md](ONLINE-PROTOCOL.md)).
- Free to run. A daily capacity guard stops *new* online games before Cloudflare's free allowance
  could run out, so no game is ever cut off. Anyone turned away is offered the computer, always
  labelled as the computer.

## After v0.3

- **v0.4:** clocks (server-authoritative, with increment). They come before any public lobby,
  because games between strangers need them.
- **v0.5:** a public lobby, quick match and live spectating, once enough people play online.
- **v0.6:** optional accounts and game history. **v0.7:** ratings.

## Also planned

- A richer Mean evaluation: Kill Zone control, how exposed each side's sacrifice tier is, king
  hunting in the middlegame.
- Drag-and-drop moves, sound effects, and PGN-style export. An Open Graph preview image comes with the
  press kit ([DISCOVERY-AND-LISTING.md](DISCOVERY-AND-LISTING.md)).

## Ideas and research

- More themes.
- Mean Chess endgame tablebases (K+P vs K and beyond), building on `tools/research/endgames.mjs`.
- An opening guide: which classic traps survive the cannibalism rule (Scholar's mate does, Fool's
  mate does not).
- A notation review once real games exist.
