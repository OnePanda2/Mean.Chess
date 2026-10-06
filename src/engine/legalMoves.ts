import { boardAfter } from './apply.ts'
import { isSquareAttacked } from './attacks.ts'
import { findKing } from './board.ts'
import { pseudoOrdinaryMoves } from './movement.ts'
import { opposite } from './squares.ts'
import type { Move, Position } from './types.ts'

/**
 * Ordinary legal moves (Rules §2.2): standard chess moves that do not leave the mover's king in
 * check. Because the enemy king attacks its neighbours, this also keeps the kings apart.
 */
export function ordinaryLegalMoves(position: Position): Move[] {
  const us = position.sideToMove
  const them = opposite(us)
  const king = findKing(position.board, us)
  return pseudoOrdinaryMoves(position).filter((move) => {
    const kingSquare = move.piece.type === 'king' ? move.to : king
    return kingSquare === null || !isSquareAttacked(boardAfter(position.board, move), kingSquare, them)
  })
}

/** Every legal move for the side to move. */
export function legalMoves(position: Position): Move[] {
  return ordinaryLegalMoves(position)
}
