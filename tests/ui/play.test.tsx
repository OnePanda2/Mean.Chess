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
    // The step into the Kill Zone looks like any other move (D-39).
    expect(square('f3').getAttribute('aria-label')).toBe('f3, empty, move here')
    expect(document.querySelectorAll('.board__hints .hint').length).toBe(
      document.querySelectorAll('.board__hints .hint--dot').length,
    )
    await user.click(square('f3'))
    // Nothing announces the capture now waiting for White: the player has to spot it (D-46).
    expect(status().queryByText(/available/)).toBeNull()
    expect(document.querySelectorAll('.status-card .banner')).toHaveLength(0)
    await user.click(square('h1'))
    // Selecting the king shows the Royal Capture like any ordinary capture: no crown, no "Win".
    expect(square('f3').getAttribute('aria-label')).toBe('f3, black king, capture')
    expect(document.querySelectorAll('.board__hints .hint--ring')).toHaveLength(1)
    expect(document.querySelectorAll('.board__hints .hint--win')).toHaveLength(0)
    await user.click(square('f3'))
    // The capture plays out first: no result box yet, and the badges wait their turn (D-52).
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.querySelectorAll('.status-card .banner--result')).toHaveLength(0)
    expect(document.querySelectorAll('.end-badge--crown')).toHaveLength(1)
    expect(document.querySelectorAll('.end-badge--skull')).toHaveLength(1)
    // The gold glow sits on the winner's square; the glow itself carries no position, so its
    // pulsing can't knock it off the square.
    const glowCell = document.querySelector<HTMLElement>('.board__glow-cell')
    const crownCell = document.querySelector('.end-badge--crown')?.parentElement
    expect(glowCell?.style.transform).toBe(crownCell?.style.transform)
    expect(glowCell?.querySelector<HTMLElement>('.board__glow')?.style.transform).toBe('')
    const dialog = await screen.findByRole('dialog', { name: 'White wins' }, { timeout: 6_000 })
    expect(within(dialog).getByText(/Royal Capture/)).toBeTruthy()
    expect(moveList().getByText('K×K')).toBeTruthy()
    expect(document.querySelectorAll('.status-card .banner--result')).toHaveLength(1)
  })

  it('slices the sacrificed piece before the king strikes in a Royal Slaughter (D-52)', async () => {
    window.history.replaceState(null, '', '/?scenario=slaughter-pawn')
    const user = userEvent.setup()
    const { container } = render(<PlayApp />)
    await user.click(square('e1'))
    await user.click(square('e3'))
    const sliced = container.querySelector('.board__ghost--sliced')
    expect(sliced?.querySelectorAll('.slice__half')).toHaveLength(2)
    expect(sliced?.querySelectorAll('.slice__stream').length).toBeGreaterThan(0)
    expect(container.querySelector('.board__piece--after-slice')).not.toBeNull()
    expect(container.querySelector('.board__ghost--royal.board__ghost--after-slice')).not.toBeNull()
    expect(container.querySelector('.board__flash--after-slice')).not.toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(moveList().getByText('K×P×K')).toBeTruthy()
  })

  it('never reveals the Kill Zone: no threat alert, no "Doomed", no overlay button (D-39)', () => {
    // White's king threatens a Royal Slaughter through its e2 pawn, with Black to move.
    resumeFrom('8/8/8/8/8/4k3/4P3/4K3 b - - 0 1')
    const { container, unmount } = render(<PlayApp />)
    expect(status().queryByText(/Kill Zone/)).toBeNull()
    expect(square('e3').getAttribute('aria-label')).toBe('e3, black king')
    expect(container.querySelectorAll('.board__hints .hint')).toHaveLength(0)
    expect(screen.queryByRole('button', { name: 'Kill zones' })).toBeNull()
    unmount()
    // In check with nothing to eat, and the only escape (h2) walks into the Kill Zone.
    resumeFrom('6r1/8/8/8/4bk2/8/8/7K w - - 0 1')
    render(<PlayApp />)
    expect(status().queryByText('Doomed')).toBeNull()
    expect(status().getByText('Check')).toBeTruthy()
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
    expect(document.querySelectorAll('.end-badge--flag')).toHaveLength(1)
    expect(document.querySelectorAll('.end-badge--crown')).toHaveLength(1)
    expect(await screen.findByRole('dialog', { name: 'Black wins' }, { timeout: 4_000 })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'View the board' }))
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(status().getByText('White to move')).toBeTruthy()
  })
})
