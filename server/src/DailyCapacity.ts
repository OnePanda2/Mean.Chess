/**
 * The daily capacity guard (ONLINE-ARCHITECTURE.md §8, P2-31): one tiny object per UTC day, named
 * `YYYY-MM-DD`, counting new online games so the free quotas can never run out mid-game.
 * - soft cap: new invites per day (`create`);
 * - hard cap: invites plus rematches (`rematch` passes the soft cap, stops at the hard one);
 * - per-address cap: new invites per address, kept only as a salted hash (a new salt each day).
 * It deletes itself 48 hours after its day ends.
 */
import { DurableObject } from 'cloudflare:workers'
import { toBase64Url } from '../../src/online/index.ts'
import { randomBytes, type Env } from './env.ts'

export type CapacityKind = 'create' | 'rematch'

export type CapacityAnswer = { readonly ok: true } | { readonly ok: false; readonly reopensAt: number }

const DAY_MS = 24 * 60 * 60 * 1_000

export function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10)
}

export function nextUtcMidnight(now: number): number {
  return (Math.floor(now / DAY_MS) + 1) * DAY_MS
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

export class DailyCapacity extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS day (
      date TEXT PRIMARY KEY, created INTEGER NOT NULL, started INTEGER NOT NULL, salt TEXT NOT NULL)`)
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS addresses (hash TEXT PRIMARY KEY, created INTEGER NOT NULL)')
  }

  /** Counts one game if there is room, and says so. `address` is the client address (hashed here). */
  async take(kind: CapacityKind, address: string, now: number): Promise<CapacityAnswer> {
    const sql = this.ctx.storage.sql
    const date = utcDay(now)
    let day = sql.exec<{ created: number; started: number; salt: string }>('SELECT created, started, salt FROM day WHERE date = ?', date).toArray()[0]
    if (!day) {
      day = { created: 0, started: 0, salt: toBase64Url(randomBytes(16)) }
      sql.exec('INSERT INTO day (date, created, started, salt) VALUES (?, 0, 0, ?)', date, day.salt)
      // Delete everything (salt and hashes included) 48 hours after this day ends.
      await this.ctx.storage.setAlarm(nextUtcMidnight(now) + 2 * DAY_MS)
    }
    const reopensAt = nextUtcMidnight(now)
    const soft = Number(this.env.DAILY_SOFT_CAP)
    const hard = Number(this.env.DAILY_HARD_CAP)
    const perAddress = Number(this.env.DAILY_PER_ADDRESS_CAP)
    if (day.started >= hard) return { ok: false, reopensAt }
    if (kind === 'rematch') {
      sql.exec('UPDATE day SET started = started + 1 WHERE date = ?', date)
      return { ok: true }
    }
    if (day.created >= soft) return { ok: false, reopensAt }
    const hash = await sha256Hex(day.salt + address)
    const used = sql.exec<{ created: number }>('SELECT created FROM addresses WHERE hash = ?', hash).toArray()[0]?.created ?? 0
    if (used >= perAddress) return { ok: false, reopensAt }
    sql.exec('UPDATE day SET created = created + 1, started = started + 1 WHERE date = ?', date)
    sql.exec('INSERT INTO addresses (hash, created) VALUES (?, 1) ON CONFLICT(hash) DO UPDATE SET created = created + 1', hash)
    return { ok: true }
  }

  /** Whether a rematch would fit under the hard cap, without counting it. */
  hasRoomForRematch(now: number): boolean {
    const day = this.ctx.storage.sql.exec<{ started: number }>('SELECT started FROM day WHERE date = ?', utcDay(now)).toArray()[0]
    return (day?.started ?? 0) < Number(this.env.DAILY_HARD_CAP)
  }

  override async alarm(): Promise<void> {
    await this.ctx.storage.deleteAll()
  }
}
