import { createContext, useContext } from 'react'
import type { ComputerPlayer, GameSnapshot, LevelSettings, MoveReply, MoveRequest } from '../ai/index.ts'
import type { Color } from '../engine/index.ts'

/** Messages to and from the computer's Web Worker (src/workers/computer.worker.ts). */
export type WorkerRequest =
  | { readonly id: number; readonly type: 'move'; readonly request: MoveRequest }
  | { readonly id: number; readonly type: 'draw'; readonly game: GameSnapshot; readonly computer: Color }

export type WorkerResponse =
  | { readonly id: number; readonly type: 'move'; readonly reply: MoveReply }
  | { readonly id: number; readonly type: 'draw'; readonly accept: boolean }
  | { readonly id: number; readonly type: 'error'; readonly message: string }

/** The computer opponent as the play page sees it: asynchronous and cancellable. */
export interface ComputerClient {
  move(request: MoveRequest): Promise<MoveReply>
  acceptsDraw(game: GameSnapshot, computer: Color): Promise<boolean>
  /** Abandons whatever the computer is thinking about (undo, a new game). Its answer never arrives. */
  cancel(): void
  /** A reply never appears sooner than this, in milliseconds, so the computer seems to think. */
  readonly minimumThinkingTime: number
}

interface Pending {
  readonly resolve: (response: WorkerResponse) => void
  readonly reject: (error: Error) => void
}

/** A request before it is numbered (Omit applied to each member of the union). */
type Unnumbered<T> = T extends unknown ? Omit<T, 'id'> : never

/** Runs the computer in a Web Worker, so the page stays responsive while it thinks. */
export function workerClient(): ComputerClient {
  let worker: Worker | null = null
  let nextId = 1
  const pending = new Map<number, Pending>()

  function connect(): Worker {
    if (worker) return worker
    const created = new Worker(new URL('../workers/computer.worker.ts', import.meta.url), { type: 'module' })
    created.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const waiting = pending.get(event.data.id)
      if (!waiting) return
      pending.delete(event.data.id)
      if (event.data.type === 'error') waiting.reject(new Error(event.data.message))
      else waiting.resolve(event.data)
    }
    created.onerror = (event) => {
      for (const waiting of pending.values()) waiting.reject(new Error(event.message || 'The computer stopped working.'))
      pending.clear()
      created.terminate()
      worker = null
    }
    worker = created
    return created
  }

  function send(message: Unnumbered<WorkerRequest>): Promise<WorkerResponse> {
    return new Promise((resolve, reject) => {
      const id = nextId++
      pending.set(id, { resolve, reject })
      connect().postMessage({ ...message, id })
    })
  }

  return {
    async move(request) {
      const response = await send({ type: 'move', request })
      if (response.type !== 'move') throw new Error('Unexpected answer from the computer.')
      return response.reply
    },
    async acceptsDraw(game, computer) {
      const response = await send({ type: 'draw', game, computer })
      return response.type === 'draw' && response.accept
    },
    cancel() {
      if (pending.size === 0) return
      // The worker is busy with a search nobody wants: stop it. A fresh one starts on demand.
      pending.clear()
      worker?.terminate()
      worker = null
    },
    minimumThinkingTime: 450,
  }
}

/**
 * Runs the computer on the page itself: for tests, and for browsers without module workers (with a
 * small budget, since the page cannot respond while it thinks). The AI is loaded on first use, so
 * it never weighs down the page otherwise.
 */
export function inlineClient(overrides: Partial<LevelSettings> = {}, minimumThinkingTime = 0): ComputerClient {
  let player: Promise<ComputerPlayer> | null = null
  const load = (): Promise<ComputerPlayer> =>
    (player ??= import('../ai/index.ts').then(({ ComputerPlayer: Player }) => new Player()))
  const now = (): number => performance.now()
  let generation = 0
  return {
    async move(request) {
      const asked = generation
      const computer = await load()
      // Let the page show that the computer is thinking before the search blocks it.
      await new Promise((resolve) => setTimeout(resolve, 0))
      // A cancelled request never settles: its answer is no longer wanted.
      if (asked !== generation) return new Promise<MoveReply>(() => undefined)
      return computer.chooseMove(request, now, overrides)
    },
    async acceptsDraw(game, computer) {
      return (await load()).acceptsDraw(game, computer, now)
    },
    cancel() {
      generation++
    },
    minimumThinkingTime,
  }
}

let shared: ComputerClient | null = null

function sharedClient(): ComputerClient {
  shared ??= typeof Worker === 'undefined' ? inlineClient({ maxDepth: 3, timeLimit: 300 }, 450) : workerClient()
  return shared
}

/** Lets tests (or another host) provide the computer; the default runs it in a Web Worker. */
export const ComputerContext = createContext<ComputerClient | null>(null)

export function useComputer(): ComputerClient {
  return useContext(ComputerContext) ?? sharedClient()
}
