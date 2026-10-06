import { applyMove } from './apply.ts'
import { isInCheck } from './attacks.ts'
import { positionKey } from './hashing.ts'
import { legalMoves } from './legalMoves.ts'
import { startingPosition } from './meanFen.ts'
import { findMove, toUci } from './notation.ts'
import { opposite } from './squares.ts'
import type { Color, Move, Position } from './types.ts'

export type Outcome =
  | {
      readonly kind: 'royal-capture' | 'royal-slaughter' | 'checkmate' | 'resignation'
      readonly winner: Color
    }
  | { readonly kind: 'stalemate' | 'threefold' | 'fifty-move' | 'agreement'; readonly winner: null }

/** A game: where it started, what was played, and how (or whether) it ended. Immutable. */
export interface GameRecord {
  readonly start: Position
  readonly moves: readonly Move[]
  /** positions[0] is the start; positions[i + 1] follows moves[i]. */
  readonly positions: readonly Position[]
  /** Repetition keys (Rules §2.7), parallel to `positions`. */
  readonly keys: readonly string[]
  readonly outcome: Outcome | null
}

export function newGame(start: Position = startingPosition()): GameRecord {
  const keys = [positionKey(start)]
  return { start, moves: [], positions: [start], keys, outcome: outcomeOf([start], keys, null) }
}

export function currentPosition(game: GameRecord): Position {
  return game.positions[game.positions.length - 1] ?? game.start
}

/** Plays a move given as a Move from legalMoves() or as coordinate notation. Throws if illegal. */
export function play(game: GameRecord, moveOrUci: Move | string): GameRecord {
  if (game.outcome) throw new Error('The game is already over.')
  const position = currentPosition(game)
  const uci = typeof moveOrUci === 'string' ? moveOrUci : toUci(moveOrUci)
  const move = findMove(legalMoves(position), uci)
  if (!move) throw new Error(`Illegal move: ${uci}`)
  const next = applyMove(position, move)
  const positions = [...game.positions, next]
  const keys = [...game.keys, positionKey(next)]
  return { start: game.start, moves: [...game.moves, move], positions, keys, outcome: outcomeOf(positions, keys, move) }
}

/**
 * Takes back the last move. If the game ended by resignation or agreement, the first undo only
 * withdraws that ending and leaves the moves in place.
 */
export function undo(game: GameRecord): GameRecord {
  if (game.outcome?.kind === 'resignation' || game.outcome?.kind === 'agreement') {
    return { ...game, outcome: outcomeOf(game.positions, game.keys, game.moves.at(-1) ?? null) }
  }
  if (game.moves.length === 0) return game
  const positions = game.positions.slice(0, -1)
  const keys = game.keys.slice(0, -1)
  const moves = game.moves.slice(0, -1)
  return { start: game.start, moves, positions, keys, outcome: outcomeOf(positions, keys, moves.at(-1) ?? null) }
}

export function resign(game: GameRecord, loser: Color): GameRecord {
  if (game.outcome) return game
  return { ...game, outcome: { kind: 'resignation', winner: opposite(loser) } }
}

export function agreeDraw(game: GameRecord): GameRecord {
  if (game.outcome) return game
  return { ...game, outcome: { kind: 'agreement', winner: null } }
}

/** End-of-game rules in priority order (Rules §2.6). */
function outcomeOf(positions: readonly Position[], keys: readonly string[], lastMove: Move | null): Outcome | null {
  if (lastMove?.kind === 'royal-capture' || lastMove?.kind === 'royal-slaughter') {
    return { kind: lastMove.kind, winner: lastMove.piece.color }
  }
  const position = positions[positions.length - 1]
  if (!position) return null
  if (legalMoves(position).length === 0) {
    return isInCheck(position.board, position.sideToMove)
      ? { kind: 'checkmate', winner: opposite(position.sideToMove) }
      : { kind: 'stalemate', winner: null }
  }
  if (position.halfmoveClock >= 100) return { kind: 'fifty-move', winner: null }
  const key = keys[keys.length - 1]
  if (keys.filter((k) => k === key).length >= 3) return { kind: 'threefold', winner: null }
  return null
}
