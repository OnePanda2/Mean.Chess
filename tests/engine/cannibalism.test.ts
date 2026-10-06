import { describe, expect, it } from 'vitest'
import {
  analyze,
  currentPosition,
  moveLayers,
  newGame,
  ordinaryLegalMoves,
  play,
  toMcn,
} from '../../src/engine/index.ts'
import { defined, legalUci, position, uci } from './helpers.ts'

const cannibalism = (text: string): string[] => uci(moveLayers(position(text)).cannibalism)

/**
 * Positions that standard chess calls checkmate. Mean Chess first asks whether the king can eat an
 * adjacent piece of its active tier (Rules §2.4). Catalogue ids refer to docs/BLUEPRINT.md §6.2.
 */
describe('Royal Cannibalism escapes from standard checkmate', () => {
  it.each([
    ['C1 back-rank mate: any of the three pawns', 'k7/8/8/8/8/8/5PPP/4r1K1 w - - 0 1', ['g1f2', 'g1g2', 'g1h2']],
    ['C2 the same, but f2 is covered by a bishop', 'k7/8/8/2b5/8/8/5PPP/4r1K1 w - - 0 1', ['g1g2', 'g1h2']],
    ['C3 smothered by its own minor pieces, no pawns left', '4k3/8/8/8/8/8/5nBB/6NK w - - 0 1', ['h1g1', 'h1g2', 'h1h2']],
    ['C5 rook tier (double check)', 'b2k4/8/8/8/8/8/5n1R/6RK w - - 0 1', ['h1g1', 'h1h2']],
    ['C7 promoted-queen tier', 'b2k4/8/8/8/7r/8/8/6Q~K w - - 0 1', ['h1g1']],
    ['C10 fool’s mate is not mate', 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3', ['e1d2', 'e1e2']],
    ['C12 smothered mate (Nf7)', '6rk/5Npp/8/8/8/8/8/K7 b - - 0 1', ['h8g7', 'h8h7']],
  ])('%s', (_label, text, expected) => {
    expect(ordinaryLegalMoves(position(text))).toHaveLength(0)
    expect(analyze(position(text)).desperate).toBe(true)
    expect(cannibalism(text)).toEqual(expected)
    expect(newGame(position(text)).outcome).toBeNull()
  })
})

describe('when the hierarchy (or the original queen) leaves no escape', () => {
  it.each([
    ['C4 minor pieces adjacent, but a pawn remains on a2', '4k3/8/8/8/8/8/P4nBB/6NK w - - 0 1', 'white'],
    ['C6 rooks adjacent, but a knight remains on a1', 'b2k4/8/8/8/8/8/5n1R/N5RK w - - 0 1', 'white'],
    ['C8 only the original queen is adjacent', 'b2k4/8/8/8/7r/8/8/6QK w - - 0 1', 'white'],
    ['C11 Scholar’s mate: d7 is covered by the queen', 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4', 'black'],
  ])('%s: Mean checkmate', (_label, text, loser) => {
    expect(cannibalism(text)).toEqual([])
    expect(newGame(position(text)).outcome).toEqual({ kind: 'checkmate', winner: loser === 'white' ? 'black' : 'white' })
  })
})

describe('desperation (Rules §2.4)', () => {
  it('counts a king whose only escape walks into the Kill Zone as desperate (C9, founder decision D-03)', () => {
    const pos = position('8/8/8/8/5k2/8/6P1/r6K w - - 0 1')
    const layers = moveLayers(pos)
    expect(layers.ordinary.map((move) => [move.kind, move.suicidal])).toEqual([['normal', true]])
    expect(layers.desperate).toBe(true)
    expect(uci(layers.cannibalism)).toEqual(['h1g2'])
    expect(legalUci(pos)).toEqual(['h1g2', 'h1h2']) // the suicidal step stays legal
  })

  it('does not apply when a royal move wins instead', () => {
    // In check from the knight, no ordinary move, but Royal Slaughter through h2 is available.
    const pos = position('6r1/8/8/8/8/7k/5n1P/7K w - - 0 1')
    const layers = moveLayers(pos)
    expect([layers.inCheck, layers.ordinary.length, layers.royal?.kind, layers.desperate]).toEqual([
      true,
      0,
      'royal-slaughter',
      false,
    ])
    expect(legalUci(pos)).toEqual(['h1h3'])
  })

  it('never applies outside check: stalemate stays stalemate (E1)', () => {
    const pos = position('K7/P7/8/8/8/4k3/8/1r6 w - - 0 1')
    expect(moveLayers(pos).cannibalism).toEqual([])
    expect(newGame(pos).outcome).toEqual({ kind: 'stalemate', winner: null })
  })

  it('only offers adjacent pieces', () => {
    expect(cannibalism('k7/8/8/8/8/8/P4PPP/4r1K1 w - - 0 1')).toEqual(['g1f2', 'g1g2', 'g1h2'])
  })

  it('reports a doomed king: desperate, nothing to eat, only suicidal moves left', () => {
    // Bishop e4 checks along the long diagonal, the g8 rook covers g1, and h2 is royal distance
    // from the black king on f4.
    const doomed = analyze(position('6r1/8/8/8/4bk2/8/8/7K w - - 0 1'))
    expect(uci(doomed.ordinary)).toEqual(['h1h2'])
    expect([doomed.desperate, doomed.cannibalism.length, doomed.doomed]).toEqual([true, 0, true])
  })
})

describe('playing a self-capture', () => {
  it('removes the piece, continues the game and is recorded as a self-capture (handoff §44)', () => {
    const start = position('k7/8/8/8/8/8/5PPP/4r1K1 w - - 0 1')
    const game = play(newGame(start), 'g1f2')
    const after = currentPosition(game)
    expect(game.outcome).toBeNull()
    expect(game.moves[0]?.kind).toBe('self-capture')
    expect([after.board[13]?.type, after.board[13]?.color]).toEqual(['king', 'white']) // f2
    expect(after.board.filter((piece) => piece?.type === 'pawn')).toHaveLength(2)
    expect(after.halfmoveClock).toBe(0)
    expect(toMcn(start, defined(game.moves[0]))).toBe('K×f2(own P)')
  })
})
