import { findKing } from './board.ts'
import { opposite } from './squares.ts'
import { isDiagonal, kingTargets, knightTargets, pawnAttacks, ray } from './tables.ts'
import type { Board, Color, Square } from './types.ts'

/**
 * Standard attack detection (Rules §2.2). A king attacks only its 8 neighbours.
 * Royal reach is deliberately NOT an attack: it never makes a move illegal and never gives check.
 */
export function isSquareAttacked(board: Board, sq: Square, by: Color): boolean {
  // A `by` pawn attacks sq from exactly the squares a pawn of the other colour on sq would attack.
  for (const from of pawnAttacks(opposite(by), sq)) {
    const piece = board[from]
    if (piece?.color === by && piece.type === 'pawn') return true
  }
  for (const from of knightTargets(sq)) {
    const piece = board[from]
    if (piece?.color === by && piece.type === 'knight') return true
  }
  for (const from of kingTargets(sq)) {
    const piece = board[from]
    if (piece?.color === by && piece.type === 'king') return true
  }
  for (let direction = 0; direction < 8; direction++) {
    for (const from of ray(sq, direction)) {
      const piece = board[from]
      if (!piece) continue
      if (piece.color === by) {
        if (piece.type === 'queen') return true
        if (piece.type === (isDiagonal(direction) ? 'bishop' : 'rook')) return true
      }
      break
    }
  }
  return false
}

/** Whether `color`'s king is in (ordinary) check. False when that king is gone. */
export function isInCheck(board: Board, color: Color): boolean {
  const king = findKing(board, color)
  return king !== null && isSquareAttacked(board, king, opposite(color))
}
