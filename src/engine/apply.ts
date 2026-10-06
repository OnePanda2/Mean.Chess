import { castlingAfter } from './castling.ts'
import { fileOf, opposite, rankOf, squareAt } from './squares.ts'
import type { Board, Move, Piece, Position, PromotionType, Square } from './types.ts'

/** The piece a pawn becomes. It keeps the pawn's id; a new queen is marked promoted (Rules §2.2). */
export function promote(pawn: Piece, type: PromotionType): Piece {
  return type === 'queen'
    ? { id: pawn.id, color: pawn.color, type, queenOrigin: 'promoted' }
    : { id: pawn.id, color: pawn.color, type }
}

/** The board after `move`, as a new array. */
export function boardAfter(board: Board, move: Move): (Piece | null)[] {
  const next = board.slice()
  const moving = move.promotion ? promote(move.piece, move.promotion) : move.piece
  next[move.from] = null
  switch (move.kind) {
    case 'castle-kingside':
      relocate(next, move.from + 3, move.from + 1)
      break
    case 'castle-queenside':
      relocate(next, move.from - 4, move.from - 1)
      break
    case 'en-passant':
      next[squareAt(fileOf(move.to), rankOf(move.from))] = null
      break
    case 'royal-slaughter':
      if (move.sacrificeSquare !== undefined) next[move.sacrificeSquare] = null
      break
    default:
      // Normal moves, captures, self-captures and royal captures all simply land on `to`,
      // replacing whatever stood there.
      break
  }
  next[move.to] = moving
  return next
}

function relocate(board: (Piece | null)[], from: Square, to: Square): void {
  board[to] = board[from] ?? null
  board[from] = null
}

/** Plays `move` (assumed legal) and returns the resulting position. Pure. */
export function applyMove(position: Position, move: Move): Position {
  const irreversible =
    move.piece.type === 'pawn' || move.captured !== undefined || move.sacrificed !== undefined
  const doubleStep = move.piece.type === 'pawn' && Math.abs(move.to - move.from) === 16
  return {
    board: boardAfter(position.board, move),
    sideToMove: opposite(position.sideToMove),
    castling: castlingAfter(position.castling, move),
    enPassant: doubleStep ? (move.from + move.to) / 2 : null,
    halfmoveClock: irreversible ? 0 : position.halfmoveClock + 1,
    fullmoveNumber: position.sideToMove === 'black' ? position.fullmoveNumber + 1 : position.fullmoveNumber,
  }
}
