/**
 * Precomputed board geometry for the search, as flat typed arrays. The same facts as the engine's
 * tables (src/engine/tables.ts), laid out for speed.
 */

const onBoard = (file: number, rank: number): boolean => file >= 0 && file < 8 && rank >= 0 && rank < 8

/** The 8 directions as [Δfile, Δrank]: even indices orthogonal, odd indices diagonal (as in the engine). */
const DIRECTIONS: readonly (readonly [number, number])[] = [
  [0, 1],
  [1, 1],
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, -1],
  [-1, 0],
  [-1, 1],
]

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

/** A list of squares per square: LIST[START[sq] .. START[sq + 1]). */
interface SquareLists {
  readonly start: Int16Array
  readonly list: Int8Array
}

function buildLists(deltas: readonly (readonly [number, number])[]): SquareLists {
  const start = new Int16Array(65)
  const items: number[] = []
  for (let sq = 0; sq < 64; sq++) {
    start[sq] = items.length
    for (const [df, dr] of deltas) {
      const file = (sq & 7) + df
      const rank = (sq >> 3) + dr
      if (onBoard(file, rank)) items.push(rank * 8 + file)
    }
  }
  start[64] = items.length
  return { start, list: Int8Array.from(items) }
}

export const KNIGHT_LISTS = buildLists(KNIGHT_JUMPS)
export const KING_LISTS = buildLists(DIRECTIONS)

/** Squares a pawn of each colour attacks from each square: index 0 white, 1 black. */
export const PAWN_ATTACK_LISTS: readonly SquareLists[] = [
  buildLists([
    [-1, 1],
    [1, 1],
  ]),
  buildLists([
    [-1, -1],
    [1, -1],
  ]),
]

/** Rays: squares outward from sq in direction d are RAY_SQUARES[RAY_START[sq * 8 + d] ...] for RAY_LENGTH[sq * 8 + d] steps. */
export const RAY_START = new Int16Array(64 * 8)
export const RAY_LENGTH = new Int8Array(64 * 8)
export const RAY_SQUARES = (() => {
  const items: number[] = []
  for (let sq = 0; sq < 64; sq++) {
    for (let d = 0; d < 8; d++) {
      const [df, dr] = DIRECTIONS[d] ?? [0, 0]
      RAY_START[sq * 8 + d] = items.length
      let length = 0
      for (let file = (sq & 7) + df, rank = (sq >> 3) + dr; onBoard(file, rank); file += df, rank += dr) {
        items.push(rank * 8 + file)
        length++
      }
      RAY_LENGTH[sq * 8 + d] = length
    }
  }
  return Int8Array.from(items)
})()

/**
 * Royal geometry (Rules §2.2): ROYAL_MIDPOINT[a * 64 + b] is the square between a and b when they
 * stand exactly two apart on a rank, file or diagonal, and -1 otherwise.
 */
export const ROYAL_MIDPOINT = (() => {
  const table = new Int8Array(64 * 64).fill(-1)
  for (let sq = 0; sq < 64; sq++) {
    for (const [df, dr] of DIRECTIONS) {
      const file = (sq & 7) + 2 * df
      const rank = (sq >> 3) + 2 * dr
      if (onBoard(file, rank)) table[sq * 64 + rank * 8 + file] = ((sq >> 3) + dr) * 8 + (sq & 7) + df
    }
  }
  return table
})()

/** King-move distance. */
export const chebyshev = (a: number, b: number): number =>
  Math.max(Math.abs((a & 7) - (b & 7)), Math.abs((a >> 3) - (b >> 3)))

/** Castling-rights bits. */
export const WHITE_KINGSIDE = 1
export const WHITE_QUEENSIDE = 2
export const BLACK_KINGSIDE = 4
export const BLACK_QUEENSIDE = 8

/** Rights that survive a move touching each square: corners lose their side (Rules §2.1, castlingAfter). */
export const CASTLING_KEEP = (() => {
  const keep = new Uint8Array(64).fill(15)
  keep[0] = 15 & ~WHITE_QUEENSIDE
  keep[7] = 15 & ~WHITE_KINGSIDE
  keep[56] = 15 & ~BLACK_QUEENSIDE
  keep[63] = 15 & ~BLACK_KINGSIDE
  return keep
})()
