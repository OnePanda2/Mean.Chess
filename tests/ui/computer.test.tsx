import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { PlayApp } from '../../src/app/PlayApp.tsx'
import { ComputerContext, inlineClient } from '../../src/app/computer.ts'
import type { Opponent } from '../../src/app/opponent.ts'
import { exportGame, newGame, parseMeanFen, play } from '../../src/engine/index.ts'

const square = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name},`) })
const status = () => within(screen.getByRole('region', { name: 'Game status' }))
const moveList = () => within(screen.getByRole('region', { name: 'Moves' }))
const button = (name: string) => screen.getByRole('button', { name })

/** The play page with the computer running in-process (a Web Worker in the browser). */
function renderPage() {
  return render(
    <ComputerContext value={inlineClient({ maxDepth: 2 })}>
      <PlayApp />
    </ComputerContext>,
  )
}

/** Saves a game against the computer from `fen` (and `moves`) the way the app does, so the page resumes it. */
function resumeAgainstComputer(fen: string, opponent: Opponent, moves: readonly string[] = []): void {
  const parsed = parseMeanFen(fen)
  if (!parsed.ok) throw new Error(parsed.error)
  const game = moves.reduce((record, move) => play(record, move), newGame(parsed.position))
  window.localStorage.setItem('mean-chess:game:v1', exportGame(game))
  window.localStorage.setItem('mean-chess:opponent:v1', JSON.stringify(opponent))
}

const AUTO_NICE: Opponent = { kind: 'computer', level: 'nice', human: 'white', auto: true }
/** White to move can take the black king on f3: a quick win against the computer. */
const ROYAL_WIN = '8/8/8/8/8/5k2/8/7K w - - 0 1'
const savedSkill = (): unknown => JSON.parse(window.localStorage.getItem('mean-chess:skill:v1') ?? 'null')

/** Waits for the computer's answer, announced for screen readers. */
const computerMoved = () => screen.findByText(/^The computer played .+\. Your move\.$/, {}, { timeout: 5_000 })

describe('playing the computer', () => {
  it('opens the New game dialog from a welcome-page link, shows who is playing, and answers a move', async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, '', '/play/?new=computer')
    renderPage()
    expect(window.location.search).toBe('') // the request is consumed
    const dialog = screen.getByRole('dialog', { name: 'New game' })
    expect(within(dialog).getByRole('radio', { name: /The computer/ })).toHaveProperty('checked', true)
    await user.click(within(dialog).getByRole('radio', { name: /^Nice/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Start game' }))
    expect(status().getByText('Your move')).toBeTruthy()
    expect(status().getByText(/You play White against the computer/)).toBeTruthy()
    await user.click(square('e2'))
    await user.click(square('e4'))
    await computerMoved()
    expect(moveList().getAllByRole('listitem')).toHaveLength(1)
    expect(moveList().getAllByRole('listitem')[0]?.textContent).toMatch(/^1\.e4\S+$/)
  })

  it('offers the Auto difficulty to a new player, starting at Nice', async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, '', '/play/?new=computer')
    renderPage()
    const dialog = screen.getByRole('dialog', { name: 'New game' })
    const auto = within(dialog).getByRole('radio', { name: /^Auto/ })
    expect(auto).toHaveProperty('checked', true)
    expect(auto.closest('label')?.textContent).toMatch(/Nice for now/)
    await user.click(within(dialog).getByRole('button', { name: 'Start game' }))
    expect(status().getByText(/against the computer/).textContent).toMatch(/: Nice \(Auto\)$/)
  })

  it('counts a won game for Auto when the next game starts, and steps up after two wins in a row', async () => {
    const user = userEvent.setup()
    window.localStorage.setItem('mean-chess:skill:v1', JSON.stringify({ level: 'nice', streak: 1 }))
    resumeAgainstComputer(ROYAL_WIN, AUTO_NICE, ['h1f3'])
    renderPage()
    const result = await screen.findByRole('dialog', { name: 'You win' }, { timeout: 3_000 })
    expect(within(result).getByText('Auto difficulty: your next game is Mean.')).toBeTruthy()
    expect(savedSkill()).toEqual({ level: 'nice', streak: 1 }) // not yet: Undo could still take it back
    await user.click(within(result).getByRole('button', { name: 'Play again' }))
    expect(status().getByText(/against the computer/).textContent).toMatch(/: Mean \(Auto\)$/)
    expect(savedSkill()).toEqual({ level: 'mean', streak: 0 })
  })

  it('does not count a result that Undo took back, or a game abandoned for a new one', async () => {
    const user = userEvent.setup()
    window.localStorage.setItem('mean-chess:skill:v1', JSON.stringify({ level: 'nice', streak: 1 }))
    resumeAgainstComputer(ROYAL_WIN, AUTO_NICE, ['h1f3'])
    renderPage()
    const result = await screen.findByRole('dialog', { name: 'You win' }, { timeout: 3_000 })
    await user.click(within(result).getByRole('button', { name: 'Undo last move' }))
    await user.click(button('New game'))
    const dialog = screen.getByRole('dialog', { name: 'New game' })
    expect(within(dialog).getByRole('radio', { name: /^Auto/ }).closest('label')?.textContent).toMatch(/Nice for now/)
    await user.click(within(dialog).getByRole('button', { name: 'Start game' }))
    expect(status().getByText(/against the computer/).textContent).toMatch(/: Nice \(Auto\)$/)
    expect(savedSkill()).toEqual({ level: 'nice', streak: 1 })
  })

  it('opens as White when the player takes Black, with the board turned around', async () => {
    const user = userEvent.setup()
    const { container } = renderPage()
    await user.click(button('New game'))
    const dialog = screen.getByRole('dialog', { name: 'New game' })
    await user.click(within(dialog).getByRole('radio', { name: /The computer/ }))
    await user.click(within(dialog).getByRole('radio', { name: 'Black' }))
    await user.click(within(dialog).getByRole('button', { name: 'Start game' }))
    await computerMoved()
    expect(container.querySelector('.board__squares button')?.getAttribute('data-square')).toBe('h1')
    expect(status().getByText(/You play Black/)).toBeTruthy()
  })

  it('takes back the computer’s reply together with the player’s move', async () => {
    const user = userEvent.setup()
    resumeAgainstComputer('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', {
      kind: 'computer',
      level: 'mean',
      human: 'white',
    })
    renderPage()
    expect(button('Undo')).toHaveProperty('disabled', true)
    await user.click(square('d2'))
    await user.click(square('d4'))
    await computerMoved()
    await user.click(button('Undo'))
    expect(moveList().getByText('No moves yet.')).toBeTruthy()
    expect(status().getByText('Your move')).toBeTruthy()
    expect(button('Undo')).toHaveProperty('disabled', true)
  })

  it('captures the player’s king the moment it walks into the Kill Zone', async () => {
    const user = userEvent.setup()
    resumeAgainstComputer('7k/8/8/4K3/8/8/8/8 w - - 0 1', { kind: 'computer', level: 'mean', human: 'white' })
    renderPage()
    await user.click(square('e5'))
    expect(square('f6').getAttribute('aria-label')).toBe('f6, empty, move here') // no warning (D-39)
    await user.click(square('f6'))
    const dialog = await screen.findByRole('dialog', { name: 'The computer wins' }, { timeout: 9_000 })
    expect(within(dialog).getByText(/Royal Capture/)).toBeTruthy()
    expect(moveList().getByText('K×K')).toBeTruthy()
  })

  it('accepts a draw with only the kings left', async () => {
    const user = userEvent.setup()
    resumeAgainstComputer('7k/8/8/4K3/8/8/8/8 w - - 0 1', { kind: 'computer', level: 'ruthless', human: 'white' })
    renderPage()
    await user.click(button('Draw'))
    await user.click(within(screen.getByRole('dialog', { name: 'Offer a draw?' })).getByRole('button', { name: 'Offer a draw' }))
    const dialog = await screen.findByRole('dialog', { name: 'Draw' }, { timeout: 5_000 })
    expect(document.querySelectorAll('.end-badge--draw')).toHaveLength(2)
    expect(within(dialog).getByText('You and the computer agreed to a draw.')).toBeTruthy()
  })

  it('declines a draw when it is winning', async () => {
    const user = userEvent.setup()
    resumeAgainstComputer('4k3/8/8/8/8/8/3q4/7K w - - 0 1', { kind: 'computer', level: 'ruthless', human: 'white' })
    renderPage()
    await user.click(button('Draw'))
    await user.click(within(screen.getByRole('dialog', { name: 'Offer a draw?' })).getByRole('button', { name: 'Offer a draw' }))
    expect(await status().findByText('The computer declines your draw offer.')).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('lets the player resign', async () => {
    const user = userEvent.setup()
    resumeAgainstComputer('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', {
      kind: 'computer',
      level: 'nice',
      human: 'white',
    })
    renderPage()
    await user.click(button('Resign'))
    await user.click(within(screen.getByRole('dialog', { name: 'Resign this game?' })).getByRole('button', { name: 'Resign' }))
    const dialog = await screen.findByRole('dialog', { name: 'The computer wins' }, { timeout: 4_000 })
    expect(within(dialog).getByText('You resigned.')).toBeTruthy()
  })

  it('resumes a game against the computer after a reload', async () => {
    const user = userEvent.setup()
    resumeAgainstComputer('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', {
      kind: 'computer',
      level: 'nice',
      human: 'white',
    })
    const first = renderPage()
    await user.click(square('e2'))
    await user.click(square('e4'))
    await computerMoved()
    first.unmount()
    renderPage()
    expect(status().getByText(/You play White against the computer/)).toBeTruthy()
    expect(moveList().getAllByRole('listitem')[0]?.textContent).toMatch(/^1\.e4\S+$/)
  })

  it('switches to a game between friends when a scenario is opened', async () => {
    resumeAgainstComputer('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', {
      kind: 'computer',
      level: 'nice',
      human: 'white',
    })
    // The Royal Capture scenario, with Black to move.
    window.history.replaceState(null, '', '/play/?scenario=royal-capture')
    renderPage()
    await waitFor(() => {
      expect(status().queryByText(/against the computer/)).toBeNull()
    })
    expect(status().getByText('Black to move')).toBeTruthy()
  })

  it('suggests a friend when the link asks for one', () => {
    window.history.replaceState(null, '', '/play/?new=friend')
    renderPage()
    const dialog = screen.getByRole('dialog', { name: 'New game' })
    expect(within(dialog).getByRole('radio', { name: /A friend/ })).toHaveProperty('checked', true)
  })
})
