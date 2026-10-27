import { describe, expect, it } from 'vitest'
import {
  MAX_MESSAGE_BYTES,
  MAX_PLY,
  PROTOCOL_VERSION,
  RULES_VERSION,
  encode,
  opponentOf,
  parseClientMessage,
  parseCreateRequest,
  parseEventsRequest,
  parseJoinRequest,
  parseServerEvent,
  type ServerEvent,
  type StateEvent,
} from '../../src/online/index.ts'

const TOKEN = 'A'.repeat(43)
const MID = 'abcDEF123_-x'
const msg = (value: unknown) => parseClientMessage(JSON.stringify(value))

describe('client messages (§6)', () => {
  it('accepts every message type with valid fields', () => {
    const valid = [
      { t: 'hello', protocol: PROTOCOL_VERSION, rules: RULES_VERSION, token: TOKEN },
      { t: 'move', ply: 0, uci: 'e2e4', mid: MID },
      { t: 'move', ply: 41, uci: 'a7a8q', mid: MID },
      { t: 'draw-offer' },
      { t: 'draw-answer', accept: true },
      { t: 'resign' },
      { t: 'abort' },
      { t: 'claim', outcome: 'win' },
      { t: 'claim', outcome: 'draw' },
      { t: 'rematch-offer' },
      { t: 'rematch-answer', accept: false },
      { t: 'sync' },
      { t: 'stats', rtt50: 40, rtt95: 120, reconnects: 1 },
    ]
    for (const message of valid) expect(msg(message)).toEqual({ ok: true, message })
  })

  it('drops unknown fields', () => {
    expect(msg({ t: 'resign', extra: 1, token: TOKEN })).toEqual({ ok: true, message: { t: 'resign' } })
    expect(msg({ t: 'move', ply: 2, uci: 'g1f3', mid: MID, fen: 'x' })).toEqual({
      ok: true,
      message: { t: 'move', ply: 2, uci: 'g1f3', mid: MID },
    })
  })

  it('rejects each invalid field with bad-request, naming the type', () => {
    const invalid = [
      { t: 'hello', protocol: '1', rules: RULES_VERSION, token: TOKEN },
      { t: 'hello', protocol: 1, rules: 'v1', token: TOKEN },
      { t: 'hello', protocol: 1, rules: RULES_VERSION, token: 'short' },
      { t: 'hello', protocol: 1, rules: RULES_VERSION },
      { t: 'move', ply: -1, uci: 'e2e4', mid: MID },
      { t: 'move', ply: MAX_PLY + 1, uci: 'e2e4', mid: MID },
      { t: 'move', ply: 1.5, uci: 'e2e4', mid: MID },
      { t: 'move', ply: 0, uci: 'e2e9', mid: MID },
      { t: 'move', ply: 0, uci: 'e7e8k', mid: MID },
      { t: 'move', ply: 0, uci: 'e2e4', mid: 'bad mid!' },
      { t: 'move', ply: 0, uci: 'e2e4' },
      { t: 'draw-answer', accept: 'yes' },
      { t: 'rematch-answer' },
      { t: 'claim', outcome: 'lose' },
      { t: 'stats', rtt50: -1, rtt95: 1, reconnects: 0 },
      { t: 'stats', rtt50: 1, rtt95: 1e9, reconnects: 0 },
    ]
    for (const message of invalid) expect(msg(message)).toEqual({ ok: false, code: 'bad-request', of: message.t })
  })

  it('answers an unknown type with unknown-type', () => {
    expect(msg({ t: 'teleport' })).toEqual({ ok: false, code: 'unknown-type', of: 'teleport' })
    expect(msg({ t: 'x'.repeat(40) })).toEqual({ ok: false, code: 'unknown-type', of: undefined })
  })

  it('refuses malformed frames', () => {
    for (const text of ['', 'not json', '[]', 'null', '42', '{"t":5}', '{"type":"move"}']) {
      expect(parseClientMessage(text)).toEqual({ ok: false, code: 'bad-request' })
    }
  })

  it('refuses oversized input before parsing it', () => {
    const big = JSON.stringify({ t: 'sync', pad: 'x'.repeat(MAX_MESSAGE_BYTES) })
    expect(parseClientMessage(big)).toEqual({ ok: false, code: 'too-large' })
    // Multi-byte characters count as bytes, not characters.
    expect(parseClientMessage(JSON.stringify({ t: 'sync', pad: 'é'.repeat(1_100) }))).toEqual({ ok: false, code: 'too-large' })
  })

  it('recognises the heartbeat', () => {
    expect(parseClientMessage('ping')).toEqual({ ok: true, ping: true })
  })
})

const state: StateEvent = {
  t: 'state',
  rev: 7,
  protocol: 1,
  rules: '0.1',
  gameId: '7KQ2MX9FTA',
  you: 'white',
  status: 'active',
  start: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  moves: ['e2e4', 'e7e5'],
  drawOffer: null,
  rematch: { offeredBy: null, next: null },
  presence: { connected: { white: true, black: false }, absentSince: { white: null, black: 1_700_000_000_000 } },
  claimableAt: 1_700_000_120_000,
  result: null,
  serverTime: 1_700_000_005_000,
}

const events: ServerEvent[] = [
  state,
  { ...state, status: 'finished', result: { winner: 'black', reason: 'royal-slaughter' }, rematch: { offeredBy: 'white', next: { gameId: 'ABCDEFGHJK', you: 'black' } } },
  { t: 'moved', rev: 8, ply: 3, uci: 'g1f3', by: 'white', mid: MID, fen: '8/8/8/8/8/8/8/8 w - - 0 1', result: null },
  { t: 'moved', rev: 9, ply: 91, uci: 'e3e5', by: 'white', mid: MID, fen: 'x', result: { winner: 'white', reason: 'royal-slaughter' } },
  { t: 'rejected', rev: 8, of: 'move', code: 'stale', mid: MID },
  { t: 'rejected', rev: 8, of: 'teleport', code: 'unknown-type' },
  { t: 'presence', rev: 9, connected: { white: true, black: true }, absentSince: { white: null, black: null }, serverTime: 1 },
  { t: 'draw', rev: 10, offeredBy: 'black', declinedBy: null },
  { t: 'ended', rev: 11, result: { winner: null, reason: 'agreement' } },
  { t: 'rematch', rev: 12, offeredBy: null, declinedBy: 'black', next: null },
  { t: 'error', code: 'not-authenticated' },
  { t: 'error', code: 'internal', errorId: 'ab12cd34' },
]

describe('server events (§7)', () => {
  it('accepts every event type', () => {
    for (const event of events) expect(parseServerEvent(encode(event))).toEqual({ ok: true, event })
  })

  it('ignores event types it does not know', () => {
    expect(parseServerEvent('{"t":"clock","rev":3,"white":1000}')).toEqual({ ok: true, event: null })
  })

  it('refuses malformed events', () => {
    const bad: unknown[] = [
      'nope',
      { t: 'moved', rev: -1, ply: 1, uci: 'e2e4', by: 'white', mid: MID, fen: 'x', result: null },
      { t: 'moved', rev: 1, ply: 0, uci: 'e2e4', by: 'white', mid: MID, fen: 'x', result: null },
      { t: 'moved', rev: 1, ply: 1, uci: 'e2e4', by: 'red', mid: MID, fen: 'x', result: null },
      { t: 'moved', rev: 1, ply: 1, uci: 'e2e4', by: 'white', mid: MID, fen: 'x', result: { winner: 'white', reason: 'magic' } },
      { t: 'rejected', rev: 1, of: 'move', code: 'nope' },
      { t: 'rejected', rev: 1, of: 'move', code: 'stale', mid: '!' },
      { t: 'presence', rev: 1, connected: { white: true }, absentSince: { white: null, black: null }, serverTime: 1 },
      { t: 'draw', rev: 1, offeredBy: 'green', declinedBy: null },
      { t: 'ended', rev: 1, result: null },
      { t: 'rematch', rev: 1, offeredBy: null, declinedBy: null, next: { gameId: 'X', you: 'blue' } },
      { t: 'error', code: 'teapot' },
      { ...state, moves: ['e2e4', 'zz'] },
      { ...state, status: 'paused' },
      { ...state, presence: { connected: { white: true, black: true }, absentSince: { white: -5, black: null } } },
      { ...state, rematch: null },
      { ...state, rev: undefined },
    ]
    for (const event of bad) expect(parseServerEvent(typeof event === 'string' ? event : JSON.stringify(event))).toEqual({ ok: false })
  })
})

describe('HTTP bodies (§4)', () => {
  it('parses create requests, defaulting to a random colour', () => {
    expect(parseCreateRequest('{"protocol":1,"rules":"0.1"}')).toEqual({ ok: true, body: { protocol: 1, rules: '0.1', color: 'random' } })
    expect(parseCreateRequest('{"protocol":1,"rules":"0.1","color":"black"}')).toEqual({ ok: true, body: { protocol: 1, rules: '0.1', color: 'black' } })
    expect(parseCreateRequest('{"protocol":1,"rules":"0.1","color":"red"}')).toEqual({ ok: false })
    expect(parseCreateRequest('{"rules":"0.1"}')).toEqual({ ok: false })
    expect(parseCreateRequest('[1]')).toEqual({ ok: false })
    expect(parseCreateRequest(`{"protocol":1,"rules":"0.1","pad":"${'x'.repeat(MAX_MESSAGE_BYTES)}"}`)).toEqual({ ok: false })
  })

  it('parses join requests', () => {
    const nonce = 'n'.repeat(16)
    expect(parseJoinRequest(`{"protocol":1,"rules":"0.1","joinNonce":"${nonce}"}`)).toEqual({ ok: true, body: { protocol: 1, rules: '0.1', joinNonce: nonce } })
    expect(parseJoinRequest('{"protocol":1,"rules":"0.1","joinNonce":"short"}')).toEqual({ ok: false })
    expect(parseJoinRequest('garbage')).toEqual({ ok: false })
  })

  it('parses event batches', () => {
    expect(parseEventsRequest('{"e":["tutorial-started","online-game-started"]}')).toEqual({ ok: true, body: ['tutorial-started', 'online-game-started'] })
    expect(parseEventsRequest('{"e":[]}')).toEqual({ ok: false })
    expect(parseEventsRequest('{"e":["page-view"]}')).toEqual({ ok: false })
    expect(parseEventsRequest(`{"e":${JSON.stringify(Array(21).fill('tutorial-started'))}}`)).toEqual({ ok: false })
    expect(parseEventsRequest('{"e":"tutorial-started"}')).toEqual({ ok: false })
  })
})

describe('helpers', () => {
  it('names the opponent', () => {
    expect(opponentOf('white')).toBe('black')
    expect(opponentOf('black')).toBe('white')
  })
})
