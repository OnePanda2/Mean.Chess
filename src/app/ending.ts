import { findKing, opposite, type Move, type Outcome, type Position, type Square } from '../engine/index.ts'

/*
 * How a game's ending is shown (D-52): the final move plays out in full, badges then pop onto the
 * kings (Chess.com style), and the result box opens a moment after that. The durations below match
 * the animations in styles/pieces.css.
 */

/** A Royal Slaughter first slices the king's own piece in half; the king moves after this. */
export const SLICE_MS = 1400
/** A final move that is not royal: the slide, plus a captured piece fading out. */
const MOVE_SETTLE_MS = 650
/** A royal move: the king's slide, then the fallen king's flare and the board's flash. */
const ROYAL_SETTLE_MS = 1150
/** The badges popping onto the kings. */
export const BADGE_POP_MS = 450
/** Founder, 2026-10-10: the result box opens 1–2 s after the animations end. */
const RESULT_PAUSE_MS = 1500
/** Movement switched off: nothing animates, but the final position stays in view for a moment. */
const STILL_PAUSE_MS = 1200
/** A finished game reopened later (a reload): its ending already happened. */
const REOPENED_PAUSE_MS = 800

export interface EndingTimeline {
  /** Milliseconds after the ending until the badges appear. */
  readonly badgesAt: number
  /** Milliseconds after the ending until the result box opens. */
  readonly resultAt: number
}

export function endingTimeline(
  outcome: Outcome,
  lastMove: Move | null,
  { animate, live }: { readonly animate: boolean; readonly live: boolean },
): EndingTimeline {
  if (!live) return { badgesAt: 0, resultAt: REOPENED_PAUSE_MS }
  if (!animate) return { badgesAt: 0, resultAt: STILL_PAUSE_MS }
  const endedByMove = outcome.kind !== 'resignation' && outcome.kind !== 'agreement' && lastMove !== null
  const settle = !endedByMove
    ? 0
    : lastMove.kind === 'royal-slaughter'
      ? SLICE_MS + ROYAL_SETTLE_MS
      : lastMove.kind === 'royal-capture'
        ? ROYAL_SETTLE_MS
        : MOVE_SETTLE_MS
  return { badgesAt: settle, resultAt: settle + BADGE_POP_MS + RESULT_PAUSE_MS }
}

/** Crown for the winner; skull for a king that fell; flag for a resignation; ½ for a draw. */
export type BadgeKind = 'crown' | 'skull' | 'flag' | 'draw'

export interface Badge {
  readonly sq: Square
  readonly kind: BadgeKind
  /** Which top corner of the square. A royal win puts both badges on one square. */
  readonly corner: 'right' | 'left'
}

export function endingBadges(outcome: Outcome, position: Position, lastMove: Move | null): Badge[] {
  if (outcome.winner === null) {
    return (['white', 'black'] as const).flatMap((color) => {
      const sq = findKing(position.board, color)
      return sq === null ? [] : [{ sq, kind: 'draw' as const, corner: 'right' as const }]
    })
  }
  const badges: Badge[] = []
  const winner = findKing(position.board, outcome.winner)
  if (winner !== null) badges.push({ sq: winner, kind: 'crown', corner: 'right' })
  // A royal win takes the losing king off the board: its badge marks the square where it fell.
  const royal = outcome.kind === 'royal-capture' || outcome.kind === 'royal-slaughter'
  const loser = royal ? (lastMove?.to ?? null) : findKing(position.board, opposite(outcome.winner))
  if (loser !== null) {
    badges.push({ sq: loser, kind: outcome.kind === 'resignation' ? 'flag' : 'skull', corner: royal ? 'left' : 'right' })
  }
  return badges
}
