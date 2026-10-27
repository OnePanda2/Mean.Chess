/**
 * One online game's connection (docs/ONLINE-PROTOCOL.md §5, §8.3): opens the socket, says hello,
 * keeps it alive with heartbeats, reconnects with backoff (paused while the page is hidden), and hands
 * every parsed server event to the listener. It knows nothing about chess: useOnlineGame does that.
 */
import {
  PING_INTERVAL_MS,
  PONG_TIMEOUT_MS,
  PROTOCOL_VERSION,
  RECONNECT_DELAYS_MS,
  RECONNECT_JITTER,
  RULES_VERSION,
  encode,
  parseServerEvent,
  type ClientMessage,
  type ServerEvent,
} from '../../online/index.ts'

export type ConnectionStatus =
  | 'connecting'
  | 'open'
  | 'reconnecting'
  /** Closed for good: the reason says why (and whether a reload can help). */
  | 'closed'

export type CloseReason = 'not-authenticated' | 'not-found' | 'superseded' | 'deleted' | 'outdated' | 'refused' | 'stopped'

export interface ConnectionEvents {
  onEvent(event: ServerEvent): void
  onStatus(status: ConnectionStatus, reason?: CloseReason): void
}

export interface ConnectionOptions {
  readonly url: string
  readonly token: string
  /** Injected for tests. */
  readonly createSocket?: (url: string) => WebSocket
  readonly random?: () => number
}

/** Close codes that end the session (§5). Others reconnect. */
const FATAL: Readonly<Record<number, CloseReason>> = {
  4401: 'not-authenticated',
  4404: 'not-found',
  4409: 'superseded',
  4410: 'deleted',
  4426: 'outdated',
  1008: 'refused',
}

export class OnlineConnection {
  private socket: WebSocket | null = null
  private attempt = 0
  private stopped = false
  private status: ConnectionStatus = 'connecting'
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private pongTimer: ReturnType<typeof setTimeout> | null = null
  private readonly onVisible = () => {
    if (document.visibilityState === 'visible' && this.status === 'reconnecting' && !this.socket) this.retryNow()
  }

  private readonly options: ConnectionOptions
  private readonly events: ConnectionEvents

  constructor(options: ConnectionOptions, events: ConnectionEvents) {
    this.options = options
    this.events = events
    document.addEventListener('visibilitychange', this.onVisible)
    window.addEventListener('online', this.onVisible)
    this.open()
  }

  get current(): ConnectionStatus {
    return this.status
  }

  /** Sends a message if the socket is open; returns whether it went out. */
  send(message: ClientMessage): boolean {
    if (this.socket?.readyState !== WebSocket.OPEN) return false
    this.socket.send(encode(message))
    return true
  }

  /** "Retry now": skip the remaining backoff. */
  retryNow(): void {
    if (this.stopped || this.socket) return
    this.clearRetry()
    this.open()
  }

  stop(): void {
    this.stopped = true
    this.clearRetry()
    this.clearHeartbeat()
    document.removeEventListener('visibilitychange', this.onVisible)
    window.removeEventListener('online', this.onVisible)
    const socket = this.socket
    this.socket = null
    socket?.close(1000, 'leaving')
    this.setStatus('closed', 'stopped')
  }

  private setStatus(status: ConnectionStatus, reason?: CloseReason): void {
    this.status = status
    this.events.onStatus(status, reason)
  }

  private open(): void {
    const create = this.options.createSocket ?? ((url: string) => new WebSocket(url))
    let socket: WebSocket
    try {
      socket = create(this.options.url)
    } catch {
      this.scheduleRetry()
      return
    }
    this.socket = socket
    socket.onopen = () => {
      socket.send(encode({ t: 'hello', protocol: PROTOCOL_VERSION, rules: RULES_VERSION, token: this.options.token }))
      this.startHeartbeat(socket)
    }
    socket.onmessage = (message: MessageEvent) => {
      if (typeof message.data !== 'string') return
      if (message.data === 'pong') {
        this.clearPong()
        return
      }
      const parsed = parseServerEvent(message.data)
      if (!parsed.ok || !parsed.event) return
      if (parsed.event.t === 'state') {
        this.attempt = 0
        if (this.status !== 'open') this.setStatus('open')
      }
      this.events.onEvent(parsed.event)
    }
    socket.onclose = (close: CloseEvent) => {
      if (this.socket !== socket) return
      this.socket = null
      this.clearHeartbeat()
      const fatal = FATAL[close.code]
      if (this.stopped) return
      if (fatal) {
        this.stopped = true
        this.setStatus('closed', fatal)
        return
      }
      this.scheduleRetry()
    }
    socket.onerror = () => {
      // onclose follows and decides.
    }
  }

  private scheduleRetry(): void {
    if (this.stopped) return
    if (this.status !== 'reconnecting') this.setStatus('reconnecting')
    // Paused while hidden: visibilitychange resumes it.
    if (document.visibilityState === 'hidden') return
    const base = RECONNECT_DELAYS_MS[Math.min(this.attempt, RECONNECT_DELAYS_MS.length - 1)] ?? 15_000
    const random = this.options.random ?? Math.random
    const delay = base * (1 + (random() * 2 - 1) * RECONNECT_JITTER)
    this.attempt += 1
    this.clearRetry()
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      this.open()
    }, delay)
  }

  private startHeartbeat(socket: WebSocket): void {
    this.clearHeartbeat()
    this.pingTimer = setInterval(() => {
      if (socket.readyState !== WebSocket.OPEN) return
      socket.send('ping')
      this.clearPong()
      // No pong in time: the connection is dead; drop it and reconnect.
      this.pongTimer = setTimeout(() => socket.close(4000, 'no pong'), PONG_TIMEOUT_MS)
    }, PING_INTERVAL_MS)
  }

  private clearPong(): void {
    if (this.pongTimer) clearTimeout(this.pongTimer)
    this.pongTimer = null
  }

  private clearHeartbeat(): void {
    if (this.pingTimer) clearInterval(this.pingTimer)
    this.pingTimer = null
    this.clearPong()
  }

  private clearRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.retryTimer = null
  }
}
