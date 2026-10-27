// Integration tests for the game server (ONLINE-TEST-PLAN.md §4–§5), run against a real local server
// (`wrangler dev`, per the A0 spike: the Workers Vitest pool doesn't support Vitest 5 yet).
// Usage: npm run test:server
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// A random port each run, so a leftover server from an earlier run can never answer for this one.
const PORT = 8700 + Math.floor(Math.random() * 200)
const BASE = `http://127.0.0.1:${PORT}`
const WS = `ws://127.0.0.1:${PORT}`
const ALLOWED = 'https://meanchess.siddheshthapa.com'
const root = fileURLToPath(new URL('../..', import.meta.url))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// --- start the server: fresh storage every run (wrangler dev persists by default), small daily caps ---
const portBusy = await fetch(`http://127.0.0.1:${PORT}/v1/health`).then(() => true, () => false)
if (portBusy) throw new Error(`Port ${PORT} is already in use: stop the other server first.`)
const state = mkdtempSync(join(tmpdir(), 'meanchess-server-test-'))
const wrangler = join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js')
const server = spawn(
  process.execPath,
  [wrangler, 'dev', '-c', 'server/wrangler.jsonc', '--port', String(PORT), '--persist-to', state, '--var', 'DAILY_SOFT_CAP:6', '--var', 'DAILY_HARD_CAP:7', '--var', 'DAILY_PER_ADDRESS_CAP:20'],
  { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
)
let output = ''
server.stdout.on('data', (d) => (output += d))
server.stderr.on('data', (d) => (output += d))
const stop = async () => {
  if (process.platform === 'win32') {
    // Kill the whole tree (npx, node, workerd), then anything still serving this port.
    spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' })
    await sleep(1_000)
    spawn('powershell', ['-NoProfile', '-Command', `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${PORT}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`], { stdio: 'ignore' })
  } else server.kill('SIGTERM')
  for (let i = 0; i < 20; i++) {
    if (!(await fetch(`${BASE}/v1/health`).then(() => true, () => false))) break
    await sleep(500)
  }
  if (await fetch(`${BASE}/v1/health`).then(() => true, () => false)) console.warn(`warning: the test server on port ${PORT} is still running`)
  rmSync(state, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
}
for (let i = 0; i < 120 && !/Ready on/.test(output); i++) await sleep(500)
if (!/Ready on/.test(output)) {
  console.error(output)
  await stop()
  throw new Error('wrangler dev did not start')
}

// --- helpers ---
const post = (path, body, origin) =>
  fetch(`${BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify(body) })
const create = async (color = 'white') => (await post('/v1/games', { protocol: 1, rules: '0.1', color })).json()
const joinGame = async (gameId, nonce = 'n'.repeat(16)) => post(`/v1/games/${gameId}/join`, { protocol: 1, rules: '0.1', joinNonce: nonce })

/** A WebSocket client that queues events and can wait for one matching a predicate. */
function connect(gameId, origin) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS}/v1/games/${gameId}/ws`, origin ? { headers: { Origin: origin } } : undefined)
    const events = []
    const waiters = []
    ws.closeInfo = null
    ws.onmessage = (e) => {
      const event = JSON.parse(e.data)
      const waiter = waiters.findIndex((w) => w.match(event))
      if (waiter >= 0) waiters.splice(waiter, 1)[0].resolve(event)
      else events.push(event)
    }
    ws.onclose = (e) => (ws.closeInfo = { code: e.code })
    ws.next = (match, timeout = 5_000) => {
      const index = events.findIndex(match)
      if (index >= 0) return Promise.resolve(events.splice(index, 1)[0])
      return new Promise((res, rej) => {
        const waiter = { match, resolve: res }
        waiters.push(waiter)
        setTimeout(() => rej(new Error(`timed out waiting for an event; queued: ${JSON.stringify(events)}`)), timeout)
      })
    }
    ws.json = (value) => ws.send(JSON.stringify(value))
    ws.onopen = () => resolve(ws)
    ws.onerror = () => reject(new Error('socket error'))
  })
}
const is = (t) => (event) => event.t === t
async function hello(ws, token) {
  ws.json({ t: 'hello', protocol: 1, rules: '0.1', token })
  return ws.next(is('state'))
}
let midCounter = 0
const mid = () => `mid${String(++midCounter).padStart(9, '0')}`
const waitClosed = async (ws) => {
  for (let i = 0; i < 50 && !ws.closeInfo; i++) await sleep(100)
  return ws.closeInfo
}

const results = []
async function test(name, fn) {
  try {
    await fn()
    results.push([true, name])
    console.log(`  ✓ ${name}`)
  } catch (error) {
    results.push([false, name])
    console.log(`  ✗ ${name}\n    ${error.stack}`)
  }
}

console.log('game server integration tests')

await test('health reports the protocol and rules', async () => {
  const health = await (await fetch(`${BASE}/v1/health`)).json()
  assert.equal(health.ok, true)
  assert.equal(health.protocol, 1)
  assert.equal(health.rules, '0.1')
})

await test('CORS allows only listed origins', async () => {
  const good = await fetch(`${BASE}/v1/health`, { headers: { Origin: ALLOWED } })
  assert.equal(good.headers.get('access-control-allow-origin'), ALLOWED)
  const bad = await fetch(`${BASE}/v1/health`, { headers: { Origin: 'https://evil.example' } })
  assert.equal(bad.status, 403)
  assert.deepEqual(await bad.json(), { error: 'origin-not-allowed' })
  const preflight = await fetch(`${BASE}/v1/games`, { method: 'OPTIONS', headers: { Origin: ALLOWED } })
  assert.equal(preflight.status, 204)
})

await test('create validates its body and versions', async () => {
  assert.equal((await post('/v1/games', { protocol: 1 })).status, 400)
  assert.deepEqual(await (await post('/v1/games', { protocol: 9, rules: '0.1' })).json(), { error: 'unsupported-protocol' })
  assert.deepEqual(await (await post('/v1/games', { protocol: 1, rules: '9.9' })).json(), { error: 'rules-mismatch' })
})

await test('a full game: create, join, hello, moves, Royal Slaughter, finished view', async () => {
  const created = await create('white')
  assert.match(created.gameId, /^[0-9A-HJKMNP-TV-Z]{10}$/)
  assert.equal(created.you, 'white')
  assert.equal(created.token.length, 43)
  const waiting = await (await fetch(`${BASE}/v1/games/${created.gameId}`)).json()
  assert.deepEqual(waiting, { status: 'waiting', creatorColor: 'white' })

  const white = await connect(created.gameId, ALLOWED)
  const whiteState = await hello(white, created.token)
  assert.equal(whiteState.status, 'waiting')
  assert.equal(whiteState.you, 'white')

  const joined = await (await joinGame(created.gameId)).json()
  assert.equal(joined.you, 'black')
  // The creator learns the game started.
  assert.equal((await white.next((e) => e.t === 'state' && e.status === 'active')).status, 'active')
  const black = await connect(created.gameId)
  assert.equal((await hello(black, joined.token)).you, 'black')

  const line = ['e2e4', 'd7d5', 'e1e2', 'e8d7', 'e2e3', 'd7d6', 'a2a3', 'd6e5', 'e3e5']
  let last
  for (const [ply, uci] of line.entries()) {
    const mover = ply % 2 === 0 ? white : black
    mover.json({ t: 'move', ply, uci, mid: mid() })
    last = await mover.next((e) => e.t === 'moved' && e.ply === ply + 1)
  }
  assert.deepEqual(last.result, { winner: 'white', reason: 'royal-slaughter' })
  const view = await (await fetch(`${BASE}/v1/games/${created.gameId}`)).json()
  assert.equal(view.status, 'finished')
  assert.deepEqual(view.game.moves, line)
  assert.deepEqual(view.result, { winner: 'white', reason: 'royal-slaughter' })
  white.close()
  black.close()
})

await test('joins are idempotent by nonce; a third player is refused', async () => {
  const created = await create('black')
  const first = await (await joinGame(created.gameId, 'a'.repeat(16))).json()
  const retry = await (await joinGame(created.gameId, 'a'.repeat(16))).json()
  assert.equal(first.you, 'white')
  assert.equal(retry.you, 'white')
  assert.notEqual(first.token, retry.token)
  const third = await joinGame(created.gameId, 'b'.repeat(16))
  assert.equal(third.status, 409)
  // The replaced token no longer works.
  const ws = await connect(created.gameId)
  ws.json({ t: 'hello', protocol: 1, rules: '0.1', token: first.token })
  assert.deepEqual(await ws.next(is('error')), { t: 'error', code: 'not-authenticated' })
  assert.equal((await waitClosed(ws))?.code, 4401)
})

await test('unknown games are not found; WebSockets from foreign origins are refused', async () => {
  assert.equal((await fetch(`${BASE}/v1/games/ZZZZZZZZZZ`)).status, 404)
  assert.equal((await fetch(`${BASE}/v1/games/not-an-id`)).status, 404)
  assert.equal((await joinGame('ZZZZZZZZZZ')).status, 404)
  const created = await create()
  await assert.rejects(connect(created.gameId, 'https://evil.example'))
})

await test('messages before hello are refused; bad input is rejected, never unanswered', async () => {
  const created = await create()
  const ws = await connect(created.gameId)
  ws.json({ t: 'sync' })
  assert.deepEqual(await ws.next(is('error')), { t: 'error', code: 'not-authenticated' })
  assert.equal((await waitClosed(ws))?.code, 4401)

  const ws2 = await connect(created.gameId)
  await hello(ws2, created.token)
  ws2.send('not json')
  assert.equal((await ws2.next(is('rejected'))).code, 'bad-request')
  ws2.json({ t: 'teleport' })
  const unknown = await ws2.next(is('rejected'))
  assert.equal(unknown.of, 'teleport')
  assert.equal(unknown.code, 'unknown-type')
  ws2.json({ t: 'move', ply: 0, uci: 'e2e4', mid: mid() })
  assert.equal((await ws2.next(is('rejected'))).code, 'not-allowed') // still waiting for an opponent
  ws2.send(JSON.stringify({ t: 'sync', pad: 'x'.repeat(3_000) }))
  assert.equal((await waitClosed(ws2))?.code, 1009)
})

await test('a duplicate move id changes nothing; a reconnect gets the full state', async () => {
  const created = await create('white')
  const joined = await (await joinGame(created.gameId)).json()
  const white = await connect(created.gameId)
  await hello(white, created.token)
  const id = mid()
  white.json({ t: 'move', ply: 0, uci: 'e2e4', mid: id })
  const moved = await white.next(is('moved'))
  white.json({ t: 'move', ply: 0, uci: 'e2e4', mid: id })
  const again = await white.next(is('moved'))
  assert.equal(again.rev, moved.rev)
  white.close()
  const back = await connect(created.gameId)
  const state = await hello(back, created.token)
  assert.deepEqual(state.moves, ['e2e4'])
  const black = await connect(created.gameId)
  const blackState = await hello(black, joined.token)
  assert.equal(blackState.you, 'black')
  back.close()
  black.close()
})

await test('presence: the opponent sees a disconnect, and a claim is refused before 120 s', async () => {
  const created = await create('white')
  const joined = await (await joinGame(created.gameId)).json()
  const white = await connect(created.gameId)
  await hello(white, created.token)
  const black = await connect(created.gameId)
  await hello(black, joined.token)
  black.close()
  const presence = await white.next((e) => e.t === 'presence' && e.connected.black === false && e.absentSince.black !== null)
  assert.equal(typeof presence.absentSince.black, 'number')
  white.json({ t: 'claim', outcome: 'win' })
  assert.equal((await white.next(is('rejected'))).code, 'opponent-present')
  white.close()
})

await test('the daily capacity guard closes new invites at the soft cap with a reopening time', async () => {
  // Earlier tests created 6 games already today (the soft cap here is 6).
  // (One request only: the per-address rate limit, 10 creates a minute, would answer 429 next.)
  const answer = await post('/v1/games', { protocol: 1, rules: '0.1' })
  assert.equal(answer.status, 503)
  const body = await answer.json()
  assert.equal(body.error, 'online-full')
  assert.ok(body.reopensAt > Date.now())
})

await stop()
const failed = results.filter(([ok]) => !ok)
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`)
process.exit(failed.length ? 1 : 0)
