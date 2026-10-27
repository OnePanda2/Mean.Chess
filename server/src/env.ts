/** Bindings and settings of the game server (server/wrangler.jsonc). */
import type { DailyCapacity } from './DailyCapacity.ts'
import type { GameRoom } from './GameRoom.ts'

interface RateLimit {
  limit(options: { key: string }): Promise<{ success: boolean }>
}

export interface Env {
  readonly GAME_ROOM: DurableObjectNamespace<GameRoom>
  readonly DAILY_CAPACITY: DurableObjectNamespace<DailyCapacity>
  readonly CREATE_LIMIT: RateLimit
  readonly JOIN_LIMIT: RateLimit
  readonly CONNECT_LIMIT: RateLimit
  /** Optional: Workers Analytics Engine (metrics). Absent locally. */
  readonly METRICS?: AnalyticsEngineDataset
  readonly ENVIRONMENT: string
  /** The kill switch: anything but "true" pauses new online games and connections. */
  readonly ONLINE_ENABLED: string
  /** Comma-separated exact origins allowed for CORS and WebSocket upgrades. */
  readonly ALLOWED_ORIGINS: string
  readonly DAILY_SOFT_CAP: string
  readonly DAILY_HARD_CAP: string
  readonly DAILY_PER_ADDRESS_CAP: string
}

/** One structured log line (ONLINE-ARCHITECTURE.md §10). Never IP addresses, tokens or bodies. */
export function log(evt: string, fields: Readonly<Record<string, unknown>> = {}): void {
  console.log(JSON.stringify({ evt, ...fields }))
}

/** An 8-character id for an unexpected error, logged and shown to the player. */
export function newErrorId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()
}

export const randomBytes = (n: number): Uint8Array => crypto.getRandomValues(new Uint8Array(n))
