# Mean Chess Rules v0.1

This is the canonical specification of Mean Chess. The engine (`src/engine`) implements it and the
tests (`tests/engine`) check it. **When the rules change, this file and the matching tests change in
the same commit.** Implementation behaviour never silently becomes the rules.

Decisions behind these rules are recorded in [DECISIONS.md](DECISIONS.md).

## 1. Baseline

Standard FIDE chess applies, except where this document says otherwise: the board, the starting
position, how every piece moves and captures, castling, en passant, promotion to a queen, rook,
bishop or knight, check, checkmate, stalemate and turn order. White moves first. Nothing else is
changed.

## 2. Definitions

- **Attack and check.** Standard attack geometry applies, and a king attacks its 8 adjacent squares.
  A king is *in check* when an enemy piece attacks its square. Royal reach (§3) is **not** an
  attack: it never makes a move illegal and never counts as check.
- **Royal distance and midpoint.** Two kings are at *royal distance* when they stand exactly two
  squares apart on the same rank, file or diagonal, i.e. |Δfile|, |Δrank| ∈ {(2,0), (0,2), (2,2)}.
  The *midpoint* is the square between them. From h1, the royal-distance squares are f1, f3 and h3.
  Squares a knight's jump away (f2, g3) are not at royal distance.
- **Sacrifice tiers.** Tier 1: pawns. Tier 2: knights and bishops. Tier 3: rooks. Tier 4: promoted
  queens. The original queen and the king belong to no tier and can never be sacrificed.
- **Active tier.** For each side, the lowest tier in which that side has at least one piece anywhere
  on the board. Only pieces of the active tier are *eligible*. A side with no tiered pieces has
  nothing eligible.
- **Queen origin.** A queen in the starting position is *original*. A queen created by promotion is
  *promoted* for the rest of the game. Promoted rooks, bishops and knights are ordinary rooks,
  bishops and knights.
- **Ordinary move.** Any standard chess move (including castling, en passant and promotion) that is
  legal under standard rules: it does not leave the mover's king in check, which also keeps the kings
  from ever being adjacent.
- **Royal move.** A Royal Capture or Royal Slaughter (§3).
- **Suicidal move.** An ordinary move after which the opponent has a royal move. Suicidal moves are
  legal.
- **Royal Kill Zone.** A king is *in the Kill Zone* when the opponent would have a royal move against
  it if it were the opponent's turn. Standing in it, entering it, and castling into, out of or
  through it are all legal.

## 3. Royal Capture and Royal Slaughter

1. Only a king can capture a king. All other pieces still give check normally.
2. **Royal Capture.** If the enemy king is at royal distance and the midpoint is empty, your king may
   capture it.
3. **Royal Slaughter.** If the enemy king is at royal distance and the midpoint holds one of **your
   own eligible** pieces, your king may remove that piece and capture the enemy king, as a single
   move.
4. In every other case there is no royal move on that line: an enemy piece on the midpoint, or one of
   your own pieces that is not eligible (including the original queen). Kings never jump.
5. Royal moves are available at any time, including when your king is in check. They are not subject
   to king-safety rules.
6. A royal move **ends the game immediately**; the capturing side wins.

## 4. Desperation and Royal Cannibalism

1. You are **desperate** when all of these hold:
   - (a) your king is in check;
   - (b) you have no royal move;
   - (c) every ordinary legal move you have is suicidal, or you have none.
2. While desperate, and only then, your king may make a **Royal Cannibalism** move: it steps onto an
   adjacent square occupied by one of your **eligible** pieces, removing that piece.
3. A cannibalism move is legal only if your king is not in check afterwards (which also forbids
   ending next to the enemy king). It may end in the Kill Zone; that is legal, but suicidal.
4. While desperate, your suicidal ordinary moves remain legal. Cannibalism is an extra option.
5. If you are not in check there is no cannibalism, even with no legal move: that is stalemate.

## 5. Legal moves

```
legal(P) = royal(P) ∪ ordinary(P) ∪ (desperate(P) ? cannibalism(P) : ∅)
```

## 6. End of the game (evaluated in this order)

1. **Royal Capture or Royal Slaughter:** the capturing side wins at once. This overrides everything
   below.
2. The side to move has **no legal moves**: in check, that is **checkmate** and that side loses;
   otherwise it is **stalemate**, a draw.
3. **Fifty-move rule:** 100 consecutive plies without a pawn move, a capture (including en passant)
   or a cannibalism move. Draw, applied automatically.
4. **Threefold repetition:** the same position (§7) for the third time. Draw, applied automatically.
5. **Agreement or resignation.**

There is **no draw for insufficient material** (§8).

## 7. Same position

Two positions are the same when they have the same placement of pieces (including queen origin), the
same side to move, the same castling rights, and the same en-passant possibility. En passant counts
only when an en-passant capture is actually legal.

## 8. Consequences and clarifications (non-normative)

- A king in check may make a royal move and win.
- **Which blockers can ever be slaughtered.** It is impossible to have the opponent in check on your
  own turn, so the midpoint piece can never be one that attacks the enemy king from the midpoint.
  That leaves pawns (on a rank or file, or on the diagonal behind them), knights (any line), bishops
  (ranks and files only) and rooks (diagonals only). A queen, original or promoted, can never be
  slaughtered through.
- The active tier never goes back down during a game: pawns cannot be created.
- A lone knight or bishop can force a win against a bare king, and a bare king can be lost in a
  corner. Material alone therefore never draws.
- Fool's mate is not mate: the king escapes by eating its d2 or e2 pawn. Scholar's mate still mates.
- At most one royal move exists in any position: one enemy king, one line, one midpoint.

## 9. Mean Chess Notation

Human-facing notation. It is labelled *Mean Chess notation* and is not official SAN.

```
move      := castle | ordinary | cannibal | royal
castle    := "O-O" | "O-O-O"                      [suffix]
ordinary  := standard SAN (Nf3, exd6, e8=Q, Qxf7) [suffix]
cannibal  := "K×" square "(own " tier ")"         [suffix]   K×e2(own P)   K×g1(own Q~)
royal     := "K×K" | "K×" tier "×K"                          K×K   K×P×K   K×N×K
tier      := "P" | "N" | "B" | "R" | "Q~"
suffix    := "+" (gives check) | "#" (Mean checkmate)
```

Ordinary captures use `x`; Mean-only captures use `×` (plain-text export writes both as `x`).
Storage and transport use coordinate moves (`e2e4`, `e7e8q`, `h1f3`): under these rules, from,
to and promotion identify every legal move uniquely.

## Change log

- **v0.1 (2026-10-07).** First specification. Founder rulings of 2026-10-07: Royal Capture works
  along the 8 straight lines only; Royal Slaughter needs no check; suicidal escapes do not block Royal
  Cannibalism.
