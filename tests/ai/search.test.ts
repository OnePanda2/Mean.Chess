import { describe, expect, it } from 'vitest'
import {
  currentPosition,
  legalMoves,
  newGame,
  parseMeanFen,
  play,
  toMeanFen,
  toUci,
  type GameRecord,
} from '../../src/engine/index.ts'
import { ComputerPlayer, LEVELS, replay, type Level, type LevelSettings } from '../../src/ai/index.ts'
import { SearchBoard } from '../../src/ai/board.ts'
import { moveToUci } from '../../src/ai/constants.ts'
import { evaluate } from '../../src/ai/evaluate.ts'
import { WIN_THRESHOLD, search } from '../../src/ai/search.ts'
import { SCENARIOS } from '../../src/app/scenarios.ts'

/** A clock that never moves: searches stop on depth alone, so every result is reproducible. */
const frozen = (): number => 0

function boardOf(fen: string): SearchBoard {
  const parsed = parseMeanFen(fen)
  if (!parsed.ok) throw new Error(`Invalid test position "${fen}": ${parsed.error}`)
  return SearchBoard.fromPosition(parsed.position)
}

/** The search's move in a position, at a fixed depth. */
const best = (fen: string, maxDepth = 4, blind = false): string =>
  moveToUci(search(boardOf(fen), { maxDepth, now: frozen, blind }).move)

describe('the computer opponent plays Mean Chess', () => {
  it('takes a Royal Capture the moment it has one', () => {
    expect(best('8/8/8/8/8/5k2/8/7K w - - 0 1')).toBe('h1f3')
  })

  it('finds a Royal Slaughter through its own pawn', () => {
    expect(best('8/8/8/8/8/4k3/4P3/4K3 w - - 0 1')).toBe('e1e3')
  })

  it('never walks into the Kill Zone when it has a safe move', () => {
    // Black to move: Kf3 is legal but hands White a Royal Capture.
    for (const depth of [1, 2, 4]) expect(best('8/8/8/8/4k3/8/8/7K b - - 0 1', depth)).not.toBe('e4f3')
  })

  it('steps out of a Royal Slaughter threat instead of making a knight move', () => {
    // White threatens to eat its e2 pawn and capture the king on e3.
    expect(best('8/8/8/8/8/n3k3/4P3/4K3 b - - 0 1')).toMatch(/^e3/)
  })

  it('escapes a back-rank mate by Royal Cannibalism', () => {
    expect(['g1f2', 'g1g2', 'g1h2']).toContain(best('k7/8/8/8/8/8/5PPP/4r1K1 w - - 0 1'))
  })

  it('mates when Mean Chess still allows it (Scholar’s mate)', () => {
    const result = search(boardOf('r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4'), {
      maxDepth: 3,
      now: frozen,
    })
    expect(moveToUci(result.move)).toBe('f3f7')
    expect(result.score).toBeGreaterThan(WIN_THRESHOLD)
  })

  it('takes a free queen and does not give its own away', () => {
    expect(best('4k3/8/8/3q4/8/8/3R4/4K3 w - - 0 1', 2)).toBe('d2d5')
    // Black's queen is attacked by the rook; moving it to safety beats everything else.
    expect(best('4k3/8/8/8/3q4/8/8/3RK3 b - - 0 1', 3)).toMatch(/^d4/)
  })

  it('overlooks royal moves when blind, like a beginner, unless nothing else is legal', () => {
    expect(best('8/8/8/8/8/5k2/8/7K w - - 0 1', 4, true)).not.toBe('h1f3')
    expect(best('8/8/8/8/4k3/8/8/7K b - - 0 1', 1, true)).toMatch(/^e4/)
  })

  it('knows the fifty-move rule ends the game, except for a checkmate on the hundredth half-move', () => {
    // Every white move is reversible, so each one ends the game in a draw.
    expect(search(boardOf('k7/8/8/8/8/8/7Q/K7 w - - 99 80'), { maxDepth: 3, now: frozen }).score).toBe(0)
    // Qh8 is mate, and mate takes priority over the fifty-move rule (Rules §2.6).
    const mate = search(boardOf('k7/8/1K6/8/8/8/7Q/8 w - - 99 80'), { maxDepth: 2, now: frozen })
    expect(moveToUci(mate.move)).toBe('h2h8')
    expect(mate.score).toBeGreaterThan(WIN_THRESHOLD)
  })

  it('is reproducible: the same request gives the same move', () => {
    const player = new ComputerPlayer()
    const request = { start: SCENARIOS[0]?.fen ?? '', moves: [], level: 'nice' as Level, seed: 42 }
    const first = player.chooseMove(request, frozen)
    expect(new ComputerPlayer().chooseMove(request, frozen).move).toBe(first.move)
  })
})

describe('every level', () => {
  const player = new ComputerPlayer()
  const quick: Partial<LevelSettings> = { maxDepth: 2 }

  it.each(LEVELS)('%s returns a legal move in every Scenario Lab position', (level) => {
    for (const scenario of SCENARIOS) {
      const parsed = parseMeanFen(scenario.fen)
      if (!parsed.ok) throw new Error(parsed.error)
      if (legalMoves(parsed.position).length === 0) continue
      const reply = player.chooseMove({ start: scenario.fen, moves: [], level, seed: 1 }, frozen, quick)
      expect(legalMoves(parsed.position).map(toUci)).toContain(reply.move)
    }
  })

  it('replays a game history before choosing', () => {
    const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    const reply = player.chooseMove({ start, moves: ['e2e4', 'e7e5'], level: 'mean', seed: 3 }, frozen, quick)
    const game = play(play(newGame(), 'e2e4'), 'e7e5')
    expect(legalMoves(currentPosition(game)).map(toUci)).toContain(reply.move)
    expect(() => replay({ start, moves: ['e2e5'] })).toThrow(/Illegal move/)
    expect(() => replay({ start: 'not a position', moves: [] })).toThrow(/Bad starting position/)
  })
})

describe('draw offers', () => {
  const player = new ComputerPlayer()

  it('accepts with only the kings left', () => {
    expect(player.acceptsDraw({ start: '8/8/3k4/8/8/8/8/4K3 w - - 0 1', moves: [] }, 'black', frozen)).toBe(true)
  })

  it('declines when winning and accepts when losing', () => {
    // White has an extra queen.
    const position = { start: '4k3/8/8/8/8/8/8/3QK3 w - - 0 1', moves: [] }
    expect(player.acceptsDraw(position, 'white', frozen)).toBe(false)
    expect(player.acceptsDraw(position, 'black', frozen)).toBe(true)
  })
})

describe('evaluation', () => {
  /** The same position with colours swapped and the board turned around. */
  function mirror(fen: string): string {
    const [placement = '', side = 'w', castling = '-', enPassant = '-', ...rest] = fen.split(' ')
    const swap = (text: string): string =>
      text.replace(/[a-z]/gi, (c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()))
    const rows = placement.split('/').reverse().map(swap).join('/')
    const swapped = swap(castling)
    const rights = ['K', 'Q', 'k', 'q'].filter((right) => swapped.includes(right)).join('') || '-'
    const ep = enPassant === '-' ? '-' : `${enPassant.charAt(0)}${9 - Number(enPassant.charAt(1))}`
    return [rows, side === 'w' ? 'b' : 'w', rights, ep, ...rest].join(' ')
  }

  it.each([
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
    '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
    '4k3/8/8/8/8/8/8/3QK3 b - - 0 1',
    '8/8/8/8/4k3/8/8/7K b - - 0 1',
  ])('is symmetric: %s', (fen) => {
    expect(evaluate(boardOf(mirror(fen)))).toBe(evaluate(boardOf(fen)))
  })

  it('prefers the side with more material', () => {
    expect(evaluate(boardOf('4k3/8/8/8/8/8/8/3QK3 w - - 0 1'))).toBeGreaterThan(500)
    expect(evaluate(boardOf('4k3/8/8/8/8/8/8/3QK3 b - - 0 1'))).toBeLessThan(-500)
  })
})

describe('self-play', () => {
  /** Plays a game between two levels through the rules engine, which validates every move. */
  function playGame(white: Level, black: Level, seed: number, maxPlies: number): GameRecord {
    const player = new ComputerPlayer()
    let game = newGame()
    const start = toMeanFen(game.start)
    const moves: string[] = []
    while (!game.outcome && moves.length < maxPlies) {
      const level = currentPosition(game).sideToMove === 'white' ? white : black
      const reply = player.chooseMove({ start, moves, level, seed: seed + moves.length }, frozen, {
        maxDepth: level === 'ruthless' ? 4 : level === 'mean' ? 3 : 2,
      })
      game = play(game, reply.move) // throws on an illegal move
      moves.push(reply.move)
    }
    return game
  }

  it('plays complete, legal games, and the stronger level wins', { timeout: 120_000 }, () => {
    const results = [1, 2, 3].map((seed) => playGame('ruthless', 'nice', seed * 101, 300).outcome)
    for (const outcome of results) expect(outcome).not.toBeNull()
    const ruthlessWins = results.filter((outcome) => outcome?.winner === 'white').length
    expect(ruthlessWins).toBeGreaterThanOrEqual(2)
  })
})
