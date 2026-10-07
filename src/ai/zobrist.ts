/**
 * Zobrist keys for position hashing (transposition table and repetition). Each key is 64 bits held
 * as two 32-bit halves, generated from a fixed seed so every run hashes identically.
 */

/** mulberry32: a small, fast, seeded 32-bit generator. Also used for the search's randomness. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const next32 = (() => {
  const random = seededRandom(0x4d65616e) // "Mean"
  return (): number => Math.floor(random() * 4294967296) | 0
})()

const keys = (count: number): Int32Array => Int32Array.from({ length: count }, next32)

/** Indexed by pieceCode * 64 + square (piece codes 0–15; 0 and 8 unused). */
export const PIECE_LO = keys(16 * 64)
export const PIECE_HI = keys(16 * 64)
export const SIDE_LO = next32()
export const SIDE_HI = next32()
/** Indexed by the 4-bit castling mask. */
export const CASTLING_LO = keys(16)
export const CASTLING_HI = keys(16)
/** Indexed by the en-passant file. */
export const EN_PASSANT_LO = keys(8)
export const EN_PASSANT_HI = keys(8)
