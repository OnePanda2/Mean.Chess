import type { Board, Color, Piece, Square } from './types.ts'

/** The piece on `sq`, or null. */
export function pieceAt(board: Board, sq: Square): Piece | null {
  return board[sq] ?? null
}

/** Square of `color`'s king, or null when it has been captured (the game is then over). */
export function findKing(board: Board, color: Color): Square | null {
  for (let sq = 0; sq < 64; sq++) {
    const piece = board[sq]
    if (piece?.type === 'king' && piece.color === color) return sq
  }
  return null
}
