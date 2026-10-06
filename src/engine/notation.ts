import { applyMove } from './apply.ts'
import { isInCheck } from './attacks.ts'
import { legalMoves, ordinaryLegalMoves } from './legalMoves.ts'
import { FILE_NAMES, fileOf, rankOf, squareName } from './squares.ts'
import type { Move, Piece, PieceType, Position, PromotionType } from './types.ts'

const PROMOTION_LETTER: Readonly<Record<PromotionType, string>> = {
  queen: 'q',
  rook: 'r',
  bishop: 'b',
  knight: 'n',
}

const PIECE_LETTER: Readonly<Record<PieceType, string>> = {
  pawn: '',
  knight: 'N',
  bishop: 'B',
  rook: 'R',
  queen: 'Q',
  king: 'K',
}

/**
 * Coordinate notation used for storage and transport: from, to and an optional promotion letter
 * (e2e4, e7e8q, h1f3). Under the 8-line royal rule this identifies every legal move uniquely.
 */
export function toUci(move: Move): string {
  return `${squareName(move.from)}${squareName(move.to)}${move.promotion ? PROMOTION_LETTER[move.promotion] : ''}`
}

/** The move in `moves` written as `uci`, or null. */
export function findMove(moves: readonly Move[], uci: string): Move | null {
  const wanted = uci.trim().toLowerCase()
  return moves.find((move) => toUci(move) === wanted) ?? null
}

/** How Mean Chess Notation names a sacrificed piece: P, N, B, R, or Q~ for a promoted queen. */
function sacrificeLetter(piece: Piece | undefined): string {
  if (!piece) return '?'
  if (piece.type === 'pawn') return 'P'
  return piece.type === 'queen' && piece.queenOrigin === 'promoted' ? 'Q~' : PIECE_LETTER[piece.type]
}

/**
 * Mean Chess Notation (Rules §2.9) for `move`, played from `position`. Ordinary moves are standard
 * SAN. Mean moves are explicit: K×K (Royal Capture), K×P×K (Royal Slaughter), K×e2(own P)
 * (Royal Cannibalism). `×` marks the Mean-only captures; `+` is check and `#` is Mean checkmate.
 */
export function toMcn(position: Position, move: Move): string {
  if (move.kind === 'royal-capture') return 'K×K'
  if (move.kind === 'royal-slaughter') return `K×${sacrificeLetter(move.sacrificed)}×K`
  return moveBody(position, move) + checkSuffix(position, move)
}

/** {@link toMcn} with `×` written as `x`, for plain-text export. */
export function toAsciiMcn(position: Position, move: Move): string {
  return toMcn(position, move).replaceAll('×', 'x')
}

function moveBody(position: Position, move: Move): string {
  if (move.kind === 'castle-kingside') return 'O-O'
  if (move.kind === 'castle-queenside') return 'O-O-O'
  if (move.kind === 'self-capture') return `K×${squareName(move.to)}(own ${sacrificeLetter(move.sacrificed)})`
  const target = squareName(move.to)
  const captures = move.captured !== undefined
  if (move.piece.type === 'pawn') {
    const base = captures ? `${FILE_NAMES.charAt(fileOf(move.from))}x${target}` : target
    return move.promotion ? `${base}=${PIECE_LETTER[move.promotion]}` : base
  }
  return `${PIECE_LETTER[move.piece.type]}${disambiguation(position, move)}${captures ? 'x' : ''}${target}`
}

/** SAN disambiguation: file if it suffices, else rank, else the full square. */
function disambiguation(position: Position, move: Move): string {
  const rivals = ordinaryLegalMoves(position).filter(
    (other) => other.to === move.to && other.from !== move.from && other.piece.type === move.piece.type,
  )
  if (rivals.length === 0) return ''
  if (rivals.every((other) => fileOf(other.from) !== fileOf(move.from))) return FILE_NAMES.charAt(fileOf(move.from))
  if (rivals.every((other) => rankOf(other.from) !== rankOf(move.from))) return String(rankOf(move.from) + 1)
  return squareName(move.from)
}

function checkSuffix(position: Position, move: Move): string {
  const next = applyMove(position, move)
  if (!isInCheck(next.board, next.sideToMove)) return ''
  return legalMoves(next).length === 0 ? '#' : '+'
}
