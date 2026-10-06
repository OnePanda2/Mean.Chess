import { describe, expect, it } from 'vitest'
import { activeTier, isEligible, squareName, tierOf, type Piece } from '../../src/engine/index.ts'
import { fen, position } from './helpers.ts'

const piece = (type: Piece['type'], queenOrigin?: Piece['queenOrigin']): Piece =>
  queenOrigin ? { id: 'x', color: 'white', type, queenOrigin } : { id: 'x', color: 'white', type }

/** White's eligible pieces, by square name. */
function eligibleSquares(pieces: Readonly<Record<string, string>>): string[] {
  const { board } = position(fen({ ...pieces, h8: 'k' }))
  return board.flatMap((p, sq) => (p?.color === 'white' && isEligible(board, p) ? [squareName(sq)] : [])).sort()
}

describe('sacrifice hierarchy (Rules §2.2)', () => {
  it('classifies pieces by class only', () => {
    expect([
      tierOf(piece('pawn')),
      tierOf(piece('knight')),
      tierOf(piece('bishop')),
      tierOf(piece('rook')),
      tierOf(piece('queen', 'promoted')),
      tierOf(piece('queen', 'original')),
      tierOf(piece('king')),
    ]).toEqual([1, 2, 2, 3, 4, null, null])
  })

  // The handoff's §23.4 matrix. Pieces: P a2, N b1, B c1, R a1, promoted Q d1, original Q f1, K e1.
  it('with a pawn on the board, only pawns are eligible', () => {
    expect(eligibleSquares({ e1: 'K', a2: 'P', b1: 'N', c1: 'B', a1: 'R', d1: 'Q~', f1: 'Q' })).toEqual(['a2'])
  })

  it('with no pawns, knights and bishops are eligible and nothing higher', () => {
    expect(eligibleSquares({ e1: 'K', b1: 'N', c1: 'B', a1: 'R', d1: 'Q~', f1: 'Q' })).toEqual(['b1', 'c1'])
  })

  it('with no pawns or minor pieces, rooks are eligible and the promoted queen is not', () => {
    expect(eligibleSquares({ e1: 'K', a1: 'R', d1: 'Q~', f1: 'Q' })).toEqual(['a1'])
  })

  it('with only queens left, the promoted queen is eligible', () => {
    expect(eligibleSquares({ e1: 'K', d1: 'Q~', f1: 'Q' })).toEqual(['d1'])
  })

  it('never makes the original queen eligible', () => {
    expect(eligibleSquares({ e1: 'K', f1: 'Q' })).toEqual([])
    expect(activeTier(position(fen({ e1: 'K', f1: 'Q', h8: 'k' })).board, 'white')).toBeNull()
  })

  it('is global: one pawn anywhere blocks every higher tier', () => {
    expect(eligibleSquares({ e1: 'K', a7: 'P', f2: 'B' })).toEqual(['a7'])
    expect(eligibleSquares({ e1: 'K', f2: 'B' })).toEqual(['f2'])
  })

  it('is computed separately for each side', () => {
    const { board } = position(fen({ e1: 'K', a2: 'P', h8: 'k', b7: 'n' }))
    expect([activeTier(board, 'white'), activeTier(board, 'black')]).toEqual([1, 2])
  })
})
