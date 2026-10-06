import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PlayApp } from '../../src/app/PlayApp.tsx'
import { RulesApp } from '../../src/app/RulesApp.tsx'

describe('page shells', () => {
  it('play page shows the Mean Chess wordmark', () => {
    render(<PlayApp />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/mean chess/i)
  })

  it('rules page names the rules version', () => {
    render(<RulesApp />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('v0.1')
  })
})
