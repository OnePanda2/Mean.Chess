/**
 * Integer encodings used by the computer opponent's search (docs/AI.md). Pieces and moves are
 * small integers so the search can store them in typed arrays and compare them cheaply.
 */

/** Colours are bit 3 of a piece code. */
export const WHITE = 0
export const BLACK = 8

export const EMPTY = 0
export const PAWN = 1
export const KNIGHT = 2
export const BISHOP = 3
export const ROOK = 4
/** The original queen: never sacrificable (Rules §2.2). */
export const QUEEN = 5
/** A queen created by promotion: tier 4. */
export const PROMOTED_QUEEN = 6
export const KING = 7

/** Sacrifice tier by piece type (Rules §2.2); 0 means never sacrificable. */
export const TIER: readonly number[] = [0, 1, 2, 2, 3, 0, 4, 0]

/** Move kinds, stored in bits 12–15 of a move. */
export const QUIET = 0
export const DOUBLE_PUSH = 1
export const CAPTURE = 2
export const EN_PASSANT = 3
export const CASTLE_KINGSIDE = 4
export const CASTLE_QUEENSIDE = 5
export const SELF_CAPTURE = 6
export const ROYAL_CAPTURE = 7
export const ROYAL_SLAUGHTER = 8

/** No move. Every real move has from ≠ to, so 0 (a1a1) can never be one. */
export const NO_MOVE = 0

/** A move: from in bits 0–5, to in bits 6–11, kind in bits 12–15, promotion type in bits 16–18. */
export const encodeMove = (from: number, to: number, kind: number, promotion = 0): number =>
  from | (to << 6) | (kind << 12) | (promotion << 16)
export const moveFrom = (move: number): number => move & 63
export const moveTo = (move: number): number => (move >> 6) & 63
export const moveKind = (move: number): number => (move >> 12) & 15
export const movePromotion = (move: number): number => (move >> 16) & 7

export const isRoyal = (move: number): boolean => {
  const kind = moveKind(move)
  return kind === ROYAL_CAPTURE || kind === ROYAL_SLAUGHTER
}

const FILES = 'abcdefgh'
const PROMOTION_LETTERS: readonly string[] = ['', '', 'n', 'b', 'r', 'q', 'q', '']

export const squareName = (sq: number): string => `${FILES.charAt(sq & 7)}${(sq >> 3) + 1}`

/** Coordinate notation, the same as the engine's toUci (e2e4, e7e8q, h1f3). */
export function moveToUci(move: number): string {
  return `${squareName(moveFrom(move))}${squareName(moveTo(move))}${PROMOTION_LETTERS[movePromotion(move)] ?? ''}`
}
