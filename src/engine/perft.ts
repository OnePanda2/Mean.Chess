import { applyMove } from './apply.ts'
import { isInCheck } from './attacks.ts'
import { legalMoves } from './legalMoves.ts'
import { toUci } from './notation.ts'
import type { Move, Position } from './types.ts'

/** Counters for the last ply of a perft run (handoff §26). */
export interface PerftCounts {
  nodes: number
  /** Ordinary captures, including en passant. */
  captures: number
  enPassant: number
  castles: number
  promotions: number
  selfCaptures: number
  royalCaptures: number
  royalSlaughters: number
  /** Leaf positions in which the side to move is in check. */
  checks: number
  /** Leaf positions in which the side to move is in check and has no legal move. */
  checkmates: number
}

/** A royal move ends the game, so it is a leaf wherever it occurs. */
const endsGame = (move: Move): boolean => move.kind === 'royal-capture' || move.kind === 'royal-slaughter'

/** Number of leaf nodes `depth` plies below `position`. */
export function perft(position: Position, depth: number): number {
  if (depth === 0) return 1
  const moves = legalMoves(position)
  if (depth === 1) return moves.length
  let nodes = 0
  for (const move of moves) {
    if (!endsGame(move)) nodes += perft(applyMove(position, move), depth - 1)
  }
  return nodes
}

/** Leaf counts per root move, keyed by coordinate notation. For finding which subtree disagrees. */
export function perftDivide(position: Position, depth: number): Map<string, number> {
  const result = new Map<string, number>()
  for (const move of legalMoves(position)) {
    const nodes = depth <= 1 ? 1 : endsGame(move) ? 0 : perft(applyMove(position, move), depth - 1)
    result.set(toUci(move), nodes)
  }
  return result
}

/** perft with per-kind counters for the moves of the last ply. Slower than {@link perft}. */
export function perftDetailed(position: Position, depth: number): PerftCounts {
  const counts: PerftCounts = {
    nodes: 0,
    captures: 0,
    enPassant: 0,
    castles: 0,
    promotions: 0,
    selfCaptures: 0,
    royalCaptures: 0,
    royalSlaughters: 0,
    checks: 0,
    checkmates: 0,
  }
  if (depth === 0) {
    counts.nodes = 1
    return counts
  }
  walk(position, depth, counts)
  return counts
}

function walk(position: Position, depth: number, counts: PerftCounts): void {
  for (const move of legalMoves(position)) {
    if (depth > 1) {
      if (!endsGame(move)) walk(applyMove(position, move), depth - 1, counts)
      continue
    }
    counts.nodes++
    if (move.kind === 'capture' || move.kind === 'en-passant') counts.captures++
    if (move.kind === 'en-passant') counts.enPassant++
    if (move.kind === 'castle-kingside' || move.kind === 'castle-queenside') counts.castles++
    if (move.promotion) counts.promotions++
    if (move.kind === 'self-capture') counts.selfCaptures++
    if (move.kind === 'royal-capture') counts.royalCaptures++
    if (move.kind === 'royal-slaughter') counts.royalSlaughters++
    if (endsGame(move)) continue
    const leaf = applyMove(position, move)
    if (isInCheck(leaf.board, leaf.sideToMove)) {
      counts.checks++
      if (legalMoves(leaf).length === 0) counts.checkmates++
    }
  }
}
