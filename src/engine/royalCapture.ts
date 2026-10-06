import { findKing } from './board.ts'
import { isEligible } from './hierarchy.ts'
import { opposite } from './squares.ts'
import { royalLines } from './tables.ts'
import type { Board, Color, Move, Piece, Square } from './types.ts'

/**
 * The royal move `side`'s king has on this board (Rules §2.3), or null. There is at most one:
 * one enemy king, one straight line, one midpoint.
 *
 * - Midpoint empty: Royal Capture.
 * - Midpoint holds one of `side`'s eligible pieces: Royal Slaughter (one move, eats it).
 * - Anything else on the midpoint blocks the line. Kings never jump.
 *
 * Available whatever the check status, and never filtered for king safety: it ends the game.
 * Depends only on the board, so it also answers "what could the opponent do if it were their turn"
 * (the Royal Kill Zone).
 */
export function royalMove(board: Board, side: Color): Move | null {
  const line = royalLine(board, side)
  if (!line) return null
  const { king, enemyKing, from, to, midpoint } = line
  const blocker = board[midpoint]
  if (!blocker) return { kind: 'royal-capture', from, to, piece: king, captured: enemyKing }
  if (blocker.color === side && isEligible(board, blocker)) {
    return {
      kind: 'royal-slaughter',
      from,
      to,
      piece: king,
      captured: enemyKing,
      sacrificed: blocker,
      sacrificeSquare: midpoint,
    }
  }
  return null
}

export type BlockReason = 'enemy-piece' | 'original-queen' | 'not-eligible'

/** Why the kings stand at royal distance but `side` has no royal move, for explanations. */
export interface BlockedRoyal {
  readonly midpoint: Square
  readonly blocker: Piece
  readonly reason: BlockReason
}

export function blockedRoyal(board: Board, side: Color): BlockedRoyal | null {
  const line = royalLine(board, side)
  if (!line) return null
  const blocker = board[line.midpoint]
  if (!blocker) return null
  if (blocker.color !== side) return { midpoint: line.midpoint, blocker, reason: 'enemy-piece' }
  if (isEligible(board, blocker)) return null
  const reason = blocker.type === 'queen' && blocker.queenOrigin === 'original' ? 'original-queen' : 'not-eligible'
  return { midpoint: line.midpoint, blocker, reason }
}

interface RoyalLineHit {
  readonly king: Piece
  readonly enemyKing: Piece
  readonly from: Square
  readonly to: Square
  readonly midpoint: Square
}

/** The kings, if they stand at royal distance (Rules §2.2). */
function royalLine(board: Board, side: Color): RoyalLineHit | null {
  const from = findKing(board, side)
  const to = findKing(board, opposite(side))
  if (from === null || to === null) return null
  const king = board[from]
  const enemyKing = board[to]
  const line = royalLines(from).find((candidate) => candidate.target === to)
  if (!line || !king || !enemyKing) return null
  return { king, enemyKing, from, to, midpoint: line.midpoint }
}
