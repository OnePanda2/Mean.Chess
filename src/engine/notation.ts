import { squareName } from './squares.ts'
import type { Move, PromotionType } from './types.ts'

const PROMOTION_LETTER: Readonly<Record<PromotionType, string>> = {
  queen: 'q',
  rook: 'r',
  bishop: 'b',
  knight: 'n',
}

/**
 * Coordinate notation used for storage and transport: from, to and an optional promotion letter
 * (e2e4, e7e8q, h1f3). Under the 8-line royal rule this identifies every legal move uniquely.
 */
export function toUci(move: Move): string {
  return `${squareName(move.from)}${squareName(move.to)}${move.promotion ? PROMOTION_LETTER[move.promotion] : ''}`
}

/** The move in `moves` written as `uci`, or null. */
export function findMove(moves: readonly Move[], uci: string): Move | null {
  const wanted = uci.trim().toLowerCase()
  return moves.find((move) => toUci(move) === wanted) ?? null
}
