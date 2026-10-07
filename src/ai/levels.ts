/** The computer opponent's difficulty levels (docs/AI.md). */
export type Level = 'nice' | 'mean' | 'ruthless'

export const LEVELS: readonly Level[] = ['nice', 'mean', 'ruthless']

export interface LevelSettings {
  /** Deepest iteration of the search, in plies. */
  readonly maxDepth: number
  /** Thinking time in milliseconds. */
  readonly timeLimit: number
  /** Picks at random among moves within this many centipawns of the best. */
  readonly variety: number
  /** Up to this much random error, in centipawns, in each move's score. */
  readonly noise: number
  /** Chance, each move, of not seeing royal moves at all, like a beginner missing the Kill Zone. */
  readonly blindChance: number
}

export const LEVEL_SETTINGS: Readonly<Record<Level, LevelSettings>> = {
  nice: { maxDepth: 2, timeLimit: 500, variety: 50, noise: 120, blindChance: 0.35 },
  mean: { maxDepth: 4, timeLimit: 1_200, variety: 12, noise: 20, blindChance: 0 },
  ruthless: { maxDepth: 40, timeLimit: 2_000, variety: 0, noise: 0, blindChance: 0 },
}

export const isLevel = (value: unknown): value is Level => LEVELS.some((level) => level === value)
