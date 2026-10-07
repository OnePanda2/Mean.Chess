import { describe, expect, it } from 'vitest'
import {
  analyze,
  explainBlocked,
  explainIneligible,
  explainMove,
  pieceAt,
  pieceName,
  type Explanation,
} from '../../src/engine/index.ts'
import { defined, fen, legal, position, rawPosition } from './helpers.ts'

/** The explanation for `uciMove` in `text`, as shown to the player (handoff §28). */
function explanation(text: string, uciMove: string): Explanation | null {
  const pos = position(text)
  return explainMove(analyze(pos), legal(pos, uciMove))
}

describe('move explanations', () => {
  it('explains a Royal Capture', () => {
    expect(explanation('8/8/8/8/8/5k2/8/7K w - - 0 1', 'h1f3')).toEqual({
      title: 'Royal Capture',
      detail: 'Your king captures the opposing king from two squares away. This wins the game.',
    })
  })

  it('names the piece a Royal Slaughter sacrifices', () => {
    expect(explanation(fen({ e1: 'K', e2: 'N', e3: 'k' }), 'e1e3')?.detail).toBe(
      'Your knight stands between the kings and is your eligible sacrifice. Your king eats it and captures the opposing king. This wins the game.',
    )
  })

  it('explains Royal Cannibalism out of a standard checkmate', () => {
    expect(explanation('k7/8/8/8/8/8/5PPP/4r1K1 w - - 0 1', 'g1f2')).toEqual({
      title: 'Royal Cannibalism',
      detail: 'Under normal chess rules this is checkmate. Your king may sacrifice this pawn to escape.',
    })
  })

  it('explains Royal Cannibalism when every normal move is suicidal, without saying so (C9, D-39)', () => {
    expect(explanation('8/8/8/8/5k2/8/6P1/r6K w - - 0 1', 'h1g2')?.detail).toBe(
      'Your king is desperate, so it may sacrifice this pawn to escape.',
    )
  })

  it('never reveals the Kill Zone: a suicidal step reads like any other move (D-39)', () => {
    expect(legal(position('8/8/8/8/4k3/8/8/7K b - - 0 1'), 'e4f3').suicidal).toBe(true)
    expect(explanation('8/8/8/8/4k3/8/8/7K b - - 0 1', 'e4f3')).toBeNull()
    expect(explanation('8/8/8/8/4k3/8/8/7K b - - 0 1', 'e4d5')).toBeNull()
  })
})

describe('why a piece cannot be sacrificed', () => {
  it('points at the lower tier that still exists', () => {
    const pos = position('4k3/8/8/8/8/8/P4nBB/6NK w - - 0 1')
    expect(explainIneligible(analyze(pos), defined(pieceAt(pos.board, 14)))?.detail).toBe(
      'You still have pawns. Only those can be sacrificed.',
    )
  })

  it('protects the original queen', () => {
    const pos = position('b2k4/8/8/8/7r/8/8/6QK w - - 0 1')
    expect(explainIneligible(analyze(pos), defined(pieceAt(pos.board, 6)))?.detail).toBe(
      'The original queen can never be sacrificed.',
    )
  })

  it('has nothing to say about the king', () => {
    const pos = position('b2k4/8/8/8/7r/8/8/6QK w - - 0 1')
    expect(explainIneligible(analyze(pos), defined(pieceAt(pos.board, 7)))).toBeNull()
  })
})

describe('why there is no royal move between kings two squares apart', () => {
  it('cannot jump an enemy piece', () => {
    const blocked = explainBlocked(analyze(position(fen({ e1: 'K', e2: 'P', e3: 'k' }, 'b'))))
    expect(blocked && [blocked.square, blocked.detail]).toEqual([12, 'Kings cannot jump over enemy pieces.'])
  })

  it('names an own piece that is not eligible yet', () => {
    expect(explainBlocked(analyze(position(fen({ e1: 'K', e2: 'N', a2: 'P', e3: 'k' }))))?.detail).toBe(
      'Your knight stands between the kings. You still have pawns, so it cannot be sacrificed yet.',
    )
  })

  it('names the original queen', () => {
    expect(explainBlocked(analyze(rawPosition(fen({ e1: 'K', e2: 'Q', e3: 'k' }))))?.detail).toBe(
      'The original queen stands between the kings and can never be sacrificed.',
    )
  })

  it('stays silent when nothing is blocked', () => {
    expect(explainBlocked(analyze(position(fen({ e1: 'K', e3: 'k' }))))).toBeNull()
  })
})

describe('position analysis', () => {
  it('reports each side’s active tier', () => {
    expect(analyze(position(fen({ e1: 'K', a2: 'P', h8: 'k', b7: 'n' }))).activeTiers).toEqual({ white: 1, black: 2 })
  })

  it('names pieces for explanations', () => {
    const pos = position('3qk3/8/8/8/8/8/8/Q~3K3 w - - 0 1')
    expect([pieceName(pieceAt(pos.board, 0)), pieceName(pieceAt(pos.board, 59)), pieceName(null)]).toEqual([
      'promoted queen',
      'queen',
      'piece',
    ])
  })
})
