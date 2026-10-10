import { describe, expect, it } from 'vitest'
import { BADGE_POP_MS, SLICE_MS, endingBadges, endingTimeline } from '../../src/app/ending.ts'
import { currentPosition, newGame, parseMeanFen, parseSquare, play, resign, agreeDraw } from '../../src/engine/index.ts'

function gameFrom(fen: string, moves: readonly string[] = []) {
  const parsed = parseMeanFen(fen)
  if (!parsed.ok) throw new Error(parsed.error)
  return moves.reduce((game, move) => play(game, move), newGame(parsed.position))
}

function sq(name: string): number {
  const square = parseSquare(name)
  if (square === null) throw new Error(`bad square ${name}`)
  return square
}

/** Scholar's mate, which still mates in Mean Chess. */
const SCHOLAR = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4'

describe('how a game’s ending is shown (D-52)', () => {
  it('waits for a Royal Slaughter’s slice, then the king’s strike, before the badges and the result', () => {
    const game = gameFrom('8/8/8/8/8/4k3/4P3/4K3 w - - 0 1', ['e1e3'])
    if (!game.outcome) throw new Error('expected a finished game')
    const timeline = endingTimeline(game.outcome, game.moves.at(-1) ?? null, { animate: true, live: true })
    expect(timeline.badgesAt).toBeGreaterThan(SLICE_MS)
    expect(timeline.resultAt - timeline.badgesAt - BADGE_POP_MS).toBeGreaterThanOrEqual(1_000)
    expect(timeline.resultAt - timeline.badgesAt - BADGE_POP_MS).toBeLessThanOrEqual(2_000)
  })

  it('orders the endings: slaughter after capture after an ordinary final move after a resignation', () => {
    const at = (game: ReturnType<typeof gameFrom>) => {
      if (!game.outcome) throw new Error('expected a finished game')
      return endingTimeline(game.outcome, game.moves.at(-1) ?? null, { animate: true, live: true }).badgesAt
    }
    const slaughter = at(gameFrom('8/8/8/8/8/4k3/4P3/4K3 w - - 0 1', ['e1e3']))
    const capture = at(gameFrom('8/8/8/8/8/5k2/8/7K w - - 0 1', ['h1f3']))
    const mate = at(gameFrom(SCHOLAR, ['h5f7']))
    const resigned = at(resign(newGame(), 'white'))
    expect(slaughter).toBeGreaterThan(capture)
    expect(capture).toBeGreaterThan(mate)
    expect(mate).toBeGreaterThan(resigned)
    expect(resigned).toBe(0)
  })

  it('still pauses before the result when movement is off, and opens quickly for a game reopened later', () => {
    const game = gameFrom('8/8/8/8/8/5k2/8/7K w - - 0 1', ['h1f3'])
    if (!game.outcome) throw new Error('expected a finished game')
    const still = endingTimeline(game.outcome, game.moves.at(-1) ?? null, { animate: false, live: true })
    expect(still.badgesAt).toBe(0)
    expect(still.resultAt).toBeGreaterThanOrEqual(1_000)
    const reopened = endingTimeline(game.outcome, game.moves.at(-1) ?? null, { animate: true, live: false })
    expect(reopened.badgesAt).toBe(0)
    expect(reopened.resultAt).toBeLessThan(still.resultAt)
  })

  it('crowns the winner and marks the fallen king on the same square after a royal win', () => {
    const game = gameFrom('8/8/8/8/8/5k2/8/7K w - - 0 1', ['h1f3'])
    if (!game.outcome) throw new Error('expected a finished game')
    expect(endingBadges(game.outcome, currentPosition(game), game.moves.at(-1) ?? null)).toEqual([
      { sq: sq('f3'), kind: 'crown', corner: 'right' },
      { sq: sq('f3'), kind: 'skull', corner: 'left' },
    ])
  })

  it('marks a checkmated king with a skull and a resigning king with a flag', () => {
    // Scholar's mate: the black king on e8 is mated.
    const mated = gameFrom(SCHOLAR, ['h5f7'])
    if (!mated.outcome) throw new Error('expected checkmate')
    expect(mated.outcome.kind).toBe('checkmate')
    expect(endingBadges(mated.outcome, currentPosition(mated), mated.moves.at(-1) ?? null)).toEqual([
      { sq: sq('e1'), kind: 'crown', corner: 'right' },
      { sq: sq('e8'), kind: 'skull', corner: 'right' },
    ])
    const resigned = resign(newGame(), 'black')
    if (!resigned.outcome) throw new Error('expected a resignation')
    expect(endingBadges(resigned.outcome, currentPosition(resigned), null)).toEqual([
      { sq: sq('e1'), kind: 'crown', corner: 'right' },
      { sq: sq('e8'), kind: 'flag', corner: 'right' },
    ])
  })

  it('gives both kings ½ in a draw', () => {
    const drawn = agreeDraw(newGame())
    if (!drawn.outcome) throw new Error('expected a draw')
    expect(endingBadges(drawn.outcome, currentPosition(drawn), null)).toEqual([
      { sq: sq('e1'), kind: 'draw', corner: 'right' },
      { sq: sq('e8'), kind: 'draw', corner: 'right' },
    ])
  })
})
