/**
 * The computer opponent's Web Worker: searches run here so the page never freezes while the
 * computer thinks (docs/AI.md). Messages are defined in src/app/computer.ts.
 */
import { ComputerPlayer } from '../ai/index.ts'
import type { WorkerRequest, WorkerResponse } from '../app/computer.ts'

/** The worker's global scope. The project's types describe a window, so it is typed here. */
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null
  postMessage(message: WorkerResponse): void
}

const player = new ComputerPlayer()
const now = (): number => performance.now()

scope.onmessage = (event) => {
  const message = event.data
  try {
    if (message.type === 'move') {
      scope.postMessage({ id: message.id, type: 'move', reply: player.chooseMove(message.request, now) })
    } else {
      scope.postMessage({ id: message.id, type: 'draw', accept: player.acceptsDraw(message.game, message.computer, now) })
    }
  } catch (error) {
    scope.postMessage({ id: message.id, type: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}
