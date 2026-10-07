import { TIER_NAMES, activeTier } from './hierarchy.ts'
import { moveLayers, type MoveLayers } from './legalMoves.ts'
import { blockedRoyal, royalMove, type BlockedRoyal } from './royalCapture.ts'
import { opposite } from './squares.ts'
import type { Color, Move, Piece, Position, Square, Tier } from './types.ts'

/** Everything the interface needs to show about a position, computed once. */
export interface PositionAnalysis extends MoveLayers {
  readonly legal: readonly Move[]
  /** Desperate, with no cannibalism available but suicidal moves left: every move loses the king. */
  readonly doomed: boolean
  readonly activeTiers: Readonly<Record<Color, Tier | null>>
  /** The opponent's royal move against the side to move, as if it were their turn (Royal Kill Zone). */
  readonly threat: Move | null
  /** The kings are at royal distance but the side to move's line is blocked. */
  readonly blocked: BlockedRoyal | null
}

export function analyze(position: Position): PositionAnalysis {
  const layers = moveLayers(position)
  const legal = layers.royal
    ? [layers.royal, ...layers.ordinary, ...layers.cannibalism]
    : [...layers.ordinary, ...layers.cannibalism]
  return {
    ...layers,
    legal,
    doomed: layers.desperate && layers.cannibalism.length === 0 && layers.ordinary.length > 0,
    activeTiers: {
      white: activeTier(position.board, 'white'),
      black: activeTier(position.board, 'black'),
    },
    threat: royalMove(position.board, opposite(position.sideToMove)),
    blocked: blockedRoyal(position.board, position.sideToMove),
  }
}

/** A short explanation for the player (handoff §28). Plain text, never HTML. */
export interface Explanation {
  readonly title: string
  readonly detail: string
}

export function pieceName(piece: Piece | null | undefined): string {
  if (!piece) return 'piece'
  if (piece.type === 'queen') return piece.queenOrigin === 'promoted' ? 'promoted queen' : 'queen'
  return piece.type
}

/**
 * Why this move is special, or null for an ordinary move. It never says whether a move walks into
 * the Royal Kill Zone: spotting that is part of the game (DECISIONS.md D-39).
 */
export function explainMove(analysis: PositionAnalysis, move: Move): Explanation | null {
  switch (move.kind) {
    case 'royal-capture':
      return {
        title: 'Royal Capture',
        detail: 'Your king captures the opposing king from two squares away. This wins the game.',
      }
    case 'royal-slaughter':
      return {
        title: 'Royal Slaughter',
        detail: `Your ${pieceName(move.sacrificed)} stands between the kings and is your eligible sacrifice. Your king eats it and captures the opposing king. This wins the game.`,
      }
    case 'self-capture': {
      const name = pieceName(move.sacrificed)
      return {
        title: 'Royal Cannibalism',
        detail:
          analysis.ordinary.length === 0
            ? `Under normal chess rules this is checkmate. Your king may sacrifice this ${name} to escape.`
            : `Your king is desperate, so it may sacrifice this ${name} to escape.`,
      }
    }
    default:
      return null
  }
}

/** Why an own piece cannot be sacrificed now (for a desperate king's neighbours). */
export function explainIneligible(analysis: PositionAnalysis, piece: Piece): Explanation | null {
  if (piece.type === 'king') return null
  if (piece.type === 'queen' && piece.queenOrigin === 'original') {
    return { title: 'Not sacrificable', detail: 'The original queen can never be sacrificed.' }
  }
  const tier = analysis.activeTiers[piece.color]
  if (tier === null) return null
  return {
    title: 'Not eligible yet',
    detail: `You still have ${TIER_NAMES[tier]}. Only those can be sacrificed.`,
  }
}

/** Why the side to move has no royal move although the kings are two squares apart. */
export function explainBlocked(analysis: PositionAnalysis): (Explanation & { readonly square: Square }) | null {
  const blocked = analysis.blocked
  if (!blocked) return null
  const square = blocked.midpoint
  switch (blocked.reason) {
    case 'enemy-piece':
      return { square, title: 'Blocked', detail: 'Kings cannot jump over enemy pieces.' }
    case 'original-queen':
      return {
        square,
        title: 'Blocked',
        detail: 'The original queen stands between the kings and can never be sacrificed.',
      }
    case 'not-eligible': {
      const tier = analysis.activeTiers[blocked.blocker.color]
      const still = tier === null ? '' : ` You still have ${TIER_NAMES[tier]}, so it cannot be sacrificed yet.`
      return { square, title: 'Blocked', detail: `Your ${pieceName(blocked.blocker)} stands between the kings.${still}` }
    }
  }
}
