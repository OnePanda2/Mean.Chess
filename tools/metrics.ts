/**
 * Summarises a `wrangler tail --format json` capture (docs/ONLINE-TEST-PLAN.md §7): CPU and wall time
 * per kind of event, plus anything that did not end "ok" and every exception.
 *
 *   npx wrangler tail meanchess-online-staging --format json > tail.jsonl   (during a load test)
 *   node tools/metrics.ts tail.jsonl
 */
import { readFileSync } from 'node:fs'

interface TailEvent {
  readonly cpuTime?: number
  readonly wallTime?: number
  readonly outcome?: string
  readonly entrypoint?: string
  readonly exceptions?: readonly { readonly name?: string; readonly message?: string }[]
  readonly logs?: readonly { readonly message?: readonly unknown[] }[]
  readonly event?: Record<string, unknown> | null
}

/** The capture is a stream of pretty-printed JSON objects: split it at depth zero, minding strings. */
function* objects(text: string): Generator<string> {
  let depth = 0
  let start = -1
  let inString = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inString) {
      if (c === '\\') i++
      else if (c === '"') inString = false
      continue
    }
    if (c === '"') inString = true
    else if (c === '{') {
      if (depth === 0) start = i
      depth++
    } else if (c === '}') {
      depth--
      if (depth === 0 && start >= 0) yield text.slice(start, i + 1)
    }
  }
}

function kindOf(event: TailEvent): string {
  const e = event.event ?? {}
  if (typeof e.rpcMethod === 'string') return `${event.entrypoint ?? 'rpc'}.${e.rpcMethod}()`
  const ws = e.getWebSocketEvent as { webSocketEventType?: string } | undefined
  if (ws?.webSocketEventType) return `GameRoom websocket ${ws.webSocketEventType}`
  if ('request' in e) {
    const url = (e.request as { url?: string } | undefined)?.url ?? ''
    const path = url.replace(/^https?:\/\/[^/]+/, '').replace(/\/v1\/games\/[A-Z0-9]{10}/, '/v1/games/:id')
    return `${event.entrypoint ?? 'fetch'} ${path}`
  }
  if ('scheduledTime' in e || 'alarm' in e) return `${event.entrypoint ?? ''} alarm`
  return `${event.entrypoint ?? 'worker'} ${Object.keys(e).join(',') || 'other'}`
}

const pct = (sorted: readonly number[], p: number) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0

const file = process.argv[2]
if (!file) throw new Error('usage: node tools/metrics.ts <tail capture>')
const groups = new Map<string, { cpu: number[]; wall: number[] }>()
const problems: string[] = []
let total = 0
let overBudget = 0
for (const raw of objects(readFileSync(file, 'utf8'))) {
  let event: TailEvent
  try {
    event = JSON.parse(raw) as TailEvent
  } catch {
    continue
  }
  total++
  const kind = kindOf(event)
  const group = groups.get(kind) ?? { cpu: [], wall: [] }
  group.cpu.push(event.cpuTime ?? 0)
  // The Free plan's CPU budget is 10 ms per event.
  if ((event.cpuTime ?? 0) > 10) overBudget++
  group.wall.push(event.wallTime ?? 0)
  groups.set(kind, group)
  // A WebSocket proxied by the front Worker always ends its response stream one of these two ways.
  const socketEnd = kind.endsWith('/ws') && (event.outcome === 'responseStreamDisconnected' || event.outcome === 'canceled')
  if (event.outcome && event.outcome !== 'ok' && !socketEnd) problems.push(`${kind}: outcome ${event.outcome}`)
  for (const exception of event.exceptions ?? []) problems.push(`${kind}: ${exception.name ?? 'Error'} ${exception.message ?? ''}`)
  for (const log of event.logs ?? []) {
    const first = log.message?.[0]
    const text = typeof first === 'string' ? first : ''
    if (text.includes('"evt":"error"')) problems.push(`${kind}: ${text}`)
  }
}

const rows = [...groups.entries()]
  .map(([kind, { cpu, wall }]) => {
    const c = [...cpu].sort((a, b) => a - b)
    const w = [...wall].sort((a, b) => a - b)
    return { kind, count: c.length, cpuP50: pct(c, 50), cpuP95: pct(c, 95), cpuP99: pct(c, 99), cpuMax: c.at(-1) ?? 0, wallP50: pct(w, 50), wallP95: pct(w, 95) }
  })
  .sort((a, b) => b.count - a.count)
console.log(`${total} events; ${overBudget} over 10 ms CPU`)
console.table(rows)
console.log(problems.length === 0 ? 'No failed outcomes, exceptions or error logs.' : `${problems.length} problems:\n${problems.slice(0, 30).join('\n')}`)
