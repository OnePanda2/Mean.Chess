import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PrivacyApp } from '../../src/app/PrivacyApp.tsx'
import { FINISHED_RETENTION_MS, IDLE_ABANDON_MS, WAITING_EXPIRY_MS } from '../../src/online/index.ts'

const DAY = 24 * 60 * 60 * 1_000

describe('the privacy page', () => {
  it('states the retention the server actually uses', () => {
    render(<PrivacyApp />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('What Mean Chess keeps')
    // If a limit changes, this test fails until the page says the new number.
    expect(screen.getByText(`An invite nobody joins is deleted after ${String(WAITING_EXPIRY_MS / 3_600_000)} hours.`)).toBeTruthy()
    expect(screen.getByText(`A finished game is deleted ${String(FINISHED_RETENTION_MS / DAY)} days after it ends.`)).toBeTruthy()
    expect(screen.getByText(new RegExp(`left untouched for ${String(IDLE_ABANDON_MS / DAY)} days`))).toBeTruthy()
    expect(screen.getByRole('link', { name: 'GitHub' }).getAttribute('href')).toBe('https://github.com/OnePanda2/Mean.Chess/issues')
  })

  it('is linked from every page footer', () => {
    render(<PrivacyApp />)
    expect(screen.getByRole('contentinfo').querySelector('a[href="/privacy/"]')?.textContent).toBe('Privacy')
  })
})
