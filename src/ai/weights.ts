import { BISHOP, KING, KNIGHT, PAWN, PROMOTED_QUEEN, QUEEN, ROOK } from './constants.ts'

/**
 * Evaluation weights in centipawns: material and piece-square tables for the middlegame (mg) and
 * endgame (eg), blended by game phase (docs/AI.md). Tables are written from White's side with rank
 * 8 at the top, as you would look at a board; Black uses the mirrored square. The piece tables follow
 * Tomasz Michniewski's Simplified Evaluation Function (Chess Programming Wiki); the pawn tables are
 * our own.
 */

/** Material by piece type. The original queen is worth a little more than a promoted one. */
export const MATERIAL_MG: readonly number[] = [0, 100, 320, 330, 500, 960, 940, 0]
export const MATERIAL_EG: readonly number[] = [0, 120, 300, 320, 530, 950, 930, 0]

/** Contribution to the game phase (24 = all minor and major pieces on the board). */
export const PHASE_WEIGHT: readonly number[] = [0, 0, 1, 1, 2, 4, 4, 0]
export const MAX_PHASE = 24

// prettier-ignore
const PAWN_MG = [
    0,   0,   0,   0,   0,   0,   0,   0,
   60,  60,  60,  60,  60,  60,  60,  60,
   20,  20,  28,  36,  36,  28,  20,  20,
    6,   6,  12,  24,  24,  12,   6,   6,
    0,   0,   6,  20,  20,   6,   0,   0,
    4,  -4,  -6,   4,   4,  -6,  -4,   4,
    4,   8,   8, -18, -18,   8,   8,   4,
    0,   0,   0,   0,   0,   0,   0,   0,
]
// prettier-ignore
const PAWN_EG = [
    0,   0,   0,   0,   0,   0,   0,   0,
   90,  90,  90,  90,  90,  90,  90,  90,
   50,  50,  50,  50,  50,  50,  50,  50,
   28,  28,  28,  28,  28,  28,  28,  28,
   14,  14,  14,  14,  14,  14,  14,  14,
    6,   6,   6,   6,   6,   6,   6,   6,
    0,   0,   0,   0,   0,   0,   0,   0,
    0,   0,   0,   0,   0,   0,   0,   0,
]
// prettier-ignore
const KNIGHT_ALL = [
  -50, -40, -30, -30, -30, -30, -40, -50,
  -40, -20,   0,   0,   0,   0, -20, -40,
  -30,   0,  10,  15,  15,  10,   0, -30,
  -30,   5,  15,  20,  20,  15,   5, -30,
  -30,   0,  15,  20,  20,  15,   0, -30,
  -30,   5,  10,  15,  15,  10,   5, -30,
  -40, -20,   0,   5,   5,   0, -20, -40,
  -50, -40, -30, -30, -30, -30, -40, -50,
]
// prettier-ignore
const BISHOP_ALL = [
  -20, -10, -10, -10, -10, -10, -10, -20,
  -10,   0,   0,   0,   0,   0,   0, -10,
  -10,   0,   5,  10,  10,   5,   0, -10,
  -10,   5,   5,  10,  10,   5,   5, -10,
  -10,   0,  10,  10,  10,  10,   0, -10,
  -10,  10,  10,  10,  10,  10,  10, -10,
  -10,   5,   0,   0,   0,   0,   5, -10,
  -20, -10, -10, -10, -10, -10, -10, -20,
]
// prettier-ignore
const ROOK_ALL = [
    0,   0,   0,   0,   0,   0,   0,   0,
    5,  10,  10,  10,  10,  10,  10,   5,
   -5,   0,   0,   0,   0,   0,   0,  -5,
   -5,   0,   0,   0,   0,   0,   0,  -5,
   -5,   0,   0,   0,   0,   0,   0,  -5,
   -5,   0,   0,   0,   0,   0,   0,  -5,
   -5,   0,   0,   0,   0,   0,   0,  -5,
    0,   0,   0,   5,   5,   0,   0,   0,
]
// prettier-ignore
const QUEEN_ALL = [
  -20, -10, -10,  -5,  -5, -10, -10, -20,
  -10,   0,   0,   0,   0,   0,   0, -10,
  -10,   0,   5,   5,   5,   5,   0, -10,
   -5,   0,   5,   5,   5,   5,   0,  -5,
    0,   0,   5,   5,   5,   5,   0,  -5,
  -10,   5,   5,   5,   5,   5,   0, -10,
  -10,   0,   5,   0,   0,   0,   0, -10,
  -20, -10, -10,  -5,  -5, -10, -10, -20,
]
// prettier-ignore
const KING_MG = [
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -20, -30, -30, -40, -40, -30, -30, -20,
  -10, -20, -20, -20, -20, -20, -20, -10,
   20,  20,   0,   0,   0,   0,  20,  20,
   20,  30,  10,   0,   0,  10,  30,  20,
]
// prettier-ignore
const KING_EG = [
  -50, -40, -30, -20, -20, -30, -40, -50,
  -30, -20, -10,   0,   0, -10, -20, -30,
  -30, -10,  20,  30,  30,  20, -10, -30,
  -30, -10,  30,  40,  40,  30, -10, -30,
  -30, -10,  30,  40,  40,  30, -10, -30,
  -30, -10,  20,  30,  30,  20, -10, -30,
  -30, -30,   0,   0,   0,   0, -30, -30,
  -50, -30, -30, -30, -30, -30, -30, -50,
]

const ZERO: readonly number[] = new Array<number>(64).fill(0)

/** Visual order (rank 8 first) → square order (a1 = 0). */
const bySquare = (visual: readonly number[]): readonly number[] =>
  Array.from({ length: 64 }, (_, sq) => visual[(7 - (sq >> 3)) * 8 + (sq & 7)] ?? 0)

const TABLES_MG: readonly (readonly number[])[] = [
  ZERO,
  bySquare(PAWN_MG),
  bySquare(KNIGHT_ALL),
  bySquare(BISHOP_ALL),
  bySquare(ROOK_ALL),
  bySquare(QUEEN_ALL),
  bySquare(QUEEN_ALL),
  bySquare(KING_MG),
]
const TABLES_EG: readonly (readonly number[])[] = [
  ZERO,
  bySquare(PAWN_EG),
  bySquare(KNIGHT_ALL),
  bySquare(BISHOP_ALL),
  bySquare(ROOK_ALL),
  bySquare(QUEEN_ALL),
  bySquare(QUEEN_ALL),
  bySquare(KING_EG),
]

/**
 * Material plus placement for every piece code (0–15) on every square, from White's point of view:
 * positive for White's pieces, negative for Black's. Indexed by pieceCode * 64 + square.
 */
function scoreTable(material: readonly number[], tables: readonly (readonly number[])[]): Int16Array {
  const table = new Int16Array(16 * 64)
  for (const type of [PAWN, KNIGHT, BISHOP, ROOK, QUEEN, PROMOTED_QUEEN, KING]) {
    const value = material[type] ?? 0
    const placement = tables[type] ?? ZERO
    for (let sq = 0; sq < 64; sq++) {
      table[type * 64 + sq] = value + (placement[sq] ?? 0)
      table[(8 | type) * 64 + sq] = -(value + (placement[sq ^ 56] ?? 0))
    }
  }
  return table
}

export const SCORE_MG = scoreTable(MATERIAL_MG, TABLES_MG)
export const SCORE_EG = scoreTable(MATERIAL_EG, TABLES_EG)
