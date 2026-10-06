import { describe, expect, it } from 'vitest'
import { applyMove, parseMeanFen, toMeanFen } from '../../src/engine/index.ts'
import { legal, movesFrom, position } from './helpers.ts'

describe('promotion', () => {
  it('offers all four promotions', () => {
    expect(movesFrom(position('4k3/P7/8/8/8/8/8/4K3 w - - 0 1'), 'a7')).toEqual(['a7a8b', 'a7a8n', 'a7a8q', 'a7a8r'])
  })

  it('offers them on captures too', () => {
    expect(movesFrom(position('1r2k3/P7/8/8/8/8/8/4K3 w - - 0 1'), 'a7')).toHaveLength(8)
  })

  it('creates a promoted queen that keeps the pawn id', () => {
    const before = position('4k3/P7/8/8/8/8/8/4K3 w - - 0 1')
    const after = applyMove(before, legal(before, 'a7a8q'))
    expect(after.board[56]).toEqual({ id: 'wP@a7', color: 'white', type: 'queen', queenOrigin: 'promoted' })
    expect(toMeanFen(after)).toBe('Q~3k3/8/8/8/8/8/8/4K3 b - - 0 1')
  })

  it('creates plain pieces on underpromotion', () => {
    const before = position('4k3/P7/8/8/8/8/8/4K3 w - - 0 1')
    const after = applyMove(before, legal(before, 'a7a8n'))
    expect(after.board[56]).toEqual({ id: 'wP@a7', color: 'white', type: 'knight' })
  })

  it('marks black promoted queens too', () => {
    const before = position('4k3/8/8/8/8/8/p7/4K3 b - - 0 1')
    const after = applyMove(before, legal(before, 'a2a1q'))
    expect(after.board[0]?.queenOrigin).toBe('promoted')
    expect(toMeanFen(after)).toBe('4k3/8/8/8/8/8/8/q~3K3 w - - 0 2')
  })

  it('keeps an original queen original when it moves', () => {
    const before = position('4k3/8/8/8/8/8/8/3QK3 w - - 0 1')
    const after = applyMove(before, legal(before, 'd1d5'))
    expect(after.board[35]?.queenOrigin).toBe('original')
  })

  it('preserves queen origin through MeanFEN', () => {
    const before = position('4k3/P7/8/8/8/8/8/4K3 w - - 0 1')
    const fen = toMeanFen(applyMove(before, legal(before, 'a7a8q')))
    const reparsed = parseMeanFen(fen)
    expect(reparsed.ok && reparsed.position.board[56]?.queenOrigin).toBe('promoted')
  })
})
