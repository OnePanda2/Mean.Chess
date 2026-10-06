import { boardAfter } from './apply.ts'
import { isSquareAttacked } from './attacks.ts'
import { findKing } from './board.ts'
import { activeTier, tierOf } from './hierarchy.ts'
import { opposite } from './squares.ts'
import { kingTargets } from './tables.ts'
import type { Move, Position } from './types.ts'

/**
 * Royal Cannibalism moves (Rules §2.4) for the side to move. The caller decides whether the side
 * is desperate; this only builds the moves: the king steps onto an adjacent square holding one of
 * its own pieces of the active tier, removing it, and must not be in check afterwards (which also
 * keeps it away from the enemy king).
 */
export function cannibalismMoves(position: Position): Move[] {
  const { board, sideToMove: us } = position
  const from = findKing(board, us)
  const tier = activeTier(board, us)
  if (from === null || tier === null) return []
  const king = board[from]
  if (!king) return []
  const them = opposite(us)
  const moves: Move[] = []
  for (const to of kingTargets(from)) {
    const victim = board[to]
    if (victim?.color !== us || tierOf(victim) !== tier) continue
    const move: Move = { kind: 'self-capture', from, to, piece: king, sacrificed: victim, sacrificeSquare: to }
    if (!isSquareAttacked(boardAfter(board, move), to, them)) moves.push(move)
  }
  return moves
}
