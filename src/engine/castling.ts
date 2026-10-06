import { isSquareAttacked } from './attacks.ts'
import { opposite } from './squares.ts'
import type { CastlingRights, Color, Move, Piece, Position, Square } from './types.ts'

const KING_HOME: Readonly<Record<Color, Square>> = { white: 4, black: 60 } // e1, e8

/**
 * Standard castling (Rules §2.1). The king may not castle out of, through or into an attacked
 * square; squares next to the enemy king count as attacked. Royal reach is not an attack, so
 * castling into the Kill Zone is legal (Rules §2.2).
 */
export function castlingMoves(position: Position, from: Square, king: Piece): Move[] {
  const { board, castling } = position
  const us = king.color
  if (from !== KING_HOME[us]) return []
  const kingside = us === 'white' ? castling.whiteKingside : castling.blackKingside
  const queenside = us === 'white' ? castling.whiteQueenside : castling.blackQueenside
  if (!kingside && !queenside) return []

  const them = opposite(us)
  if (isSquareAttacked(board, from, them)) return []
  const isOwnRook = (sq: Square): boolean => {
    const piece = board[sq]
    return piece?.type === 'rook' && piece.color === us
  }
  const allEmpty = (squares: readonly Square[]): boolean => squares.every((sq) => !board[sq])
  const allSafe = (squares: readonly Square[]): boolean =>
    squares.every((sq) => !isSquareAttacked(board, sq, them))

  const moves: Move[] = []
  if (kingside && isOwnRook(from + 3) && allEmpty([from + 1, from + 2]) && allSafe([from + 1, from + 2])) {
    moves.push({ kind: 'castle-kingside', from, to: from + 2, piece: king })
  }
  if (
    queenside &&
    isOwnRook(from - 4) &&
    allEmpty([from - 1, from - 2, from - 3]) &&
    allSafe([from - 1, from - 2])
  ) {
    moves.push({ kind: 'castle-queenside', from, to: from - 2, piece: king })
  }
  return moves
}

/** Castling rights after `move`: a king move loses both; anything leaving or landing on a rook corner loses that side. */
export function castlingAfter(rights: CastlingRights, move: Move): CastlingRights {
  let { whiteKingside, whiteQueenside, blackKingside, blackQueenside } = rights
  if (move.piece.type === 'king') {
    if (move.piece.color === 'white') {
      whiteKingside = false
      whiteQueenside = false
    } else {
      blackKingside = false
      blackQueenside = false
    }
  }
  for (const sq of [move.from, move.to, move.sacrificeSquare]) {
    if (sq === 0) whiteQueenside = false
    if (sq === 7) whiteKingside = false
    if (sq === 56) blackQueenside = false
    if (sq === 63) blackKingside = false
  }
  return { whiteKingside, whiteQueenside, blackKingside, blackQueenside }
}
