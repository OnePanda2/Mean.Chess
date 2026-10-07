import { describe, expect, it } from 'vitest'
import { canUndo, computerToMove, createState, gameReducer, type GameState } from '../../src/app/gameState.ts'
import type { Opponent } from '../../src/app/opponent.ts'
import { currentPosition, newGame, parseMeanFen, play, type GameRecord } from '../../src/engine/index.ts'

const asWhite: Opponent = { kind: 'computer', level: 'mean', human: 'white' }
const asBlack: Opponent = { kind: 'computer', level: 'mean', human: 'black' }

function gameFrom(fen: string, moves: readonly string[] = []): GameRecord {
  const parsed = parseMeanFen(fen)
  if (!parsed.ok) throw new Error(parsed.error)
  return moves.reduce((game, move) => play(game, move), newGame(parsed.position))
}

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const stateOf = (game: GameRecord, opponent: Opponent): GameState => createState(game, { opponent })

describe('games against the computer (game state)', () => {
  it('knows whose turn it is', () => {
    expect(computerToMove(stateOf(newGame(), asWhite))).toBe(false)
    expect(computerToMove(stateOf(newGame(), asBlack))).toBe(true)
    expect(computerToMove(stateOf(newGame(), { kind: 'friend' }))).toBe(false)
  })

  it('ignores clicks while the computer is to move', () => {
    const state = stateOf(newGame(), asBlack)
    expect(gameReducer(state, { type: 'square', square: 52 }).selected).toBeNull() // e7
  })

  it('plays the computer’s move only for the position it was asked about', () => {
    const state = stateOf(gameFrom(START, ['e2e4']), asWhite)
    expect(gameReducer(state, { type: 'computer-move', uci: 'e7e5', ply: 0 }).game.moves).toHaveLength(1)
    expect(gameReducer(state, { type: 'computer-move', uci: 'e7e6', ply: 1 }).game.moves).toHaveLength(2)
    // An illegal answer changes nothing; nor does an answer on the player's turn.
    expect(gameReducer(state, { type: 'computer-move', uci: 'e7e4', ply: 1 })).toBe(state)
    const playersTurn = stateOf(newGame(), asWhite)
    expect(gameReducer(playersTurn, { type: 'computer-move', uci: 'e2e4', ply: 0 })).toBe(playersTurn)
  })

  it('undoes back to the player’s turn, and only when the player has moved', () => {
    expect(canUndo(stateOf(gameFrom(START, ['e2e4']), asBlack))).toBe(false)
    const state = stateOf(gameFrom(START, ['e2e4', 'e7e5', 'g1f3']), asBlack)
    expect(canUndo(state)).toBe(true)
    const undone = gameReducer(state, { type: 'undo' })
    expect(undone.game.moves).toHaveLength(1)
    expect(currentPosition(undone.game).sideToMove).toBe('black')
    // While the computer thinks, Undo takes back the player's move alone.
    const thinking = stateOf(gameFrom(START, ['e2e4', 'e7e5']), asBlack)
    expect(gameReducer(thinking, { type: 'undo' }).game.moves).toHaveLength(1)
  })

  it('undoes a lost game back to before the player’s fatal move', () => {
    const lost = stateOf(gameFrom('7k/8/8/4K3/8/8/8/8 w - - 0 1', ['e5f6', 'h8f6']), asWhite)
    expect(lost.game.outcome?.kind).toBe('royal-capture')
    expect(gameReducer(lost, { type: 'undo' }).game.moves).toHaveLength(0)
  })

  it('always resigns for the player, even on the computer’s turn', () => {
    const state = stateOf(gameFrom(START, ['e2e4']), asWhite)
    expect(gameReducer(state, { type: 'resign' }).game.outcome).toEqual({ kind: 'resignation', winner: 'black' })
  })

  it('applies a draw answer only to the position it was offered in', () => {
    const state = stateOf(gameFrom(START, ['e2e4', 'e7e5']), asWhite)
    expect(gameReducer(state, { type: 'draw-answer', accept: true, ply: 1 })).toBe(state)
    expect(gameReducer(state, { type: 'draw-answer', accept: false, ply: 2 }).drawDeclinedAt).toBe(2)
    expect(gameReducer(state, { type: 'draw-answer', accept: true, ply: 2 }).game.outcome?.kind).toBe('agreement')
  })

  it('starts the player at the bottom and switches to friends for a loaded position', () => {
    const state = stateOf(newGame(), { kind: 'friend' })
    expect(gameReducer(state, { type: 'start', opponent: asBlack }).flipped).toBe(true)
    expect(gameReducer(state, { type: 'start', opponent: asWhite }).flipped).toBe(false)
    const loaded = gameReducer(stateOf(newGame(), asWhite), { type: 'load', game: newGame(), scenario: null })
    expect(loaded.opponent).toEqual({ kind: 'friend' })
  })
})
