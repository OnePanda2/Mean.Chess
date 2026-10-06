import { describe, expect, it } from 'vitest'
import { perft, perftDetailed, perftDivide } from '../../src/engine/index.ts'
import { PERFT_POSITIONS } from './fixtures.ts'
import { position } from './helpers.ts'

/**
 * Standard perft values. Mean Chess agrees with standard chess up to these depths because no
 * internal node is a standard checkmate and the kings stay at least 4 squares apart
 * (docs/BLUEPRINT.md §3.3). Deeper, Mean-specific values live in meanPerft.test.ts.
 */
const STANDARD: readonly [keyof typeof PERFT_POSITIONS, number, number][] = [
  ['start', 1, 20],
  ['start', 2, 400],
  ['start', 3, 8_902],
  ['start', 4, 197_281],
  ['kiwipete', 1, 48],
  ['kiwipete', 2, 2_039],
  ['kiwipete', 3, 97_862],
  ['position3', 1, 14],
  ['position3', 2, 191],
  ['position3', 3, 2_812],
  ['position3', 4, 43_238],
  ['position4', 1, 6],
  ['position4', 2, 264],
  ['position4', 3, 9_467],
  ['position4Mirrored', 1, 6],
  ['position4Mirrored', 2, 264],
  ['position4Mirrored', 3, 9_467],
  ['position5', 1, 44],
  ['position5', 2, 1_486],
  ['position5', 3, 62_379],
  ['position6', 1, 46],
  ['position6', 2, 2_079],
  ['position6', 3, 89_890],
]

describe('perft (standard values)', () => {
  it.each(STANDARD)('%s at depth %i has %i leaves', (name, depth, nodes) => {
    expect(perft(position(PERFT_POSITIONS[name]), depth)).toBe(nodes)
  })
})

describe('perft counters', () => {
  it('matches the published breakdown for the start position at depth 3', () => {
    expect(perftDetailed(position(PERFT_POSITIONS.start), 3)).toMatchObject({
      nodes: 8_902,
      captures: 34,
      enPassant: 0,
      castles: 0,
      promotions: 0,
      checks: 12,
      checkmates: 0,
    })
  })

  it('matches the published breakdown for Kiwipete at depth 2', () => {
    expect(perftDetailed(position(PERFT_POSITIONS.kiwipete), 2)).toMatchObject({
      nodes: 2_039,
      captures: 351,
      enPassant: 1,
      castles: 91,
      promotions: 0,
      checks: 3,
      checkmates: 0,
    })
  })

  it('matches the published breakdown for position 4 at depth 2', () => {
    expect(perftDetailed(position(PERFT_POSITIONS.position4), 2)).toMatchObject({
      nodes: 264,
      captures: 87,
      enPassant: 0,
      castles: 6,
      promotions: 48,
      checks: 10,
      checkmates: 0,
    })
  })
})

describe('perftDivide', () => {
  it('splits the start position at depth 2 into 20 moves of 20 replies', () => {
    const divide = perftDivide(position(PERFT_POSITIONS.start), 2)
    expect(divide.size).toBe(20)
    expect([...divide.values()].every((nodes) => nodes === 20)).toBe(true)
  })

  it('gives a royal move no subtree, because it ends the game', () => {
    expect(Object.fromEntries(perftDivide(position('8/8/8/8/8/5k2/8/7K w - - 0 1'), 2))).toEqual({
      h1f3: 0,
      h1g1: 6,
      h1h2: 6,
    })
  })

  it('counts one node per move at depth 1, and the position itself at depth 0', () => {
    expect([...perftDivide(position(PERFT_POSITIONS.start), 1).values()].every((nodes) => nodes === 1)).toBe(true)
    expect(perft(position(PERFT_POSITIONS.start), 0)).toBe(1)
    expect(perftDetailed(position(PERFT_POSITIONS.start), 0).nodes).toBe(1)
  })
})
