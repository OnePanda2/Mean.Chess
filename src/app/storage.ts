import { exportGame, importGame, type GameRecord } from '../engine/index.ts'

const GAME_KEY = 'mean-chess:game:v1'
const PREFERENCES_KEY = 'mean-chess:preferences:v1'

export interface Preferences {
  readonly flipped: boolean
  readonly showKillZones: boolean
}

const DEFAULT_PREFERENCES: Preferences = { flipped: false, showKillZones: false }

/**
 * Browser storage is a convenience only: it can be missing or throw (private windows, blocked
 * site data). Every access is wrapped, and a saved game is replayed and validated before use.
 */
export function loadSavedGame(): GameRecord | null {
  try {
    const text = window.localStorage.getItem(GAME_KEY)
    if (!text) return null
    const loaded = importGame(text)
    return loaded.ok ? loaded.game : null
  } catch {
    return null
  }
}

export function saveGameLocally(game: GameRecord): void {
  try {
    window.localStorage.setItem(GAME_KEY, exportGame(game))
  } catch {
    // Storage unavailable: the game simply is not remembered.
  }
}

export function loadPreferences(): Preferences {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(PREFERENCES_KEY) ?? '{}')
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_PREFERENCES
    const record = parsed as Record<string, unknown>
    return {
      flipped: record.flipped === true,
      showKillZones: record.showKillZones === true,
    }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

export function savePreferences(preferences: Preferences): void {
  try {
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences))
  } catch {
    // Ignore: preferences are optional.
  }
}
