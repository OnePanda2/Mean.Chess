import { describe, expect, it } from 'vitest'
import {
  applyMove,
  isInCheck,
  legalMoves,
  moveLayers,
  parseMeanFen,
  toUci,
  type Move,
  type Position,
} from '../../src/engine/index.ts'
import { SearchBoard, perft } from '../../src/ai/board.ts'
import { NO_MOVE, isRoyal, moveKind, SELF_CAPTURE } from '../../src/ai/constants.ts'
import { seededRandom } from '../../src/ai/zobrist.ts'
import { SCENARIOS } from '../../src/app/scenarios.ts'
import { PERFT_POSITIONS } from '../engine/fixtures.ts'

function position(fen: string): Position {
  const parsed = parseMeanFen(fen)
  if (!parsed.ok) throw new Error(`Invalid test position "${fen}": ${parsed.error}`)
  return parsed.position
}

const boardOf = (fen: string): SearchBoard => SearchBoard.fromPosition(position(fen))

/** Everything that defines the board's state, for comparing two boards. */
function snapshot(board: SearchBoard) {
  return {
    squares: Array.from(board.squares),
    side: board.side,
    castling: board.castling,
    enPassant: board.enPassant,
    halfmove: board.halfmove,
    kings: Array.from(board.kings),
    counts: Array.from(board.counts),
    hash: [board.hashLo, board.hashHi],
    eval: [board.mg, board.eg, board.phase],
  }
}

/**
 * The same perft values the engine is held to (tests/engine/perft.test.ts and meanPerft.test.ts).
 * The Mean values were predicted by a third implementation before either board existed.
 */
const PERFT: readonly [keyof typeof PERFT_POSITIONS, number, number][] = [
  ['start', 4, 197_281],
  ['start', 5, 4_865_625],
  ['kiwipete', 3, 97_862],
  ['kiwipete', 4, 4_085_603],
  ['position3', 5, 674_641],
  ['position4', 4, 422_373],
  ['position4Mirrored', 4, 422_373],
  ['position5', 4, 2_103_500],
  // Position 6 has no internal mate within depth 4 (pure standard chess), so depth 3 suffices here.
  ['position6', 3, 89_890],
]

describe('the search board agrees with the rules engine', () => {
  it.each(PERFT)('perft: %s at depth %i has %i leaves', { timeout: 120_000 }, (name, depth, nodes) => {
    expect(perft(boardOf(PERFT_POSITIONS[name]), depth)).toBe(nodes)
  })

  it('counts royal moves as leaves, like the engine', () => {
    expect(perft(boardOf('8/8/8/8/8/5k2/8/7K w - - 0 1'), 2)).toBe(12)
    expect(boardOf('8/8/8/8/8/4k3/4P3/4K3 w - - 0 1').legalUci()).toContain('e1e3')
    expect(perft(boardOf('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3'), 1)).toBe(2)
  })

  it('plays seeded random games move for move with the engine', { timeout: 120_000 }, () => {
    const starts = [
      ...Object.values(PERFT_POSITIONS),
      ...SCENARIOS.map((scenario) => scenario.fen),
      '8/8/8/3k4/8/8/3PK3/8 w - - 0 1',
      '8/5k2/8/8/2K5/8/1P6/8 w - - 0 1',
      '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1',
      '4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1',
    ]
    const random = seededRandom(20261007)
    const seen = { positions: 0, royal: 0, cannibalism: 0, suicidal: 0 }
    for (let game = 0; game < 240; game++) {
      let pos = position(starts[game % starts.length] ?? PERFT_POSITIONS.start)
      const board = SearchBoard.fromPosition(pos)
      for (let ply = 0; ply < 160; ply++) {
        // Same legal moves, the same check and royal facts, the same state as a fresh conversion.
        const engineMoves = legalMoves(pos)
        expect(board.legalUci().sort()).toEqual(engineMoves.map(toUci).sort())
        expect(board.inCheck()).toBe(isInCheck(pos.board, pos.sideToMove))
        expect(board.royalMove(board.side) !== NO_MOVE).toBe(moveLayers(pos).royal !== null)
        expect(snapshot(board)).toEqual(snapshot(SearchBoard.fromPosition(pos)))
        expect(board.computeHash()).toEqual([board.hashLo, board.hashHi])
        seen.positions++
        if (engineMoves.length === 0 || pos.halfmoveClock >= 100) break

        const move: Move | undefined = engineMoves[Math.floor(random() * engineMoves.length)]
        if (!move) break
        if (move.suicidal) seen.suicidal++
        const encoded = board.findUci(toUci(move))
        expect(encoded).not.toBe(NO_MOVE)
        if (isRoyal(encoded)) {
          seen.royal++
          break // the game is over
        }
        if (moveKind(encoded) === SELF_CAPTURE) seen.cannibalism++

        // Make, unmake, make again: unmake must restore every field exactly.
        const before = snapshot(board)
        board.make(encoded)
        board.unmake(encoded)
        expect(snapshot(board)).toEqual(before)
        board.make(encoded)
        pos = applyMove(pos, move)
      }
    }
    expect(seen.positions).toBeGreaterThan(20_000)
    expect(seen.royal).toBeGreaterThan(0)
    expect(seen.cannibalism).toBeGreaterThan(0)
    expect(seen.suicidal).toBeGreaterThan(0)
  })
})

describe('null moves, repetition and long games', () => {
  it('passes the turn and restores everything', () => {
    const board = boardOf(PERFT_POSITIONS.kiwipete)
    const before = snapshot(board)
    board.makeNull()
    expect(board.side).not.toBe(before.side)
    expect(board.computeHash()).toEqual([board.hashLo, board.hashHi])
    board.unmakeNull()
    expect(snapshot(board)).toEqual(before)
  })

  it('drops a live en-passant square from the hash when passing, and restores it', () => {
    // Black has just played f7-f5 and White's e5 pawn can take en passant.
    const board = boardOf('rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3')
    expect(board.legalUci()).toContain('e5f6')
    const before = snapshot(board)
    board.makeNull()
    expect(board.enPassant).toBe(-1)
    expect(board.computeHash()).toEqual([board.hashLo, board.hashHi])
    board.unmakeNull()
    expect(snapshot(board)).toEqual(before)
    expect(board.computeHash()).toEqual([board.hashLo, board.hashHi])
  })

  it('recognises a repeated position', () => {
    const board = boardOf(PERFT_POSITIONS.start)
    for (const uci of ['g1f3', 'g8f6', 'f3g1']) board.commit(board.findUci(uci))
    expect(board.isRepetition()).toBe(false)
    board.commit(board.findUci('f6g8'))
    expect(board.isRepetition()).toBe(true)
    expect(board.occurrences()).toBe(2)
    for (const uci of ['g1f3', 'g8f6', 'f3g1', 'f6g8']) board.commit(board.findUci(uci))
    expect(board.occurrences()).toBe(3)
  })

  it('never looks back past a pawn move or capture', () => {
    const board = boardOf(PERFT_POSITIONS.start)
    for (const uci of ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'e2e4']) board.commit(board.findUci(uci))
    expect(board.halfmove).toBe(0)
    expect(board.occurrences()).toBe(1)
  })

  it('keeps working through very long games', () => {
    const board = boardOf('4k3/8/8/8/8/8/8/R3K3 w - - 0 1')
    const shuffle = ['a1a2', 'e8d8', 'a2a1', 'd8e8']
    for (let i = 0; i < 4_000; i++) board.commit(board.findUci(shuffle[i % 4] ?? ''))
    expect(board.historyLength).toBeLessThan(4_096)
    expect(board.occurrences()).toBeGreaterThan(2)
    expect(board.computeHash()).toEqual([board.hashLo, board.hashHi])
  })

  it('refuses to make a royal move permanently', () => {
    const board = boardOf('8/8/8/8/8/5k2/8/7K w - - 0 1')
    expect(() => {
      board.commit(board.findUci('h1f3'))
    }).toThrow(/royal move/)
  })
})
