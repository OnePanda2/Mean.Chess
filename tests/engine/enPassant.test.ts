import { describe, expect, it } from 'vitest'
import { applyMove, currentPosition, legalMoves, newGame, play, squareName } from '../../src/engine/index.ts'
import { legal, legalUci, position } from './helpers.ts'

describe('en passant', () => {
  const beforeDoubleStep = position('4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1')

  it('becomes available immediately after a double step', () => {
    const game = play(newGame(beforeDoubleStep), 'd7d5')
    const now = currentPosition(game)
    expect(now.enPassant === null ? null : squareName(now.enPassant)).toBe('d6')
    const capture = legalMoves(now).find((move) => move.kind === 'en-passant')
    expect(capture && [squareName(capture.from), squareName(capture.to), capture.captured?.type]).toEqual([
      'e5',
      'd6',
      'pawn',
    ])
  })

  it('removes the passed pawn', () => {
    const now = currentPosition(play(newGame(beforeDoubleStep), 'd7d5'))
    const after = applyMove(now, legal(now, 'e5d6'))
    expect(after.board[35]).toBeNull() // d5
    expect(after.board[43]?.type).toBe('pawn') // d6
    expect(after.halfmoveClock).toBe(0)
  })

  it('expires if not used at once', () => {
    let game = play(newGame(beforeDoubleStep), 'd7d5')
    game = play(game, 'e1e2')
    game = play(game, 'e8e7')
    expect(legalUci(currentPosition(game))).not.toContain('e5d6')
  })

  it('is illegal when removing both pawns would expose the king', () => {
    // White king a5, pawns c5 (white) and d5 (black) on the fifth rank, black rook on h5.
    const pinned = position('7k/8/8/K1Pp3r/8/8/8/8 w - d6 0 1')
    expect(legalUci(pinned)).not.toContain('c5d6')
    expect(legalUci(pinned)).toContain('c5c6')
  })
})
