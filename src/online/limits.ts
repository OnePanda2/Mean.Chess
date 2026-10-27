/**
 * Online play constants (docs/ONLINE-PROTOCOL.md §13). Shared by the browser and the game server.
 * The daily capacity caps live in the Worker's `vars`, not here, so they can be tuned without a release.
 */
export { RULES_VERSION } from '../engine/index.ts'

/** The protocol version this build speaks. The server also accepts the previous one (P2-15). */
export const PROTOCOL_VERSION = 1
export const OLDEST_SUPPORTED_PROTOCOL = 1

export const HELLO_TIMEOUT_MS = 10_000
export const PING_INTERVAL_MS = 25_000
export const PONG_TIMEOUT_MS = 10_000
/** A socket with no heartbeat for this long is treated as gone (the lazy liveness check). */
export const DEAD_SOCKET_AFTER_MS = 75_000
/** Reconnect backoff; the last value repeats. Each delay gets ±30% jitter. */
export const RECONNECT_DELAYS_MS = [0, 1_000, 2_000, 4_000, 8_000, 15_000] as const
export const RECONNECT_JITTER = 0.3
export const PRESENCE_DISPLAY_DELAY_MS = 5_000
export const CLAIM_AFTER_MS = 120_000
export const SYNC_WHILE_WAITING_MS = 60_000
export const SERVER_LOST_FALLBACK_MS = 30_000

export const WAITING_EXPIRY_MS = 24 * 60 * 60 * 1_000
export const IDLE_ABANDON_MS = 7 * 24 * 60 * 60 * 1_000
export const FINISHED_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000

export const MAX_PLY = 2_000
export const MAX_MESSAGE_BYTES = 2_048
export const MAX_SOCKETS_PER_SEAT = 3
export const MAX_PENDING_SOCKETS = 4
/** Per-socket token bucket: this many messages, refilling at the rate below. */
export const SOCKET_BUCKET_SIZE = 20
export const SOCKET_BUCKET_REFILL_PER_SECOND = 5
export const MAX_DRAW_OFFERS = 3
export const MAX_REMATCH_OFFERS = 3

export const EVENTS_SAMPLE_RATE = 0.25
