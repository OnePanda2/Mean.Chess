import { describe, expect, it } from 'vitest'
import {
  analyze,
  blockedRoyal,
  currentPosition,
  newGame,
  parseMeanFen,
  play,
  royalMove,
  squareName,
  toMcn,
  toUci,
} from '../../src/engine/index.ts'
import { defined, fen, position, rawPosition } from './helpers.ts'

const royalFor = (text: string, side: 'white' | 'black' = 'white') => royalMove(position(text).board, side)

describe('Royal Slaughter (Rules §2.3)', () => {
  it('eats an eligible pawn between the kings and wins in one move (B1)', () => {
    const move = royalFor(fen({ e1: 'K', e2: 'P', e3: 'k' }))
    expect(move?.kind).toBe('royal-slaughter')
    expect(move && [toUci(move), squareName(move.sacrificeSquare ?? -1), move.sacrificed?.type]).toEqual([
      'e1e3',
      'e2',
      'pawn',
    ])
    const game = play(newGame(position(fen({ e1: 'K', e2: 'P', e3: 'k' }))), 'e1e3')
    expect(game.outcome).toEqual({ kind: 'royal-slaughter', winner: 'white' })
    const after = currentPosition(game)
    expect([after.board[12], after.board[20]?.type]).toEqual([null, 'king']) // e2 empty, e3 white king
    expect(toMcn(game.positions[0] ?? game.start, defined(game.moves[0]))).toBe('K×P×K')
  })

  it('needs no check: it is a hunting move (founder decision D-02)', () => {
    const pos = position(fen({ e1: 'K', e2: 'P', e3: 'k' }))
    expect(analyze(pos).inCheck).toBe(false)
    expect(analyze(pos).royal?.kind).toBe('royal-slaughter')
  })

  it('cannot jump an enemy piece: the pawn blocks Black (B2), who is now in the Kill Zone', () => {
    const blackToMove = position(fen({ e1: 'K', e2: 'P', e3: 'k' }, 'b'))
    expect(royalMove(blackToMove.board, 'black')).toBeNull()
    expect(blockedRoyal(blackToMove.board, 'black')?.reason).toBe('enemy-piece')
    expect(analyze(blackToMove).threat?.kind).toBe('royal-slaughter')
  })

  it('is impossible through a knight while a pawn exists anywhere (B3)', () => {
    const text = fen({ e1: 'K', e2: 'N', a2: 'P', e3: 'k' })
    expect(royalFor(text)).toBeNull()
    expect(blockedRoyal(position(text).board, 'white')?.reason).toBe('not-eligible')
  })

  it('becomes possible through the knight once no pawn remains (B4)', () => {
    const move = royalFor(fen({ e1: 'K', e2: 'N', e3: 'k' }))
    expect(move?.kind).toBe('royal-slaughter')
    expect(move && toMcn(position(fen({ e1: 'K', e2: 'N', e3: 'k' })), move)).toBe('K×N×K')
  })

  it.each([
    ['a bishop on a file (B5)', { e1: 'K', e2: 'B', e3: 'k' }],
    ['a rook on a diagonal (B6)', { c1: 'K', d2: 'R', e3: 'k' }],
    ['a pawn on a rank', { c2: 'K', d2: 'P', e2: 'k' }],
    ['a pawn on the diagonal behind it (B12)', { e3: 'K', d2: 'P', c1: 'k' }],
    ['a knight on a diagonal', { c1: 'K', d2: 'N', e3: 'k' }],
  ])('works through %s', (_label, pieces) => {
    expect(royalFor(fen(pieces))?.kind).toBe('royal-slaughter')
  })

  it('is impossible through a rook while a knight exists anywhere (B7)', () => {
    expect(royalFor(fen({ c1: 'K', d2: 'R', h1: 'N', e3: 'k' }))).toBeNull()
  })

  it('works for Black through its own knight (B9) and not for White through that enemy knight (B8)', () => {
    const pieces = { e1: 'K', e2: 'n', e3: 'k' }
    expect(royalFor(fen(pieces), 'white')).toBeNull()
    const black = royalMove(position(fen(pieces, 'b')).board, 'black')
    expect(black && [black.kind, toUci(black)]).toEqual(['royal-slaughter', 'e3e1'])
  })

  // A queen (or rook on a line, bishop on a diagonal, pawn on its capture diagonal) between the
  // kings always attacks the enemy king, so it is the slaughterer's turn only in impossible
  // positions (D-16). The generator is tested directly on such boards.
  describe('blockers that can never occur in a legal game', () => {
    it.each([
      ['a promoted queen', { e1: 'K', e2: 'Q~', e3: 'k' }],
      ['a pawn on its capture diagonal (B11)', { c1: 'K', d2: 'P', e3: 'k' }],
      ['a rook on a file', { e1: 'K', e2: 'R', e3: 'k' }],
      ['a bishop on a diagonal', { c1: 'K', d2: 'B', e3: 'k' }],
    ])('rejects the position with %s between the kings', (_label, pieces) => {
      expect(parseMeanFen(fen(pieces)).ok).toBe(false)
    })

    it('would slaughter a promoted queen once all lower tiers are gone', () => {
      expect(royalMove(rawPosition(fen({ e1: 'K', e2: 'Q~', e3: 'k' })).board, 'white')?.kind).toBe('royal-slaughter')
    })

    it('would not slaughter a promoted queen while a rook remains', () => {
      expect(royalMove(rawPosition(fen({ e1: 'K', e2: 'Q~', a1: 'R', e3: 'k' })).board, 'white')).toBeNull()
    })

    it('never slaughters the original queen, whatever else is left', () => {
      const board = rawPosition(fen({ e1: 'K', e2: 'Q', e3: 'k' })).board
      expect(royalMove(board, 'white')).toBeNull()
      expect(blockedRoyal(board, 'white')?.reason).toBe('original-queen')
    })
  })
})
