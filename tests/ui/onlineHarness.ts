/**
 * An in-process game server for UI tests: the real RoomCore (server/src/room.ts) behind a fake
 * WebSocket and a fake fetch, so the online page plays real games without a network.
 */
import {
  authenticate,
  createRoom,
  handleMessage,
  join,
  seatConnected,
  seatDisconnected,
  stateEvent,
  type Outbound,
  type RoomState,
  type Step,
} from '../../server/src/room.ts'
import { encode, opponentOf, parseClientMessage, parseCreateRequest, type Seat, type ServerEvent } from '../../src/online/index.ts'

const hashOf = (token: string) => `hash:${token}`

export class FakeServer {
  rooms = new Map<string, RoomState>()
  sockets: FakeSocket[] = []
  /** Answer the next create with this error instead (e.g. the capacity guard). */
  nextCreateError: { status: number; body: unknown } | null = null
  private counter = 0
  now = 1_800_000_000_000

  private apply(gameId: string, step: Step, sender: FakeSocket | null): void {
    this.rooms.set(gameId, step.state)
    for (const out of step.effects.events) this.deliver(gameId, out, sender)
  }

  private deliver(gameId: string, { to, event }: Outbound, sender: FakeSocket | null): void {
    if (to === 'sender') {
      sender?.receive(encode(event))
      return
    }
    for (const socket of this.sockets) {
      if (socket.gameId === gameId && socket.seat && socket.readyState === FakeSocket.OPEN && (to === 'all' || to === socket.seat)) {
        socket.receive(encode(event))
      }
    }
  }

  /** The fake fetch for the HTTP API. */
  fetch = (input: string | URL | Request, init?: RequestInit): Promise<Response> => Promise.resolve(this.answer(input, init))

  private answer(input: string | URL | Request, init?: RequestInit): Response {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
    if (url.pathname === '/v1/games' && init?.method === 'POST') {
      if (this.nextCreateError) {
        const { status, body } = this.nextCreateError
        this.nextCreateError = null
        return json(body, status)
      }
      const parsed = parseCreateRequest(typeof init.body === 'string' ? init.body : '')
      if (!parsed.ok) return json({ error: 'bad-request' }, 400)
      const gameId = `GAME${String(++this.counter).padStart(6, '0')}`
      const token = `token-${gameId}-creator`.padEnd(43, 'x')
      const color: Seat = parsed.body.color === 'random' ? 'white' : parsed.body.color
      this.apply(gameId, createRoom({ id: gameId, creatorColor: color, creatorTokenHash: hashOf(token), now: this.now }), null)
      return json({ gameId, you: color, token, protocol: 1, rules: '0.1' }, 201)
    }
    const match = /^\/v1\/games\/([^/]+)(\/join)?$/.exec(url.pathname)
    const room = match?.[1] ? this.rooms.get(match[1]) : undefined
    if (!match?.[1] || !room) return json({ error: 'not-found' }, 404)
    if (match[2] === '/join') {
      const token = `token-${match[1]}-joiner`.padEnd(43, 'y')
      const answer = this.joinAs(match[1], token)
      if (!answer.ok) return json({ error: answer.code }, answer.code === 'game-full' ? 409 : 410)
      return json({ gameId: match[1], you: answer.seat, token })
    }
    if (room.status === 'waiting') return json({ status: 'waiting', creatorColor: room.creatorColor })
    if (room.status === 'active') return json({ status: 'active' })
    return json({ status: 'finished', game: { start: room.startFen, moves: room.moves.map((m) => m.uci) }, result: room.result })
  }

  joinAs(gameId: string, token: string): { ok: true; seat: Seat } | { ok: false; code: string } {
    const room = this.rooms.get(gameId)
    if (!room) return { ok: false, code: 'not-found' }
    const outcome = join(room, { joinNonce: 'n'.repeat(16), tokenHash: hashOf(token), now: this.now })
    if (!outcome.ok) return outcome
    this.apply(gameId, outcome.step, null)
    return { ok: true, seat: outcome.seat }
  }

  /** Called by FakeSocket for every text frame from a page or a scripted client. */
  onFrame(socket: FakeSocket, text: string): void {
    if (text === 'ping') {
      socket.receive('pong')
      return
    }
    const room = this.rooms.get(socket.gameId)
    if (!room) return
    const parsed = parseClientMessage(text)
    if (!parsed.ok || 'ping' in parsed) return
    const message = parsed.message
    if (message.t === 'hello') {
      const outcome = authenticate(room, { protocol: message.protocol, rules: message.rules, tokenHash: hashOf(message.token) })
      if (!outcome.ok) {
        socket.receive(encode({ t: 'error', code: outcome.code }))
        socket.close(4401)
        return
      }
      socket.seat = outcome.seat
      this.apply(socket.gameId, seatConnected(room, outcome.seat, this.now), socket)
      socket.receive(encode(stateEvent(this.rooms.get(socket.gameId) ?? room, outcome.seat, this.now)))
      return
    }
    if (!socket.seat) return
    this.apply(socket.gameId, handleMessage(room, message, { seat: socket.seat, now: this.now, newGameId: `NEXT${String(++this.counter).padStart(6, '0')}` }), socket)
  }

  onClose(socket: FakeSocket): void {
    const room = this.rooms.get(socket.gameId)
    if (!room || !socket.seat) return
    const stillHere = this.sockets.some((other) => other !== socket && other.gameId === socket.gameId && other.seat === socket.seat && other.readyState === FakeSocket.OPEN)
    if (!stillHere) this.apply(socket.gameId, seatDisconnected(room, socket.seat, this.now), null)
  }
}

export let server = new FakeServer()
export function resetServer(): FakeServer {
  server = new FakeServer()
  return server
}

/** A WebSocket stand-in connected to the FakeServer. Also usable as a scripted client in tests. */
export class FakeSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3
  readonly CONNECTING = 0
  readonly OPEN = 1
  readonly CLOSING = 2
  readonly CLOSED = 3
  readyState = FakeSocket.CONNECTING
  seat: Seat | null = null
  readonly gameId: string
  received: ServerEvent[] = []
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  constructor(url: string) {
    this.gameId = /\/v1\/games\/([^/]+)\/ws$/.exec(url)?.[1] ?? ''
    server.sockets.push(this)
    queueMicrotask(() => {
      this.readyState = FakeSocket.OPEN
      this.onopen?.(new Event('open'))
    })
  }

  send(text: string): void {
    if (this.readyState !== FakeSocket.OPEN) return
    server.onFrame(this, text)
  }

  receive(text: string): void {
    if (this.readyState !== FakeSocket.OPEN) return
    if (text !== 'pong') this.received.push(JSON.parse(text) as ServerEvent)
    this.onmessage?.(new MessageEvent('message', { data: text }))
  }

  close(code = 1000): void {
    if (this.readyState === FakeSocket.CLOSED) return
    this.readyState = FakeSocket.CLOSED
    server.onClose(this)
    this.onclose?.(new CloseEvent('close', { code }))
  }
}

/** A scripted opponent: opens a socket, says hello, and can move. */
export function scriptedPlayer(gameId: string, token: string) {
  const socket = new FakeSocket(`wss://server.test/v1/games/${gameId}/ws`)
  return {
    socket,
    async hello() {
      await Promise.resolve()
      socket.send(JSON.stringify({ t: 'hello', protocol: 1, rules: '0.1', token }))
    },
    move(ply: number, uci: string) {
      socket.send(JSON.stringify({ t: 'move', ply, uci, mid: `scripted${String(ply).padStart(4, '0')}` }))
    },
    send(message: unknown) {
      socket.send(JSON.stringify(message))
    },
    last: () => socket.received.at(-1),
  }
}

export { opponentOf }
