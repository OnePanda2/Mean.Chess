import { describe, expect, it } from 'vitest'
import {
  alarm,
  authenticate,
  claimableAt,
  createRematchRoom,
  createRoom,
  fromRow,
  handleMessage,
  join,
  seatConnected,
  seatDisconnected,
  stateEvent,
  toRow,
  type MessageContext,
  type RoomState,
  type Step,
} from '../../server/src/room.ts'
import { CLAIM_AFTER_MS, FINISHED_RETENTION_MS, IDLE_ABANDON_MS, MAX_PLY, WAITING_EXPIRY_MS, type ClientMessage, type ServerEvent } from '../../src/online/index.ts'

const T0 = 1_800_000_000_000
const HASH = { white: 'w'.repeat(64), black: 'b'.repeat(64) }
let midCounter = 0
const mid = () => `mid${String(++midCounter).padStart(9, '0')}`

type Message = Exclude<ClientMessage, { t: 'hello' }>
const send = (state: RoomState, seat: 'white' | 'black', message: Message, extra: Partial<MessageContext> = {}): Step =>
  handleMessage(state, message, { seat, now: extra.now ?? T0 + 1_000, ...extra })

/** A game with White created, Black joined, and both connected. */
function activeRoom(): RoomState {
  let state = createRoom({ id: '7KQ2MX9FTA', creatorColor: 'white', creatorTokenHash: HASH.white, now: T0 }).state
  const joined = join(state, { joinNonce: 'n'.repeat(16), tokenHash: HASH.black, now: T0 + 500 })
  if (!joined.ok) throw new Error('join failed')
  state = joined.step.state
  state = seatConnected(state, 'white', T0 + 600).state
  state = seatConnected(state, 'black', T0 + 700).state
  return state
}

/** Plays UCI moves alternately, asserting each is accepted. */
function playMoves(state: RoomState, ucis: readonly string[], now = T0 + 1_000): RoomState {
  let current = state
  for (const uci of ucis) {
    const seat = current.moves.length % 2 === 0 ? 'white' : 'black'
    const result = send(current, seat, { t: 'move', ply: current.moves.length, uci, mid: mid() }, { now })
    const event = result.effects.events[0]?.event
    expect(event?.t, `${uci}: ${JSON.stringify(event)}`).toBe('moved')
    current = result.state
  }
  return current
}

const firstEvent = (result: Step): ServerEvent | undefined => result.effects.events[0]?.event
const revs = (result: Step) => result.effects.events.map((o) => ('rev' in o.event ? o.event.rev : null))

describe('lifecycle', () => {
  it('creates a waiting room that expires in 24 hours, then starts on join', () => {
    const created = createRoom({ id: '7KQ2MX9FTA', creatorColor: 'black', creatorTokenHash: HASH.black, now: T0 })
    expect(created.state.status).toBe('waiting')
    expect(created.state.tokenHash).toEqual({ white: null, black: HASH.black })
    expect(created.effects.alarmAt).toBe(T0 + WAITING_EXPIRY_MS)
    expect(created.effects.save).toBe(true)
    const joined = join(created.state, { joinNonce: 'n'.repeat(16), tokenHash: HASH.white, now: T0 + 10 })
    expect(joined.ok && joined.seat).toBe('white')
    if (!joined.ok) return
    expect(joined.step.state.status).toBe('active')
    expect(joined.step.state.rev).toBe(1)
    expect(joined.step.effects.alarmAt).toBe(T0 + 10 + IDLE_ABANDON_MS)
    // Both seats get a fresh state (the creator learns the game has started).
    expect(joined.step.effects.events.map((o) => [o.to, o.event.t])).toEqual([['white', 'state'], ['black', 'state']])
  })

  it('makes joins idempotent by nonce, and refuses a third player', () => {
    const state = activeRoom()
    const retry = join(state, { joinNonce: 'n'.repeat(16), tokenHash: 'x'.repeat(64), now: T0 + 900 })
    expect(retry.ok && retry.seat).toBe('black')
    if (retry.ok) expect(retry.step.state.tokenHash.black).toBe('x'.repeat(64))
    expect(join(state, { joinNonce: 'm'.repeat(16), tokenHash: 'y'.repeat(64), now: T0 })).toEqual({ ok: false, code: 'game-full' })
  })

  it('ends by Royal Capture when a king walks two squares from the enemy king', () => {
    // Kings walk towards each other; Black's king steps into White's Kill Zone on the c-file.
    let state = playMoves(activeRoom(), ['e2e3', 'e7e6', 'e1e2', 'e8e7', 'e2d3', 'e7d6', 'd3c4'])
    const blunder = send(state, 'black', { t: 'move', ply: state.moves.length, uci: 'd6c6', mid: mid() })
    expect(firstEvent(blunder)?.t).toBe('moved')
    state = blunder.state
    // White king c4, black king c6, c5 empty: White captures.
    const royal = send(state, 'white', { t: 'move', ply: state.moves.length, uci: 'c4c6', mid: mid() })
    expect(firstEvent(royal)).toMatchObject({ t: 'moved', result: { winner: 'white', reason: 'royal-capture' } })
    expect(royal.state.status).toBe('finished')
  })

  it('ends by Royal Slaughter through an own pawn, with the result in the move event', () => {
    let state = playMoves(activeRoom(), ['e2e4', 'd7d5', 'e1e2', 'e8d7', 'e2e3', 'd7d6'])
    // White king e3 behind its e4 pawn; Black's king walks to e5, two squares away on the file.
    state = playMoves(state, ['a2a3'])
    const toE5 = send(state, 'black', { t: 'move', ply: state.moves.length, uci: 'd6e5', mid: mid() })
    expect(firstEvent(toE5)?.t).toBe('moved')
    state = toE5.state
    // Kings e3 and e5 with White's own pawn on e4 between: White wins at once.
    const slaughter = send(state, 'white', { t: 'move', ply: state.moves.length, uci: 'e3e5', mid: mid() })
    const event = firstEvent(slaughter)
    expect(event).toMatchObject({ t: 'moved', uci: 'e3e5', result: { winner: 'white', reason: 'royal-slaughter' } })
    expect(slaughter.state.status).toBe('finished')
    expect(slaughter.state.engine).toBeNull()
    expect(slaughter.effects.alarmAt).toBe(T0 + 1_000 + FINISHED_RETENTION_MS)
    // Nothing more can happen to the result.
    const after = send(slaughter.state, 'black', { t: 'resign' })
    expect(after.state.result).toEqual({ winner: 'white', reason: 'royal-slaughter' })
    expect(firstEvent(after)?.t).toBe('state')
  })

  it('ends by resignation, agreement, abort and claim', () => {
    const resigned = send(activeRoom(), 'black', { t: 'resign' })
    expect(firstEvent(resigned)).toMatchObject({ t: 'ended', result: { winner: 'white', reason: 'resignation' } })

    let state = activeRoom()
    state = send(state, 'white', { t: 'draw-offer' }).state
    const agreed = send(state, 'black', { t: 'draw-answer', accept: true })
    expect(firstEvent(agreed)).toMatchObject({ t: 'ended', result: { winner: null, reason: 'agreement' } })

    const aborted = send(playMoves(activeRoom(), ['e2e4']), 'black', { t: 'abort' })
    expect(firstEvent(aborted)).toMatchObject({ t: 'ended', result: { winner: null, reason: 'aborted' } })
    const lateAbort = send(playMoves(activeRoom(), ['e2e4', 'e7e5']), 'white', { t: 'abort' })
    expect(firstEvent(lateAbort)).toMatchObject({ t: 'rejected', code: 'not-allowed' })

    const waiting = createRoom({ id: '7KQ2MX9FTA', creatorColor: 'white', creatorTokenHash: HASH.white, now: T0 }).state
    expect(firstEvent(send(waiting, 'white', { t: 'abort' }))).toMatchObject({ t: 'ended', result: { reason: 'aborted' } })
  })

  it('draws at the move limit', () => {
    // Shuffle knights back and forth; threefold would end it first, so check the limit logic on a
    // room whose history is already MAX_PLY - 1 long (moves are only counted, not replayed).
    const state = activeRoom()
    const long: RoomState = {
      ...state,
      moves: Array.from({ length: MAX_PLY - 1 }, (_, i) => ({ uci: 'g1f3', color: i % 2 === 0 ? 'white' : 'black', mid: `old${String(i).padStart(9, '0')}`, at: T0 })),
    }
    // The engine position is still the start (White to move), so make the side to move match.
    const blackToMove = playMoves({ ...state }, ['g1f3']).engine
    const result = send({ ...long, engine: blackToMove }, 'black', { t: 'move', ply: MAX_PLY - 1, uci: 'g8f6', mid: mid() })
    expect(firstEvent(result)).toMatchObject({ t: 'moved', ply: MAX_PLY, result: { winner: null, reason: 'move-limit' } })
    expect(result.state.status).toBe('finished')
  })
})

describe('authorisation', () => {
  it('authenticates only seat holders with a supported protocol and the same rules', () => {
    const state = activeRoom()
    expect(authenticate(state, { protocol: 1, rules: '0.1', tokenHash: HASH.white })).toEqual({ ok: true, seat: 'white' })
    expect(authenticate(state, { protocol: 1, rules: '0.1', tokenHash: HASH.black })).toEqual({ ok: true, seat: 'black' })
    expect(authenticate(state, { protocol: 1, rules: '0.1', tokenHash: 'z'.repeat(64) })).toEqual({ ok: false, code: 'not-authenticated' })
    expect(authenticate(state, { protocol: 2, rules: '0.1', tokenHash: HASH.white })).toEqual({ ok: false, code: 'unsupported-protocol' })
    expect(authenticate(state, { protocol: 1, rules: '0.2', tokenHash: HASH.white })).toEqual({ ok: false, code: 'rules-mismatch' })
  })

  it('rejects every action from the wrong seat or in the wrong status', () => {
    const state = activeRoom()
    expect(firstEvent(send(state, 'black', { t: 'move', ply: 0, uci: 'e7e5', mid: mid() }))).toMatchObject({ code: 'not-your-turn' })
    expect(firstEvent(send(state, 'white', { t: 'draw-answer', accept: true }))).toMatchObject({ code: 'no-offer' })
    expect(firstEvent(send(state, 'white', { t: 'rematch-offer' }))).toMatchObject({ code: 'not-allowed' })
    expect(firstEvent(send(state, 'white', { t: 'rematch-answer', accept: true }))).toMatchObject({ code: 'no-offer' })
    expect(firstEvent(send(state, 'white', { t: 'claim', outcome: 'win' }))).toMatchObject({ code: 'opponent-present' })

    const waiting = createRoom({ id: '7KQ2MX9FTA', creatorColor: 'white', creatorTokenHash: HASH.white, now: T0 }).state
    expect(firstEvent(send(waiting, 'white', { t: 'move', ply: 0, uci: 'e2e4', mid: mid() }))).toMatchObject({ code: 'not-allowed' })
    expect(firstEvent(send(waiting, 'white', { t: 'resign' }))).toMatchObject({ code: 'not-allowed' })
    expect(firstEvent(send(waiting, 'white', { t: 'draw-offer' }))).toMatchObject({ code: 'not-allowed' })
    expect(firstEvent(send(waiting, 'white', { t: 'claim', outcome: 'win' }))).toMatchObject({ code: 'not-allowed' })

    const finished = send(state, 'white', { t: 'resign' }).state
    expect(firstEvent(send(finished, 'white', { t: 'move', ply: 0, uci: 'e2e4', mid: mid() }))).toMatchObject({ code: 'game-over' })
    expect(firstEvent(send(finished, 'white', { t: 'draw-offer' }))).toMatchObject({ code: 'game-over' })
    expect(firstEvent(send(finished, 'white', { t: 'abort' }))?.t).toBe('state')
    expect(firstEvent(send(finished, 'white', { t: 'claim', outcome: 'draw' }))?.t).toBe('state')
  })

  it('rejects illegal moves without changing anything', () => {
    const state = activeRoom()
    const illegal = send(state, 'white', { t: 'move', ply: 0, uci: 'e2e5', mid: mid() })
    expect(firstEvent(illegal)).toMatchObject({ t: 'rejected', code: 'illegal-move', rev: state.rev })
    expect(illegal.state).toBe(state)
    expect(illegal.effects.save).toBe(false)
  })
})

describe('ordering and idempotency', () => {
  it('raises rev by exactly 1 per broadcast change, and never for replies', () => {
    const state = activeRoom()
    const before = state.rev
    const moved = send(state, 'white', { t: 'move', ply: 0, uci: 'e2e4', mid: mid() })
    expect(revs(moved)).toEqual([before + 1])
    const sync = send(moved.state, 'black', { t: 'sync' })
    expect(sync.state.rev).toBe(before + 1)
    expect(firstEvent(sync)).toMatchObject({ t: 'state', rev: before + 1 })
    const rejected = send(moved.state, 'white', { t: 'move', ply: 1, uci: 'd2d4', mid: mid() })
    expect(firstEvent(rejected)).toMatchObject({ t: 'rejected', rev: before + 1 })
  })

  it('treats a repeated mid as the same move, and a stale ply as stale (with a fresh state)', () => {
    const state = activeRoom()
    const id = mid()
    const first = send(state, 'white', { t: 'move', ply: 0, uci: 'e2e4', mid: id })
    const repeat = send(first.state, 'white', { t: 'move', ply: 0, uci: 'e2e4', mid: id })
    expect(repeat.state).toBe(first.state)
    expect(repeat.effects.events).toEqual([{ to: 'sender', event: { ...firstEvent(first), rev: first.state.rev } }])
    expect(repeat.effects.save).toBe(false)

    // An older duplicate (not the last move) gets a full state instead.
    const later = playMoves(first.state, ['e7e5', 'g1f3'])
    expect(firstEvent(send(later, 'white', { t: 'move', ply: 0, uci: 'e2e4', mid: id }))?.t).toBe('state')

    const stale = send(later, 'black', { t: 'move', ply: 1, uci: 'b8c6', mid: mid() })
    expect(stale.effects.events.map((o) => o.event.t)).toEqual(['rejected', 'state'])
    expect(firstEvent(stale)).toMatchObject({ code: 'stale' })
  })
})

describe('draw offers', () => {
  it('limits offers, declines by moving, and makes the decliner wait for an opponent move', () => {
    let state = activeRoom()
    state = send(state, 'white', { t: 'draw-offer' }).state
    expect(firstEvent(send(state, 'white', { t: 'draw-offer' }))).toMatchObject({ code: 'already-offered' })

    // Black declines by moving: two broadcasts, two revs.
    state = playMoves(state, ['e2e4'])
    const decline = send(state, 'black', { t: 'move', ply: 1, uci: 'e7e5', mid: mid() })
    expect(decline.effects.events.map((o) => o.event.t)).toEqual(['moved', 'draw'])
    expect(revs(decline)).toEqual([state.rev + 1, state.rev + 2])
    expect(decline.state.drawOffer).toBeNull()
    state = decline.state

    // White may not offer again until Black has moved after the decline.
    expect(firstEvent(send(state, 'white', { t: 'draw-offer' }))).toMatchObject({ code: 'not-allowed' })
    state = playMoves(state, ['g1f3'])
    expect(firstEvent(send(state, 'white', { t: 'draw-offer' }))).toMatchObject({ code: 'not-allowed' })
    state = playMoves(state, ['b8c6'])
    const again = send(state, 'white', { t: 'draw-offer' })
    expect(firstEvent(again)).toMatchObject({ t: 'draw', offeredBy: 'white' })

    // An explicit decline also counts; the third offer is the last.
    state = send(again.state, 'black', { t: 'draw-answer', accept: false }).state
    state = playMoves(state, ['f1c4', 'f8c5'])
    state = send(state, 'white', { t: 'draw-offer' }).state
    state = send(state, 'black', { t: 'draw-answer', accept: false }).state
    state = playMoves(state, ['d2d3', 'd7d6'])
    expect(firstEvent(send(state, 'white', { t: 'draw-offer' }))).toMatchObject({ code: 'offer-limit' })
  })

  it("lets the offerer move without withdrawing the offer", () => {
    let state = playMoves(activeRoom(), ['e2e4', 'e7e5'])
    state = send(state, 'white', { t: 'draw-offer' }).state
    const moved = send(state, 'white', { t: 'move', ply: 2, uci: 'g1f3', mid: mid() })
    expect(moved.effects.events.map((o) => o.event.t)).toEqual(['moved'])
    expect(moved.state.drawOffer).toBe('white')
  })
})

describe('presence and claims', () => {
  it('broadcasts presence changes and allows a claim only after 120 s of continuous absence', () => {
    let state = activeRoom()
    const left = seatDisconnected(state, 'black', T0 + 10_000)
    expect(firstEvent(left)).toMatchObject({ t: 'presence', connected: { white: true, black: false }, absentSince: { black: T0 + 10_000 } })
    state = left.state
    expect(claimableAt(state, 'white')).toBe(T0 + 10_000 + CLAIM_AFTER_MS)
    expect(stateEvent(state, 'white', T0 + 20_000).claimableAt).toBe(T0 + 10_000 + CLAIM_AFTER_MS)
    expect(claimableAt(state, 'black')).toBeNull()

    const early = send(state, 'white', { t: 'claim', outcome: 'win' }, { now: T0 + 10_000 + CLAIM_AFTER_MS - 1_000 })
    expect(firstEvent(early)).toMatchObject({ code: 'opponent-present' })
    const onTime = send(state, 'white', { t: 'claim', outcome: 'win' }, { now: T0 + 10_000 + CLAIM_AFTER_MS })
    expect(firstEvent(onTime)).toMatchObject({ t: 'ended', result: { winner: 'white', reason: 'claim-win' } })
    const draw = send(state, 'white', { t: 'claim', outcome: 'draw' }, { now: T0 + 10_000 + CLAIM_AFTER_MS })
    expect(firstEvent(draw)).toMatchObject({ result: { winner: null, reason: 'claim-draw' } })

    // Coming back cancels the countdown.
    const back = seatConnected(state, 'black', T0 + 60_000)
    expect(back.state.absentSince.black).toBeNull()
    expect(claimableAt(back.state, 'white')).toBeNull()
  })

  it('uses the last heartbeat when a dead socket is found, and ignores repeats', () => {
    const state = activeRoom()
    const dead = seatDisconnected(state, 'black', T0 + 200_000, T0 + 100_000)
    expect(dead.state.absentSince.black).toBe(T0 + 100_000)
    expect(seatDisconnected(dead.state, 'black', T0 + 300_000).effects.events).toEqual([])
    expect(seatConnected(state, 'white', T0).effects.events).toEqual([])
  })
})

describe('rematch', () => {
  function finishedRoom(): RoomState {
    return send(activeRoom(), 'black', { t: 'resign' }).state
  }

  it('creates a new game with colours swapped and the same tokens', () => {
    let state = finishedRoom()
    const offer = send(state, 'white', { t: 'rematch-offer' })
    expect(firstEvent(offer)).toMatchObject({ t: 'rematch', offeredBy: 'white' })
    state = offer.state
    expect(firstEvent(send(state, 'white', { t: 'rematch-offer' }))).toMatchObject({ code: 'already-offered' })
    const accepted = send(state, 'black', { t: 'rematch-answer', accept: true }, { newGameId: 'NEXTGAME01' })
    expect(accepted.effects.spawnRematch).toEqual({ gameId: 'NEXTGAME01', tokenHash: { white: HASH.black, black: HASH.white } })
    expect(accepted.effects.events.map((o) => [o.to, 'next' in o.event ? o.event.next : undefined])).toEqual([
      ['white', { gameId: 'NEXTGAME01', you: 'black' }],
      ['black', { gameId: 'NEXTGAME01', you: 'white' }],
    ])
    expect(firstEvent(send(accepted.state, 'white', { t: 'rematch-offer' }))).toMatchObject({ code: 'not-allowed' })

    const next = createRematchRoom({ id: 'NEXTGAME01', tokenHash: { white: HASH.black, black: HASH.white }, creatorColor: 'white', now: T0 + 5_000 })
    expect(next.state.status).toBe('active')
    expect(authenticate(next.state, { protocol: 1, rules: '0.1', tokenHash: HASH.black })).toEqual({ ok: true, seat: 'white' })
  })

  it('needs both players present, respects the hard cap, declines and limits', () => {
    let state = finishedRoom()
    expect(firstEvent(send(state, 'white', { t: 'rematch-offer' }, { capacityOk: false }))).toMatchObject({ code: 'online-full' })
    const away = seatDisconnected(state, 'black', T0 + 2_000).state
    expect(firstEvent(send(away, 'white', { t: 'rematch-offer' }))).toMatchObject({ code: 'opponent-offline' })

    state = send(state, 'white', { t: 'rematch-offer' }).state
    const offererLeft = seatDisconnected(state, 'white', T0 + 2_000).state
    expect(firstEvent(send(offererLeft, 'black', { t: 'rematch-answer', accept: true }, { newGameId: 'X' }))).toMatchObject({ code: 'opponent-offline' })
    expect(firstEvent(send(state, 'black', { t: 'rematch-answer', accept: true }))).toMatchObject({ code: 'not-allowed' })

    for (let i = 0; i < 2; i++) {
      state = send(state, 'black', { t: 'rematch-answer', accept: false }).state
      state = send(state, 'white', { t: 'rematch-offer' }).state
    }
    state = send(state, 'black', { t: 'rematch-answer', accept: false }).state
    expect(firstEvent(send(state, 'white', { t: 'rematch-offer' }))).toMatchObject({ code: 'offer-limit' })

    const abortedGame = send(activeRoom(), 'white', { t: 'abort' }).state
    expect(firstEvent(send(abortedGame, 'white', { t: 'rematch-offer' }))).toMatchObject({ code: 'not-allowed' })
  })
})

describe('alarms', () => {
  it('expires unjoined invites after 24 hours', () => {
    const waiting = createRoom({ id: '7KQ2MX9FTA', creatorColor: 'white', creatorTokenHash: HASH.white, now: T0 }).state
    expect(alarm(waiting, T0 + WAITING_EXPIRY_MS - 1).effects.deleteAll).toBe(false)
    const expired = alarm(waiting, T0 + WAITING_EXPIRY_MS)
    expect(expired.effects.deleteAll).toBe(true)
    expect(expired.effects.alarmAt).toBeNull()
  })

  it('abandons a game after 7 days without moves or connections, but not if a move came later', () => {
    let state = playMoves(activeRoom(), ['e2e4'], T0 + 1_000)
    state = seatDisconnected(seatDisconnected(state, 'white', T0 + 2_000).state, 'black', T0 + 2_000).state
    const early = alarm(state, T0 + 1_000 + IDLE_ABANDON_MS - 3_600_000)
    expect(early.state.status).toBe('active')
    const abandoned = alarm(state, T0 + 1_000 + IDLE_ABANDON_MS)
    expect(firstEvent(abandoned)).toMatchObject({ t: 'ended', result: { winner: null, reason: 'abandoned' } })
    expect(abandoned.effects.alarmAt).toBe(T0 + 1_000 + IDLE_ABANDON_MS + FINISHED_RETENTION_MS)

    // Someone still connected: never abandoned; look again later.
    const watched = alarm(playMoves(activeRoom(), ['e2e4'], T0 + 1_000), T0 + 1_000 + IDLE_ABANDON_MS)
    expect(watched.state.status).toBe('active')
    expect(watched.effects.alarmAt).toBeGreaterThan(T0 + 1_000 + IDLE_ABANDON_MS)
  })

  it('deletes finished games after 30 days', () => {
    const finished = send(activeRoom(), 'white', { t: 'resign' }, { now: T0 + 5_000 }).state
    expect(alarm(finished, T0 + 5_000 + FINISHED_RETENTION_MS - 1).effects.deleteAll).toBe(false)
    expect(alarm(finished, T0 + 5_000 + FINISHED_RETENTION_MS).effects.deleteAll).toBe(true)
  })
})

describe('stats', () => {
  it('accepts one stats message per seat after the game, for metrics only', () => {
    const finished = send(activeRoom(), 'white', { t: 'resign' }).state
    const first = send(finished, 'black', { t: 'stats', rtt50: 40, rtt95: 90, reconnects: 1 })
    expect(first.effects.stats).toEqual({ seat: 'black', rtt50: 40, rtt95: 90, reconnects: 1 })
    expect(first.effects.events).toEqual([])
    expect(send(first.state, 'black', { t: 'stats', rtt50: 1, rtt95: 1, reconnects: 0 }).effects.stats).toBeNull()
    expect(send(activeRoom(), 'white', { t: 'stats', rtt50: 1, rtt95: 1, reconnects: 0 }).effects.stats).toBeNull()
  })
})

describe('storage', () => {
  it('restores from the stored row without replaying, and plays on identically', () => {
    const live = playMoves(activeRoom(), ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4'])
    const restored = fromRow(toRow(live), live.moves)
    expect(restored.currentFen).toBe(live.currentFen)
    expect(restored.engine?.keys).toEqual(live.engine?.keys)
    const a = send(live, 'black', { t: 'move', ply: 5, uci: 'g8f6', mid: 'samemid0001' })
    const b = send(restored, 'black', { t: 'move', ply: 5, uci: 'g8f6', mid: 'samemid0001' })
    expect(firstEvent(b)).toEqual(firstEvent(a))
  })

  it('still detects threefold repetition after a restore', () => {
    // Knights out and back twice: the start position recurs a third time on move 8.
    let state = playMoves(activeRoom(), ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1'])
    state = fromRow(toRow(state), state.moves)
    const third = send(state, 'black', { t: 'move', ply: 7, uci: 'f6g8', mid: mid() })
    expect(firstEvent(third)).toMatchObject({ result: { winner: null, reason: 'threefold' } })
  })

  it('keeps only the keys since the last irreversible move', () => {
    const state = playMoves(activeRoom(), ['g1f3', 'g8f6', 'e2e4'])
    expect(state.engine?.keys).toHaveLength(1)
  })

  it('restores finished games without parsing their final position', () => {
    let state = playMoves(activeRoom(), ['e2e4', 'd7d5', 'e1e2', 'e8d7', 'e2e3', 'd7d6', 'a2a3', 'd6e5', 'e3e5'])
    expect(state.status).toBe('finished')
    state = fromRow(toRow(state), state.moves)
    expect(state.engine).toBeNull()
    expect(state.result).toEqual({ winner: 'white', reason: 'royal-slaughter' })
    expect(() => fromRow({ ...toRow(activeRoom()), current_fen: 'garbage' }, [])).toThrow(/invalid/)
  })
})
