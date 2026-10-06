import { describe, expect, it } from 'vitest'
import {
  agreeDraw,
  currentPosition,
  exportGame,
  importGame,
  newGame,
  play,
  resign,
  saveGame,
  toMeanFen,
  toUci,
  type GameRecord,
} from '../../src/engine/index.ts'
import { position } from './helpers.ts'

const playAll = (game: GameRecord, moves: string): GameRecord =>
  moves.split(' ').reduce((acc, move) => play(acc, move), game)

const loaded = (text: string): GameRecord => {
  const result = importGame(text)
  if (!result.ok) throw new Error(result.error)
  return result.game
}

const failure = (text: string): string => {
  const result = importGame(text)
  return result.ok ? 'loaded' : result.error
}

describe('saved games (docs/BLUEPRINT.md §4.6)', () => {
  it('round-trips a game with a self-capture, replaying every move', () => {
    const game = playAll(newGame(), 'f2f3 e7e5 g2g4 d8h4 e1e2')
    const copy = loaded(exportGame(game))
    expect(copy.moves.map(toUci)).toEqual(['f2f3', 'e7e5', 'g2g4', 'd8h4', 'e1e2'])
    expect(copy.moves.at(-1)?.kind).toBe('self-capture')
    expect(toMeanFen(currentPosition(copy))).toBe(toMeanFen(currentPosition(game)))
  })

  it('keeps a custom start position, including queen origin', () => {
    const game = newGame(position('b2k4/8/8/8/7r/8/8/6Q~K w - - 0 1'))
    expect(saveGame(game).start).toBe('b2k4/8/8/8/7r/8/8/6Q~K w - - 0 1')
    expect(toMeanFen(loaded(exportGame(game)).start)).toBe('b2k4/8/8/8/7r/8/8/6Q~K w - - 0 1')
  })

  it('recomputes a royal win from the moves', () => {
    const won = play(newGame(position('8/8/8/8/8/5k2/8/7K w - - 0 1')), 'h1f3')
    expect(loaded(exportGame(won)).outcome).toEqual({ kind: 'royal-capture', winner: 'white' })
  })

  it('restores endings that are not moves', () => {
    const game = play(newGame(), 'e2e4')
    expect(loaded(exportGame(resign(game, 'black'))).outcome).toEqual({ kind: 'resignation', winner: 'white' })
    expect(loaded(exportGame(agreeDraw(game))).outcome).toEqual({ kind: 'agreement', winner: null })
  })

  it('never trusts a stored result the moves do not produce', () => {
    const saved = { ...saveGame(play(newGame(), 'e2e4')), result: { kind: 'checkmate', winner: 'white' } }
    expect(loaded(JSON.stringify(saved)).outcome).toBeNull()
  })

  it.each([
    ['text that is not JSON', 'not json', 'not valid JSON'],
    ['another format', JSON.stringify({ format: 'pgn' }), 'not a saved Mean Chess game'],
    ['another version', JSON.stringify({ ...saveGame(newGame()), version: 2 }), 'different version'],
    ['a broken start position', JSON.stringify({ ...saveGame(newGame()), start: '8/8 w - - 0 1' }), 'start position is invalid'],
    ['a malformed move list', JSON.stringify({ ...saveGame(newGame()), moves: ['e2e4', 42] }), 'malformed'],
    ['an illegal move', JSON.stringify({ ...saveGame(newGame()), moves: ['e2e4', 'e7e4'] }), 'Move 2 (e7e4)'],
    ['too many moves', JSON.stringify({ ...saveGame(newGame()), moves: Array<string>(2001).fill('g1f3') }), 'malformed'],
    ['an oversized file', 'x'.repeat(70_000), 'too large'],
  ])('rejects %s', (_label, text, message) => {
    expect(failure(text)).toContain(message)
  })
})
