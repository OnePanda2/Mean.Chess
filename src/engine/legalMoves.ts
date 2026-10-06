import { boardAfter } from './apply.ts'
import { isInCheck, isSquareAttacked } from './attacks.ts'
import { findKing } from './board.ts'
import { cannibalismMoves } from './cannibalism.ts'
import { pseudoOrdinaryMoves } from './movement.ts'
import { royalMove } from './royalCapture.ts'
import { chebyshev, opposite } from './squares.ts'
import type { Move, Position } from './types.ts'

/**
 * Ordinary legal moves (Rules §2.2): standard chess moves that do not leave the mover's king in
 * check. Because the enemy king attacks its neighbours, this also keeps the kings apart.
 * These are exactly the legal moves of standard chess.
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

/** Every layer of the legal-move formula for one position (Rules §2.5). */
export interface MoveLayers {
  /** The side to move's royal move, if any (Rules §2.3). */
  readonly royal: Move | null
  /** Ordinary legal moves; suicidal ones carry `suicidal: true`. */
  readonly ordinary: readonly Move[]
  /** Royal Cannibalism moves; empty unless desperate. */
  readonly cannibalism: readonly Move[]
  readonly inCheck: boolean
  /** In check, no royal move, and every ordinary move is suicidal or there is none (Rules §2.4). */
  readonly desperate: boolean
}

/**
 * The Mean Chess legal-move formula (Rules §2.5):
 *   legal = royal ∪ ordinary ∪ (desperate ? cannibalism : ∅)
 */
export function moveLayers(position: Position): MoveLayers {
  const us = position.sideToMove
  const royal = royalMove(position.board, us)
  const inCheck = isInCheck(position.board, us)
  const ordinary = markSuicidal(position, ordinaryLegalMoves(position))
  const desperate = inCheck && royal === null && ordinary.every((move) => move.suicidal === true)
  const cannibalism = desperate ? markSuicidal(position, cannibalismMoves(position)) : []
  return { royal, ordinary, cannibalism, inCheck, desperate }
}

/** Every legal move for the side to move: royal, then ordinary, then cannibalism. */
export function legalMoves(position: Position): Move[] {
  const { royal, ordinary, cannibalism } = moveLayers(position)
  return royal ? [royal, ...ordinary, ...cannibalism] : [...ordinary, ...cannibalism]
}

/**
 * Flags moves after which the opponent has a royal move (Rules §2.2). A royal move needs the kings
 * exactly 2 apart, and one move changes their distance by at most 2 (castling moves the king two
 * squares), so with the kings more than 4 apart nothing can be suicidal and the work is skipped.
 * Unflagged moves are left untouched (undefined = safe).
 */
function markSuicidal(position: Position, moves: Move[]): Move[] {
  const us = position.sideToMove
  const king = findKing(position.board, us)
  const enemyKing = findKing(position.board, opposite(us))
  if (king === null || enemyKing === null || chebyshev(king, enemyKing) > 4) return moves
  return moves.map((move) =>
    royalMove(boardAfter(position.board, move), opposite(us)) ? { ...move, suicidal: true } : move,
  )
}
