import { describe, expect, it } from 'vitest'
import {
  formatGameId,
  generateGameId,
  generateJoinNonce,
  generateMid,
  generateToken,
  hashToken,
  isJoinNonce,
  isMid,
  isToken,
  normalizeGameId,
  toBase64Url,
  type RandomBytes,
} from '../../src/online/index.ts'

/** Deterministic "random" bytes: 0, 1, 2, … */
const counting: RandomBytes = (n) => Uint8Array.from({ length: n }, (_, i) => i)
const real: RandomBytes = (n) => crypto.getRandomValues(new Uint8Array(n))

describe('game ids', () => {
  it('are 10 Crockford base32 characters', () => {
    expect(generateGameId(counting)).toBe('0123456789')
    expect(generateGameId(() => new Uint8Array(10).fill(255))).toBe('ZZZZZZZZZZ')
    for (let i = 0; i < 200; i++) expect(generateGameId(real)).toMatch(/^[0-9A-HJKMNP-TV-Z]{10}$/)
  })

  it('reads ids the way people type them', () => {
    expect(normalizeGameId('7kq2m-x9fta')).toBe('7KQ2MX9FTA')
    expect(normalizeGameId(' 7KQ2M X9FTA ')).toBe('7KQ2MX9FTA')
    expect(normalizeGameId('O0IL1-ABCDE')).toBe('00111ABCDE')
    expect(normalizeGameId('7KQ2MX9FTU')).toBeNull() // U isn't in the alphabet
    expect(normalizeGameId('7KQ2MX9FT')).toBeNull()
    expect(normalizeGameId('7KQ2MX9FTAA')).toBeNull()
    expect(normalizeGameId('7KQ2M!9FTA')).toBeNull()
  })

  it('are shown in two halves', () => {
    expect(formatGameId('7KQ2MX9FTA')).toBe('7KQ2M-X9FTA')
  })
})

describe('tokens, move ids and join nonces', () => {
  it('have the right lengths and alphabets', () => {
    const token = generateToken(real)
    expect(token).toHaveLength(43)
    expect(isToken(token)).toBe(true)
    expect(isMid(generateMid(real))).toBe(true)
    expect(generateMid(real)).toHaveLength(12)
    expect(isJoinNonce(generateJoinNonce(real))).toBe(true)
  })

  it('reject malformed values', () => {
    expect(isToken('short')).toBe(false)
    expect(isToken(42)).toBe(false)
    expect(isToken(`${'a'.repeat(42)}+`)).toBe(false)
    expect(isMid('abc')).toBe(false)
    expect(isMid('a'.repeat(25))).toBe(false)
    expect(isJoinNonce('a'.repeat(15))).toBe(false)
  })

  it('encode base64url without padding', () => {
    expect(toBase64Url(new Uint8Array([]))).toBe('')
    expect(toBase64Url(new Uint8Array([0xfb]))).toBe('-w')
    expect(toBase64Url(new Uint8Array([0xfb, 0xff]))).toBe('-_8')
    expect(toBase64Url(new Uint8Array([0xfb, 0xff, 0xbf]))).toBe('-_-_')
    expect(toBase64Url(new TextEncoder().encode('Mean'))).toBe('TWVhbg')
  })

  it('refuse a random source that returns the wrong number of bytes', () => {
    expect(() => generateToken(() => new Uint8Array(3))).toThrow(/Expected 32/)
  })

  it('hash a token to stable lowercase hex', async () => {
    const hash = await hashToken('a'.repeat(43))
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(await hashToken('a'.repeat(43))).toBe(hash)
    expect(await hashToken('b'.repeat(43))).not.toBe(hash)
  })
})
