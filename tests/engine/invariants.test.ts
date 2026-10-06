import { describe, expect, it } from 'vitest'
import {
  activeTier,
  chebyshev,
  currentPosition,
  findKing,
  isInCheck,
  legalMoves,
  newGame,
  opposite,
  parseMeanFen,
  play,
  positionKey,
  toMeanFen,
  toUci,
  validatePosition,
  type Color,
  type MoveKind,
  type Position,
} from '../../src/engine/index.ts'

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

const COLORS: readonly Color[] = ['white', 'black']
const originalQueens = (position: Position, color: Color): number =>
  position.board.filter((piece) => piece?.color === color && piece.type === 'queen' && piece.queenOrigin === 'original')
    .length

/**
 * Random full Mean Chess games (royal moves, suicidal moves and cannibalism included). After every
 * move the rules' structural guarantees must hold.
 */
describe('invariants over seeded random Mean Chess games', () => {
  it('hold after every move', { timeout: 120_000 }, () => {
    const random = seededRandom(1234)
    const seen = new Map<MoveKind | 'suicidal', number>()
    for (let gameIndex = 0; gameIndex < 150; gameIndex++) {
      let game = newGame()
      let previous = currentPosition(game)
      while (!game.outcome && game.moves.length < 400) {
        const moves = legalMoves(previous)
        const move = moves[Math.floor(random() * moves.length)]
        if (!move) throw new Error('a game without outcome must have a legal move')
        seen.set(move.kind, (seen.get(move.kind) ?? 0) + 1)
        if (move.suicidal) seen.set('suicidal', (seen.get('suicidal') ?? 0) + 1)
        game = play(game, move)
        const next = currentPosition(game)
        const context = `game ${gameIndex}, after ${toUci(move)}: ${toMeanFen(next)}`

        if (move.kind === 'royal-capture' || move.kind === 'royal-slaughter') {
          expect(findKing(next.board, opposite(move.piece.color)), context).toBeNull()
          expect(game.outcome?.winner, context).toBe(move.piece.color)
          break
        }
        // A position reached by a legal non-royal move is always a valid position:
        // one king each, kings not adjacent, the side that just moved not in check.
        expect(validatePosition(next), context).toBeNull()
        const whiteKing = findKing(next.board, 'white')
        const blackKing = findKing(next.board, 'black')
        expect(whiteKing !== null && blackKing !== null && chebyshev(whiteKing, blackKing) >= 2, context).toBe(true)
        expect(isInCheck(next.board, opposite(next.sideToMove)), context).toBe(false)
        for (const color of COLORS) {
          // The active tier never moves back down: pawns cannot be created (Rules §2.8).
          const before = activeTier(previous.board, color)
          const after = activeTier(next.board, color)
          if (before !== null) expect(after === null || after >= before, context).toBe(true)
          // Original queens are never created.
          expect(originalQueens(next, color), context).toBeLessThanOrEqual(originalQueens(previous, color))
        }
        // MeanFEN round-trips, including queen origin.
        const reparsed = parseMeanFen(toMeanFen(next))
        expect(reparsed.ok && positionKey(reparsed.position), context).toBe(positionKey(next))
        previous = next
      }
    }
    // The random games must actually exercise the Mean rules.
    expect(seen.get('royal-capture') ?? 0).toBeGreaterThan(0)
    expect(seen.get('suicidal') ?? 0).toBeGreaterThan(0)
    expect(seen.get('promotion' as MoveKind) ?? 0).toBe(0) // promotion is a field, never a kind (D-17)
  })
})
