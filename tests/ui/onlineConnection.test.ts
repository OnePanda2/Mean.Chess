import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OnlineConnection, type CloseReason, type ConnectionStatus } from '../../src/app/online/connection.ts'
import { resultText } from '../../src/app/online/text.ts'
import { PING_INTERVAL_MS, PONG_TIMEOUT_MS, RECONNECT_DELAYS_MS, encode } from '../../src/online/index.ts'
import { createRoom, join, stateEvent } from '../../server/src/room.ts'

/** A socket the test drives by hand. */
class HandSocket {
  static all: HandSocket[] = []
  readyState = 0
  sent: string[] = []
  onopen: (() => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  onclose: ((event: { code: number }) => void) | null = null
  onerror: (() => void) | null = null
  constructor() {
    HandSocket.all.push(this)
  }
  open() {
    this.readyState = 1
    this.onopen?.()
  }
  send(text: string) {
    this.sent.push(text)
  }
  message(data: unknown) {
    this.onmessage?.({ data })
  }
  close(code = 1006) {
    this.readyState = 3
    this.onclose?.({ code })
  }
}

const STATE = encode(stateEvent(activeRoom(), 'white', 0))

function activeRoom() {
  const created = createRoom({ id: 'GAME000001', creatorColor: 'white', creatorTokenHash: 'h1', now: 0 }).state
  const joined = join(created, { joinNonce: 'n'.repeat(16), tokenHash: 'h2', now: 0 })
  if (!joined.ok) throw new Error(joined.code)
  return joined.step.state
}

const open: OnlineConnection[] = []

function lastSocket(): HandSocket {
  const socket = HandSocket.all.at(-1)
  if (!socket) throw new Error('no socket yet')
  return socket
}

function connect() {
  const statuses: [ConnectionStatus, CloseReason | undefined][] = []
  const events: unknown[] = []
  const connection = new OnlineConnection(
    { url: 'wss://server.test/v1/games/GAME000001/ws', token: 't'.repeat(43), createSocket: () => new HandSocket() as unknown as WebSocket, random: () => 0.5 },
    { onEvent: (event) => events.push(event), onStatus: (status, reason) => statuses.push([status, reason]) },
  )
  open.push(connection)
  return { connection, statuses, events, socket: lastSocket }
}

beforeEach(() => {
  HandSocket.all = []
  vi.useFakeTimers()
  vi.stubGlobal('WebSocket', { OPEN: 1 })
})

afterEach(() => {
  for (const connection of open.splice(0)) connection.stop()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('OnlineConnection', () => {
  it('says hello on open and reports open on the first state', () => {
    const { socket, statuses, events } = connect()
    socket().open()
    expect(JSON.parse(socket().sent[0] ?? '{}')).toMatchObject({ t: 'hello', protocol: 1, token: 't'.repeat(43) })
    socket().message(STATE)
    expect(statuses.at(-1)).toEqual(['open', undefined])
    expect(events).toHaveLength(1)
  })

  it('ignores junk frames', () => {
    const { socket, events } = connect()
    socket().open()
    socket().message('{nope')
    socket().message(new ArrayBuffer(2))
    socket().message(JSON.stringify({ t: 'unknown-thing' }))
    expect(events).toHaveLength(0)
  })

  it('reconnects with growing backoff, and resets after a state', () => {
    const { socket, statuses } = connect()
    socket().open()
    socket().close(1006)
    expect(statuses.at(-1)).toEqual(['reconnecting', undefined])
    expect(HandSocket.all).toHaveLength(1)
    vi.advanceTimersByTime(RECONNECT_DELAYS_MS[0])
    expect(HandSocket.all).toHaveLength(2)
    socket().close(1006)
    vi.advanceTimersByTime(RECONNECT_DELAYS_MS[1] - 1)
    expect(HandSocket.all).toHaveLength(2)
    vi.advanceTimersByTime(1)
    expect(HandSocket.all).toHaveLength(3)
    socket().open()
    socket().message(STATE)
    socket().close(1006)
    vi.advanceTimersByTime(RECONNECT_DELAYS_MS[0])
    expect(HandSocket.all).toHaveLength(4)
  })

  it('"Retry now" skips the wait', () => {
    const { connection, socket } = connect()
    socket().close(1006)
    connection.retryNow()
    expect(HandSocket.all).toHaveLength(2)
  })

  it.each([
    [4401, 'not-authenticated'],
    [4404, 'not-found'],
    [4409, 'superseded'],
    [4410, 'deleted'],
    [4426, 'outdated'],
    [1008, 'refused'],
  ] as const)('stops for good on close code %i', (code, reason) => {
    const { socket, statuses } = connect()
    socket().open()
    socket().close(code)
    expect(statuses.at(-1)).toEqual(['closed', reason])
    vi.advanceTimersByTime(60_000)
    expect(HandSocket.all).toHaveLength(1)
  })

  it('pings, and drops a connection that stops answering', () => {
    const { socket } = connect()
    const first = socket()
    const closing = vi.spyOn(first, 'close')
    first.open()
    vi.advanceTimersByTime(PING_INTERVAL_MS)
    expect(first.sent.at(-1)).toBe('ping')
    first.message('pong')
    vi.advanceTimersByTime(PONG_TIMEOUT_MS)
    expect(first.readyState).toBe(1)
    expect(closing).not.toHaveBeenCalled()
    vi.advanceTimersByTime(PING_INTERVAL_MS)
    expect(closing).toHaveBeenCalledWith(4000, 'no pong')
  })

  it('waits while the page is hidden and resumes when it is visible again', () => {
    const { socket } = connect()
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    socket().close(1006)
    vi.advanceTimersByTime(60_000)
    expect(HandSocket.all).toHaveLength(1)
    visibility.mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(HandSocket.all).toHaveLength(2)
    visibility.mockRestore()
  })

  it('stop() closes the socket and never reconnects', () => {
    const { connection, socket, statuses } = connect()
    socket().open()
    connection.stop()
    expect(statuses.at(-1)).toEqual(['closed', 'stopped'])
    expect(connection.send({ t: 'sync' })).toBe(false)
    vi.advanceTimersByTime(60_000)
    expect(HandSocket.all).toHaveLength(1)
  })
})

describe('resultText', () => {
  it('speaks from the player’s side', () => {
    expect(resultText({ winner: 'white', reason: 'royal-slaughter' }, 'white')).toMatch(/^You win!/)
    expect(resultText({ winner: 'white', reason: 'royal-slaughter' }, 'black')).toMatch(/^You lose\./)
    expect(resultText({ winner: null, reason: 'agreement' }, 'white')).toMatch(/draw/i)
  })
})
