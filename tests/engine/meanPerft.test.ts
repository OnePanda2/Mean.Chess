import { describe, expect, it } from 'vitest'
import { perft, perftDetailed } from '../../src/engine/index.ts'
import { PERFT_POSITIONS } from './fixtures.ts'
import { position } from './helpers.ts'

/**
 * Mean Chess perft where it diverges from standard chess. Each value was predicted BEFORE the
 * engine existed by an independent implementation (chess.js plus a thin Mean layer, see
 * tools/research/perft_safety.mjs and docs/BLUEPRINT.md §3.3). Two implementations agreeing to
 * the node is the strongest move-generation check we have.
 */
const MEAN: readonly [keyof typeof PERFT_POSITIONS, number, number, string][] = [
  ['start', 5, 4_865_625, '+16: the 8 fool’s-mate lines each gain K×d2 and K×e2'],
  ['kiwipete', 4, 4_085_603, 'unchanged: its one internal mate has no legal cannibalism'],
  ['position3', 5, 674_641, '+17 cannibalism escapes across 17 ply-4 mates'],
  ['position4', 4, 422_373, '+40 escapes from 22 ply-3 mates'],
  ['position4Mirrored', 4, 422_373, 'mirror of position 4'],
  ['position5', 4, 2_103_500, '+13 escapes from 44 ply-3 mates'],
  ['position6', 4, 3_894_594, 'unchanged: no internal mates'],
]

describe('Mean perft (independently predicted values)', () => {
  it.each(MEAN)('%s at depth %i has %i leaves (%s)', { timeout: 120_000 }, (name, depth, nodes) => {
    expect(perft(position(PERFT_POSITIONS[name]), depth)).toBe(nodes)
  })

  it('finds no Mean checkmate at depth 4 from the start, where standard chess finds 8', { timeout: 60_000 }, () => {
    expect(perftDetailed(position(PERFT_POSITIONS.start), 4)).toMatchObject({
      nodes: 197_281,
      captures: 1_576,
      checks: 469,
      checkmates: 0,
    })
  })

  it('counts the fool’s-mate escapes as self-captures', () => {
    expect(
      perftDetailed(position('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3'), 1),
    ).toMatchObject({ nodes: 2, selfCaptures: 2, captures: 0 })
  })

  it('treats a royal move as a terminal leaf', () => {
    const a2 = position('8/8/8/8/8/5k2/8/7K w - - 0 1')
    expect(perftDetailed(a2, 1)).toMatchObject({ nodes: 3, royalCaptures: 1 })
    // Only Kh2 and Kg1 have replies (6 each); the royal capture ended the game.
    expect(perft(a2, 2)).toBe(12)
  })

  it('counts Royal Slaughters', () => {
    expect(perftDetailed(position('8/8/8/8/8/4k3/4P3/4K3 w - - 0 1'), 1)).toMatchObject({
      nodes: 3,
      royalSlaughters: 1,
    })
  })
})
