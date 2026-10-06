import type { Board, Color, Piece, Tier } from './types.ts'

/** How each tier is named in rules text and explanations. */
export const TIER_NAMES: Readonly<Record<Tier, string>> = {
  1: 'pawns',
  2: 'knights and bishops',
  3: 'rooks',
  4: 'promoted queens',
}

/**
 * Sacrifice tier of a piece (Rules §2.2): pawns 1, knights and bishops 2, rooks 3, promoted
 * queens 4. The original queen and the king belong to no tier and can never be sacrificed.
 * The tier depends only on the piece's class, never on its chess value or position.
 */
export function tierOf(piece: Piece): Tier | null {
  switch (piece.type) {
    case 'pawn':
      return 1
    case 'knight':
    case 'bishop':
      return 2
    case 'rook':
      return 3
    case 'queen':
      return piece.queenOrigin === 'promoted' ? 4 : null
    case 'king':
      return null
  }
}

/** The lowest tier in which `color` has a piece anywhere on the board (Rules §2.2), or null. */
export function activeTier(board: Board, color: Color): Tier | null {
  let lowest: Tier | null = null
  for (const piece of board) {
    if (piece?.color !== color) continue
    const tier = tierOf(piece)
    if (tier === 1) return 1
    if (tier !== null && (lowest === null || tier < lowest)) lowest = tier
  }
  return lowest
}

/** Whether `piece` may be sacrificed right now: it belongs to its side's active tier. */
export function isEligible(board: Board, piece: Piece): boolean {
  const tier = tierOf(piece)
  return tier !== null && tier === activeTier(board, piece.color)
}
