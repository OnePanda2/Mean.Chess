import { describe, expect, it } from 'vitest'
import { RULES_VERSION } from '../../src/engine/index.ts'

describe('engine package', () => {
  it('reports the rules version it implements', () => {
    expect(RULES_VERSION).toBe('0.1')
  })
})
