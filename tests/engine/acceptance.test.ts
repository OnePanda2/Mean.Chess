import { describe, expect, it } from 'vitest'
import {
  analyze,
  currentPosition,
  findKing,
  legalMoves,
  newGame,
  parseMeanFen,
  play,
  royalMove,
  toMcn,
  toUci,
  type GameRecord,
} from '../../src/engine/index.ts'
import { defined, fen, position, rawPosition } from './helpers.ts'

/** The handoff's acceptance scenarios (§43–§45), scripted against the engine. */

const historyOf = (game: GameRecord): string[] =>
  game.moves.map((move, i) => toMcn(defined(game.positions[i]), move))

describe('§43 the foundational scenario', () => {
  it('Black may walk into the Kill Zone; White sees and plays the Royal Capture; the game ends', () => {
    // White king h1, black king e4. Black steps to f3: legal, two squares from the white king.
    let game = newGame(position('8/8/8/8/4k3/8/8/7K b - - 0 1'))
    const step = legalMoves(currentPosition(game)).find((move) => toUci(move) === 'e4f3')
    expect(step?.suicidal).toBe(true)
    game = play(game, 'e4f3')
    expect(game.outcome).toBeNull()

    const whiteView = analyze(currentPosition(game))
    expect(whiteView.royal && [whiteView.royal.kind, toUci(whiteView.royal)]).toEqual(['royal-capture', 'h1f3'])

    game = play(game, 'h1f3')
    expect(game.outcome).toEqual({ kind: 'royal-capture', winner: 'white' })
    expect(findKing(currentPosition(game).board, 'black')).toBeNull()
    expect(historyOf(game)).toEqual(['Kf3', 'K×K'])
  })

  it('no ordinary piece ever captures a king', () => {
    for (const fenText of [
      '8/8/8/8/8/5k2/8/7K w - - 0 1',
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      'k7/8/8/8/8/8/5PPP/4r1K1 w - - 0 1',
    ]) {
      const pos = position(fenText)
      const enemyKing = findKing(pos.board, 'black')
      expect(legalMoves(pos).filter((move) => move.to === enemyKing && move.piece.type !== 'king')).toEqual([])
    }
  })

  it('K–P–K: Royal Slaughter removes the pawn, captures the king and ends the game', () => {
    const game = play(newGame(position(fen({ e1: 'K', e2: 'P', e3: 'k' }))), 'e1e3')
    expect(game.outcome).toEqual({ kind: 'royal-slaughter', winner: 'white' })
    expect(currentPosition(game).board[12]).toBeNull() // e2
    expect(historyOf(game)).toEqual(['K×P×K'])
  })

  it('K–N–K: no Royal Slaughter while a white pawn exists elsewhere; available once it is gone', () => {
    expect(analyze(position(fen({ e1: 'K', e2: 'N', a2: 'P', e3: 'k' }))).royal).toBeNull()
    expect(analyze(position(fen({ e1: 'K', e2: 'N', e3: 'k' }))).royal?.kind).toBe('royal-slaughter')
  })

  it('K–Q–K: an original queen never allows Royal Slaughter; a promoted one does once lower tiers are gone', () => {
    // Both positions are unreachable in play (the queen would be giving check, D-16), so the
    // generator is asked directly.
    expect(parseMeanFen(fen({ e1: 'K', e2: 'Q', e3: 'k' })).ok).toBe(false)
    expect(royalMove(rawPosition(fen({ e1: 'K', e2: 'Q', e3: 'k' })).board, 'white')).toBeNull()
    expect(royalMove(rawPosition(fen({ e1: 'K', e2: 'Q~', e3: 'k' })).board, 'white')?.kind).toBe('royal-slaughter')
  })
})

describe('§44 checkmate escape', () => {
  it('a back-rank mate is escaped by eating an eligible pawn; the game goes on', () => {
    const start = position('k7/8/8/8/8/8/5PPP/4r1K1 w - - 0 1')
    expect(newGame(start).outcome).toBeNull()
    const game = play(newGame(start), 'g1h2')
    expect(game.outcome).toBeNull()
    expect(currentPosition(game).board.filter((piece) => piece?.type === 'pawn')).toHaveLength(2)
    expect(historyOf(game)).toEqual(['K×h2(own P)'])
  })

  it.each([
    ['knight and bishops (no pawns left)', '4k3/8/8/8/8/8/5nBB/6NK w - - 0 1', true],
    ['the same with a pawn left on a2', '4k3/8/8/8/8/8/P4nBB/6NK w - - 0 1', false],
    ['rooks', 'b2k4/8/8/8/8/8/5n1R/6RK w - - 0 1', true],
    ['a promoted queen', 'b2k4/8/8/8/7r/8/8/6Q~K w - - 0 1', true],
    ['the original queen', 'b2k4/8/8/8/7r/8/8/6QK w - - 0 1', false],
  ])('hierarchy check with %s: escape possible = %s', (_label, text, escapes) => {
    expect(analyze(position(text)).cannibalism.length > 0).toBe(escapes)
    expect(newGame(position(text)).outcome?.kind ?? 'ongoing').toBe(escapes ? 'ongoing' : 'checkmate')
  })
})

describe('§45 King Kill Zone', () => {
  it('K . K is legal; K K is not', () => {
    expect(parseMeanFen(fen({ c1: 'K', e1: 'k' })).ok).toBe(true)
    expect(parseMeanFen(fen({ d1: 'K', e1: 'k' })).ok).toBe(false)
  })

  it('a king two squares away wins by capture; three squares away it cannot', () => {
    expect(analyze(position(fen({ c1: 'K', e1: 'k' }))).royal?.kind).toBe('royal-capture')
    expect(analyze(position(fen({ b1: 'K', e1: 'k' }))).royal).toBeNull()
  })

  it('an enemy piece between the kings blocks; an own eligible piece means Royal Slaughter', () => {
    expect(analyze(position(fen({ c1: 'K', d1: 'n', e1: 'k' }))).royal).toBeNull()
    expect(analyze(position(fen({ c1: 'K', d1: 'N', e1: 'k' }))).royal?.kind).toBe('royal-slaughter')
  })
})
