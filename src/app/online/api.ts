/**
 * The game server's HTTP API (docs/ONLINE-PROTOCOL.md §4), and where seat tokens are kept in this browser
 * (docs/ONLINE-SECURITY.md §2: `mean-chess:online:v1:<gameId>`, deleted after 30 days, never in a URL).
 */
import {
  FINISHED_RETENTION_MS,
  PROTOCOL_VERSION,
  RULES_VERSION,
  generateJoinNonce,
  type ColorChoice,
  type HttpErrorCode,
  type Result,
  type Seat,
} from '../../online/index.ts'

/** The server's base URL, set at build time. Empty when online play isn't configured. */
export const ONLINE_URL: string = (import.meta.env.VITE_ONLINE_URL as string | undefined) ?? ''

export const onlineAvailable = (): boolean => ONLINE_URL !== ''

export const socketUrl = (gameId: string): string => `${ONLINE_URL.replace(/^http/, 'ws')}/v1/games/${gameId}/ws`

const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n))

export type ApiResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: HttpErrorCode | 'network'; readonly reopensAt?: number }

async function call<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  let response: Response
  try {
    response = await fetch(`${ONLINE_URL}${path}`, init)
  } catch {
    return { ok: false, error: 'network' }
  }
  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    // An empty or broken body: judged by the status alone.
  }
  if (response.ok) return { ok: true, value: body as T }
  const data = (body ?? {}) as { error?: HttpErrorCode; reopensAt?: number }
  return { ok: false, error: data.error ?? 'internal', ...(data.reopensAt ? { reopensAt: data.reopensAt } : {}) }
}

const postJson = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export interface SeatGrant {
  readonly gameId: string
  readonly you: Seat
  readonly token: string
}

export function createGame(color: ColorChoice): Promise<ApiResult<SeatGrant>> {
  return call('/v1/games', postJson({ protocol: PROTOCOL_VERSION, rules: RULES_VERSION, color }))
}

/** Joins with a fresh nonce kept for this tab, so a retry after a lost answer gets the same seat. */
export function joinGame(gameId: string): Promise<ApiResult<SeatGrant>> {
  const key = `mean-chess:online:join:${gameId}`
  let nonce: string | null = null
  try {
    nonce = sessionStorage.getItem(key)
  } catch {
    // Storage blocked: a new nonce each attempt still works.
  }
  if (!nonce) {
    nonce = generateJoinNonce(randomBytes)
    try {
      sessionStorage.setItem(key, nonce)
    } catch {
      // As above.
    }
  }
  return call(`/v1/games/${gameId}/join`, postJson({ protocol: PROTOCOL_VERSION, rules: RULES_VERSION, joinNonce: nonce }))
}

export type GameInfo =
  | { readonly status: 'waiting'; readonly creatorColor: Seat }
  | { readonly status: 'active' }
  | { readonly status: 'finished'; readonly game: { readonly start: string; readonly moves: readonly string[] }; readonly result: Result | null }

export function gameInfo(gameId: string): Promise<ApiResult<GameInfo>> {
  return call(`/v1/games/${gameId}`)
}

// ---------------------------------------------------------------------------------------------
// Seat tokens

const TOKEN_PREFIX = 'mean-chess:online:v1:'

export interface StoredSeat {
  readonly token: string
  readonly you: Seat
  readonly savedAt: number
}

export function saveSeat(grant: SeatGrant, now = Date.now()): void {
  try {
    localStorage.setItem(TOKEN_PREFIX + grant.gameId, JSON.stringify({ token: grant.token, you: grant.you, savedAt: now }))
  } catch {
    // Without storage the game still works in this tab; a reload can't resume it.
  }
}

export function loadSeat(gameId: string): StoredSeat | null {
  try {
    const raw = localStorage.getItem(TOKEN_PREFIX + gameId)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<StoredSeat>
    if (typeof value.token !== 'string' || (value.you !== 'white' && value.you !== 'black') || typeof value.savedAt !== 'number') return null
    return { token: value.token, you: value.you, savedAt: value.savedAt }
  } catch {
    return null
  }
}

/** Deletes seat tokens older than the server keeps games (30 days). */
export function pruneSeats(now = Date.now()): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (!key?.startsWith(TOKEN_PREFIX)) continue
      const seat = loadSeat(key.slice(TOKEN_PREFIX.length))
      if (!seat || now - seat.savedAt > FINISHED_RETENTION_MS) localStorage.removeItem(key)
    }
  } catch {
    // Nothing to prune without storage.
  }
}
