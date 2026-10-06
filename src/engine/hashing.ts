import { ordinaryLegalMoves } from './legalMoves.ts'
import { castlingOf, placementOf } from './meanFen.ts'
import { squareName } from './squares.ts'
import type { Position } from './types.ts'

/**
 * Identity of a position for repetition (Rules §2.7): placement including queen origin, side to
 * move, castling rights, and the en-passant square only when an en-passant capture is actually
 * legal. Piece ids and move counters are deliberately excluded.
 */
export function positionKey(position: Position): string {
  const enPassant =
    position.enPassant !== null && ordinaryLegalMoves(position).some((move) => move.kind === 'en-passant')
      ? squareName(position.enPassant)
      : '-'
  return [
    placementOf(position.board),
    position.sideToMove === 'white' ? 'w' : 'b',
    castlingOf(position.castling),
    enPassant,
  ].join(' ')
}
