import { describe, expect, it } from 'vitest'
import { applyMove, isInCheck, ordinaryLegalMoves, startingPosition, toUci } from '../../src/engine/index.ts'
import { legal, legalUci, movesFrom, position, rawPosition } from './helpers.ts'

describe('standard movement', () => {
  it('has the 20 standard opening moves', () => {
    expect(legalUci(startingPosition())).toEqual(
      [
        'a2a3', 'a2a4', 'b2b3', 'b2b4', 'c2c3', 'c2c4', 'd2d3', 'd2d4', 'e2e3', 'e2e4',
        'f2f3', 'f2f4', 'g2g3', 'g2g4', 'h2h3', 'h2h4', 'b1a3', 'b1c3', 'g1f3', 'g1h3',
      ].sort(),
    )
  })

  it('moves a knight to all 8 squares from the centre and 2 from a corner', () => {
    expect(movesFrom(position('4k3/8/8/8/3N4/8/8/4K3 w - - 0 1'), 'd4')).toHaveLength(8)
    expect(movesFrom(position('4k3/8/8/8/8/8/8/N3K3 w - - 0 1'), 'a1')).toEqual(['a1b3', 'a1c2'])
  })

  it('stops a rook at its own piece', () => {
    expect(movesFrom(position('4k3/8/8/8/8/P7/8/R3K3 w - - 0 1'), 'a1')).toEqual(['a1a2', 'a1b1', 'a1c1', 'a1d1'])
  })

  it('lets a bishop capture the first enemy piece and no further', () => {
    expect(movesFrom(position('4k3/8/8/8/8/4p3/8/2B1K3 w - - 0 1'), 'c1')).toEqual(['c1a3', 'c1b2', 'c1d2', 'c1e3'])
  })

  it('gives a centralised queen 27 moves on an open board', () => {
    expect(movesFrom(position('4k3/8/8/8/3Q4/8/8/4K3 w - - 0 1'), 'd4')).toHaveLength(27)
  })

  it('moves pawns one or two squares from the start, and only one later', () => {
    expect(movesFrom(position('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1'), 'e2')).toEqual(['e2e3', 'e2e4'])
    expect(movesFrom(position('4k3/8/8/8/8/4P3/8/4K3 w - - 0 1'), 'e3')).toEqual(['e3e4'])
    expect(movesFrom(position('4k3/4p3/8/8/8/8/8/4K3 b - - 0 1'), 'e7')).toEqual(['e7e5', 'e7e6'])
  })

  it('blocks pawns head-on and lets them capture diagonally only', () => {
    expect(movesFrom(position('4k3/8/8/8/8/4n3/4P3/4K3 w - - 0 1'), 'e2')).toEqual([])
    expect(movesFrom(position('4k3/8/8/8/8/3b1b2/4P3/4K3 w - - 0 1'), 'e2')).toEqual([
      'e2d3', 'e2e3', 'e2e4', 'e2f3',
    ])
  })
})

describe('king safety', () => {
  it('keeps the king off squares attacked by enemy pieces', () => {
    expect(movesFrom(position('4k3/8/8/8/8/8/r7/4K3 w - - 0 1'), 'e1')).toEqual(['e1d1', 'e1f1'])
  })

  it('never puts the kings next to each other', () => {
    // Black king on f5: e4 and f4 touch it; every other step is allowed.
    expect(movesFrom(position('8/8/8/5k2/8/4K3/8/8 w - - 0 1'), 'e3')).toEqual([
      'e3d2', 'e3d3', 'e3d4', 'e3e2', 'e3f2', 'e3f3',
    ])
  })

  it('freezes a piece pinned against its king, except along the pin', () => {
    expect(movesFrom(position('k3r3/8/8/8/8/8/4B3/4K3 w - - 0 1'), 'e2')).toEqual([])
    expect(movesFrom(position('k3r3/8/8/8/8/8/4R3/4K3 w - - 0 1'), 'e2')).toEqual([
      'e2e3', 'e2e4', 'e2e5', 'e2e6', 'e2e7', 'e2e8',
    ])
  })

  it('answers a check only by moving the king, blocking or capturing', () => {
    expect(legalUci(position('4r2k/8/8/8/8/R7/8/4K3 w - - 0 1'))).toEqual(['a3e3', 'e1d1', 'e1d2', 'e1f1', 'e1f2'])
  })

  it('allows only king moves in double check', () => {
    expect(legalUci(position('4r2k/8/8/8/1b6/R7/8/4K3 w - - 0 1'))).toEqual(['e1d1', 'e1f1', 'e1f2'])
  })

  it('detects a discovered check', () => {
    const before = position('4k3/8/8/8/4N3/8/4R3/K7 w - - 0 1')
    expect(isInCheck(before.board, 'black')).toBe(false)
    const after = applyMove(before, legal(before, 'e4c3'))
    expect(isInCheck(after.board, 'black')).toBe(true)
  })
})

describe('only kings capture kings', () => {
  // These positions cannot occur in play (the side that just moved is in check); they prove the
  // generator never offers a non-king capture of a king even if handed one.
  it.each([
    ['a rook on the same file', '4k3/8/8/8/8/8/8/4RK2 w - - 0 1'],
    ['a knight a jump away', '4k3/8/3N4/8/8/8/8/4K3 w - - 0 1'],
    ['a pawn on the capture diagonal', '8/8/8/8/8/2k5/1P6/4K3 w - - 0 1'],
  ])('with %s', (_label, fen) => {
    const pos = rawPosition(fen)
    const blackKing = pos.board.findIndex((piece) => piece?.type === 'king' && piece.color === 'black')
    expect(ordinaryLegalMoves(pos).filter((move) => move.to === blackKing).map(toUci)).toEqual([])
  })
})
