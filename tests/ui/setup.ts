import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'

beforeEach(() => {
  // Every test starts from a fresh page: no saved game, no deep link.
  window.localStorage.clear()
  window.history.replaceState(null, '', '/')
})

// Vitest runs without globals, so Testing Library cannot register its own cleanup.
afterEach(() => {
  cleanup()
})
