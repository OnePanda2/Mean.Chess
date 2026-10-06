import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import {
  applyMove,
  findMove,
  isInCheck,
  ordinaryLegalMoves,
  placementOf,
  toMeanFen,
  toUci,
  type Position,
} from '../../src/engine/index.ts'
import { PERFT_POSITIONS } from './fixtures.ts'
import { position } from './helpers.ts'

/** Small seeded PRNG (mulberry32) so every run plays the same games. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * chess.js's public moves({ verbose: true }) builds SAN (with check detection) for every move,
 * which costs milliseconds per position. Its internal generator is the one its own perft() uses.
 * chess.js is pinned to exactly 1.4.0, and the first test below proves the two views agree.
 */
interface InternalMove {
  from: number
  to: number
  promotion?: string
}
interface ChessInternals {
  _moves(options: { legal: boolean }): readonly InternalMove[]
  _makeMove(move: InternalMove): void
}
const internals = (chess: Chess): ChessInternals => chess as unknown as ChessInternals
const algebraic = (sq0x88: number): string => `${'abcdefgh'.charAt(sq0x88 & 0xf)}${8 - (sq0x88 >> 4)}`
const coordinate = (move: InternalMove): string => `${algebraic(move.from)}${algebraic(move.to)}${move.promotion ?? ''}`
const referenceMoves = (chess: Chess): string[] => internals(chess)._moves({ legal: true }).map(coordinate).sort()
const publicMoves = (chess: Chess): string[] =>
  chess
    .moves({ verbose: true })
    .map((move) => `${move.from}${move.to}${move.promotion ?? ''}`)
    .sort()

/**
 * Ordinary Mean Chess moves ARE standard chess moves: the Mean layer only adds royal and
 * cannibalism moves on top. So in every position of a random game our ordinary moves must equal
 * chess.js's legal moves exactly (docs/BLUEPRINT.md §6.1).
 */
function playRandomGames(startFen: string, games: number, maxPlies: number, seed: number): number {
  const random = seededRandom(seed)
  let positionsChecked = 0
  for (let game = 0; game < games; game++) {
    let ours: Position = position(startFen)
    const reference = new Chess(startFen)
    for (let ply = 0; ply < maxPlies; ply++) {
      const legal = ordinaryLegalMoves(ours)
      const ourMoves = legal.map(toUci).sort()
      const theirInternal = internals(reference)._moves({ legal: true })
      const theirMoves = theirInternal.map(coordinate).sort()
      const agree =
        ourMoves.join(' ') === theirMoves.join(' ') &&
        isInCheck(ours.board, ours.sideToMove) === reference.inCheck() &&
        placementOf(ours.board).replaceAll('~', '') === reference.fen().split(' ')[0]
      if (!agree) {
        // Only build the (slow) diagnostics when something is actually wrong.
        const context = `game ${game}, ply ${ply}, ${toMeanFen(ours)}`
        expect(ourMoves, context).toEqual(theirMoves)
        expect(isInCheck(ours.board, ours.sideToMove), context).toBe(reference.inCheck())
        expect(placementOf(ours.board).replaceAll('~', ''), context).toBe(reference.fen().split(' ')[0])
      }
      positionsChecked++
      if (ourMoves.length === 0) break
      const choice = ourMoves[Math.floor(random() * ourMoves.length)] ?? ''
      const move = findMove(legal, choice)
      const theirs = theirInternal.find((candidate) => coordinate(candidate) === choice)
      if (!move || !theirs) throw new Error(`move ${choice} vanished`)
      ours = applyMove(ours, move)
      internals(reference)._makeMove(theirs)
    }
  }
  return positionsChecked
}

describe('ordinary moves agree with chess.js (BSD-2 oracle)', () => {
  it('uses a chess.js internal generator that agrees with its public API', () => {
    for (const fen of Object.values(PERFT_POSITIONS)) {
      const chess = new Chess(fen)
      expect(referenceMoves(chess), fen).toEqual(publicMoves(chess))
    }
  })

  it('over seeded random games from the start position', { timeout: 30_000 }, () => {
    expect(playRandomGames(PERFT_POSITIONS.start, 120, 160, 20261007)).toBeGreaterThan(10_000)
  })

  it('over seeded random games from Kiwipete (castling and en passant heavy)', { timeout: 30_000 }, () => {
    expect(playRandomGames(PERFT_POSITIONS.kiwipete, 40, 100, 7)).toBeGreaterThan(1_000)
  })

  it('over seeded random games from position 4 (promotion heavy)', { timeout: 30_000 }, () => {
    expect(playRandomGames(PERFT_POSITIONS.position4, 40, 100, 4)).toBeGreaterThan(1_000)
  })
})
