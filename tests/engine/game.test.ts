import { describe, expect, it } from 'vitest'
import {
  agreeDraw,
  applyMove,
  currentPosition,
  newGame,
  play,
  positionKey,
  resign,
  startingPosition,
  toMeanFen,
  undo,
  type GameRecord,
} from '../../src/engine/index.ts'
import { legal, position } from './helpers.ts'

const playAll = (game: GameRecord, moves: string): GameRecord =>
  moves.split(' ').reduce((acc, move) => play(acc, move), game)

describe('game record', () => {
  it('ends in checkmate after Scholar’s mate (no Mean escape exists there)', () => {
    const game = playAll(newGame(), 'e2e4 e7e5 f1c4 b8c6 d1h5 g8f6 h5f7')
    expect(game.outcome).toEqual({ kind: 'checkmate', winner: 'white' })
    expect(() => play(game, 'e8e7')).toThrow('over')
  })

  it('ends in stalemate when the side to move has no move and is not in check', () => {
    expect(newGame(position('K7/P7/8/8/8/4k3/8/1r6 w - - 0 1')).outcome).toEqual({ kind: 'stalemate', winner: null })
  })

  it('rejects illegal moves', () => {
    expect(() => play(newGame(), 'e2e5')).toThrow('Illegal move: e2e5')
  })

  it('takes moves back', () => {
    const game = undo(play(newGame(), 'e2e4'))
    expect(game.moves).toHaveLength(0)
    expect(toMeanFen(currentPosition(game))).toBe(toMeanFen(startingPosition()))
    expect(undo(game)).toBe(game)
  })

  it('records resignation and agreed draws, and lets undo withdraw them', () => {
    const game = play(newGame(), 'e2e4')
    expect(resign(game, 'white').outcome).toEqual({ kind: 'resignation', winner: 'black' })
    const drawn = agreeDraw(game)
    expect(drawn.outcome).toEqual({ kind: 'agreement', winner: null })
    const withdrawn = undo(drawn)
    expect(withdrawn.outcome).toBeNull()
    expect(withdrawn.moves).toHaveLength(1)
  })
})

describe('draw rules', () => {
  it('draws by the fifty-move rule after 100 plies without a pawn move or capture', () => {
    const game = play(newGame(position('4k3/8/8/8/8/8/8/R3K3 w - - 99 60')), 'a1a2')
    expect(game.outcome).toEqual({ kind: 'fifty-move', winner: null })
  })

  it('resets the fifty-move count on a pawn move', () => {
    const game = play(newGame(position('4k3/8/8/8/8/8/P7/4K3 w - - 99 60')), 'a2a3')
    expect(currentPosition(game).halfmoveClock).toBe(0)
    expect(game.outcome).toBeNull()
  })

  it('draws on the third occurrence of the same position', () => {
    const shuffle = 'g1f3 g8f6 f3g1 f6g8'
    const twice = playAll(newGame(), `${shuffle} ${shuffle}`.split(' ').slice(0, -1).join(' '))
    expect(twice.outcome).toBeNull()
    expect(play(twice, 'f6g8').outcome).toEqual({ kind: 'threefold', winner: null })
  })

  it('counts en passant in the position only when the capture is really possible', () => {
    const start = startingPosition()
    expect(positionKey(applyMove(start, legal(start, 'e2e4')))).toBe(
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -',
    )
    const capturable = currentPosition(play(newGame(position('4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1')), 'd7d5'))
    expect(positionKey(capturable).endsWith(' d6')).toBe(true)
  })

  it('distinguishes an original queen from a promoted one', () => {
    expect(positionKey(position('4k3/8/8/8/8/8/8/Q3K3 w - - 0 1'))).not.toBe(
      positionKey(position('4k3/8/8/8/8/8/8/Q~3K3 w - - 0 1')),
    )
  })
})
