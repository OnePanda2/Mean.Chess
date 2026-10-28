/**
 * Load test for the online game server (docs/ONLINE-TEST-PLAN.md §7). Each simulated game is two
 * WebSocket clients playing random legal moves with our engine; every `moved.fen` is checked against
 * the engine, and every move id must be confirmed exactly once. Finished games rematch, so the number
 * of live games stays up without extra creates.
 *
 *   node tools/loadtest.ts --url https://meanchess-online-staging.onepanda2.workers.dev --games 50 --minutes 5
 *   node tools/loadtest.ts --url ... --burst 100          (creation burst: expects 429s past the limit)
 *
 * Runs from one machine, so the server's per-address limits apply to all games at once. Creates, joins
 * and connections are paced to stay under them (10, 20 and 30 a minute); the daily caps must be raised
 * on staging for a run. Writes a JSON summary to stdout at the end.
 */
import { randomBytes as nodeRandomBytes } from 'node:crypto'
import { parseArgs } from 'node:util'
import { currentPosition, legalMoves, newGame, play, toMeanFen, toUci, type GameRecord, importGame } from '../src/engine/index.ts'
import { encode, generateJoinNonce, generateMid, parseServerEvent, type Seat, type ServerEvent } from '../src/online/index.ts'

const { values: args } = parseArgs({
  options: {
    url: { type: 'string' },
    origin: { type: 'string', default: 'https://meanchess.siddheshthapa.com' },
    games: { type: 'string', default: '50' },
    minutes: { type: 'string', default: '5' },
    'move-ms': { type: 'string', default: '1000' },
    burst: { type: 'string' },
    'deploy-at': { type: 'string' },
  },
})
if (!args.url) throw new Error('--url is required')
const BASE = args.url.replace(/\/$/, '')
const WS_BASE = BASE.replace(/^http/, 'ws')
const ORIGIN = args.origin
const randomBytes = (n: number) => new Uint8Array(nodeRandomBytes(n))
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** A client-side pacer: at most `perMinute` starts in any rolling minute. */
function pacer(perMinute: number) {
  const starts: number[] = []
  return async () => {
    for (;;) {
      const now = Date.now()
      while (starts.length > 0 && now - (starts[0] ?? 0) >= 60_000) starts.shift()
      if (starts.length < perMinute) {
        starts.push(now)
        return
      }
      await sleep(60_000 - (now - (starts[0] ?? now)) + 50)
    }
  }
}
const paceCreate = pacer(9)
const paceJoin = pacer(18)
const paceConnect = pacer(27)

const stats = {
  gamesStarted: 0,
  gamesFinished: 0,
  rematches: 0,
  movesSent: 0,
  movesConfirmed: 0,
  duplicateConfirmations: 0,
  desyncs: 0,
  rejected: 0,
  errors: 0,
  unexpectedCloses: 0,
  connectFailures: 0,
  reconnects: 0,
  reconnectMs: [] as number[],
  rttMs: [] as number[],
  httpStatus: {} as Record<string, number>,
}
const notes: string[] = []
const T0 = Date.now()
const since = () => `+${Math.round((Date.now() - T0) / 1000)}s`

async function post(path: string, body: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
  const response = await fetch(`${BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN }, body: JSON.stringify(body) })
  stats.httpStatus[response.status] = (stats.httpStatus[response.status] ?? 0) + 1
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>
  return { status: response.status, json }
}

interface Pending {
  readonly mid: string
  readonly ply: number
  readonly uci: string
  readonly sentAt: number
}

/** One player's connection to one game. */
class Client {
  ws: WebSocket | null = null
  game: GameRecord = newGame()
  pending: Pending | null = null
  confirmed = new Set<string>()
  closedAt: number | null = null
  fromRematch = false
  finished = false
  stopped = false
  private ping: ReturnType<typeof setInterval> | null = null
  private moveTimer: ReturnType<typeof setTimeout> | null = null

  readonly gameId: string
  readonly seat: Seat
  readonly token: string
  private readonly table: Table

  constructor(gameId: string, seat: Seat, token: string, table: Table) {
    this.gameId = gameId
    this.seat = seat
    this.token = token
    this.table = table
  }

  async connect(): Promise<void> {
    await paceConnect()
    if (this.stopped) return
    const ws = new WebSocket(`${WS_BASE}/v1/games/${this.gameId}/ws`, { headers: { Origin: ORIGIN } })
    this.ws = ws
    ws.onopen = () => {
      ws.send(encode({ t: 'hello', protocol: 1, rules: '0.1', token: this.token }))
      this.ping = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send('ping'), 25_000)
    }
    ws.onmessage = (message) => {
      if (typeof message.data !== 'string' || message.data === 'pong') return
      const parsed = parseServerEvent(message.data)
      if (parsed.ok && parsed.event) this.onEvent(parsed.event)
    }
    ws.onclose = (close) => {
      if (this.ping) clearInterval(this.ping)
      if (this.ws !== ws || this.stopped) return
      this.ws = null
      const opened = this.closedAt === null
      if (opened) stats.unexpectedCloses += 1
      else stats.connectFailures += 1
      this.closedAt ??= Date.now()
      notes.push(`close ${close.code} ${since()} ${this.gameId}/${this.seat} ply ${this.game.moves.length}${this.fromRematch ? ' (rematch game)' : ''}${opened ? '' : ' (reconnect failed)'}`)
      void sleep(1_000 + Math.random() * 1_000).then(() => this.connect())
    }
  }

  stop(): void {
    this.stopped = true
    if (this.ping) clearInterval(this.ping)
    if (this.moveTimer) clearTimeout(this.moveTimer)
    this.ws?.close(1000)
  }

  private send(message: Parameters<typeof encode>[0]): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(encode(message))
  }

  private onEvent(event: ServerEvent): void {
    switch (event.t) {
      case 'state': {
        if (this.closedAt !== null) {
          stats.reconnects += 1
          stats.reconnectMs.push(Date.now() - this.closedAt)
          this.closedAt = null
        }
        const loaded = event.status === 'finished' ? null : importGame(JSON.stringify({ format: 'mean-chess-game', version: 1, rules: event.rules, start: event.start, moves: event.moves, result: null }))
        if (loaded?.ok) this.game = loaded.game
        if (event.status === 'finished') this.finish()
        // A move in flight: confirmed if the server has it, else sent again with the same id.
        if (this.pending) {
          if (event.moves[this.pending.ply] === this.pending.uci) this.confirm(this.pending.mid)
          else if (event.moves.length === this.pending.ply) this.send({ t: 'move', ply: this.pending.ply, uci: this.pending.uci, mid: this.pending.mid })
          else this.pending = null
        }
        if (event.status === 'active') this.scheduleMove()
        return
      }
      case 'moved': {
        let after: GameRecord | null
        try {
          after = play(this.game, event.uci)
        } catch {
          after = null
        }
        if (!after || toMeanFen(currentPosition(after)) !== event.fen || event.ply !== this.game.moves.length + 1) {
          stats.desyncs += 1
          notes.push(`desync ${this.gameId} ply ${event.ply}`)
          this.send({ t: 'sync' })
          return
        }
        this.game = after
        if (event.by === this.seat) {
          if (this.pending?.mid === event.mid) {
            stats.rttMs.push(Date.now() - this.pending.sentAt)
          }
          this.confirm(event.mid)
        }
        if (event.result) this.finish()
        else this.scheduleMove()
        return
      }
      case 'ended':
        this.finish()
        return
      case 'rematch':
        if (event.next) void this.table.rematch(this, event.next.gameId, event.next.you)
        else if (event.offeredBy && event.offeredBy !== this.seat) this.send({ t: 'rematch-answer', accept: true })
        return
      case 'rejected':
        stats.rejected += 1
        notes.push(`rejected ${event.of} ${event.code} ${this.gameId}`)
        if (event.of === 'move') this.pending = null
        return
      case 'error':
        stats.errors += 1
        notes.push(`error ${event.code} ${this.gameId}`)
        return
      default:
        return
    }
  }

  private confirm(mid: string): void {
    if (this.confirmed.has(mid)) {
      stats.duplicateConfirmations += 1
      return
    }
    this.confirmed.add(mid)
    stats.movesConfirmed += 1
    if (this.pending?.mid === mid) this.pending = null
  }

  private finish(): void {
    if (this.finished) return
    this.finished = true
    if (this.moveTimer) clearTimeout(this.moveTimer)
    if (this.seat === 'white') {
      stats.gamesFinished += 1
      if (!this.table.stopping) setTimeout(() => this.send({ t: 'rematch-offer' }), 500)
    }
  }

  private scheduleMove(): void {
    if (this.finished || this.pending || this.moveTimer) return
    const position = currentPosition(this.game)
    if (position.sideToMove !== this.seat) return
    this.moveTimer = setTimeout(() => {
      this.moveTimer = null
      if (this.finished || this.pending || this.table.stopping) return
      const legal = legalMoves(currentPosition(this.game))
      const move = legal[Math.floor(Math.random() * legal.length)]
      if (!move) return
      const pending = { mid: generateMid(randomBytes), ply: this.game.moves.length, uci: toUci(move), sentAt: Date.now() }
      this.pending = pending
      stats.movesSent += 1
      this.send({ t: 'move', ply: pending.ply, uci: pending.uci, mid: pending.mid })
    }, Number(args['move-ms']) * (0.8 + Math.random() * 0.4))
  }
}

/** Both players of one game, through its rematches. */
class Table {
  clients: Client[] = []
  stopping = false
  private rematching = new Set<string>()

  async start(): Promise<boolean> {
    await paceCreate()
    const created = await post('/v1/games', { protocol: 1, rules: '0.1', color: 'white' })
    if (created.status !== 201) {
      notes.push(`create ${created.status} ${JSON.stringify(created.json)}`)
      return false
    }
    const gameId = String(created.json.gameId)
    await paceJoin()
    const joined = await post(`/v1/games/${gameId}/join`, { protocol: 1, rules: '0.1', joinNonce: generateJoinNonce(randomBytes) })
    if (joined.status !== 200) {
      notes.push(`join ${joined.status} ${JSON.stringify(joined.json)}`)
      return false
    }
    this.clients = [new Client(gameId, 'white', String(created.json.token), this), new Client(gameId, 'black', String(joined.json.token), this)]
    stats.gamesStarted += 1
    for (const client of this.clients) await client.connect()
    return true
  }

  async rematch(client: Client, gameId: string, you: Seat): Promise<void> {
    const key = `${gameId}/${you}`
    if (this.rematching.has(key) || this.stopping) return
    this.rematching.add(key)
    if (client.seat === 'white') stats.rematches += 1
    const next = new Client(gameId, you, client.token, this)
    next.fromRematch = true
    client.stop()
    this.clients = this.clients.map((c) => (c === client ? next : c))
    await next.connect()
  }

  stop(): void {
    this.stopping = true
    for (const client of this.clients) client.stop()
  }
}

const pct = (values: number[], p: number) => {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]
}

async function burst(count: number) {
  const started = Date.now()
  const results = await Promise.all(Array.from({ length: count }, () => post('/v1/games', { protocol: 1, rules: '0.1', color: 'white' })))
  const byStatus: Record<number, number> = {}
  for (const r of results) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1
  console.log(JSON.stringify({ test: 'creation burst', count, ms: Date.now() - started, byStatus }, null, 2))
}

async function steady() {
  const games = Number(args.games)
  const minutes = Number(args.minutes)
  const tables: Table[] = []
  const t0 = Date.now()
  // Ramp: as fast as the per-address limits allow.
  for (let i = 0; i < games; i++) {
    const table = new Table()
    if (await table.start()) tables.push(table)
    if (i % 10 === 9) process.stderr.write(`ramp: ${tables.length} games after ${Math.round((Date.now() - t0) / 1000)} s\n`)
  }
  const rampSeconds = Math.round((Date.now() - t0) / 1000)
  // Reset the counters that matter so the steady window is measured alone.
  stats.rttMs = []
  const steadyStart = Date.now()
  const before = { sent: stats.movesSent, confirmed: stats.movesConfirmed }
  const deployAt = args['deploy-at'] ? Number(args['deploy-at']) * 1000 : null
  let deployed = false
  while (Date.now() - steadyStart < minutes * 60_000) {
    await sleep(10_000)
    if (deployAt !== null && !deployed && Date.now() - steadyStart >= deployAt) {
      deployed = true
      process.stderr.write('signal: deploy now\n')
    }
    process.stderr.write(`steady: ${Math.round((Date.now() - steadyStart) / 1000)} s, confirmed ${stats.movesConfirmed - before.confirmed}, desyncs ${stats.desyncs}, closes ${stats.unexpectedCloses}\n`)
  }
  for (const table of tables) table.stop()
  // In flight at the end: moves sent but not yet confirmed (should be at most one per game).
  const unconfirmed = stats.movesSent - stats.movesConfirmed
  console.log(
    JSON.stringify(
      {
        test: 'steady play',
        games: tables.length,
        sockets: tables.length * 2,
        rampSeconds,
        steadyMinutes: minutes,
        movesSentTotal: stats.movesSent,
        movesConfirmedTotal: stats.movesConfirmed,
        movesInSteadyWindow: stats.movesConfirmed - before.confirmed,
        unconfirmedAtEnd: unconfirmed,
        duplicateConfirmations: stats.duplicateConfirmations,
        desyncs: stats.desyncs,
        rejected: stats.rejected,
        errors: stats.errors,
        gamesFinished: stats.gamesFinished,
        rematches: stats.rematches,
        unexpectedCloses: stats.unexpectedCloses,
        unexpectedClosePercent: Number(((100 * stats.unexpectedCloses) / Math.max(1, tables.length * 2)).toFixed(2)),
        connectFailures: stats.connectFailures,
        reconnects: stats.reconnects,
        reconnectMsP95: pct(stats.reconnectMs, 95),
        reconnectMsMax: stats.reconnectMs.length ? Math.max(...stats.reconnectMs) : null,
        rttMsP50: pct(stats.rttMs, 50),
        rttMsP95: pct(stats.rttMs, 95),
        rttMsP99: pct(stats.rttMs, 99),
        httpStatus: stats.httpStatus,
        notes: notes.slice(0, 40),
      },
      null,
      2,
    ),
  )
  await sleep(500)
  process.exit(0)
}

if (args.burst) await burst(Number(args.burst))
else await steady()
