/**
 * Public entry point of the computer opponent (docs/AI.md).
 *
 * Like the rules engine it has no React, DOM, clock or randomness of its own: the caller passes a
 * millisecond clock and a seed, so a search can be replayed exactly. Code outside src/ai imports
 * from this file, or from levels.ts when it needs only the list of levels: that keeps the search
 * out of the page's own bundle (it runs in a Web Worker).
 */
import { parseMeanFen } from '../engine/index.ts'
import { SearchBoard } from './board.ts'
import { BLACK, KING, NO_MOVE, WHITE, moveToUci } from './constants.ts'
import { LEVEL_SETTINGS, type Level, type LevelSettings } from './levels.ts'
import { TranspositionTable, search } from './search.ts'
import { seededRandom } from './zobrist.ts'

export { LEVELS, LEVEL_SETTINGS, isLevel, type Level, type LevelSettings } from './levels.ts'

/** A game as the computer needs it: where it started and every move since. */
export interface GameSnapshot {
  /** MeanFEN of the starting position. */
  readonly start: string
  /** Every move played since, in coordinate notation (e2e4, h1f3, e7e8q). */
  readonly moves: readonly string[]
}

export interface MoveRequest extends GameSnapshot {
  readonly level: Level
  /** Seeds the level's randomness, so a request can be replayed exactly. */
  readonly seed: number
}

export interface MoveReply {
  /** The chosen move in coordinate notation. */
  readonly move: string
  /** The search's score for the side to move, in centipawns. */
  readonly score: number
  readonly depth: number
  readonly nodes: number
}

/** How far behind the computer must think it is before it accepts a draw offer. */
const ACCEPT_DRAW_BELOW = -150

/** Replays a game on a search board. Throws on anything the rules engine would reject. */
export function replay(game: GameSnapshot): SearchBoard {
  const parsed = parseMeanFen(game.start)
  if (!parsed.ok) throw new Error(`Bad starting position: ${parsed.error}`)
  const board = SearchBoard.fromPosition(parsed.position)
  for (const uci of game.moves) {
    const move = board.findUci(uci)
    if (move === NO_MOVE) throw new Error(`Illegal move in game: ${uci}`)
    board.commit(move)
  }
  return board
}

/** The computer opponent. It keeps its transposition table from one move to the next. */
export class ComputerPlayer {
  private readonly table = new TranspositionTable(19)

  /**
   * Chooses a move for the side to move. `now` is a millisecond clock (performance.now in the
   * browser). `overrides` adjusts the level's settings, for tests.
   */
  chooseMove(request: MoveRequest, now: () => number, overrides: Partial<LevelSettings> = {}): MoveReply {
    const board = replay(request)
    const settings: LevelSettings = { ...LEVEL_SETTINGS[request.level], ...overrides }
    const random = seededRandom(request.seed)
    const blind = random() < settings.blindChance
    const choice =
      settings.variety > 0 || settings.noise > 0
        ? { variety: settings.variety, noise: settings.noise, random }
        : undefined
    const result = search(
      board,
      { maxDepth: settings.maxDepth, timeLimit: settings.timeLimit, now, blind, choice },
      this.table,
    )
    return { move: moveToUci(result.move), score: result.score, depth: result.depth, nodes: result.nodes }
  }

  /**
   * Whether the computer, playing `computer`, accepts a draw offered in this position: only when it
   * thinks it is losing, or nothing but the two kings is left.
   */
  acceptsDraw(game: GameSnapshot, computer: 'white' | 'black', now: () => number): boolean {
    const board = replay(game)
    const onlyKings = board.counts.every((count, code) => count === 0 || (code & 7) === KING)
    if (onlyKings) return true
    const result = search(board, { maxDepth: 6, timeLimit: 400, now }, this.table)
    const forComputer = board.side === (computer === 'white' ? WHITE : BLACK) ? result.score : -result.score
    return forComputer <= ACCEPT_DRAW_BELOW
  }
}
