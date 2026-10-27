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

## v0.2.4 (released): the tutorial starts from the basics

- 16 lessons, all on the board. It starts with the king eating its own pieces: when it may (only with
  no other way out), where it may land, the order (pawns, then knights and bishops, then rooks, then
  promoted queens) and never the original queen. Then kings capturing kings. The closing page of text
  became a hands-on lesson (D-53).

## 1.0.0: online play, and Mean Chess on Google Play (planned)

The founder's decisions of 26 October 2026 (M1–M21, [MOBILE-BLUEPRINT.md](MOBILE-BLUEPRINT.md)):
- **The store launch is 1.0.0**, for the app and the website together. It includes **online play**
  (the v0.3 plan below), because the apps wait for it.
- **Android first** (Google Play). iOS follows once an Apple device is available for enrolment.
- **New in the apps:**
  - built from the same code with Capacitor; everything except online play works offline;
  - haptics, the share sheet, sound effects (on the website too), and a rare "rate us" prompt;
  - **ads** (a banner on menus; at most one full-screen ad after every 3rd finished game; never
    during a game; personalised only with consent);
  - anonymous usage counters.

  The website stays ad-free.
- **Renumbering:** the releases below keep their content and order, but online play becomes part of
  1.0.0. Clocks become 1.1, the lobby 1.2, optional accounts 1.3 and ratings 1.4.

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
