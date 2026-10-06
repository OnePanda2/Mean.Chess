import { agreeDraw, newGame, play, resign, type GameRecord, type Outcome } from './game.ts'
import { parseMeanFen, toMeanFen } from './meanFen.ts'
import { toUci } from './notation.ts'
import { RULES_VERSION } from './version.ts'

export const GAME_FORMAT = 'mean-chess-game'
const MAX_TEXT_LENGTH = 64 * 1024
const MAX_MOVES = 2000
const COORDINATE = /^[a-h][1-8][a-h][1-8][qrbn]?$/

/** A saved game (docs/BLUEPRINT.md §4.6). Plain data: safe to JSON.stringify. */
export interface SavedGame {
  readonly format: typeof GAME_FORMAT
  readonly version: 1
  readonly rules: string
  readonly start: string
  readonly moves: readonly string[]
  readonly result: Outcome | null
}

export type LoadResult = { readonly ok: true; readonly game: GameRecord } | { readonly ok: false; readonly error: string }

export function saveGame(game: GameRecord): SavedGame {
  return {
    format: GAME_FORMAT,
    version: 1,
    rules: RULES_VERSION,
    start: toMeanFen(game.start),
    moves: game.moves.map(toUci),
    result: game.outcome,
  }
}

export function exportGame(game: GameRecord): string {
  return JSON.stringify(saveGame(game))
}

/** Parses and replays a saved game. Never trusts the stored result; never throws. */
export function importGame(text: string): LoadResult {
  if (text.length > MAX_TEXT_LENGTH) return fail('That saved game is too large.')
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return fail('That is not a saved Mean Chess game (it is not valid JSON).')
  }
  return loadGame(data)
}

/** Validates and replays already-parsed saved-game data. */
export function loadGame(data: unknown): LoadResult {
  if (!isRecord(data) || data.format !== GAME_FORMAT) return fail('That is not a saved Mean Chess game.')
  if (data.version !== 1) return fail('That saved game comes from a different version of Mean Chess.')
  if (typeof data.start !== 'string') return fail('The saved game has no start position.')
  const moves = data.moves
  if (!isStringArray(moves) || moves.length > MAX_MOVES || !moves.every((move) => COORDINATE.test(move))) {
    return fail('The saved move list is malformed.')
  }
  const start = parseMeanFen(data.start)
  if (!start.ok) return fail(`The saved start position is invalid: ${start.error}`)

  let game = newGame(start.position)
  for (const [index, move] of moves.entries()) {
    try {
      game = play(game, move)
    } catch {
      return fail(`Move ${index + 1} (${move}) is not legal in that game.`)
    }
  }
  // Endings that are not moves are restored if the game is still open.
  const result = data.result
  if (game.outcome === null && isRecord(result)) {
    if (result.kind === 'agreement') game = agreeDraw(game)
    if (result.kind === 'resignation' && result.winner === 'white') game = resign(game, 'black')
    if (result.kind === 'resignation' && result.winner === 'black') game = resign(game, 'white')
  }
  return { ok: true, game }
}

const fail = (error: string): LoadResult => ({ ok: false, error })

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}
