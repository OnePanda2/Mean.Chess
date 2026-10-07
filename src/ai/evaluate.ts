import type { SearchBoard } from './board.ts'
import { BISHOP, BLACK, KING, PAWN, ROOK, WHITE } from './constants.ts'
import { MATERIAL_EG, MAX_PHASE } from './weights.ts'

/** Bonus for a passed pawn by how far it has advanced (relative rank 0–7). */
const PASSED_MG: readonly number[] = [0, 5, 10, 18, 30, 50, 80, 0]
const PASSED_EG: readonly number[] = [0, 10, 18, 32, 55, 90, 140, 0]
const DOUBLED = 12
const ISOLATED = 10
const BISHOP_PAIR = 30
const ROOK_OPEN_FILE = 20
const ROOK_SEMI_OPEN_FILE = 10
const TEMPO = 12

/** Distance from the centre (0 in the middle four squares, 6 in a corner). */
const CENTER_DISTANCE = Int8Array.from({ length: 64 }, (_, sq) => {
  const file = sq & 7
  const rank = sq >> 3
  return Math.max(3 - file, file - 4) + Math.max(3 - rank, rank - 4)
})

/** Pawns per file, and per file the highest and lowest rank each side's pawns stand on. */
const whitePawnFiles = new Int8Array(8)
const blackPawnFiles = new Int8Array(8)
/** Highest white pawn rank (-1 none) and lowest (8 none). */
const whiteFront = new Int8Array(8)
const whiteRear = new Int8Array(8)
/** Lowest black pawn rank, its most advanced (8 none), and highest (-1 none). */
const blackFront = new Int8Array(8)
const blackRear = new Int8Array(8)

/**
 * Static evaluation in centipawns from the side to move's point of view (docs/AI.md): material
 * and placement (kept incrementally by the board, blended by game phase), pawn structure, the
 * bishop pair, rooks on open files, and a push towards the corner when one side is winning an
 * endgame. Mean Chess has no insufficient-material draws, so a lone minor piece is still worth
 * playing for (Rules §2.6).
 */
export function evaluate(board: SearchBoard): number {
  const s = board.squares
  const phase = Math.min(board.phase, MAX_PHASE)
  let mg = board.mg
  let eg = board.eg

  whitePawnFiles.fill(0)
  blackPawnFiles.fill(0)
  whiteFront.fill(-1)
  whiteRear.fill(8)
  blackFront.fill(8)
  blackRear.fill(-1)
  for (let sq = 0; sq < 64; sq++) {
    const piece = s[sq] ?? 0
    if ((piece & 7) !== PAWN) continue
    const file = sq & 7
    const rank = sq >> 3
    if (piece === (WHITE | PAWN)) {
      whitePawnFiles[file] = (whitePawnFiles[file] ?? 0) + 1
      if (rank > (whiteFront[file] ?? -1)) whiteFront[file] = rank
      if (rank < (whiteRear[file] ?? 8)) whiteRear[file] = rank
    } else {
      blackPawnFiles[file] = (blackPawnFiles[file] ?? 0) + 1
      if (rank < (blackFront[file] ?? 8)) blackFront[file] = rank
      if (rank > (blackRear[file] ?? -1)) blackRear[file] = rank
    }
  }

  for (let file = 0; file < 8; file++) {
    const white = whitePawnFiles[file] ?? 0
    const black = blackPawnFiles[file] ?? 0
    // Neighbouring files; at the edge the file stands in for its missing neighbour.
    const left = file > 0 ? file - 1 : file
    const right = file < 7 ? file + 1 : file
    if (white > 0) {
      if (white > 1) {
        mg -= DOUBLED * (white - 1)
        eg -= DOUBLED * (white - 1)
      }
      const neighbours = (file > 0 ? (whitePawnFiles[file - 1] ?? 0) : 0) + (file < 7 ? (whitePawnFiles[file + 1] ?? 0) : 0)
      if (neighbours === 0) {
        mg -= ISOLATED * white
        eg -= ISOLATED * white
      }
      // Passed: no black pawn further up this file or a neighbouring one.
      const rank = whiteFront[file] ?? 0
      if ((blackRear[left] ?? -1) <= rank && (blackRear[file] ?? -1) <= rank && (blackRear[right] ?? -1) <= rank) {
        mg += PASSED_MG[rank] ?? 0
        eg += PASSED_EG[rank] ?? 0
      }
    }
    if (black > 0) {
      if (black > 1) {
        mg += DOUBLED * (black - 1)
        eg += DOUBLED * (black - 1)
      }
      const neighbours = (file > 0 ? (blackPawnFiles[file - 1] ?? 0) : 0) + (file < 7 ? (blackPawnFiles[file + 1] ?? 0) : 0)
      if (neighbours === 0) {
        mg += ISOLATED * black
        eg += ISOLATED * black
      }
      const rank = blackFront[file] ?? 7
      if ((whiteRear[left] ?? 8) >= rank && (whiteRear[file] ?? 8) >= rank && (whiteRear[right] ?? 8) >= rank) {
        mg -= PASSED_MG[7 - rank] ?? 0
        eg -= PASSED_EG[7 - rank] ?? 0
      }
    }
  }

  for (let sq = 0; sq < 64; sq++) {
    const piece = s[sq] ?? 0
    if ((piece & 7) !== ROOK) continue
    const file = sq & 7
    const own = piece === (WHITE | ROOK) ? whitePawnFiles[file] : blackPawnFiles[file]
    const enemy = piece === (WHITE | ROOK) ? blackPawnFiles[file] : whitePawnFiles[file]
    const bonus = own === 0 ? (enemy === 0 ? ROOK_OPEN_FILE : ROOK_SEMI_OPEN_FILE) : 0
    mg += piece === (WHITE | ROOK) ? bonus : -bonus
  }

  const counts = board.counts
  if ((counts[WHITE | BISHOP] ?? 0) >= 2) {
    mg += BISHOP_PAIR
    eg += BISHOP_PAIR
  }
  if ((counts[BLACK | BISHOP] ?? 0) >= 2) {
    mg -= BISHOP_PAIR
    eg -= BISHOP_PAIR
  }

  let score = Math.round((mg * phase + eg * (MAX_PHASE - phase)) / MAX_PHASE)
  score += mopUp(board, phase)
  return (board.side === WHITE ? score : -score) + TEMPO
}

/**
 * When one side is clearly ahead in an endgame, reward driving the enemy king to the edge and
 * bringing the own king closer. A cornered king soon has only suicidal moves (Rules §2.2).
 */
function mopUp(board: SearchBoard, phase: number): number {
  if (phase > 10) return 0
  let material = 0
  const counts = board.counts
  for (let type = PAWN; type < KING; type++) {
    const value = MATERIAL_EG[type] ?? 0
    material += value * ((counts[WHITE | type] ?? 0) - (counts[BLACK | type] ?? 0))
  }
  if (Math.abs(material) < 250) return 0
  const whiteKing = board.kings[0] ?? 0
  const blackKing = board.kings[1] ?? 0
  const weak = material > 0 ? blackKing : whiteKing
  const distance = Math.abs((whiteKing & 7) - (blackKing & 7)) + Math.abs((whiteKing >> 3) - (blackKing >> 3))
  const bonus = 10 * (CENTER_DISTANCE[weak] ?? 0) + 4 * (14 - distance)
  return material > 0 ? bonus : -bonus
}
