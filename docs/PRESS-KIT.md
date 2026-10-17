# Mean Chess press kit

Everything needed to write about Mean Chess, post it or list it, in one place. The files are
served from the site, so every post can link to the same copies:
`https://meanchess.siddheshthapa.com/press/…`. Images and clips may be used freely when writing
about Mean Chess.

**Community posts are written by the founder, in their own words** (decision F11). This kit gives the
facts, the pictures and the links; it is not post text to copy.

## Facts

| | |
|---|---|
| Name | Mean Chess |
| Creator | Siddhesh Thapa |
| Play | https://meanchess.siddheshthapa.com (free, no sign-up, works on phones) |
| Learn | https://meanchess.siddheshthapa.com/tutorial/ (16 lessons on a real board) |
| Rules | https://meanchess.siddheshthapa.com/rules/ (Rules v0.1, October 2026) |
| Source | https://github.com/OnePanda2/Mean.Chess (MIT licence) |
| Contact | https://github.com/OnePanda2/Mean.Chess/issues |
| Modes | Against the computer (Nice, Mean, Ruthless, or Auto, which picks the level from your results), or a friend on the same device. Online play is planned. |

## Descriptions

**One sentence.** Mean Chess is standard chess with a deadlier king: it can kill the enemy king from
two squares away, and eat its own army to survive.

**About 50 words.** Mean Chess is ordinary chess with a lethal king. A king two squares from the enemy
king, in a straight line, captures it and wins instantly, even by eating its own piece in between.
Trapped in check, a king may eat an adjacent friendly piece to escape, pawns first. The original queen
is never food.

**The rules in about 150 words.** Everything in chess still applies, with three new powers for the
king.
- **Royal Capture.** Only a king can capture a king. When the two kings stand exactly two squares apart
  on a row, column or diagonal, with the square between them empty, the king to move captures the
  other and wins on the spot, even while in check.
- **Royal Slaughter.** If that square holds one of the mover's own pieces, the king may eat it and
  capture the enemy king in the same move. An enemy piece in between blocks it.
- **Royal Cannibalism.** A king in check with no other way out may eat a piece of its own standing
  next to it, if it is safe there afterwards.
- **The order.** A king eats pawns first, then knights and bishops, then rooks, then promoted queens:
  only the cheapest group still on the board. The original queen can never be eaten.

There is no draw for lack of material. Full rules: https://meanchess.siddheshthapa.com/rules/

**What makes it different.**
1. Only kings can capture kings, from two squares away: Royal Capture.
2. A king can eat its own piece standing between the kings to do it: Royal Slaughter.
3. A trapped king can eat its own neighbour to escape check: Royal Cannibalism.
4. A strict eating order: pawns, then knights and bishops, then rooks, then promoted queens.
5. The original queen is untouchable; promoted queens are not.
6. An enemy piece between the kings blocks everything, so every piece between them is its owner's
   shield and weapon. Fool's mate doesn't work (the king eats a pawn); Scholar's mate still does.

**Taglines.** "Kings kill kings." · "The king is the deadliest piece on the board." · "Fool's mate
doesn't work here."

**Please don't say:** "chess with self-capture" (it undersells it); "the first variant ever to…";
anything implying Chess.com or Lichess endorsement; "AI-designed" (it isn't).

## Pictures

| File | What it shows |
|---|---|
| [`og.png`](../public/press/og.png) (1200×630) | Link preview: a Royal Slaughter mid-slice, "Kings kill kings." Every page uses it. |
| [`social-preview.png`](../public/press/social-preview.png) (1280×640) | The same card for GitHub's social preview |
| [`screenshot-mean.png`](../public/press/screenshot-mean.png) (1600×1000) | The play page mid-game, Mean theme |
| [`screenshot-themes.png`](../public/press/screenshot-themes.png) | The four themes side by side: Mean, Sugar, Arcade, Picnic |

## Clips

| File | What it shows |
|---|---|
| [`royal-slaughter.mp4`](../public/press/royal-slaughter.mp4) (1080p, 6 s) and [`.gif`](../public/press/royal-slaughter.gif) (board only) | From a real computer game: in check, the white king slices its own pawn in half and takes the black king; then the badges. |
| [`cannibalism.mp4`](../public/press/cannibalism.mp4) (1080p, 5 s) and [`.gif`](../public/press/cannibalism.gif) (board only) | Fool's mate fails: the queen gives "mate", and the white king eats its own e2 pawn to escape. |
| `media/press/royal-slaughter-vertical.mp4` (1080×1920, 12 s; **not on the site**) | For YouTube Shorts, TikTok and Reels: the last four moves of the demo game, ending in a Royal Slaughter and "White wins". The founder posts it from personal accounts. |

The clips are made by `media/recorder/clip.mjs` (local tooling, not in the repository) on a virtual
clock, so every frame lands exactly on time.

## Example game

A real game between the computer's Mean (White) and Nice (Black) levels, checked move by move by the
rules engine. It ends with a Royal Slaughter played **while in check**: the black king walked to b2,
the white king came to d2 with its own pawn on c2 between them, and Black's queen check couldn't stop
the royal move.

1\. Nc3 e6 2. d4 Nh6 3. Nf3 Bb4 4. Bg5 Be7 5. Bxe7 Qxe7 6. h3 Qb4 7. Rb1 d5 8. a3 Qf8 9. e3 Qd6 10.
Qe2 Nc6 11. Qd2 Rb8 12. e4 a6 13. Qg5 dxe4 14. Nxe4 Qf8 15. d5 Nd8 16. Qe5 Qe7 17. Qxg7 Qf8 18. Nf6+
Ke7 19. Qg5 c6 20. d6+ Kxd6 21. Rd1+ Kc7 22. Qg3+ Kb6 23. Qxb8 Nf5 24. Qxc8 Ka5 25. Qc7+ Ka4 26. b3+
Kxa3 27. Qa5+ Kb2 28. Kd2 Qh6+ 29. K×P×K

Mean Chess notation: `K×P×K` is a Royal Slaughter through a pawn. To replay it, open
[`example-game.json`](../public/press/example-game.json), copy its text, then on the play page choose
**Scenarios** → **Load a position or saved game**, paste it and press **Load**.

## Special moves to link to

Each opens the position on the play page.

| Shows | Link |
|---|---|
| Royal Capture, even in check | https://meanchess.siddheshthapa.com/play/?scenario=royal-capture-in-check |
| Royal Slaughter | https://meanchess.siddheshthapa.com/play/?scenario=slaughter-pawn |
| The eating order (pawns first) | https://meanchess.siddheshthapa.com/play/?scenario=slaughter-blocked |
| Royal Cannibalism | https://meanchess.siddheshthapa.com/play/?scenario=cannibal-back-rank |
| Fool's mate fails | https://meanchess.siddheshthapa.com/play/?scenario=fools-mate |

## Diagrams

Seven 360 px boards for the Chess Variant Pages and articles, in
[`public/press/diagrams/`](../public/press/diagrams/): the start position, a Royal Capture, a Royal
Slaughter, an enemy piece blocking, Royal Cannibalism, Fool's mate failing, and pawns first. The
listing draft is [CHESS-VARIANT-PAGES.md](CHESS-VARIANT-PAGES.md).
