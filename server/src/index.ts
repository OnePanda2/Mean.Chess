/**
 * The game server's front door (docs/ONLINE-PROTOCOL.md §4): routing, CORS and Origin checks, rate
 * limits, the kill switch and the daily capacity guard. Each game lives in its own GameRoom object.
 */
import {
  PROTOCOL_VERSION,
  RULES_VERSION,
  OLDEST_SUPPORTED_PROTOCOL,
  generateGameId,
  generateToken,
  hashToken,
  normalizeGameId,
  parseCreateRequest,
  parseEventsRequest,
  parseJoinRequest,
  type HttpErrorCode,
} from '../../src/online/index.ts'
import { utcDay } from './DailyCapacity.ts'
import { log, newErrorId, randomBytes, type Env } from './env.ts'

export { GameRoom } from './GameRoom.ts'
export { DailyCapacity } from './DailyCapacity.ts'

const MAX_BODY_BYTES = 2_048

function allowedOrigins(env: Env): string[] {
  return env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
}

function corsHeaders(origin: string | null, env: Env): Record<string, string> {
  if (!origin || !allowedOrigins(env).includes(origin)) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(body: unknown, status: number, cors: Record<string, string>, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors, ...extra } })
}

function fail(code: HttpErrorCode, status: number, cors: Record<string, string>, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}): Response {
  return json({ error: code, ...extra }, status, cors, headers)
}

async function readBody(request: Request): Promise<string | null> {
  const length = Number(request.headers.get('Content-Length') ?? '0')
  if (length > MAX_BODY_BYTES) return null
  const text = await request.text()
  return new TextEncoder().encode(text).length > MAX_BODY_BYTES ? null : text
}

const clientAddress = (request: Request): string => request.headers.get('CF-Connecting-IP') ?? 'local'

function versionError(protocol: number, rules: string, cors: Record<string, string>): Response | null {
  if (protocol < OLDEST_SUPPORTED_PROTOCOL || protocol > PROTOCOL_VERSION) return fail('unsupported-protocol', 409, cors)
  if (rules !== RULES_VERSION) return fail('rules-mismatch', 409, cors)
  return null
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin')
    const cors = corsHeaders(origin, env)
    try {
      return await route(request, env, origin, cors)
    } catch (error) {
      const errorId = newErrorId()
      log('error', { errorId, message: (error as Error).message })
      return fail('internal', 500, cors, { errorId })
    }
  },
} satisfies ExportedHandler<Env>

async function route(request: Request, env: Env, origin: string | null, cors: Record<string, string>): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname
  if (request.method === 'OPTIONS') return new Response(null, { status: origin && Object.keys(cors).length ? 204 : 403, headers: cors })
  // Browsers always send Origin on cross-origin requests and WebSocket upgrades. A foreign origin is
  // refused; requests without one (scripts, tests) aren't browser-driven and pass to the normal limits.
  if (origin && !allowedOrigins(env).includes(origin)) return fail('origin-not-allowed', 403, {})

  if (request.method === 'GET' && path === '/v1/health') {
    return json({ ok: true, protocol: PROTOCOL_VERSION, rules: RULES_VERSION, build: env.ENVIRONMENT }, 200, cors)
  }

  if (request.method === 'POST' && path === '/v1/events') {
    const text = await readBody(request)
    const parsed = text === null ? { ok: false as const } : parseEventsRequest(text)
    if (!parsed.ok) return fail('bad-request', 400, cors)
    if (!(await env.CONNECT_LIMIT.limit({ key: `events:${clientAddress(request)}` })).success) return fail('rate-limited', 429, cors, {}, { 'Retry-After': '60' })
    for (const event of parsed.body) env.METRICS?.writeDataPoint({ blobs: ['funnel', event, env.ENVIRONMENT] })
    return new Response(null, { status: 204, headers: cors })
  }

  const online = env.ONLINE_ENABLED === 'true'

  if (request.method === 'POST' && path === '/v1/games') {
    if (!online) return fail('unavailable', 503, cors)
    if (!(await env.CREATE_LIMIT.limit({ key: clientAddress(request) })).success) return fail('rate-limited', 429, cors, {}, { 'Retry-After': '60' })
    const text = await readBody(request)
    const parsed = text === null ? { ok: false as const } : parseCreateRequest(text)
    if (!parsed.ok) return fail('bad-request', 400, cors)
    const versions = versionError(parsed.body.protocol, parsed.body.rules, cors)
    if (versions) return versions
    const now = Date.now()
    const capacity = await env.DAILY_CAPACITY.get(env.DAILY_CAPACITY.idFromName(utcDay(now))).take('create', clientAddress(request), now)
    if (!capacity.ok) {
      log('capacity_closed', { reopensAt: capacity.reopensAt })
      return fail('online-full', 503, cors, { reopensAt: capacity.reopensAt })
    }
    const gameId = generateGameId(randomBytes)
    const token = generateToken(randomBytes)
    const you = await env.GAME_ROOM.get(env.GAME_ROOM.idFromName(gameId)).create(gameId, parsed.body.color, await hashToken(token), now)
    return json({ gameId, you, token, protocol: PROTOCOL_VERSION, rules: RULES_VERSION }, 201, cors)
  }

  const match = /^\/v1\/games\/([^/]+)(\/join|\/ws)?$/.exec(path)
  if (!match?.[1]) return fail('not-found', 404, cors)
  const gameId = normalizeGameId(decodeURIComponent(match[1]))
  if (!gameId) return fail('not-found', 404, cors)
  const room = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(gameId))
  const action = match[2]

  if (request.method === 'POST' && action === '/join') {
    if (!online) return fail('unavailable', 503, cors)
    if (!(await env.JOIN_LIMIT.limit({ key: clientAddress(request) })).success) return fail('rate-limited', 429, cors, {}, { 'Retry-After': '60' })
    const text = await readBody(request)
    const parsed = text === null ? { ok: false as const } : parseJoinRequest(text)
    if (!parsed.ok) return fail('bad-request', 400, cors)
    const versions = versionError(parsed.body.protocol, parsed.body.rules, cors)
    if (versions) return versions
    const token = generateToken(randomBytes)
    const answer = await room.join(parsed.body.joinNonce, await hashToken(token), Date.now())
    if (!answer.ok) return fail(answer.code, answer.code === 'not-found' ? 404 : answer.code === 'game-full' ? 409 : 410, cors)
    return json({ gameId, you: answer.you, token }, 200, cors)
  }

  if (request.method === 'GET' && action === '/ws') {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return fail('bad-request', 400, cors)
    if (!online) return fail('unavailable', 503, cors)
    if (!(await env.CONNECT_LIMIT.limit({ key: clientAddress(request) })).success) return fail('rate-limited', 429, cors, {}, { 'Retry-After': '60' })
    return room.fetch(request)
  }

  if (request.method === 'GET' && action === undefined) {
    const info = await room.info()
    if (!info.found) return fail('not-found', 404, cors)
    if (info.status === 'finished') return json({ status: 'finished', game: info.game, result: info.result, finishedAt: info.finishedAt }, 200, cors)
    return json(info.status === 'waiting' ? { status: 'waiting', creatorColor: info.creatorColor } : { status: 'active' }, 200, cors)
  }

  return fail('not-found', 404, cors)
}
