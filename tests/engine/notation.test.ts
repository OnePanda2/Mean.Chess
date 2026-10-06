import { describe, expect, it } from 'vitest'
import {
  currentPosition,
  newGame,
  play,
  startingPosition,
  toAsciiMcn,
  toMcn,
  type GameRecord,
  type Position,
} from '../../src/engine/index.ts'
import { fen, legal, position } from './helpers.ts'

const mcn = (pos: Position, uciMove: string): string => toMcn(pos, legal(pos, uciMove))

/** The notation of the last move of a game. */
function lastMcn(game: GameRecord): string {
  const move = game.moves.at(-1)
  const before = game.positions.at(-2)
  if (!move || !before) throw new Error('no moves')
  return toMcn(before, move)
}

const playAll = (start: Position, moves: string): GameRecord =>
  moves.split(' ').reduce((game, move) => play(game, move), newGame(start))

describe('Mean Chess Notation (Rules §2.9)', () => {
  it('writes ordinary moves as standard SAN', () => {
    const start = startingPosition()
    expect([mcn(start, 'e2e4'), mcn(start, 'g1f3')]).toEqual(['e4', 'Nf3'])
    const open = position('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1')
    expect([mcn(open, 'e1g1'), mcn(open, 'e1c1')]).toEqual(['O-O', 'O-O-O'])
  })

  it('writes captures, en passant and promotions', () => {
    expect(mcn(position('4k3/8/8/8/8/3b1b2/4P3/4K3 w - - 0 1'), 'e2d3')).toBe('exd3')
    const ep = currentPosition(play(newGame(position('4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1')), 'd7d5'))
    expect(mcn(ep, 'e5d6')).toBe('exd6')
    const promote = position('4k3/P7/8/8/8/8/8/4K3 w - - 0 1')
    expect([mcn(promote, 'a7a8q'), mcn(promote, 'a7a8n')]).toEqual(['a8=Q+', 'a8=N'])
  })

  it('disambiguates by file, then rank, then square', () => {
    const knights = position(fen({ e1: 'K', b1: 'N', f3: 'N', e8: 'k' }))
    expect([mcn(knights, 'b1d2'), mcn(knights, 'f3d2')]).toEqual(['Nbd2', 'Nfd2'])
    const rooks = position(fen({ e1: 'K', a1: 'R', a3: 'R', h8: 'k' }))
    expect([mcn(rooks, 'a1a2'), mcn(rooks, 'a3a2')]).toEqual(['R1a2', 'R3a2'])
    const queens = position(fen({ e1: 'K', a1: 'Q', a3: 'Q~', c1: 'Q~', h7: 'k' }))
    expect([mcn(queens, 'a1b2'), mcn(queens, 'c1b2')]).toEqual(['Qa1b2', 'Qcb2'])
  })

  it('marks Mean checkmate with # and a check with an escape with +', () => {
    expect(lastMcn(playAll(startingPosition(), 'e2e4 e7e5 f1c4 b8c6 d1h5 g8f6 h5f7'))).toBe('Qxf7#')
    // Fool's mate is only check in Mean Chess: the king can eat its d2 or e2 pawn.
    expect(lastMcn(playAll(startingPosition(), 'f2f3 e7e5 g2g4 d8h4'))).toBe('Qh4+')
  })

  it('writes the Mean moves explicitly', () => {
    expect(mcn(position('8/8/8/8/8/5k2/8/7K w - - 0 1'), 'h1f3')).toBe('K×K')
    expect(mcn(position(fen({ e1: 'K', e2: 'P', e3: 'k' })), 'e1e3')).toBe('K×P×K')
    expect(mcn(position(fen({ e1: 'K', e2: 'N', e3: 'k' })), 'e1e3')).toBe('K×N×K')
    expect(mcn(position('k7/8/8/8/8/8/5PPP/4r1K1 w - - 0 1'), 'g1f2')).toBe('K×f2(own P)')
    expect(mcn(position('b2k4/8/8/8/7r/8/8/6Q~K w - - 0 1'), 'h1g1')).toBe('K×g1(own Q~)')
  })

  it('has a plain-ASCII form for export', () => {
    expect(toAsciiMcn(position('k7/8/8/8/8/8/5PPP/4r1K1 w - - 0 1'), legal(position('k7/8/8/8/8/8/5PPP/4r1K1 w - - 0 1'), 'g1f2'))).toBe(
      'Kxf2(own P)',
    )
  })
})
