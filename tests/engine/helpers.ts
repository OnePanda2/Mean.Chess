import { legalMoves, parseMeanFen, toUci, type Move, type Position } from '../../src/engine/index.ts'
import { parseMeanFenUnchecked } from '../../src/engine/meanFen.ts'

/** Parses a MeanFEN that must be a valid position. */
export function position(fen: string): Position {
  const parsed = parseMeanFen(fen)
  if (!parsed.ok) throw new Error(`Invalid test position "${fen}": ${parsed.error}`)
  return parsed.position
}

/**
 * Parses MeanFEN syntax WITHOUT legality validation, for generator tests on positions that cannot
 * arise in play (docs/BLUEPRINT.md D-16).
 */
export function rawPosition(fen: string): Position {
  const parsed = parseMeanFenUnchecked(fen)
  if (!parsed.ok) throw new Error(`Malformed test position "${fen}": ${parsed.error}`)
  return parsed.position
}

/** Moves in coordinate notation, sorted. */
export const uci = (moves: readonly Move[]): string[] => moves.map(toUci).sort()

export const legalUci = (pos: Position): string[] => uci(legalMoves(pos))

/** Legal moves of the piece on `square`, in coordinate notation, sorted. */
export const movesFrom = (pos: Position, square: string): string[] =>
  legalUci(pos).filter((move) => move.startsWith(square))

/** The legal move written as `uciMove`; fails the test if it is not legal. */
export function legal(pos: Position, uciMove: string): Move {
  const move = legalMoves(pos).find((candidate) => toUci(candidate) === uciMove)
  if (!move) throw new Error(`${uciMove} is not legal; legal moves are ${legalUci(pos).join(' ')}`)
  return move
}
