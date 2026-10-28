/**
 * An online game in the page (docs/ONLINE-PROTOCOL.md §7, §8). The board runs on the same reducer as
 * local play: the player's own moves appear at once and wait for the server's confirmation; the
 * opponent's moves arrive through the reducer's `computer-move` path; any doubt ends in a full `state`
 * from the server, which always wins. The server is the only authority.
 */
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { currentPosition, importGame, play, toMeanFen, toUci, type GameRecord, type PromotionType, type Square } from '../../engine/index.ts'
import {
  generateMid,
  opponentOf,
  type GameStatus,
  type NextGame,
  type Presence,
  type Result,
  type Seat,
  type ServerEvent,
  type StateEvent,
} from '../../online/index.ts'
import { createState, gameReducer, type GameState } from '../gameState.ts'
import { socketUrl } from './api.ts'
import { OnlineConnection, type CloseReason, type ConnectionStatus } from './connection.ts'

const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n))

export interface OnlineMeta {
  readonly status: GameStatus | null
  readonly result: Result | null
  readonly drawOffer: Seat | null
  readonly rematch: { readonly offeredBy: Seat | null; readonly next: NextGame | null }
  readonly presence: Presence | null
  readonly claimableAt: number | null
  /** Server time minus local time, for countdowns. */
  readonly clockOffset: number
}

const EMPTY_META: OnlineMeta = {
  status: null,
  result: null,
  drawOffer: null,
  rematch: { offeredBy: null, next: null },
  presence: null,
  claimableAt: null,
  clockOffset: 0,
}

interface Pending {
  readonly ply: number
  readonly uci: string
  readonly mid: string
}

export interface OnlineGame {
  readonly state: GameState
  readonly meta: OnlineMeta
  readonly connection: ConnectionStatus
  readonly closeReason: CloseReason | null
  /** When the current spell of reconnecting began (local time), or null while connected. */
  readonly reconnectingSince: number | null
  /** True while the player's own move waits for the server. */
  readonly pending: boolean
  readonly you: Seat
  readonly onSquare: (square: Square) => void
  readonly onDeselect: () => void
  readonly onPromote: (piece: PromotionType) => void
  readonly onCancelPromotion: () => void
  readonly offerDraw: () => void
  readonly answerDraw: (accept: boolean) => void
  readonly resign: () => void
  readonly abort: () => void
  readonly claim: (outcome: 'win' | 'draw') => void
  readonly offerRematch: () => void
  readonly answerRematch: (accept: boolean) => void
  readonly retryNow: () => void
}

function gameFrom(event: StateEvent): GameRecord | null {
  const loaded = importGame(JSON.stringify({ format: 'mean-chess-game', version: 1, rules: event.rules, start: event.start, moves: event.moves, result: null }))
  return loaded.ok ? loaded.game : null
}

const uciOf = (game: GameRecord, index: number): string | undefined => {
  const move = game.moves[index]
  return move ? toUci(move) : undefined
}

export interface OnlineGameOptions {
  readonly gameId: string
  readonly token: string
  readonly you: Seat
  /** Injected for tests. */
  readonly createSocket?: (url: string) => WebSocket
}

export function useOnlineGame({ gameId, token, you, createSocket }: OnlineGameOptions): OnlineGame {
  const [state, dispatch] = useReducer(gameReducer, undefined, () =>
    createState(importGameOrNew(), { opponent: { kind: 'computer', level: 'mean', human: you }, flipped: you === 'black' }),
  )
  const [meta, setMeta] = useState<OnlineMeta>(EMPTY_META)
  const [connection, setConnection] = useState<ConnectionStatus>('connecting')
  const [closeReason, setCloseReason] = useState<CloseReason | null>(null)
  const [reconnectingSince, setReconnectingSince] = useState<number | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)

  const connectionRef = useRef<OnlineConnection | null>(null)
  const gameRef = useRef(state.game)
  const pendingRef = useRef<Pending | null>(null)
  useEffect(() => {
    gameRef.current = state.game
    pendingRef.current = pending
  }, [state.game, pending])
  /** The moves the server has confirmed, and the last revision applied. */
  const serverMoves = useRef<string[]>([])
  const serverGame = useRef<GameRecord | null>(null)
  const lastRev = useRef(-1)

  const send = useCallback((message: Parameters<OnlineConnection['send']>[0]) => connectionRef.current?.send(message) ?? false, [])

  const handle = useCallback(
    (event: ServerEvent) => {
      switch (event.t) {
        case 'state': {
          const game = gameFrom(event)
          if (!game) {
            send({ t: 'sync' })
            return
          }
          lastRev.current = event.rev
          serverMoves.current = [...event.moves]
          serverGame.current = game
          setMeta({
            status: event.status,
            result: event.result,
            drawOffer: event.drawOffer,
            rematch: event.rematch,
            presence: event.presence,
            claimableAt: event.claimableAt,
            clockOffset: event.serverTime - Date.now(),
          })
          // Reconcile a move that was in flight (§8.2).
          const waiting = pendingRef.current
          const local = gameRef.current
          if (waiting) {
            if (event.moves[waiting.ply] === waiting.uci) setPending(null)
            else if (event.moves.length === waiting.ply && event.status === 'active' && currentPosition(game).sideToMove === you) {
              send({ t: 'move', ply: waiting.ply, uci: waiting.uci, mid: waiting.mid })
              return // keep the local board, which already shows the move
            } else setPending(null)
          }
          const same = local.moves.length === event.moves.length && event.moves.every((uci, i) => uciOf(local, i) === uci)
          if (!same) dispatch({ type: 'load', game, scenario: null, keepOpponent: true })
          return
        }
        case 'moved': {
          if (event.rev <= lastRev.current) {
            if (pendingRef.current?.mid === event.mid) setPending(null)
            return
          }
          if (event.rev > lastRev.current + 1 || event.ply !== serverMoves.current.length + 1) {
            send({ t: 'sync' })
            return
          }
          lastRev.current = event.rev
          // Desync check: the server's position after the move must match our engine's.
          const before = serverGame.current
          let after: GameRecord | null
          try {
            after = before ? play(before, event.uci) : null
          } catch {
            after = null
          }
          if (!after || toMeanFen(currentPosition(after)) !== event.fen) {
            send({ t: 'sync' })
            return
          }
          serverMoves.current = [...serverMoves.current, event.uci]
          serverGame.current = after
          if (event.by === you) {
            if (pendingRef.current?.mid === event.mid) setPending(null)
          } else {
            dispatch({ type: 'computer-move', uci: event.uci, ply: event.ply - 1 })
          }
          setMeta((m) => ({
            ...m,
            drawOffer: event.result ? null : m.drawOffer,
            result: event.result ?? m.result,
            status: event.result ? 'finished' : m.status,
          }))
          return
        }
        case 'rejected': {
          if (event.of === 'move' && pendingRef.current && (!event.mid || event.mid === pendingRef.current.mid)) {
            setPending(null)
            if (serverGame.current) dispatch({ type: 'load', game: serverGame.current, scenario: null, keepOpponent: true })
          }
          return
        }
        case 'presence':
        case 'draw':
        case 'ended':
        case 'rematch': {
          if (event.rev <= lastRev.current) return
          if (event.rev > lastRev.current + 1) {
            send({ t: 'sync' })
            return
          }
          lastRev.current = event.rev
          setMeta((m) => {
            if (event.t === 'presence') {
              const claimSince = event.absentSince[opponentOf(you)]
              return {
                ...m,
                presence: { connected: event.connected, absentSince: event.absentSince },
                claimableAt: m.status === 'active' && !event.connected[opponentOf(you)] && claimSince !== null ? claimSince + 120_000 : null,
                clockOffset: event.serverTime - Date.now(),
              }
            }
            if (event.t === 'draw') return { ...m, drawOffer: event.offeredBy }
            if (event.t === 'ended') return { ...m, result: event.result, status: 'finished', drawOffer: null, claimableAt: null }
            return { ...m, rematch: { offeredBy: event.offeredBy, next: event.next ?? m.rematch.next } }
          })
          return
        }
        case 'error':
          return
      }
    },
    [send, you],
  )

  useEffect(() => {
    const connectionInstance = new OnlineConnection(
      { url: socketUrl(gameId), token, ...(createSocket ? { createSocket } : {}) },
      {
        onEvent: (event) => handle(event),
        onStatus: (status, reason) => {
          setConnection(status)
          setCloseReason(status === 'closed' ? (reason ?? null) : null)
          setReconnectingSince((since) => (status === 'reconnecting' ? (since ?? Date.now()) : null))
        },
      },
    )
    connectionRef.current = connectionInstance
    return () => {
      connectionInstance.stop()
      connectionRef.current = null
    }
  }, [gameId, token, createSocket, handle])

  // A new local move by the player: send it, once (§6).
  useEffect(() => {
    const game = state.game
    const confirmed = serverMoves.current.length
    if (pending || meta.status !== 'active' || game.moves.length !== confirmed + 1) return
    const move = game.moves[confirmed]
    const uci = uciOf(game, confirmed)
    if (!move || !uci || move.piece.color !== you) return
    const next: Pending = { ply: confirmed, uci, mid: generateMid(randomBytes) }
    pendingRef.current = next
    setPending(next)
    send({ t: 'move', ...next })
  }, [state.game, pending, meta.status, send, you])

  const canMove = meta.status === 'active' && !pending && connection === 'open'
  return {
    state,
    meta,
    connection,
    closeReason,
    reconnectingSince,
    pending: pending !== null,
    you,
    onSquare: (square) => {
      if (canMove) dispatch({ type: 'square', square })
    },
    onDeselect: () => dispatch({ type: 'deselect' }),
    onPromote: (piece) => dispatch({ type: 'promote', piece }),
    onCancelPromotion: () => dispatch({ type: 'cancel-promotion' }),
    offerDraw: () => send({ t: 'draw-offer' }),
    answerDraw: (accept) => send({ t: 'draw-answer', accept }),
    resign: () => send({ t: 'resign' }),
    abort: () => send({ t: 'abort' }),
    claim: (outcome) => send({ t: 'claim', outcome }),
    offerRematch: () => send({ t: 'rematch-offer' }),
    answerRematch: (accept) => send({ t: 'rematch-answer', accept }),
    retryNow: () => connectionRef.current?.retryNow(),
  }
}

function importGameOrNew(): GameRecord {
  const loaded = importGame(JSON.stringify({ format: 'mean-chess-game', version: 1, rules: '0.1', start: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', moves: [], result: null }))
  if (!loaded.ok) throw new Error(loaded.error)
  return loaded.game
}
