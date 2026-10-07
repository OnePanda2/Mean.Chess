import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WelcomeApp } from '../../src/app/WelcomeApp.tsx'
import { exportGame, newGame, play } from '../../src/engine/index.ts'

const choices = () => within(screen.getByRole('navigation', { name: 'Get started' }))
const card = (name: RegExp) => choices().getByRole('link', { name })

describe('the welcome page', () => {
  it('offers the tutorial and a game', () => {
    render(<WelcomeApp />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Mean Chess')
    expect(card(/^Start here.*Tutorial/).getAttribute('href')).toBe('/tutorial/')
    expect(card(/Learn how to play/).textContent).toContain('8 short lessons')
    expect(card(/^Play/).getAttribute('href')).toBe('/play/?new=choose')
    expect(screen.getByRole('link', { name: 'Read the full rules →' }).getAttribute('href')).toBe('/rules/')
  })

  it('offers to continue a game in progress', () => {
    window.localStorage.setItem('mean-chess:game:v1', exportGame(play(newGame(), 'e2e4')))
    render(<WelcomeApp />)
    expect(card(/^Play/).getAttribute('href')).toBe('/play/')
    expect(card(/^Play/).textContent).toContain('Continue your game')
  })

  it('shows where the player is in the tutorial', () => {
    window.localStorage.setItem('mean-chess:tutorial:v1', JSON.stringify({ lesson: 3, finished: false }))
    const { unmount } = render(<WelcomeApp />)
    expect(card(/Tutorial/).textContent).toContain('Continue at lesson 4 of 8')
    unmount()
    window.localStorage.setItem('mean-chess:tutorial:v1', JSON.stringify({ lesson: 0, finished: true }))
    render(<WelcomeApp />)
    expect(card(/Tutorial/).textContent).toContain('Done.')
    expect(card(/Tutorial/).textContent).not.toContain('Start here')
  })
})
