/**
 * Identifiers for online play (docs/ONLINE-PROTOCOL.md §2): game ids, seat tokens, move ids and join
 * nonces. Randomness is passed in (`RandomBytes`), so this module stays deterministic and testable;
 * callers pass `(n) => crypto.getRandomValues(new Uint8Array(n))`.
 */

/** Returns `n` cryptographically random bytes. */
export type RandomBytes = (n: number) => Uint8Array

/** Crockford base32: digits and letters without I, L, O and U. */
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

export const GAME_ID_LENGTH = 10
export const TOKEN_LENGTH = 43
const TOKEN_BYTES = 32
const MID_BYTES = 9 // 12 characters
const NONCE_BYTES = 12 // 16 characters

function bytes(random: RandomBytes, n: number): Uint8Array {
  const out = random(n)
  if (out.length !== n) throw new Error(`Expected ${n} random bytes, got ${out.length}`)
  return out
}

/** A new game id: 10 Crockford characters, 50 bits (each byte's low 5 bits: 256 is a multiple of 32). */
export function generateGameId(random: RandomBytes): string {
  return Array.from(bytes(random, GAME_ID_LENGTH), (b) => CROCKFORD.charAt(b & 31)).join('')
}

/**
 * Reads a game id as people type or paste it: case-insensitive, spaces and hyphens ignored, O read as
 * 0 and I or L as 1. Returns the canonical id, or null if it can't be one.
 */
export function normalizeGameId(input: string): string | null {
  const id = input
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
  if (id.length !== GAME_ID_LENGTH) return null
  for (const char of id) if (!CROCKFORD.includes(char)) return null
  return id
}

/** Shown to people in two halves: `7KQ2M-X9FTA`. */
export function formatGameId(id: string): string {
  return `${id.slice(0, 5)}-${id.slice(5)}`
}

/** Base64url without padding. */
export function toBase64Url(data: Uint8Array): string {
  let out = ''
  for (let i = 0; i < data.length; i += 3) {
    const a = data[i] ?? 0
    const b = data[i + 1] ?? 0
    const c = data[i + 2] ?? 0
    const triple = (a << 16) | (b << 8) | c
    const chars = i + 2 < data.length ? 4 : i + 1 < data.length ? 3 : 2
    for (let k = 0; k < chars; k++) out += BASE64URL.charAt((triple >> (18 - 6 * k)) & 63)
  }
  return out
}

/** A seat token: 32 random bytes as 43 base64url characters. The server keeps only its hash. */
export function generateToken(random: RandomBytes): string {
  return toBase64Url(bytes(random, TOKEN_BYTES))
}

/** A move id, made fresh by the client for each move attempt (12 characters, 72 bits). */
export function generateMid(random: RandomBytes): string {
  return toBase64Url(bytes(random, MID_BYTES))
}

/** A join nonce, made by the client for each join attempt (16 characters, 96 bits). */
export function generateJoinNonce(random: RandomBytes): string {
  return toBase64Url(bytes(random, NONCE_BYTES))
}

export const isToken = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value)
export const isMid = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{8,24}$/.test(value)
export const isJoinNonce = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{16}$/.test(value)

/** SHA-256 of a seat token, as lowercase hex: what the server stores instead of the token. */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}
