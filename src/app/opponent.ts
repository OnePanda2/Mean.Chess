import { isLevel, type Level } from '../ai/levels.ts'
import type { Color } from '../engine/index.ts'

/** Who the player faces: a friend on the same device, or the computer (docs/AI.md). */
export type Opponent =
  | { readonly kind: 'friend' }
  | { readonly kind: 'computer'; readonly level: Level; readonly human: Color }

export const FRIEND: Opponent = { kind: 'friend' }

/** The colour the computer plays, or null in a game between friends. */
export const computerColor = (opponent: Opponent): Color | null =>
  opponent.kind === 'computer' ? (opponent.human === 'white' ? 'black' : 'white') : null

/** How the levels are presented. The names keep the game's tone; the descriptions keep it clear. */
export const LEVEL_TEXT: Readonly<Record<Level, { readonly name: string; readonly description: string }>> = {
  nice: { name: 'Nice', description: 'Easy. Plays for fun and sometimes misses the Kill Zone.' },
  mean: { name: 'Mean', description: 'Medium. Punishes your mistakes.' },
  ruthless: { name: 'Ruthless', description: 'Hard. Thinks deeply and shows no mercy.' },
}

export function isOpponent(value: unknown): value is Opponent {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  if (record.kind === 'friend') return true
  return record.kind === 'computer' && isLevel(record.level) && (record.human === 'white' || record.human === 'black')
}
