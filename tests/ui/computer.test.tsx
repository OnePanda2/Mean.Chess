import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { PlayApp } from '../../src/app/PlayApp.tsx'
import { ComputerContext, inlineClient } from '../../src/app/computer.ts'
import type { Opponent } from '../../src/app/opponent.ts'
import { exportGame, newGame, parseMeanFen } from '../../src/engine/index.ts'

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

/** Saves a game against the computer from `fen` the way the app does, so the page resumes it. */
function resumeAgainstComputer(fen: string, opponent: Opponent): void {
  const parsed = parseMeanFen(fen)
  if (!parsed.ok) throw new Error(parsed.error)
  window.localStorage.setItem('mean-chess:game:v1', exportGame(newGame(parsed.position)))
  window.localStorage.setItem('mean-chess:opponent:v1', JSON.stringify(opponent))
}

/** Waits for the computer's answer, announced for screen readers. */
const computerMoved = () => screen.findByText(/^The computer played .+\. Your move\.$/, {}, { timeout: 5_000 })

describe('playing the computer', () => {
  it('starts from the hero, shows who is playing, and answers a move', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(button('Play the computer'))
    const dialog = screen.getByRole('dialog', { name: 'New game' })
    expect(within(dialog).getByRole('radio', { name: /The computer/ })).toHaveProperty('checked', true)
    await user.click(within(dialog).getByRole('radio', { name: /Nice/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Start game' }))
    expect(status().getByText('Your move')).toBeTruthy()
    expect(status().getByText(/You play White against the computer/)).toBeTruthy()
    await user.click(square('e2'))
    await user.click(square('e4'))
    await computerMoved()
    expect(moveList().getAllByRole('listitem')).toHaveLength(1)
    expect(moveList().getAllByRole('listitem')[0]?.textContent).toMatch(/^1\.e4\S+$/)
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
    const dialog = await screen.findByRole('dialog', { name: 'The computer wins' }, { timeout: 5_000 })
    expect(within(dialog).getByText(/Royal Capture/)).toBeTruthy()
    expect(moveList().getByText('K×K')).toBeTruthy()
  })

  it('accepts a draw with only the kings left', async () => {
    const user = userEvent.setup()
    resumeAgainstComputer('7k/8/8/4K3/8/8/8/8 w - - 0 1', { kind: 'computer', level: 'ruthless', human: 'white' })
    renderPage()
    await user.click(button('Draw'))
    await user.click(within(screen.getByRole('dialog', { name: 'Offer a draw?' })).getByRole('button', { name: 'Offer a draw' }))
    const dialog = await screen.findByRole('dialog', { name: 'Draw' })
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
    const dialog = screen.getByRole('dialog', { name: 'The computer wins' })
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

  it('switches to a game between friends when a scenario is loaded', async () => {
    const user = userEvent.setup()
    resumeAgainstComputer('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', {
      kind: 'computer',
      level: 'nice',
      human: 'white',
    })
    renderPage()
    // The first rule card's scenario is Royal Capture, with Black to move.
    await user.click(screen.getAllByRole('button', { name: 'Try it' })[0] ?? button('Try it'))
    await waitFor(() => {
      expect(status().queryByText(/against the computer/)).toBeNull()
    })
    expect(status().getByText('Black to move')).toBeTruthy()
  })
})
