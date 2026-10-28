import type { GameRecord } from '../../engine/index.ts'
import type { Seat } from '../../online/index.ts'
import { loadSkill, saveGameLocally, saveOpponent, savePreferences } from '../storage.ts'

/** How long the server may be gone mid-game before the page offers the computer (ONLINE-TEST-PLAN §6.9). */
export const OFFER_COMPUTER_AFTER_MS = 30_000

/**
 * "Finish this position against the computer": the local board picks up exactly this game, against
 * the computer at the player's Auto level, from the player's side. It replaces the saved local game.
 */
export function finishAgainstComputer(game: GameRecord, you: Seat): void {
  saveGameLocally(game)
  saveOpponent({ kind: 'computer', level: loadSkill().level, human: you, auto: true })
  savePreferences({ flipped: you === 'black' })
  window.location.assign('/play/')
}
