/**
 * RoomCore: the game room as a pure state machine (docs/ONLINE-ARCHITECTURE.md §9). It takes the room
 * state, a command and the current time, and returns the new state, the events to send, what to store
 * and when the next alarm should fire. No Cloudflare APIs, no clock, no randomness: the adapter
 * (GameRoom) passes `now`, token hashes and new game ids in, and moves bytes between sockets, SQLite
 * and this module. Rules: docs/ONLINE-PROTOCOL.md §3, §6–§8; authorisation: docs/ONLINE-SECURITY.md §2.
 */
import {
  currentPosition,
  RULES_VERSION as RULES,
  parseMeanFen,
  play,
  positionKey,
  startingPosition,
  toMeanFen,
  type GameRecord,
  type Outcome,
  type Position,
} from '../../src/engine/index.ts'
import {
  CLAIM_AFTER_MS,
  FINISHED_RETENTION_MS,
  IDLE_ABANDON_MS,
  MAX_DRAW_OFFERS,
  MAX_PLY,
  MAX_REMATCH_OFFERS,
  OLDEST_SUPPORTED_PROTOCOL,
  PROTOCOL_VERSION,
  WAITING_EXPIRY_MS,
  opponentOf,
  type ClientMessage,
  type EndReason,
  type ErrorCode,
  type GameStatus,
  type RejectCode,
  type Result,
  type Seat,
  type ServerEvent,
  type StateEvent,
} from '../../src/online/index.ts'

export interface MoveRow {
  readonly uci: string
  readonly color: Seat
  readonly mid: string
  readonly at: number
}

type PerSeat<T> = Readonly<Record<Seat, T>>

/** Everything the room knows. Persisted as one `game` row plus the `moves` rows (toRow / fromRow). */
export interface RoomState {
  readonly id: string
  readonly protocol: number
  readonly rules: string
  readonly status: GameStatus
  readonly creatorColor: Seat
  readonly tokenHash: PerSeat<string | null>
  readonly joinNonce: string | null
  readonly startFen: string
  readonly moves: readonly MoveRow[]
  /**
   * The engine's view, rebuilt without replay (A0 spike: zero-replay resume): the current position plus
   * the position keys since the last irreversible move, which is all threefold repetition needs.
   * Null once the game is finished: the final position may lack a king and is never played on.
   */
  readonly engine: GameRecord | null
  readonly currentFen: string
  readonly rev: number
  readonly drawOffer: Seat | null
  readonly drawOffers: PerSeat<number>
  /** The ply at which each seat's last draw offer was declined (the opponent must move after it). */
  readonly drawDeclinedAt: PerSeat<number | null>
  readonly rematchOffer: Seat | null
  readonly rematchOffers: PerSeat<number>
  readonly rematchGameId: string | null
  readonly absentSince: PerSeat<number | null>
  /** Live only (not stored): whether each seat has an authenticated socket. The adapter rebuilds it. */
  readonly connected: PerSeat<boolean>
  readonly statsReceived: PerSeat<boolean>
  readonly result: Result | null
  readonly createdAt: number
  readonly startedAt: number | null
  readonly lastMoveAt: number | null
  readonly updatedAt: number
  readonly finishedAt: number | null
  readonly expiresAt: number
}

/** Who an event goes to. `sender` is the socket whose message is being handled. */
export type Target = 'sender' | Seat | 'all'

export interface Outbound {
  readonly to: Target
  readonly event: ServerEvent
}

export interface Effects {
  readonly events: readonly Outbound[]
  /** Store the game row (and append `newMoves`). */
  readonly save: boolean
  readonly newMoves: readonly MoveRow[]
  /** The room is gone: delete all its storage and close every socket (code 4410). */
  readonly deleteAll: boolean
  /** A rematch was accepted: create this game (adapter: a new room with these seat hashes). */
  readonly spawnRematch: { readonly gameId: string; readonly tokenHash: PerSeat<string> } | null
  /** Accepted `stats` messages, for metrics only. */
  readonly stats: { readonly seat: Seat; readonly rtt50: number; readonly rtt95: number; readonly reconnects: number } | null
  /** When the alarm should next fire (mirrors `expiresAt`); null when the room is deleted. */
  readonly alarmAt: number | null
}

export interface Step {
  readonly state: RoomState
  readonly effects: Effects
}

const noEffects = (state: RoomState): Effects => ({
  events: [],
  save: false,
  newMoves: [],
  deleteAll: false,
  spawnRematch: null,
  stats: null,
  alarmAt: state.expiresAt,
})

function step(state: RoomState, partial: Partial<Effects> = {}): Step {
  return { state, effects: { ...noEffects(state), ...partial } }
}

const both = <T>(value: T): PerSeat<T> => ({ white: value, black: value })
const withSeat = <T>(record: PerSeat<T>, seat: Seat, value: T): PerSeat<T> =>
  seat === 'white' ? { white: value, black: record.black } : { white: record.white, black: value }

const START_FEN = toMeanFen(startingPosition())

// ---------------------------------------------------------------------------------------------
// Creation and restore

function engineFrom(position: Position, keys: readonly string[]): GameRecord {
  return { start: position, moves: [], positions: [position], keys, outcome: null }
}

/** A new waiting room with the creator's seat taken (`POST /v1/games`). */
export function createRoom(input: {
  readonly id: string
  readonly creatorColor: Seat
  readonly creatorTokenHash: string
  readonly now: number
}): Step {
  const start = startingPosition()
  const state: RoomState = {
    id: input.id,
    protocol: PROTOCOL_VERSION,
    rules: RULES,
    status: 'waiting',
    creatorColor: input.creatorColor,
    tokenHash: withSeat(both<string | null>(null), input.creatorColor, input.creatorTokenHash),
    joinNonce: null,
    startFen: START_FEN,
    moves: [],
    engine: engineFrom(start, [positionKey(start)]),
    currentFen: START_FEN,
    rev: 0,
    drawOffer: null,
    drawOffers: both(0),
    drawDeclinedAt: both<number | null>(null),
    rematchOffer: null,
    rematchOffers: both(0),
    rematchGameId: null,
    absentSince: both<number | null>(null),
    connected: both(false),
    statsReceived: both(false),
    result: null,
    createdAt: input.now,
    startedAt: null,
    lastMoveAt: null,
    updatedAt: input.now,
    finishedAt: null,
    expiresAt: input.now + WAITING_EXPIRY_MS,
  }
  return step(state, { save: true })
}

/** A rematch: a new room, already active, with both seats taken (colours already swapped by the caller). */
export function createRematchRoom(input: {
  readonly id: string
  readonly tokenHash: PerSeat<string>
  readonly creatorColor: Seat
  readonly now: number
}): Step {
  const { state } = createRoom({
    id: input.id,
    creatorColor: input.creatorColor,
    creatorTokenHash: input.tokenHash[input.creatorColor],
    now: input.now,
  })
  return step(
    { ...state, status: 'active', tokenHash: input.tokenHash, startedAt: input.now, expiresAt: input.now + IDLE_ABANDON_MS },
    { save: true },
  )
}


// ---------------------------------------------------------------------------------------------
// Joining and authentication (HTTP and `hello`)

export type JoinOutcome =
  | { readonly ok: true; readonly seat: Seat; readonly step: Step }
  | { readonly ok: false; readonly code: 'game-full' | 'game-over' }

/**
 * Claims the open seat (`POST /v1/games/:id/join`). A retry with the same nonce returns the same seat
 * with the new token hash, which replaces the old one (so the old token stops working).
 */
export function join(state: RoomState, input: { readonly joinNonce: string; readonly tokenHash: string; readonly now: number }): JoinOutcome {
  const seat = opponentOf(state.creatorColor)
  if (state.status === 'finished') return { ok: false, code: 'game-over' }
  if (state.status === 'active') {
    if (state.joinNonce !== input.joinNonce) return { ok: false, code: 'game-full' }
    const next = { ...state, tokenHash: withSeat(state.tokenHash, seat, input.tokenHash), updatedAt: input.now }
    return { ok: true, seat, step: step(next, { save: true }) }
  }
  const next: RoomState = {
    ...state,
    status: 'active',
    tokenHash: withSeat(state.tokenHash, seat, input.tokenHash),
    joinNonce: input.joinNonce,
    rev: state.rev + 1,
    startedAt: input.now,
    updatedAt: input.now,
    expiresAt: input.now + IDLE_ABANDON_MS,
  }
  return { ok: true, seat, step: step(next, { save: true, events: stateToAll(next, input.now) }) }
}

export type HelloOutcome = { readonly ok: true; readonly seat: Seat } | { readonly ok: false; readonly code: ErrorCode }

/** Checks a `hello`: protocol, rules, and which seat (if any) the token hash belongs to. */
export function authenticate(
  state: RoomState,
  hello: { readonly protocol: number; readonly rules: string; readonly tokenHash: string },
): HelloOutcome {
  if (hello.protocol < OLDEST_SUPPORTED_PROTOCOL || hello.protocol > PROTOCOL_VERSION) return { ok: false, code: 'unsupported-protocol' }
  if (hello.rules !== state.rules) return { ok: false, code: 'rules-mismatch' }
  if (state.tokenHash.white === hello.tokenHash) return { ok: true, seat: 'white' }
  if (state.tokenHash.black === hello.tokenHash) return { ok: true, seat: 'black' }
  return { ok: false, code: 'not-authenticated' }
}

// ---------------------------------------------------------------------------------------------
// Presence

/** A seat's first authenticated socket arrived. */
export function seatConnected(state: RoomState, seat: Seat, now: number): Step {
  if (state.connected[seat]) return step(state)
  const next: RoomState = {
    ...state,
    connected: withSeat(state.connected, seat, true),
    absentSince: withSeat(state.absentSince, seat, null),
    rev: state.rev + 1,
    updatedAt: now,
  }
  return step(next, { save: true, events: [{ to: 'all', event: presenceEvent(next, now) }] })
}

/** A seat's last socket closed (or was found dead; `since` is then its last heartbeat). */
export function seatDisconnected(state: RoomState, seat: Seat, now: number, since: number = now): Step {
  if (!state.connected[seat]) return step(state)
  const next: RoomState = {
    ...state,
    connected: withSeat(state.connected, seat, false),
    absentSince: withSeat(state.absentSince, seat, since),
    rev: state.rev + 1,
    updatedAt: now,
  }
  return step(next, { save: true, events: [{ to: 'all', event: presenceEvent(next, now) }] })
}

// ---------------------------------------------------------------------------------------------
// Messages

export interface MessageContext {
  readonly seat: Seat
  readonly now: number
  /** For `rematch-answer`: the id the new game will get (the adapter generates it). */
  readonly newGameId?: string
  /** For `rematch-offer`: false when the day's hard cap is reached (capacity guard). */
  readonly capacityOk?: boolean
}

/** Handles one parsed message from an authenticated seat. Never throws for bad input: it rejects. */
export function handleMessage(state: RoomState, message: Exclude<ClientMessage, { t: 'hello' }>, context: MessageContext): Step {
  switch (message.t) {
    case 'move':
      return move(state, message, context)
    case 'draw-offer':
      return drawOffer(state, context)
    case 'draw-answer':
      return drawAnswer(state, message.accept, context)
    case 'resign':
      return resign(state, context)
    case 'abort':
      return abort(state, context)
    case 'claim':
      return claim(state, message.outcome, context)
    case 'rematch-offer':
      return rematchOffer(state, context)
    case 'rematch-answer':
      return rematchAnswer(state, message.accept, context)
    case 'sync':
      return step(state, { events: [{ to: 'sender', event: stateEvent(state, context.seat, context.now) }] })
    case 'stats':
      return stats(state, message, context)
  }
}

function reject(state: RoomState, of: string, code: RejectCode, extra: { readonly mid?: string; readonly withState?: Seat; readonly now?: number } = {}): Step {
  const events: Outbound[] = [{ to: 'sender', event: { t: 'rejected', rev: state.rev, of, code, ...(extra.mid ? { mid: extra.mid } : {}) } }]
  if (extra.withState && extra.now !== undefined) events.push({ to: 'sender', event: stateEvent(state, extra.withState, extra.now) })
  return step(state, { events })
}

function sideToMove(state: RoomState): Seat | null {
  return state.engine ? currentPosition(state.engine).sideToMove : null
}

function resultOf(outcome: Outcome): Result {
  return { winner: outcome.winner, reason: outcome.kind }
}

function move(state: RoomState, message: { readonly ply: number; readonly uci: string; readonly mid: string }, { seat, now }: MessageContext): Step {
  // Idempotency first: a repeat of a move already played (same seat, same mid) changes nothing.
  const playedAt = state.moves.findIndex((row) => row.mid === message.mid && row.color === seat)
  if (playedAt >= 0) {
    const row = state.moves[playedAt]
    if (row && playedAt === state.moves.length - 1) {
      return step(state, {
        events: [{ to: 'sender', event: { t: 'moved', rev: state.rev, ply: playedAt + 1, uci: row.uci, by: seat, mid: row.mid, fen: state.currentFen, result: state.result } }],
      })
    }
    return step(state, { events: [{ to: 'sender', event: stateEvent(state, seat, now) }] })
  }
  if (state.status === 'finished') return reject(state, 'move', 'game-over', { mid: message.mid })
  if (state.status === 'waiting' || !state.engine) return reject(state, 'move', 'not-allowed', { mid: message.mid })
  if (sideToMove(state) !== seat) return reject(state, 'move', 'not-your-turn', { mid: message.mid })
  if (message.ply !== state.moves.length) return reject(state, 'move', 'stale', { mid: message.mid, withState: seat, now })

  let engine: GameRecord
  try {
    engine = play(state.engine, message.uci)
  } catch {
    return reject(state, 'move', 'illegal-move', { mid: message.mid })
  }
  const position = currentPosition(engine)
  const row: MoveRow = { uci: message.uci, color: seat, mid: message.mid, at: now }
  const moves = [...state.moves, row]
  const outcomeResult = engine.outcome ? resultOf(engine.outcome) : null
  const result: Result | null = outcomeResult ?? (moves.length >= MAX_PLY ? { winner: null, reason: 'move-limit' } : null)
  // Keep only the keys since the last irreversible move: earlier positions can never recur.
  const keys = position.halfmoveClock === 0 ? [positionKey(position)] : engine.keys
  const fen = toMeanFen(position)
  const events: Outbound[] = []
  let rev = state.rev + 1
  events.push({ to: 'all', event: { t: 'moved', rev, ply: moves.length, uci: message.uci, by: seat, mid: message.mid, fen, result } })
  // A move by the player who was offered a draw declines it (§6, "Draw offers").
  let drawOffer = state.drawOffer
  let drawDeclinedAt = state.drawDeclinedAt
  if (drawOffer && drawOffer !== seat && !result) {
    rev += 1
    events.push({ to: 'all', event: { t: 'draw', rev, offeredBy: null, declinedBy: seat } })
    drawDeclinedAt = withSeat(drawDeclinedAt, drawOffer, moves.length)
    drawOffer = null
  }
  const base: RoomState = {
    ...state,
    moves,
    engine: result ? null : engineFrom(position, keys),
    currentFen: fen,
    rev,
    drawOffer: result ? null : drawOffer,
    drawDeclinedAt,
    lastMoveAt: now,
    updatedAt: now,
    expiresAt: now + IDLE_ABANDON_MS,
  }
  const next = result ? finish(base, result, now) : base
  return step(next, { save: true, newMoves: [row], events })
}

/** Marks the game finished (exactly once: callers check `status` first). */
function finish(state: RoomState, result: Result, now: number): RoomState {
  return {
    ...state,
    status: 'finished',
    result,
    engine: null,
    drawOffer: null,
    finishedAt: now,
    updatedAt: now,
    expiresAt: now + FINISHED_RETENTION_MS,
  }
}

function endWith(state: RoomState, result: Result, now: number): Step {
  const next = finish({ ...state, rev: state.rev + 1 }, result, now)
  return step(next, { save: true, events: [{ to: 'all', event: { t: 'ended', rev: next.rev, result } }] })
}

function drawOffer(state: RoomState, { seat, now }: MessageContext): Step {
  if (state.status !== 'active') return reject(state, 'draw-offer', state.status === 'finished' ? 'game-over' : 'not-allowed')
  if (state.drawOffer) return reject(state, 'draw-offer', 'already-offered')
  if (state.drawOffers[seat] >= MAX_DRAW_OFFERS) return reject(state, 'draw-offer', 'offer-limit')
  const declinedAt = state.drawDeclinedAt[seat]
  if (declinedAt !== null && !state.moves.slice(declinedAt).some((row) => row.color !== seat)) {
    return reject(state, 'draw-offer', 'not-allowed')
  }
  const next: RoomState = {
    ...state,
    drawOffer: seat,
    drawOffers: withSeat(state.drawOffers, seat, state.drawOffers[seat] + 1),
    rev: state.rev + 1,
    updatedAt: now,
  }
  return step(next, { save: true, events: [{ to: 'all', event: { t: 'draw', rev: next.rev, offeredBy: seat, declinedBy: null } }] })
}

function drawAnswer(state: RoomState, accept: boolean, { seat, now }: MessageContext): Step {
  if (state.status !== 'active' || state.drawOffer !== opponentOf(seat)) return reject(state, 'draw-answer', 'no-offer')
  if (accept) return endWith(state, { winner: null, reason: 'agreement' }, now)
  const next: RoomState = {
    ...state,
    drawOffer: null,
    drawDeclinedAt: withSeat(state.drawDeclinedAt, opponentOf(seat), state.moves.length),
    rev: state.rev + 1,
    updatedAt: now,
  }
  return step(next, { save: true, events: [{ to: 'all', event: { t: 'draw', rev: next.rev, offeredBy: null, declinedBy: seat } }] })
}

function resign(state: RoomState, { seat, now }: MessageContext): Step {
  if (state.status === 'finished') return step(state, { events: [{ to: 'sender', event: stateEvent(state, seat, now) }] })
  if (state.status !== 'active') return reject(state, 'resign', 'not-allowed')
  return endWith(state, { winner: opponentOf(seat), reason: 'resignation' }, now)
}

function abort(state: RoomState, { seat, now }: MessageContext): Step {
  if (state.status === 'finished') return step(state, { events: [{ to: 'sender', event: stateEvent(state, seat, now) }] })
  const allowed = state.status === 'waiting' ? seat === state.creatorColor : state.moves.length < 2
  if (!allowed) return reject(state, 'abort', 'not-allowed')
  return endWith(state, { winner: null, reason: 'aborted' }, now)
}

/** When `seat` may claim, or null: the opponent must be absent (and not connected) for 120 s. */
export function claimableAt(state: RoomState, seat: Seat): number | null {
  const opponent = opponentOf(seat)
  const since = state.absentSince[opponent]
  if (state.status !== 'active' || state.connected[opponent] || since === null) return null
  return since + CLAIM_AFTER_MS
}

function claim(state: RoomState, outcome: 'win' | 'draw', { seat, now }: MessageContext): Step {
  if (state.status === 'finished') return step(state, { events: [{ to: 'sender', event: stateEvent(state, seat, now) }] })
  if (state.status !== 'active') return reject(state, 'claim', 'not-allowed')
  const at = claimableAt(state, seat)
  if (at === null || now < at) return reject(state, 'claim', 'opponent-present')
  return endWith(state, outcome === 'win' ? { winner: seat, reason: 'claim-win' } : { winner: null, reason: 'claim-draw' }, now)
}

function rematchOffer(state: RoomState, { seat, now, capacityOk = true }: MessageContext): Step {
  if (state.status !== 'finished' || state.result?.reason === 'aborted' || state.rematchGameId) return reject(state, 'rematch-offer', 'not-allowed')
  if (state.rematchOffer) return reject(state, 'rematch-offer', 'already-offered')
  if (state.rematchOffers[seat] >= MAX_REMATCH_OFFERS) return reject(state, 'rematch-offer', 'offer-limit')
  if (!state.connected[opponentOf(seat)]) return reject(state, 'rematch-offer', 'opponent-offline')
  if (!capacityOk) return reject(state, 'rematch-offer', 'online-full')
  const next: RoomState = {
    ...state,
    rematchOffer: seat,
    rematchOffers: withSeat(state.rematchOffers, seat, state.rematchOffers[seat] + 1),
    rev: state.rev + 1,
    updatedAt: now,
  }
  return step(next, { save: true, events: [{ to: 'all', event: { t: 'rematch', rev: next.rev, offeredBy: seat, declinedBy: null, next: null } }] })
}

function rematchAnswer(state: RoomState, accept: boolean, { seat, now, newGameId }: MessageContext): Step {
  const offerer = opponentOf(seat)
  if (state.status !== 'finished' || state.rematchOffer !== offerer) return reject(state, 'rematch-answer', 'no-offer')
  if (!accept) {
    const next: RoomState = { ...state, rematchOffer: null, rev: state.rev + 1, updatedAt: now }
    return step(next, { save: true, events: [{ to: 'all', event: { t: 'rematch', rev: next.rev, offeredBy: null, declinedBy: seat, next: null } }] })
  }
  if (!state.connected[offerer]) return reject(state, 'rematch-answer', 'opponent-offline')
  const white = state.tokenHash.white
  const black = state.tokenHash.black
  if (!newGameId || !white || !black) return reject(state, 'rematch-answer', 'not-allowed')
  const next: RoomState = { ...state, rematchOffer: null, rematchGameId: newGameId, rev: state.rev + 1, updatedAt: now }
  // Colours swap: each player's token now holds the other seat.
  const events: Outbound[] = (['white', 'black'] as const).map((to) => ({
    to,
    event: { t: 'rematch', rev: next.rev, offeredBy: null, declinedBy: null, next: { gameId: newGameId, you: opponentOf(to) } },
  }))
  return step(next, { save: true, events, spawnRematch: { gameId: newGameId, tokenHash: { white: black, black: white } } })
}

function stats(state: RoomState, message: { readonly rtt50: number; readonly rtt95: number; readonly reconnects: number }, { seat }: MessageContext): Step {
  if (state.status !== 'finished' || state.statsReceived[seat]) return step(state)
  const next = { ...state, statsReceived: withSeat(state.statsReceived, seat, true) }
  return step(next, { stats: { seat, rtt50: message.rtt50, rtt95: message.rtt95, reconnects: message.reconnects } })
}

// ---------------------------------------------------------------------------------------------
// Alarms (retention, §3 and ONLINE-DATA-MODEL.md §6)

/** The alarm fired. Each deadline is re-checked: a handler whose deadline no longer applies does nothing. */
export function alarm(state: RoomState, now: number): Step {
  if (state.status === 'waiting' && now >= state.createdAt + WAITING_EXPIRY_MS) {
    return { state, effects: { ...noEffects(state), deleteAll: true, alarmAt: null } }
  }
  if (state.status === 'active') {
    const lastActivity = state.lastMoveAt ?? state.startedAt ?? state.createdAt
    if (state.connected.white || state.connected.black) {
      // Someone is here: no abandonment while connected. Look again in a day.
      const next = { ...state, expiresAt: Math.max(lastActivity + IDLE_ABANDON_MS, now + 24 * 60 * 60 * 1_000) }
      return step(next, { save: true })
    }
    if (now >= lastActivity + IDLE_ABANDON_MS) return endWith(state, { winner: null, reason: 'abandoned' }, now)
  }
  if (state.status === 'finished' && state.finishedAt !== null && now >= state.finishedAt + FINISHED_RETENTION_MS) {
    return { state, effects: { ...noEffects(state), deleteAll: true, alarmAt: null } }
  }
  return step(state)
}

// ---------------------------------------------------------------------------------------------
// Views

export function stateEvent(state: RoomState, you: Seat, now: number): StateEvent {
  return {
    t: 'state',
    rev: state.rev,
    protocol: state.protocol,
    rules: state.rules,
    gameId: state.id,
    you,
    status: state.status,
    start: state.startFen,
    moves: state.moves.map((row) => row.uci),
    drawOffer: state.drawOffer,
    rematch: {
      offeredBy: state.rematchOffer,
      next: state.rematchGameId ? { gameId: state.rematchGameId, you: opponentOf(you) } : null,
    },
    presence: { connected: state.connected, absentSince: state.absentSince },
    claimableAt: claimableAt(state, you),
    result: state.result,
    serverTime: now,
  }
}

function stateToAll(state: RoomState, now: number): Outbound[] {
  return (['white', 'black'] as const).map((to) => ({ to, event: stateEvent(state, to, now) }))
}

function presenceEvent(state: RoomState, now: number): ServerEvent {
  return { t: 'presence', rev: state.rev, connected: state.connected, absentSince: state.absentSince, serverTime: now }
}

// ---------------------------------------------------------------------------------------------
// Storage mapping (the adapter writes these to SQLite; ONLINE-DATA-MODEL.md §2, amended by the A0 spike)

/** The `game` row. `position_keys` is the spike's addition (zero-replay resume). */
export interface GameRow {
  readonly id: string
  readonly protocol: number
  readonly rules: string
  readonly status: GameStatus
  readonly creator_color: Seat
  readonly white_token_hash: string | null
  readonly black_token_hash: string | null
  readonly join_nonce: string | null
  readonly start_fen: string
  readonly current_fen: string
  readonly position_keys: string
  readonly ply: number
  readonly rev: number
  readonly draw_offer: Seat | null
  readonly draw_offers_white: number
  readonly draw_offers_black: number
  readonly draw_declined_white: number | null
  readonly draw_declined_black: number | null
  readonly rematch_offer: Seat | null
  readonly rematch_offers_white: number
  readonly rematch_offers_black: number
  readonly rematch_game_id: string | null
  readonly white_absent_since: number | null
  readonly black_absent_since: number | null
  readonly result_winner: Seat | null
  readonly result_reason: EndReason | null
  readonly created_at: number
  readonly started_at: number | null
  readonly last_move_at: number | null
  readonly updated_at: number
  readonly finished_at: number | null
  readonly expires_at: number
}

export function toRow(state: RoomState): GameRow {
  return {
    id: state.id,
    protocol: state.protocol,
    rules: state.rules,
    status: state.status,
    creator_color: state.creatorColor,
    white_token_hash: state.tokenHash.white,
    black_token_hash: state.tokenHash.black,
    join_nonce: state.joinNonce,
    start_fen: state.startFen,
    current_fen: state.currentFen,
    position_keys: JSON.stringify(state.engine?.keys ?? []),
    ply: state.moves.length,
    rev: state.rev,
    draw_offer: state.drawOffer,
    draw_offers_white: state.drawOffers.white,
    draw_offers_black: state.drawOffers.black,
    draw_declined_white: state.drawDeclinedAt.white,
    draw_declined_black: state.drawDeclinedAt.black,
    rematch_offer: state.rematchOffer,
    rematch_offers_white: state.rematchOffers.white,
    rematch_offers_black: state.rematchOffers.black,
    rematch_game_id: state.rematchGameId,
    white_absent_since: state.absentSince.white,
    black_absent_since: state.absentSince.black,
    result_winner: state.result?.winner ?? null,
    result_reason: state.result?.reason ?? null,
    created_at: state.createdAt,
    started_at: state.startedAt,
    last_move_at: state.lastMoveAt,
    updated_at: state.updatedAt,
    finished_at: state.finishedAt,
    expires_at: state.expiresAt,
  }
}

/**
 * Rebuilds the room from storage without replaying a single move (A0 spike). `connected` starts false;
 * the adapter marks seats connected from the sockets that survived hibernation.
 */
export function fromRow(row: GameRow, moves: readonly MoveRow[]): RoomState {
  let engine: GameRecord | null = null
  if (row.status !== 'finished') {
    const parsed = parseMeanFen(row.current_fen)
    if (!parsed.ok) throw new Error(`Stored position is invalid: ${parsed.error}`)
    engine = engineFrom(parsed.position, JSON.parse(row.position_keys) as string[])
  }
  return {
    id: row.id,
    protocol: row.protocol,
    rules: row.rules,
    status: row.status,
    creatorColor: row.creator_color,
    tokenHash: { white: row.white_token_hash, black: row.black_token_hash },
    joinNonce: row.join_nonce,
    startFen: row.start_fen,
    moves,
    engine,
    currentFen: row.current_fen,
    rev: row.rev,
    drawOffer: row.draw_offer,
    drawOffers: { white: row.draw_offers_white, black: row.draw_offers_black },
    drawDeclinedAt: { white: row.draw_declined_white, black: row.draw_declined_black },
    rematchOffer: row.rematch_offer,
    rematchOffers: { white: row.rematch_offers_white, black: row.rematch_offers_black },
    rematchGameId: row.rematch_game_id,
    absentSince: { white: row.white_absent_since, black: row.black_absent_since },
    connected: both(false),
    statsReceived: both(false),
    result: row.result_reason ? { winner: row.result_winner, reason: row.result_reason } : null,
    createdAt: row.created_at,
    startedAt: row.started_at,
    lastMoveAt: row.last_move_at,
    updatedAt: row.updated_at,
    finishedAt: row.finished_at,
    expiresAt: row.expires_at,
  }
}
