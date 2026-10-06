import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PlayApp } from '../../src/app/PlayApp.tsx'
import { exportGame, newGame, parseMeanFen } from '../../src/engine/index.ts'

const square = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name},`) })
const moveList = () => within(screen.getByRole('region', { name: 'Moves' }))
const status = () => within(screen.getByRole('region', { name: 'Game status' }))

/** Saves a game starting from `fen` the way the app does, so the page resumes it. */
function resumeFrom(fen: string): void {
  const parsed = parseMeanFen(fen)
  if (!parsed.ok) throw new Error(parsed.error)
  window.localStorage.setItem('mean-chess:game:v1', exportGame(newGame(parsed.position)))
}

describe('the play page', () => {
  it('starts a standard game with White to move', () => {
    const { container } = render(<PlayApp />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/mean chess/i)
    expect(container.querySelectorAll('.board__piece')).toHaveLength(32)
    expect(status().getByText('White to move')).toBeTruthy()
  })

  it('selects a piece, shows its moves and plays one', async () => {
    const user = userEvent.setup()
    render(<PlayApp />)
    await user.click(square('e2'))
    expect(square('e4').getAttribute('aria-label')).toBe('e4, empty, move here')
    await user.click(square('e4'))
    expect(moveList().getByText('e4')).toBeTruthy()
    expect(status().getByText('Black to move')).toBeTruthy()
    expect(square('e4').getAttribute('aria-label')).toBe('e4, white pawn')
  })

  it('does not let the side to move pick up an enemy piece, or move illegally', async () => {
    const user = userEvent.setup()
    render(<PlayApp />)
    await user.click(square('e7'))
    expect(screen.queryAllByRole('button', { name: /move here/ })).toHaveLength(0)
    await user.click(square('e2'))
    await user.click(square('e5'))
    expect(moveList().queryByText('e5')).toBeNull()
    expect(status().getByText('White to move')).toBeTruthy()
  })

  it('takes a move back', async () => {
    const user = userEvent.setup()
    render(<PlayApp />)
    await user.click(square('g1'))
    await user.click(square('f3'))
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(moveList().getByText('No moves yet.')).toBeTruthy()
    expect(square('g1').getAttribute('aria-label')).toBe('g1, white knight')
  })

  it('plays the foundational Royal Capture scenario to the end (handoff §43)', async () => {
    window.history.replaceState(null, '', '/?scenario=royal-capture')
    const user = userEvent.setup()
    render(<PlayApp />)
    expect(window.location.search).toBe('') // the deep link is consumed
    await user.click(square('e4'))
    expect(square('f3').getAttribute('aria-label')).toContain('walks into the Royal Kill Zone')
    await user.click(square('f3'))
    expect(status().getByText('Royal Capture available')).toBeTruthy()
    await user.click(square('h1'))
    expect(square('f3').getAttribute('aria-label')).toContain('Royal Capture, wins the game')
    await user.click(square('f3'))
    const dialog = screen.getByRole('dialog', { name: 'White wins' })
    expect(within(dialog).getByText(/Royal Capture/)).toBeTruthy()
    expect(moveList().getByText('K×K')).toBeTruthy()
  })

  it('offers Royal Cannibalism out of a back-rank mate and records it', async () => {
    window.history.replaceState(null, '', '/?scenario=cannibal-back-rank')
    const user = userEvent.setup()
    render(<PlayApp />)
    expect(status().getByText('Desperate')).toBeTruthy()
    expect(square('f2').getAttribute('aria-label')).toContain('can be sacrificed')
    await user.click(square('g1'))
    expect(square('f2').getAttribute('aria-label')).toContain('sacrifice your pawn (Royal Cannibalism)')
    await user.click(square('f2'))
    expect(moveList().getByText('K×f2(own P)')).toBeTruthy()
    expect(status().getByText('Black to move')).toBeTruthy()
  })

  it('asks which piece to promote to, and marks a promoted queen', async () => {
    resumeFrom('4k3/P7/8/8/8/8/8/4K3 w - - 0 1')
    const user = userEvent.setup()
    render(<PlayApp />)
    await user.click(square('a7'))
    await user.click(square('a8'))
    const dialog = screen.getByRole('dialog', { name: 'Promote the pawn' })
    await user.click(within(dialog).getByRole('button', { name: /^Queen/ }))
    expect(square('a8').getAttribute('aria-label')).toBe('a8, white promoted queen')
    expect(moveList().getByText('a8=Q+')).toBeTruthy()
  })

  it('resumes the saved game after a reload', async () => {
    const user = userEvent.setup()
    const first = render(<PlayApp />)
    await user.click(square('d2'))
    await user.click(square('d4'))
    first.unmount()
    render(<PlayApp />)
    expect(moveList().getByText('d4')).toBeTruthy()
  })

  it('still works when browser storage is unavailable', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    render(<PlayApp />)
    expect(status().getByText('White to move')).toBeTruthy()
    spy.mockRestore()
  })

  it('explains why an imported position is rejected', async () => {
    const user = userEvent.setup()
    render(<PlayApp />)
    await user.click(screen.getByRole('button', { name: 'Scenarios' }))
    const lab = screen.getByRole('dialog', { name: 'Scenario Lab' })
    await user.type(within(lab).getByRole('textbox', { name: /standard FEN/ }), '8/8/8/8/8/8/4k3/4K3 w - - 0 1')
    await user.click(within(lab).getByRole('button', { name: 'Load' }))
    expect(within(lab).getByRole('alert').textContent).toContain('adjacent')
  })

  it('confirms before resigning, and undo withdraws it', async () => {
    const user = userEvent.setup()
    render(<PlayApp />)
    await user.click(screen.getByRole('button', { name: 'Resign' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Resign as White?' })).getByRole('button', { name: 'Resign' }))
    expect(screen.getByRole('dialog', { name: 'Black wins' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'View the board' }))
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(status().getByText('White to move')).toBeTruthy()
  })
})
