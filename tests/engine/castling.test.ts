import { describe, expect, it } from 'vitest'
import { applyMove, squareName, toMeanFen } from '../../src/engine/index.ts'
import { legal, legalUci, position } from './helpers.ts'

const OPEN = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'

describe('castling', () => {
  it('is available on both wings when the way is clear', () => {
    expect(legalUci(position(OPEN))).toEqual(expect.arrayContaining(['e1g1', 'e1c1']))
    expect(legalUci(position(OPEN.replace(' w ', ' b ')))).toEqual(expect.arrayContaining(['e8g8', 'e8c8']))
  })

  it('moves the rook to the other side of the king', () => {
    const kingside = applyMove(position(OPEN), legal(position(OPEN), 'e1g1'))
    expect([kingside.board[6]?.type, kingside.board[5]?.type, kingside.board[7]]).toEqual(['king', 'rook', null])
    const queenside = applyMove(position(OPEN), legal(position(OPEN), 'e1c1'))
    expect([queenside.board[2]?.type, queenside.board[3]?.type, queenside.board[0]]).toEqual(['king', 'rook', null])
    expect(toMeanFen(queenside)).toBe('r3k2r/8/8/8/8/8/8/2KR3R b kq - 1 1')
  })

  it('needs every square between king and rook to be empty', () => {
    expect(legalUci(position('r3k2r/8/8/8/8/8/8/R3KB1R w KQkq - 0 1'))).not.toContain('e1g1')
    expect(legalUci(position('r3k2r/8/8/8/8/8/8/RN2K2R w KQkq - 0 1'))).not.toContain('e1c1')
  })

  it('is not allowed out of check', () => {
    const moves = legalUci(position('r3k2r/8/8/4r3/8/8/8/R3K2R w KQkq - 0 1'))
    expect(moves).not.toContain('e1g1')
    expect(moves).not.toContain('e1c1')
  })

  it('is not allowed through or into an attacked square', () => {
    const through = legalUci(position('r3kr2/8/8/8/8/8/8/R3K2R w KQq - 0 1'))
    expect(through).not.toContain('e1g1')
    expect(through).toContain('e1c1')
    expect(legalUci(position('r3k1r1/8/8/8/8/8/8/R3K2R w KQq - 0 1'))).not.toContain('e1g1')
  })

  it('ignores an attack on b1 when castling queenside', () => {
    expect(legalUci(position('rr2k3/8/8/8/8/8/8/R3K2R w KQq - 0 1'))).toContain('e1c1')
  })

  it('treats squares next to the enemy king as attacked (D2)', () => {
    expect(legalUci(position('8/8/8/8/8/8/P4Nk1/4K2R w K - 0 1'))).not.toContain('e1g1')
  })

  it('may land in the Royal Kill Zone, because royal reach is not an attack (D1)', () => {
    expect(legalUci(position('8/8/8/8/8/6k1/P4N2/4K2R w K - 0 1'))).toContain('e1g1')
  })

  it('loses both rights when the king moves and one right when a rook moves', () => {
    const afterKing = applyMove(position(OPEN), legal(position(OPEN), 'e1e2'))
    expect([afterKing.castling.whiteKingside, afterKing.castling.whiteQueenside]).toEqual([false, false])
    const afterRook = applyMove(position(OPEN), legal(position(OPEN), 'h1h2'))
    expect([afterRook.castling.whiteKingside, afterRook.castling.whiteQueenside]).toEqual([false, true])
  })

  it('loses the right when the rook is captured on its corner', () => {
    const blackToMove = position('r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1')
    const after = applyMove(blackToMove, legal(blackToMove, 'a8a1'))
    expect(after.castling).toEqual({
      whiteKingside: true,
      whiteQueenside: false,
      blackKingside: true,
      blackQueenside: false,
    })
    expect(squareName(after.board.findIndex((piece) => piece?.type === 'rook' && piece.color === 'black'))).toBe('a1')
  })
})
