/**
 * GameRoom: the Durable Object adapter for one online game (docs/ONLINE-ARCHITECTURE.md). All game logic
 * is in RoomCore (room.ts); this file only moves bytes between WebSockets (Hibernation API), SQLite and
 * RoomCore, and applies RoomCore's effects. Spike rules (LAUNCH-PLAN.md): every message path catches
 * errors and always replies; restores never replay moves.
 */
import { DurableObject } from 'cloudflare:workers'
import {
  DEAD_SOCKET_AFTER_MS,
  HELLO_TIMEOUT_MS,
  MAX_PENDING_SOCKETS,
  MAX_SOCKETS_PER_SEAT,
  SOCKET_BUCKET_REFILL_PER_SECOND,
  SOCKET_BUCKET_SIZE,
  encode,
  generateGameId,
  hashToken,
  parseClientMessage,
  type ColorChoice,
  type Result,
  type Seat,
  type ServerEvent,
} from '../../src/online/index.ts'
import {
  alarm as roomAlarm,
  authenticate,
  createRematchRoom,
  createRoom,
  fromRow,
  handleMessage,
  join as roomJoin,
  seatConnected,
  seatDisconnected,
  stateEvent,
  toRow,
  type GameRow,
  type MoveRow,
  type RoomState,
  type Step,
} from './room.ts'
import { log, newErrorId, randomBytes, type Env } from './env.ts'

interface Attachment {
  readonly seat: Seat | null
  readonly connectedAt: number
}

export type JoinAnswer = { readonly ok: true; readonly you: Seat } | { readonly ok: false; readonly code: 'not-found' | 'game-full' | 'game-over' }

export type GameInfo =
  | { readonly found: false }
  | { readonly found: true; readonly status: 'waiting'; readonly creatorColor: Seat }
  | { readonly found: true; readonly status: 'active' }
  | {
      readonly found: true
      readonly status: 'finished'
      readonly game: { format: 'mean-chess-game'; version: 1; rules: string; start: string; moves: string[]; result: null }
      readonly result: Result | null
      readonly finishedAt: number | null
    }

const COLUMNS: readonly (keyof GameRow)[] = [
  'id', 'protocol', 'rules', 'status', 'creator_color', 'white_token_hash', 'black_token_hash', 'join_nonce',
  'start_fen', 'current_fen', 'position_keys', 'ply', 'rev', 'draw_offer', 'draw_offers_white', 'draw_offers_black',
  'draw_declined_white', 'draw_declined_black', 'rematch_offer', 'rematch_offers_white', 'rematch_offers_black',
  'rematch_game_id', 'white_absent_since', 'black_absent_since', 'result_winner', 'result_reason', 'created_at',
  'started_at', 'last_move_at', 'updated_at', 'finished_at', 'expires_at',
]

export class GameRoom extends DurableObject<Env> {
  private room: RoomState | null = null
  private loaded = false
  /** Per-socket token buckets, in memory only (a hibernated socket was idle, so its bucket is full). */
  private readonly buckets = new WeakMap<WebSocket, { tokens: number; at: number }>()

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'))
    // Schema setup is synchronous SQLite: it finishes before any event is delivered.
    this.migrate()
  }

  private migrate(): void {
    const sql = this.ctx.storage.sql
    sql.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
    sql.exec(`CREATE TABLE IF NOT EXISTS game (
      id TEXT PRIMARY KEY, protocol INTEGER NOT NULL, rules TEXT NOT NULL, status TEXT NOT NULL,
      creator_color TEXT NOT NULL, white_token_hash TEXT, black_token_hash TEXT, join_nonce TEXT,
      start_fen TEXT NOT NULL, current_fen TEXT NOT NULL, position_keys TEXT NOT NULL, ply INTEGER NOT NULL,
      rev INTEGER NOT NULL, draw_offer TEXT, draw_offers_white INTEGER NOT NULL, draw_offers_black INTEGER NOT NULL,
      draw_declined_white INTEGER, draw_declined_black INTEGER, rematch_offer TEXT,
      rematch_offers_white INTEGER NOT NULL, rematch_offers_black INTEGER NOT NULL, rematch_game_id TEXT,
      white_absent_since INTEGER, black_absent_since INTEGER, result_winner TEXT, result_reason TEXT,
      created_at INTEGER NOT NULL, started_at INTEGER, last_move_at INTEGER, updated_at INTEGER NOT NULL,
      finished_at INTEGER, expires_at INTEGER NOT NULL)`)
    sql.exec(`CREATE TABLE IF NOT EXISTS moves (
      ply INTEGER PRIMARY KEY, uci TEXT NOT NULL, color TEXT NOT NULL, mid TEXT NOT NULL, at INTEGER NOT NULL)`)
    sql.exec("INSERT OR IGNORE INTO meta (key, value) VALUES ('schema_version', '1')")
  }

  // ---------------------------------------------------------------------------------------------
  // Loading and storing

  /** The room, rebuilt lazily from storage after a wake (no replay: RoomCore's fromRow). */
  private load(): RoomState | null {
    if (this.loaded) return this.room
    this.loaded = true
    const row = this.ctx.storage.sql.exec<Record<string, SqlStorageValue>>('SELECT * FROM game LIMIT 1').toArray()[0]
    if (!row) return (this.room = null)
    const moves = this.ctx.storage.sql
      .exec<{ uci: string; color: string; mid: string; at: number }>('SELECT uci, color, mid, at FROM moves ORDER BY ply')
      .toArray()
      .map((m): MoveRow => ({ uci: m.uci, color: m.color as Seat, mid: m.mid, at: m.at }))
    let room = fromRow(row as unknown as GameRow, moves)
    // Sockets survive hibernation: seats with an authenticated socket are present (no events).
    const live = this.liveSeats()
    room = { ...room, connected: { white: live.white > 0, black: live.black > 0 } }
    return (this.room = room)
  }

  private liveSeats(): Record<Seat, number> {
    const count = { white: 0, black: 0 }
    for (const ws of this.ctx.getWebSockets()) {
      const seat = this.attachment(ws).seat
      if (seat) count[seat] += 1
    }
    return count
  }

  private attachment(ws: WebSocket): Attachment {
    return (ws.deserializeAttachment() as Attachment | null) ?? { seat: null, connectedAt: 0 }
  }

  private save(room: RoomState, newMoves: readonly MoveRow[]): void {
    const row = toRow(room)
    const sql = this.ctx.storage.sql
    sql.exec(
      `INSERT OR REPLACE INTO game (${COLUMNS.join(', ')}) VALUES (${COLUMNS.map(() => '?').join(', ')})`,
      ...COLUMNS.map((column) => row[column]),
    )
    for (const [index, move] of newMoves.entries()) {
      const ply = room.moves.length - newMoves.length + index
      sql.exec('INSERT INTO moves (ply, uci, color, mid, at) VALUES (?, ?, ?, ?, ?)', ply, move.uci, move.color, move.mid, move.at)
    }
  }

  /** Applies RoomCore's effects: storage, events, alarm, rematch, deletion. */
  private async apply(step: Step, sender: WebSocket | null): Promise<void> {
    const { state, effects } = step
    if (effects.deleteAll) {
      for (const ws of this.ctx.getWebSockets()) ws.close(4410, 'game deleted')
      await this.ctx.storage.deleteAll()
      this.room = null
      this.loaded = true
      log('room_deleted', { gameId: state.id })
      return
    }
    this.room = state
    this.loaded = true
    if (effects.save) this.save(state, effects.newMoves)
    for (const { to, event } of effects.events) this.deliver(to, event, sender)
    if (effects.alarmAt !== null) await this.ctx.storage.setAlarm(effects.alarmAt)
    if (effects.spawnRematch) await this.spawnRematch(effects.spawnRematch, state)
    if (effects.stats) this.env.METRICS?.writeDataPoint({ blobs: ['stats', this.env.ENVIRONMENT], doubles: [effects.stats.rtt50, effects.stats.rtt95, effects.stats.reconnects] })
    const ended = effects.events.find((o) => o.event.t === 'ended' || (o.event.t === 'moved' && o.event.result))
    if (ended && state.result) {
      log('game_ended', { gameId: state.id, reason: state.result.reason, ply: state.moves.length })
      this.env.METRICS?.writeDataPoint({ blobs: ['game_ended', state.result.reason, this.env.ENVIRONMENT], doubles: [state.moves.length] })
    }
  }

  private deliver(to: 'sender' | Seat | 'all', event: ServerEvent, sender: WebSocket | null): void {
    const text = encode(event)
    const send = (ws: WebSocket) => {
      try {
        ws.send(text)
      } catch {
        // A socket that just closed: its close handler updates presence.
      }
    }
    if (to === 'sender') {
      if (sender) send(sender)
      return
    }
    for (const ws of this.ctx.getWebSockets()) {
      const seat = this.attachment(ws).seat
      if (seat && (to === 'all' || to === seat)) send(ws)
    }
  }

  private async spawnRematch(spawn: { gameId: string; tokenHash: Record<Seat, string> }, from: RoomState): Promise<void> {
    const stub = this.env.GAME_ROOM.get(this.env.GAME_ROOM.idFromName(spawn.gameId))
    await stub.initRematch(spawn.gameId, spawn.tokenHash, from.creatorColor === 'white' ? 'black' : 'white', Date.now())
    await this.env.DAILY_CAPACITY.get(this.env.DAILY_CAPACITY.idFromName(new Date().toISOString().slice(0, 10))).take('rematch', '', Date.now())
    log('rematch_created', { gameId: from.id, next: spawn.gameId })
  }

  // ---------------------------------------------------------------------------------------------
  // RPC from the Worker

  async create(gameId: string, color: ColorChoice, tokenHash: string, now: number): Promise<Seat> {
    const seat: Seat = color === 'random' ? ((randomBytes(1)[0] ?? 0) % 2 === 0 ? 'white' : 'black') : color
    await this.apply(createRoom({ id: gameId, creatorColor: seat, creatorTokenHash: tokenHash, now }), null)
    log('game_created', { gameId })
    return seat
  }

  async initRematch(gameId: string, tokenHash: Record<Seat, string>, creatorColor: Seat, now: number): Promise<void> {
    await this.apply(createRematchRoom({ id: gameId, tokenHash, creatorColor, now }), null)
  }

  async join(joinNonce: string, tokenHash: string, now: number): Promise<JoinAnswer> {
    const room = this.load()
    if (!room) return { ok: false, code: 'not-found' }
    const outcome = roomJoin(room, { joinNonce, tokenHash, now })
    if (!outcome.ok) return outcome
    await this.apply(outcome.step, null)
    log('seat_claimed', { gameId: room.id, seat: outcome.seat })
    return { ok: true, you: outcome.seat }
  }

  info(): GameInfo {
    const room = this.load()
    if (!room) return { found: false }
    if (room.status === 'waiting') return { found: true, status: 'waiting', creatorColor: room.creatorColor }
    if (room.status === 'active') return { found: true, status: 'active' }
    return {
      found: true,
      status: 'finished',
      game: { format: 'mean-chess-game', version: 1, rules: room.rules, start: room.startFen, moves: room.moves.map((m) => m.uci), result: null },
      result: room.result,
      finishedAt: room.finishedAt,
    }
  }

  // ---------------------------------------------------------------------------------------------
  // WebSockets

  override fetch(): Response {
    if (!this.load()) return new Response(JSON.stringify({ error: 'not-found' }), { status: 404 })
    const now = Date.now()
    this.closeStalePending(now)
    const pending = this.ctx.getWebSockets().filter((ws) => this.attachment(ws).seat === null)
    if (pending.length >= MAX_PENDING_SOCKETS) return new Response(JSON.stringify({ error: 'rate-limited' }), { status: 429 })
    const pair = new WebSocketPair()
    const server = pair[1]
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ seat: null, connectedAt: now } satisfies Attachment)
    return new Response(null, { status: 101, webSocket: pair[0] })
  }

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    try {
      await this.onMessage(ws, message)
    } catch (error) {
      // Spike rule: never leave a request unanswered.
      const errorId = newErrorId()
      log('error', { gameId: this.room?.id, errorId, message: (error as Error).message })
      try {
        ws.send(encode({ t: 'error', code: 'internal', errorId }))
      } catch {
        // The socket is gone; nothing to answer.
      }
    }
  }

  private async onMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') {
      ws.close(1003, 'text frames only')
      return
    }
    if (!this.takeToken(ws)) {
      ws.close(1008, 'too many messages')
      return
    }
    const now = Date.now()
    const parsed = parseClientMessage(message)
    if ('ping' in parsed) {
      ws.send('pong')
      return
    }
    if (!parsed.ok) {
      if (parsed.code === 'too-large') {
        ws.close(1009, 'message too large')
        return
      }
      const room = this.load()
      ws.send(encode({ t: 'rejected', rev: room?.rev ?? 0, of: parsed.of ?? 'unknown', code: parsed.code }))
      return
    }
    const room = this.load()
    if (!room) {
      ws.send(encode({ t: 'error', code: 'game-deleted' }))
      ws.close(4410, 'game deleted')
      return
    }
    const { seat } = this.attachment(ws)
    if (parsed.message.t === 'hello') {
      await this.hello(ws, room, parsed.message, now)
      return
    }
    if (!seat) {
      ws.send(encode({ t: 'error', code: 'not-authenticated' }))
      ws.close(4401, 'not authenticated')
      return
    }
    let current = await this.checkLiveness(room, seat, now)
    const context: { seat: Seat; now: number; newGameId?: string; capacityOk?: boolean } = { seat, now }
    if (parsed.message.t === 'rematch-offer') {
      context.capacityOk = await this.env.DAILY_CAPACITY.get(this.env.DAILY_CAPACITY.idFromName(new Date(now).toISOString().slice(0, 10))).hasRoomForRematch(now)
    }
    if (parsed.message.t === 'rematch-answer' && parsed.message.accept) context.newGameId = generateGameId(randomBytes)
    current = this.room ?? current
    await this.apply(handleMessage(current, parsed.message, context), ws)
  }

  private async hello(ws: WebSocket, room: RoomState, hello: { protocol: number; rules: string; token: string }, now: number): Promise<void> {
    const outcome = authenticate(room, { protocol: hello.protocol, rules: hello.rules, tokenHash: await hashToken(hello.token) })
    if (!outcome.ok) {
      ws.send(encode({ t: 'error', code: outcome.code }))
      ws.close(outcome.code === 'not-authenticated' ? 4401 : 4426, outcome.code)
      return
    }
    const seat = outcome.seat
    // At most 3 sockets per seat: a newer connection supersedes the oldest.
    const mine = this.ctx.getWebSockets().filter((other) => other !== ws && this.attachment(other).seat === seat)
    if (mine.length >= MAX_SOCKETS_PER_SEAT) {
      const oldest = mine.sort((a, b) => this.attachment(a).connectedAt - this.attachment(b).connectedAt)[0]
      oldest?.close(4409, 'superseded')
    }
    ws.serializeAttachment({ seat, connectedAt: now } satisfies Attachment)
    const current = this.room ?? room
    const connected = seatConnected(current, seat, now)
    await this.apply(connected, ws)
    ws.send(encode(stateEvent(this.room ?? connected.state, seat, now)))
  }

  override async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    await this.socketGone(ws, code)
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    await this.socketGone(ws, 1006)
  }

  private async socketGone(ws: WebSocket, code: number): Promise<void> {
    try {
      const { seat } = this.attachment(ws)
      const room = this.load()
      if (!seat || !room) return
      const stillHere = this.ctx.getWebSockets().some((other) => other !== ws && this.attachment(other).seat === seat)
      log('socket_closed', { gameId: room.id, seat, code })
      if (!stillHere) await this.apply(seatDisconnected(room, seat, Date.now()), null)
    } catch (error) {
      log('error', { gameId: this.room?.id, errorId: newErrorId(), message: (error as Error).message })
    }
  }

  /** The lazy liveness check (§8.3): an opponent socket silent for 75 s is closed and counted absent. */
  private async checkLiveness(room: RoomState, seat: Seat, now: number): Promise<RoomState> {
    const opponent: Seat = seat === 'white' ? 'black' : 'white'
    const sockets = this.ctx.getWebSockets().filter((ws) => this.attachment(ws).seat === opponent)
    if (sockets.length === 0) return room
    let lastBeat = 0
    let alive = 0
    for (const ws of sockets) {
      const beat = this.ctx.getWebSocketAutoResponseTimestamp(ws)?.getTime() ?? this.attachment(ws).connectedAt
      if (now - beat > DEAD_SOCKET_AFTER_MS) {
        lastBeat = Math.max(lastBeat, beat)
        ws.close(1001, 'no heartbeat')
      } else alive += 1
    }
    if (alive > 0 || !room.connected[opponent]) return room
    const step = seatDisconnected(room, opponent, now, lastBeat || now)
    await this.apply(step, null)
    return step.state
  }

  /** Unauthenticated sockets get 10 s to say hello. */
  private closeStalePending(now: number): void {
    for (const ws of this.ctx.getWebSockets()) {
      const { seat, connectedAt } = this.attachment(ws)
      if (seat === null && now - connectedAt > HELLO_TIMEOUT_MS) ws.close(4401, 'hello timeout')
    }
  }

  private takeToken(ws: WebSocket): boolean {
    const now = Date.now()
    const bucket = this.buckets.get(ws) ?? { tokens: SOCKET_BUCKET_SIZE, at: now }
    bucket.tokens = Math.min(SOCKET_BUCKET_SIZE, bucket.tokens + ((now - bucket.at) / 1_000) * SOCKET_BUCKET_REFILL_PER_SECOND)
    bucket.at = now
    this.buckets.set(ws, bucket)
    if (bucket.tokens < 1) return false
    bucket.tokens -= 1
    return true
  }

  // ---------------------------------------------------------------------------------------------
  // Alarms

  override async alarm(): Promise<void> {
    try {
      const room = this.load()
      if (!room) return
      await this.apply(roomAlarm(room, Date.now()), null)
    } catch (error) {
      log('error', { gameId: this.room?.id, errorId: newErrorId(), message: (error as Error).message })
      throw error // let the platform retry the alarm
    }
  }
}
