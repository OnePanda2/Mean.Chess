import { fileOf, isOnBoard, rankOf, squareAt } from './squares.ts'
import type { Color, Square } from './types.ts'

/** The 8 directions as [Δfile, Δrank]. Even indices are orthogonal, odd indices diagonal. */
export const DIRECTIONS: readonly (readonly [number, number])[] = [
  [0, 1],
  [1, 1],
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, -1],
  [-1, 0],
  [-1, 1],
]
export const ORTHOGONAL_DIRECTIONS: readonly number[] = [0, 2, 4, 6]
export const DIAGONAL_DIRECTIONS: readonly number[] = [1, 3, 5, 7]
export const ALL_DIRECTIONS: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7]
export const isDiagonal = (direction: number): boolean => direction % 2 === 1

const KNIGHT_JUMPS: readonly (readonly [number, number])[] = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
]

const EMPTY: readonly Square[] = []

function perSquare<T>(build: (sq: Square) => T): readonly T[] {
  return Array.from({ length: 64 }, (_, sq) => build(sq))
}

function offsets(sq: Square, deltas: readonly (readonly [number, number])[]): readonly Square[] {
  const result: Square[] = []
  for (const [df, dr] of deltas) {
    const file = fileOf(sq) + df
    const rank = rankOf(sq) + dr
    if (isOnBoard(file, rank)) result.push(squareAt(file, rank))
  }
  return result
}

const KNIGHT = perSquare((sq) => offsets(sq, KNIGHT_JUMPS))
const KING = perSquare((sq) => offsets(sq, DIRECTIONS))
const RAYS = perSquare((sq) =>
  DIRECTIONS.map(([df, dr]) => {
    const ray: Square[] = []
    for (let file = fileOf(sq) + df, rank = rankOf(sq) + dr; isOnBoard(file, rank); file += df, rank += dr) {
      ray.push(squareAt(file, rank))
    }
    return ray
  }),
)
const PAWN_ATTACKS: Readonly<Record<Color, readonly (readonly Square[])[]>> = {
  white: perSquare((sq) => offsets(sq, [[-1, 1], [1, 1]])),
  black: perSquare((sq) => offsets(sq, [[-1, -1], [1, -1]])),
}

/** A square at royal distance (Rules §2.2) and the midpoint between it and the origin. */
export interface RoyalLine {
  readonly target: Square
  readonly midpoint: Square
}
const ROYAL = perSquare((sq) =>
  DIRECTIONS.flatMap(([df, dr]): RoyalLine[] => {
    const file = fileOf(sq) + 2 * df
    const rank = rankOf(sq) + 2 * dr
    if (!isOnBoard(file, rank)) return []
    return [{ target: squareAt(file, rank), midpoint: squareAt(fileOf(sq) + df, rankOf(sq) + dr) }]
  }),
)

export const knightTargets = (sq: Square): readonly Square[] => KNIGHT[sq] ?? EMPTY
export const kingTargets = (sq: Square): readonly Square[] => KING[sq] ?? EMPTY
/** Squares from `sq` outward in `direction`, nearest first. */
export const ray = (sq: Square, direction: number): readonly Square[] => RAYS[sq]?.[direction] ?? EMPTY
/** Squares a pawn of `color` standing on `sq` attacks. */
export const pawnAttacks = (color: Color, sq: Square): readonly Square[] => PAWN_ATTACKS[color][sq] ?? EMPTY
/** Every square at royal distance from `sq`, with its midpoint (up to 8). */
export const royalLines = (sq: Square): readonly RoyalLine[] => ROYAL[sq] ?? []
