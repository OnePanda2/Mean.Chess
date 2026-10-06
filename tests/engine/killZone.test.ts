import { describe, expect, it } from 'vitest'
import { analyze, applyMove, isInCheck, legalMoves, toUci } from '../../src/engine/index.ts'
import { fen, legal, position } from './helpers.ts'

const suicidal = (text: string): string[] =>
  legalMoves(position(text))
    .filter((move) => move.suicidal === true)
    .map(toUci)
    .sort()

describe('the Royal Kill Zone is legal but dangerous (Rules §2.2)', () => {
  it('lets a king walk into the opponent’s royal reach, flagged as suicidal (A1)', () => {
    expect(suicidal('8/8/8/8/4k3/8/8/7K b - - 0 1')).toEqual(['e4f3'])
  })

  it('is not check', () => {
    const before = position('8/8/8/8/4k3/8/8/7K b - - 0 1')
    const after = applyMove(before, legal(before, 'e4f3'))
    expect(isInCheck(after.board, 'black')).toBe(false)
    expect(analyze(after).royal?.kind).toBe('royal-capture')
  })

  it('flags stepping to royal distance on a rank (A4)', () => {
    expect(suicidal('8/8/8/8/8/8/8/K2k4 w - - 0 1')).toEqual(['a1b1'])
  })

  it('can leave a cornered king nothing but a suicidal move (A5, a zugzwang, not a stalemate)', () => {
    const pos = position('8/8/8/8/8/8/2k5/K7 w - - 0 1')
    expect(legalMoves(pos).map((move) => [toUci(move), move.suicidal])).toEqual([['a1a2', true]])
  })

  it('flags moving the blocker off the line between the kings (B4)', () => {
    expect(suicidal(fen({ e1: 'K', e2: 'N', e3: 'k' }))).toEqual(['e2c1', 'e2c3', 'e2d4', 'e2f4', 'e2g1', 'e2g3'])
  })

  it('flags capturing the last enemy pawn when that arms the enemy’s Royal Slaughter (G1)', () => {
    expect(suicidal('8/7p/8/8/8/4k3/4n3/4K2R w - - 0 1')).toEqual(['h1h7'])
  })

  it('flags castling into royal reach (D1)', () => {
    expect(suicidal('8/8/8/8/8/6k1/P4N2/4K2R w K - 0 1')).toContain('e1g1')
  })

  it('flags queenside castling from four squares away (the king moves two squares)', () => {
    expect(suicidal('8/8/8/8/8/k7/P7/R3K3 w Q - 0 1')).toEqual(['e1c1'])
  })

  it('warns the side to move when the opponent threatens a royal move (B2)', () => {
    const blackToMove = analyze(position(fen({ e1: 'K', e2: 'P', e3: 'k' }, 'b')))
    expect(blackToMove.threat?.kind).toBe('royal-slaughter')
    expect(blackToMove.royal).toBeNull()
  })
})
