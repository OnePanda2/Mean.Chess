import { LEVELS, isLevel, type Level } from '../ai/levels.ts'
import type { Color, Outcome } from '../engine/index.ts'

/**
 * The Auto difficulty (D-50): a staircase over the computer's three levels, remembered per browser.
 * It starts at Nice. Two wins in a row at the current level or above step it up; two losses in a row
 * at the current level or below step it down; a draw resets the count.
 */
export interface Skill {
  readonly level: Level
  /** Wins in a row (positive) or losses in a row (negative) towards the next step. */
  readonly streak: number
}

export const NEW_SKILL: Skill = { level: 'nice', streak: 0 }

export type GameResult = 'win' | 'loss' | 'draw'

const rank = (level: Level): number => LEVELS.indexOf(level)

/** The level `steps` away from `level`, held within Nice to Ruthless. */
function shift(level: Level, steps: number): Level {
  const index = Math.min(LEVELS.length - 1, Math.max(0, rank(level) + steps))
  return LEVELS[index] ?? level
}

/** The skill after a finished game against the computer at level `played`. */
export function recordResult(skill: Skill, played: Level, result: GameResult): Skill {
  if (result === 'draw') return { ...skill, streak: 0 }
  if (result === 'win') {
    // Beating an easier level than the current one says nothing new.
    if (rank(played) < rank(skill.level)) return skill
    const streak = Math.max(skill.streak, 0) + 1
    return streak >= 2 ? { level: shift(skill.level, 1), streak: 0 } : { ...skill, streak }
  }
  // Losing to a harder level than the current one is expected.
  if (rank(played) > rank(skill.level)) return skill
  const streak = Math.min(skill.streak, 0) - 1
  return streak <= -2 ? { level: shift(skill.level, -1), streak: 0 } : { ...skill, streak }
}

/** The player's result in a finished game, or null while the game goes on. Resigning is a loss. */
export function resultFor(outcome: Outcome | null, player: Color): GameResult | null {
  if (!outcome) return null
  if (outcome.winner === null) return 'draw'
  return outcome.winner === player ? 'win' : 'loss'
}

export function isSkill(value: unknown): value is Skill {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return isLevel(record.level) && Number.isInteger(record.streak) && Math.abs(record.streak as number) < 2
}
