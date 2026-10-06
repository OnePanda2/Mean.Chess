import { legalMoves, parseMeanFen, parseSquare, toUci, type Move, type Position } from '../../src/engine/index.ts'
import { parseMeanFenUnchecked } from '../../src/engine/meanFen.ts'

/**
 * Builds a MeanFEN from a piece map, e.g. fen({ e1: 'K', e2: 'P', e3: 'k' }). Letters follow FEN
 * (uppercase white) and may carry the promoted mark: { d1: 'Q~' }. No castling, no en passant.
 */
export function fen(pieces: Readonly<Record<string, string>>, side: 'w' | 'b' = 'w'): string {
  const grid: string[] = Array.from({ length: 64 }, () => '')
  for (const [square, letter] of Object.entries(pieces)) {
    const sq = parseSquare(square)
    if (sq === null) throw new Error(`Bad square "${square}"`)
    grid[sq] = letter
  }
  const rows: string[] = []
  for (let rank = 7; rank >= 0; rank--) {
    let row = ''
    let empty = 0
    for (let file = 0; file < 8; file++) {
      const letter = grid[rank * 8 + file] ?? ''
      if (letter === '') {
        empty++
        continue
      }
      if (empty > 0) row += String(empty)
      empty = 0
      row += letter
    }
    if (empty > 0) row += String(empty)
    rows.push(row)
  }
  return `${rows.join('/')} ${side} - - 0 1`
}

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

/** The value, or a test failure if it is missing. */
export function defined<T>(value: T | undefined | null, what = 'value'): T {
  if (value === undefined || value === null) throw new Error(`Expected a ${what}`)
  return value
}
