import { castlingMoves } from './castling.ts'
import { fileOf, isOnBoard, rankOf, squareAt } from './squares.ts'
import {
  ALL_DIRECTIONS,
  DIAGONAL_DIRECTIONS,
  ORTHOGONAL_DIRECTIONS,
  kingTargets,
  knightTargets,
  ray,
} from './tables.ts'
import type { Board, Move, Piece, Position, PromotionType, Square } from './types.ts'

const PROMOTIONS: readonly PromotionType[] = ['queen', 'rook', 'bishop', 'knight']

/**
 * Every ordinary move (Rules §2.2) for the side to move, before the king-safety filter.
 * Never generates a capture of a king: only kings capture kings, and only by a royal move.
 */
export function pseudoOrdinaryMoves(position: Position): Move[] {
  const { board, sideToMove } = position
  const moves: Move[] = []
  for (let from = 0; from < 64; from++) {
    const piece = board[from]
    if (piece?.color !== sideToMove) continue
    switch (piece.type) {
      case 'pawn':
        addPawnMoves(position, from, piece, moves)
        break
      case 'knight':
        addSteps(board, from, piece, knightTargets(from), moves)
        break
      case 'bishop':
        addSlides(board, from, piece, DIAGONAL_DIRECTIONS, moves)
        break
      case 'rook':
        addSlides(board, from, piece, ORTHOGONAL_DIRECTIONS, moves)
        break
      case 'queen':
        addSlides(board, from, piece, ALL_DIRECTIONS, moves)
        break
      case 'king':
        addSteps(board, from, piece, kingTargets(from), moves)
        moves.push(...castlingMoves(position, from, piece))
        break
    }
  }
  return moves
}

/** Adds a move to `to` if it is empty or holds a capturable enemy. Returns whether a slide may go on. */
function addTarget(board: Board, from: Square, piece: Piece, to: Square, moves: Move[]): boolean {
  const target = board[to]
  if (!target) {
    moves.push({ kind: 'normal', from, to, piece })
    return true
  }
  if (target.color !== piece.color && target.type !== 'king') {
    moves.push({ kind: 'capture', from, to, piece, captured: target })
  }
  return false
}

function addSteps(board: Board, from: Square, piece: Piece, targets: readonly Square[], moves: Move[]): void {
  for (const to of targets) addTarget(board, from, piece, to, moves)
}

function addSlides(
  board: Board,
  from: Square,
  piece: Piece,
  directions: readonly number[],
  moves: Move[],
): void {
  for (const direction of directions) {
    for (const to of ray(from, direction)) {
      if (!addTarget(board, from, piece, to, moves)) break
    }
  }
}

function addPawnMoves(position: Position, from: Square, pawn: Piece, moves: Move[]): void {
  const { board, enPassant } = position
  const forward = pawn.color === 'white' ? 1 : -1
  const file = fileOf(from)
  const rank = rankOf(from)

  // Pawns never stand on the first or last rank, so one step forward is always on the board.
  const oneStep = squareAt(file, rank + forward)
  if (!board[oneStep]) {
    addPawnMove(moves, { kind: 'normal', from, to: oneStep, piece: pawn })
    const startRank = pawn.color === 'white' ? 1 : 6
    if (rank === startRank) {
      const twoSteps = squareAt(file, rank + 2 * forward)
      if (!board[twoSteps]) moves.push({ kind: 'normal', from, to: twoSteps, piece: pawn })
    }
  }

  for (const sideways of [-1, 1]) {
    if (!isOnBoard(file + sideways, rank + forward)) continue
    const to = squareAt(file + sideways, rank + forward)
    const target = board[to]
    if (target) {
      if (target.color !== pawn.color && target.type !== 'king') {
        addPawnMove(moves, { kind: 'capture', from, to, piece: pawn, captured: target })
      }
    } else if (to === enPassant) {
      const victim = board[squareAt(file + sideways, rank)]
      if (victim?.type === 'pawn' && victim.color !== pawn.color) {
        moves.push({ kind: 'en-passant', from, to, piece: pawn, captured: victim })
      }
    }
  }
}

/** A pawn move reaching the last rank becomes four moves, one per promotion choice. */
function addPawnMove(moves: Move[], move: Move): void {
  const lastRank = move.piece.color === 'white' ? 7 : 0
  if (rankOf(move.to) !== lastRank) {
    moves.push(move)
    return
  }
  for (const promotion of PROMOTIONS) moves.push({ ...move, promotion })
}
