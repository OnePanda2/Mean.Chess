import { describe, expect, it } from 'vitest'
import {
  currentPosition,
  findKing,
  isInCheck,
  legalMoves,
  newGame,
  parseMeanFen,
  play,
  toMcn,
  toUci,
  type Move,
} from '../../src/engine/index.ts'
import { defined, fen, legalUci, position } from './helpers.ts'

const royalIn = (text: string): Move | undefined =>
  legalMoves(position(text)).find((move) => move.kind === 'royal-capture' || move.kind === 'royal-slaughter')

describe('Royal Capture (Rules §2.3)', () => {
  it.each([
    ['north', 'd6'],
    ['north-east', 'f6'],
    ['east', 'f4'],
    ['south-east', 'f2'],
    ['south', 'd2'],
    ['south-west', 'b2'],
    ['west', 'b4'],
    ['north-west', 'b6'],
  ])('captures the enemy king two squares away to the %s', (_direction, square) => {
    const move = royalIn(fen({ d4: 'K', [square]: 'k' }))
    expect(move?.kind).toBe('royal-capture')
    expect(move && toUci(move)).toBe(`d4${square}`)
  })

  it.each(['f1', 'f3', 'h3'])('from h1 reaches %s (the corrected handoff example list)', (square) => {
    expect(royalIn(fen({ h1: 'K', [square]: 'k' }))?.kind).toBe('royal-capture')
  })

  it.each(['f2', 'g3'])('from h1 does not reach the knight-shaped square %s: a safe stand-off', (square) => {
    expect(royalIn(fen({ h1: 'K', [square]: 'k' }))).toBeUndefined()
  })

  it.each(['e1', 'e2', 'e3', 'e4', 'h4', 'd4'])('does not reach three or more squares (h1 to %s)', (square) => {
    expect(royalIn(fen({ h1: 'K', [square]: 'k' }))).toBeUndefined()
  })

  it('allows kings to stand two squares apart, but never adjacent', () => {
    expect(parseMeanFen(fen({ h1: 'K', f3: 'k' })).ok).toBe(true)
    expect(parseMeanFen(fen({ h1: 'K', g2: 'k' })).ok).toBe(false)
  })

  it('works for Black too', () => {
    const move = royalIn(fen({ e6: 'K', e8: 'k' }, 'b'))
    expect(move && toUci(move)).toBe('e8e6')
  })

  it('is offered alongside the ordinary moves (A2)', () => {
    expect(legalUci(position('8/8/8/8/8/5k2/8/7K w - - 0 1'))).toEqual(['h1f3', 'h1g1', 'h1h2'])
  })

  it('is available while the capturing king is in ordinary check (A3, handoff §11)', () => {
    const inCheck = position('8/8/8/8/8/5k2/8/r6K w - - 0 1')
    expect(isInCheck(inCheck.board, 'white')).toBe(true)
    expect(royalIn('8/8/8/8/8/5k2/8/r6K w - - 0 1')?.kind).toBe('royal-capture')
  })

  it('ignores whether the landing square is defended, because the game is over', () => {
    expect(royalIn('5r2/8/8/8/8/5k2/8/7K w - - 0 1')?.kind).toBe('royal-capture')
  })

  it('ends the game immediately, removes the king and is recorded as K×K', () => {
    const game = play(newGame(position('8/8/8/8/8/5k2/8/7K w - - 0 1')), 'h1f3')
    expect(game.outcome).toEqual({ kind: 'royal-capture', winner: 'white' })
    expect(findKing(currentPosition(game).board, 'black')).toBeNull()
    expect(toMcn(game.positions[0] ?? game.start, defined(game.moves[0]))).toBe('K×K')
    expect(() => play(game, 'f3e3')).toThrow('over')
  })

  it('beats a draw rule that would otherwise trigger on the same move', () => {
    const game = play(newGame(position('8/8/8/8/8/5k2/8/7K w - - 99 80')), 'h1f3')
    expect(game.outcome?.kind).toBe('royal-capture')
  })
})
