import { LESSONS } from './lessons.ts'

const PROGRESS_KEY = 'mean-chess:tutorial:v1'

/** Where the player is in the tutorial. Browser storage only: losing it just means starting over. */
export interface TutorialProgress {
  /** The lesson to come back to (an index into LESSONS). */
  readonly lesson: number
  /** The player has reached the end at least once. */
  readonly finished: boolean
}

export const NO_PROGRESS: TutorialProgress = { lesson: 0, finished: false }

export function loadTutorialProgress(): TutorialProgress {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(PROGRESS_KEY) ?? 'null')
    if (typeof parsed !== 'object' || parsed === null) return NO_PROGRESS
    const record = parsed as Record<string, unknown>
    const lesson = typeof record.lesson === 'number' && Number.isInteger(record.lesson) ? record.lesson : 0
    return {
      lesson: Math.min(Math.max(lesson, 0), LESSONS.length - 1),
      finished: record.finished === true,
    }
  } catch {
    return NO_PROGRESS
  }
}

export function saveTutorialProgress(progress: TutorialProgress): void {
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress))
  } catch {
    // Ignore: the tutorial simply starts from the beginning next time.
  }
}
