import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { APPEARANCE_KEY, loadAppearance } from '../../src/app/appearance.ts'
import { PlayApp } from '../../src/app/PlayApp.tsx'
import { THEMES, isThemeId, themeById } from '../../src/app/themes.ts'
import { PIXEL_SPRITES, spriteRuns } from '../../src/components/pieces/pixelSprites.ts'

const square = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name},`) })

describe('themes', () => {
  it('has four themes, each with a known piece style', () => {
    expect(THEMES.map((theme) => theme.id)).toEqual(['mean', 'sugar', 'arcade', 'picnic'])
    expect(isThemeId('sugar')).toBe(true)
    expect(isThemeId('neon')).toBe(false)
    expect(themeById('arcade').pieceStyle).toBe('pixel')
  })

  it('ignores a stored theme it does not know', () => {
    window.localStorage.setItem(APPEARANCE_KEY, JSON.stringify({ theme: 'neon', animations: false }))
    expect(loadAppearance()).toEqual({ theme: 'mean', animations: false })
  })

  it('switches the page theme, swaps in pixel pieces and remembers the choice', async () => {
    const user = userEvent.setup()
    const { container } = render(<PlayApp />)
    expect(document.documentElement.dataset.theme).toBe('mean')
    expect(container.querySelectorAll('.board__piece .piece-art--vector')).toHaveLength(32)

    await user.click(screen.getByRole('button', { name: /Theme/ }))
    const dialog = screen.getByRole('dialog', { name: 'Themes' })
    await user.click(within(dialog).getByRole('radio', { name: /^Arcade/ }))

    expect(document.documentElement.dataset.theme).toBe('arcade')
    expect(container.querySelectorAll('.board__piece .piece-art--pixel')).toHaveLength(32)
    expect(loadAppearance().theme).toBe('arcade')
    expect(within(dialog).getByRole('radio', { name: /^Arcade/ }).getAttribute('aria-checked')).toBe('true')
  })

  it('lets the player switch movement off', async () => {
    const user = userEvent.setup()
    const { container } = render(<PlayApp />)
    await user.click(screen.getByRole('button', { name: /Theme/ }))
    await user.click(screen.getByRole('checkbox', { name: 'Animate moves and captures' }))
    expect(container.querySelector('.board')?.classList.contains('board--still')).toBe(true)
    expect(loadAppearance().animations).toBe(false)
  })
})

describe('move and capture animation', () => {
  it('keeps every piece’s element in place when a piece moves, so its slide is never cut short', async () => {
    const user = userEvent.setup()
    const { container } = render(<PlayApp />)
    const before = [...container.querySelectorAll('.board__piece')]
    // e2-e3 passes f2, g2 and h2 in board order. Moving the pawn's element in the DOM would cancel
    // its slide (and a Royal Slaughter's king would vanish instead of waiting for the slice).
    for (const name of ['e2', 'e3']) await user.click(square(name))
    const after = [...container.querySelectorAll('.board__piece')]
    expect(after.map((element) => before.indexOf(element))).toEqual(before.map((_, index) => index))
  })

  it('leaves a ghost of a captured piece, and brings it back on undo', async () => {
    const user = userEvent.setup()
    const { container } = render(<PlayApp />)
    for (const name of ['e2', 'e4', 'd7', 'd5', 'e4', 'd5']) await user.click(square(name))
    const ghost = container.querySelector('.board__ghost--taken')
    expect(ghost).not.toBeNull()

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(container.querySelector('.board__ghost')).toBeNull()
    expect(container.querySelectorAll('.board__piece--appear')).toHaveLength(1)
  })

  it('marks a Royal Capture with a royal ghost and a board flash', async () => {
    window.history.replaceState(null, '', '/?scenario=royal-capture')
    const user = userEvent.setup()
    const { container } = render(<PlayApp />)
    for (const name of ['e4', 'f3', 'h1', 'f3']) await user.click(square(name))
    expect(container.querySelector('.board__ghost--royal')).not.toBeNull()
    expect(container.querySelector('.board__flash--royal')).not.toBeNull()
  })

  it('swallows a sacrificed piece with a gold flash', async () => {
    window.history.replaceState(null, '', '/?scenario=cannibal-back-rank')
    const user = userEvent.setup()
    const { container } = render(<PlayApp />)
    for (const name of ['g1', 'g2']) await user.click(square(name))
    expect(container.querySelector('.board__ghost--eaten')).not.toBeNull()
    expect(container.querySelector('.board__flash--sacrifice')).not.toBeNull()
  })
})

describe('pixel sprites', () => {
  it('are 16×16 and use only the five cell codes', () => {
    for (const [type, sprite] of Object.entries(PIXEL_SPRITES)) {
      expect(sprite, type).toHaveLength(16)
      for (const row of sprite) expect(row, `${type}: ${row}`).toMatch(/^[.ofha]{16}$/)
    }
  })

  it('merge each row into runs of equal cells', () => {
    expect(spriteRuns(['..oof...........'])).toEqual([
      { x: 2, y: 0, width: 2, cell: 'o' },
      { x: 4, y: 0, width: 1, cell: 'f' },
    ])
  })
})
