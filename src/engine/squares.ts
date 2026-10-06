import type { Color, Square } from './types.ts'

export const FILE_NAMES = 'abcdefgh'

export const fileOf = (sq: Square): number => sq & 7
export const rankOf = (sq: Square): number => sq >> 3
export const squareAt = (file: number, rank: number): Square => rank * 8 + file
export const isOnBoard = (file: number, rank: number): boolean =>
  file >= 0 && file < 8 && rank >= 0 && rank < 8

/** 28 → 'e4'. */
export function squareName(sq: Square): string {
  return `${FILE_NAMES.charAt(fileOf(sq))}${rankOf(sq) + 1}`
}

/** 'e4' → 28; anything that is not a square name → null. */
export function parseSquare(name: string): Square | null {
  if (name.length !== 2) return null
  const file = FILE_NAMES.indexOf(name.charAt(0))
  const rank = name.charCodeAt(1) - '1'.charCodeAt(0)
  return file >= 0 && rank >= 0 && rank < 8 ? squareAt(file, rank) : null
}

/** King-move distance between two squares. */
export function chebyshev(a: Square, b: Square): number {
  return Math.max(Math.abs(fileOf(a) - fileOf(b)), Math.abs(rankOf(a) - rankOf(b)))
}

export const opposite = (color: Color): Color => (color === 'white' ? 'black' : 'white')
