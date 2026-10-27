/**
 * The online protocol (docs/ONLINE-PROTOCOL.md): the contract between the browser and the game
 * server, shared by both. Everything that crosses the wire is parsed here, strictly: the server
 * parses client messages (§6) and HTTP bodies (§4); the client parses server events (§7). Parsers
 * never throw: they return a result, and unknown fields are dropped.
 */
import { isJoinNonce, isMid, isToken } from './ids.ts'
import { MAX_MESSAGE_BYTES, MAX_PLY } from './limits.ts'

export type Seat = 'white' | 'black'
export type ColorChoice = Seat | 'random'
export type GameStatus = 'waiting' | 'active' | 'finished'

export type EndReason =
  | 'royal-capture'
  | 'royal-slaughter'
  | 'checkmate'
  | 'stalemate'
  | 'threefold'
  | 'fifty-move'
  | 'resignation'
  | 'agreement'
  | 'claim-win'
  | 'claim-draw'
  | 'aborted'
  | 'abandoned'
  | 'move-limit'

export interface Result {
  readonly winner: Seat | null
  readonly reason: EndReason
}

export type RejectCode =
  | 'not-your-turn'
  | 'stale'
  | 'illegal-move'
  | 'game-over'
  | 'not-allowed'
  | 'already-offered'
  | 'no-offer'
  | 'offer-limit'
  | 'opponent-present'
  | 'opponent-offline'
  | 'bad-request'
  | 'unknown-type'
  | 'online-full'

export type ErrorCode =
  | 'unsupported-protocol'
  | 'rules-mismatch'
  | 'not-authenticated'
  | 'not-found'
  | 'game-deleted'
  | 'internal'

/** HTTP error codes (§4). */
export type HttpErrorCode =
  | 'bad-request'
  | 'origin-not-allowed'
  | 'unsupported-protocol'
  | 'rules-mismatch'
  | 'rate-limited'
  | 'online-full'
  | 'unavailable'
  | 'not-found'
  | 'game-full'
  | 'game-over'
  | 'internal'

export type AnalyticsEvent =
  | 'tutorial-started'
  | 'tutorial-completed'
  | 'computer-game-started'
  | 'friend-game-started'
  | 'online-game-started'

// ---------------------------------------------------------------------------------------------
// Client → server (§6)

export type ClientMessage =
  | { readonly t: 'hello'; readonly protocol: number; readonly rules: string; readonly token: string }
  | { readonly t: 'move'; readonly ply: number; readonly uci: string; readonly mid: string }
  | { readonly t: 'draw-offer' }
  | { readonly t: 'draw-answer'; readonly accept: boolean }
  | { readonly t: 'resign' }
  | { readonly t: 'abort' }
  | { readonly t: 'claim'; readonly outcome: 'win' | 'draw' }
  | { readonly t: 'rematch-offer' }
  | { readonly t: 'rematch-answer'; readonly accept: boolean }
  | { readonly t: 'sync' }
  | { readonly t: 'stats'; readonly rtt50: number; readonly rtt95: number; readonly reconnects: number }

export type ClientMessageType = ClientMessage['t']

export type ParsedClientMessage =
  | { readonly ok: true; readonly message: ClientMessage }
  | { readonly ok: true; readonly ping: true }
  /** `of` names the message type when it was readable, for the `rejected` reply. */
  | { readonly ok: false; readonly code: 'bad-request' | 'unknown-type' | 'too-large'; readonly of?: string }

// ---------------------------------------------------------------------------------------------
// Server → client (§7)

export interface Presence {
  readonly connected: Readonly<Record<Seat, boolean>>
  readonly absentSince: Readonly<Record<Seat, number | null>>
}

export interface NextGame {
  readonly gameId: string
  readonly you: Seat
}

export interface StateEvent {
  readonly t: 'state'
  readonly rev: number
  readonly protocol: number
  readonly rules: string
  readonly gameId: string
  readonly you: Seat
  readonly status: GameStatus
  readonly start: string
  readonly moves: readonly string[]
  readonly drawOffer: Seat | null
  readonly rematch: { readonly offeredBy: Seat | null; readonly next: NextGame | null }
  readonly presence: Presence
  readonly claimableAt: number | null
  readonly result: Result | null
  readonly serverTime: number
}

export type ServerEvent =
  | StateEvent
  | {
      readonly t: 'moved'
      readonly rev: number
      readonly ply: number
      readonly uci: string
      readonly by: Seat
      readonly mid: string
      readonly fen: string
      readonly result: Result | null
    }
  | { readonly t: 'rejected'; readonly rev: number; readonly of: string; readonly code: RejectCode; readonly mid?: string }
  | ({ readonly t: 'presence'; readonly rev: number; readonly serverTime: number } & Presence)
  | { readonly t: 'draw'; readonly rev: number; readonly offeredBy: Seat | null; readonly declinedBy: Seat | null }
  | { readonly t: 'ended'; readonly rev: number; readonly result: Result }
  | {
      readonly t: 'rematch'
      readonly rev: number
      readonly offeredBy: Seat | null
      readonly declinedBy: Seat | null
      readonly next: NextGame | null
    }
  | { readonly t: 'error'; readonly code: ErrorCode; readonly errorId?: string }

export type ParsedServerEvent =
  | { readonly ok: true; readonly event: ServerEvent }
  /** A well-formed event of a type this build doesn't know: ignore it (forward compatibility). */
  | { readonly ok: true; readonly event: null }
  | { readonly ok: false }

// ---------------------------------------------------------------------------------------------
// HTTP bodies (§4)

export interface CreateRequest {
  readonly protocol: number
  readonly rules: string
  readonly color: ColorChoice
}

export interface JoinRequest {
  readonly protocol: number
  readonly rules: string
  readonly joinNonce: string
}

export interface SeatResponse {
  readonly gameId: string
  readonly you: Seat
  readonly token: string
}

// ---------------------------------------------------------------------------------------------
// Value checks

const SEATS: readonly string[] = ['white', 'black']
const END_REASONS: readonly string[] = [
  'royal-capture', 'royal-slaughter', 'checkmate', 'stalemate', 'threefold', 'fifty-move', 'resignation',
  'agreement', 'claim-win', 'claim-draw', 'aborted', 'abandoned', 'move-limit',
]
const REJECT_CODES: readonly string[] = [
  'not-your-turn', 'stale', 'illegal-move', 'game-over', 'not-allowed', 'already-offered', 'no-offer',
  'offer-limit', 'opponent-present', 'opponent-offline', 'bad-request', 'unknown-type', 'online-full',
]
const ERROR_CODES: readonly string[] = [
  'unsupported-protocol', 'rules-mismatch', 'not-authenticated', 'not-found', 'game-deleted', 'internal',
]
const STATUSES: readonly string[] = ['waiting', 'active', 'finished']
const ANALYTICS_EVENTS: readonly string[] = [
  'tutorial-started', 'tutorial-completed', 'computer-game-started', 'friend-game-started', 'online-game-started',
]
const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/
/** A cap on the small numbers clients report in `stats`. */
const MAX_STAT = 600_000

type Fields = Readonly<Record<string, unknown>>

const isObject = (value: unknown): value is Fields => typeof value === 'object' && value !== null && !Array.isArray(value)
const isInt = (value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
export const isSeat = (value: unknown): value is Seat => typeof value === 'string' && SEATS.includes(value)
const isSeatOrNull = (value: unknown): value is Seat | null => value === null || isSeat(value)
export const isUci = (value: unknown): value is string => typeof value === 'string' && UCI.test(value)
const isString = (value: unknown, max = 200): value is string => typeof value === 'string' && value.length <= max
const isRules = (value: unknown): value is string => typeof value === 'string' && /^\d+\.\d+$/.test(value)

function isResult(value: unknown): value is Result {
  return isObject(value) && isSeatOrNull(value.winner) && typeof value.reason === 'string' && END_REASONS.includes(value.reason)
}

function isResultOrNull(value: unknown): value is Result | null {
  return value === null || isResult(value)
}

function isSeatRecord<T>(value: unknown, check: (v: unknown) => v is T): value is Record<Seat, T> {
  return isObject(value) && check(value.white) && check(value.black)
}

const isBool = (value: unknown): value is boolean => typeof value === 'boolean'
const isTimeOrNull = (value: unknown): value is number | null => value === null || isInt(value)

function isPresence(value: Fields): boolean {
  return isSeatRecord(value.connected, isBool) && isSeatRecord(value.absentSince, isTimeOrNull)
}

function isNextOrNull(value: unknown): value is NextGame | null {
  return value === null || (isObject(value) && isString(value.gameId, 20) && isSeat(value.you))
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length
}

/** JSON.parse that never throws, for text already checked against the size limit. */
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

// ---------------------------------------------------------------------------------------------
// Parsers

/**
 * Parses one WebSocket text frame from a client (§5, §6). The literal text `ping` is the heartbeat
 * (normally answered by the runtime's auto-response before it gets here).
 */
export function parseClientMessage(text: string): ParsedClientMessage {
  if (byteLength(text) > MAX_MESSAGE_BYTES) return { ok: false, code: 'too-large' }
  if (text === 'ping') return { ok: true, ping: true }
  const data = parseJson(text)
  if (!isObject(data) || typeof data.t !== 'string') return { ok: false, code: 'bad-request' }
  const t = data.t
  const bad = { ok: false, code: 'bad-request', of: t } as const
  switch (t) {
    case 'hello':
      return isInt(data.protocol, 0, 1_000) && isRules(data.rules) && isToken(data.token)
        ? { ok: true, message: { t, protocol: data.protocol, rules: data.rules, token: data.token } }
        : bad
    case 'move':
      return isInt(data.ply, 0, MAX_PLY) && isUci(data.uci) && isMid(data.mid)
        ? { ok: true, message: { t, ply: data.ply, uci: data.uci, mid: data.mid } }
        : bad
    case 'draw-answer':
    case 'rematch-answer':
      return isBool(data.accept) ? { ok: true, message: { t, accept: data.accept } } : bad
    case 'claim':
      return data.outcome === 'win' || data.outcome === 'draw' ? { ok: true, message: { t, outcome: data.outcome } } : bad
    case 'stats':
      return isInt(data.rtt50, 0, MAX_STAT) && isInt(data.rtt95, 0, MAX_STAT) && isInt(data.reconnects, 0, 10_000)
        ? { ok: true, message: { t, rtt50: data.rtt50, rtt95: data.rtt95, reconnects: data.reconnects } }
        : bad
    case 'draw-offer':
    case 'resign':
    case 'abort':
    case 'rematch-offer':
    case 'sync':
      return { ok: true, message: { t } }
    default:
      return { ok: false, code: 'unknown-type', of: isString(t, 32) ? t : undefined }
  }
}

/** Parses one event from the server (§7). Unknown event types are ignored, not errors. */
export function parseServerEvent(text: string): ParsedServerEvent {
  const data = parseJson(text)
  if (!isObject(data) || typeof data.t !== 'string') return { ok: false }
  const fail = { ok: false } as const
  const rev = isInt(data.rev)
  switch (data.t) {
    case 'state': {
      const rematch = data.rematch
      const presence = data.presence
      const ok =
        rev &&
        isInt(data.protocol) &&
        isRules(data.rules) &&
        isString(data.gameId, 20) &&
        isSeat(data.you) &&
        typeof data.status === 'string' &&
        STATUSES.includes(data.status) &&
        isString(data.start, 120) &&
        Array.isArray(data.moves) &&
        data.moves.length <= MAX_PLY &&
        data.moves.every(isUci) &&
        isSeatOrNull(data.drawOffer) &&
        isObject(rematch) &&
        isSeatOrNull(rematch.offeredBy) &&
        isNextOrNull(rematch.next) &&
        isObject(presence) &&
        isPresence(presence) &&
        isTimeOrNull(data.claimableAt) &&
        isResultOrNull(data.result) &&
        isInt(data.serverTime)
      return ok ? { ok: true, event: data as unknown as StateEvent } : fail
    }
    case 'moved':
      return rev &&
        isInt(data.ply, 1, MAX_PLY) &&
        isUci(data.uci) &&
        isSeat(data.by) &&
        isMid(data.mid) &&
        isString(data.fen, 120) &&
        isResultOrNull(data.result)
        ? { ok: true, event: data as unknown as ServerEvent }
        : fail
    case 'rejected':
      return rev &&
        isString(data.of, 32) &&
        typeof data.code === 'string' &&
        REJECT_CODES.includes(data.code) &&
        (data.mid === undefined || isMid(data.mid))
        ? { ok: true, event: data as unknown as ServerEvent }
        : fail
    case 'presence':
      return rev && isPresence(data) && isInt(data.serverTime) ? { ok: true, event: data as unknown as ServerEvent } : fail
    case 'draw':
      return rev && isSeatOrNull(data.offeredBy) && isSeatOrNull(data.declinedBy)
        ? { ok: true, event: data as unknown as ServerEvent }
        : fail
    case 'ended':
      return rev && isResult(data.result) ? { ok: true, event: data as unknown as ServerEvent } : fail
    case 'rematch':
      return rev && isSeatOrNull(data.offeredBy) && isSeatOrNull(data.declinedBy) && isNextOrNull(data.next)
        ? { ok: true, event: data as unknown as ServerEvent }
        : fail
    case 'error':
      return typeof data.code === 'string' &&
        ERROR_CODES.includes(data.code) &&
        (data.errorId === undefined || isString(data.errorId, 16))
        ? { ok: true, event: data as unknown as ServerEvent }
        : fail
    default:
      return { ok: true, event: null }
  }
}

type BodyResult<T> = { readonly ok: true; readonly body: T } | { readonly ok: false }

function parseBody(text: string): Fields | null {
  if (byteLength(text) > MAX_MESSAGE_BYTES) return null
  const data = parseJson(text)
  return isObject(data) ? data : null
}

/** `POST /v1/games` (§4). The colour defaults to random. */
export function parseCreateRequest(text: string): BodyResult<CreateRequest> {
  const data = parseBody(text)
  if (!data || !isInt(data.protocol, 0, 1_000) || !isRules(data.rules)) return { ok: false }
  const color = data.color ?? 'random'
  if (color !== 'white' && color !== 'black' && color !== 'random') return { ok: false }
  return { ok: true, body: { protocol: data.protocol, rules: data.rules, color } }
}

/** `POST /v1/games/:id/join` (§4). */
export function parseJoinRequest(text: string): BodyResult<JoinRequest> {
  const data = parseBody(text)
  if (!data || !isInt(data.protocol, 0, 1_000) || !isRules(data.rules) || !isJoinNonce(data.joinNonce)) return { ok: false }
  return { ok: true, body: { protocol: data.protocol, rules: data.rules, joinNonce: data.joinNonce } }
}

/** `POST /v1/events` (§4): a batch of anonymous counters, at most 20 per request. */
export function parseEventsRequest(text: string): BodyResult<readonly AnalyticsEvent[]> {
  const data = parseBody(text)
  if (!data || !Array.isArray(data.e) || data.e.length === 0 || data.e.length > 20) return { ok: false }
  const events: AnalyticsEvent[] = []
  for (const event of data.e as unknown[]) {
    if (typeof event !== 'string' || !ANALYTICS_EVENTS.includes(event)) return { ok: false }
    events.push(event as AnalyticsEvent)
  }
  return { ok: true, body: events }
}

/** Serialises any protocol message. Kept in one place so both sides encode alike. */
export function encode(message: ClientMessage | ServerEvent): string {
  return JSON.stringify(message)
}

export const opponentOf = (seat: Seat): Seat => (seat === 'white' ? 'black' : 'white')
