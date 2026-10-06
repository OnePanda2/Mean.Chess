import { isInCheck } from './attacks.ts'
import { findKing } from './board.ts'
import { chebyshev, fileOf, opposite, parseSquare, rankOf, squareAt, squareName } from './squares.ts'
import type { Board, CastlingRights, Color, Piece, PieceType, Position, Square } from './types.ts'

/**
 * MeanFEN is standard FEN plus one mark: a promoted queen is written `Q~` / `q~`
 * (the X-FEN / lichess convention for promoted pieces). A queen without `~` is original.
 */
export const START_MEAN_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

const MAX_LENGTH = 200

export type ParseResult =
  | { readonly ok: true; readonly position: Position }
  | { readonly ok: false; readonly error: string }

const TYPE_OF_LETTER: Readonly<Record<string, PieceType>> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
}

const LETTER_OF_TYPE: Readonly<Record<PieceType, string>> = {
  pawn: 'p',
  knight: 'n',
  bishop: 'b',
  rook: 'r',
  queen: 'q',
  king: 'k',
}

export const NO_CASTLING: CastlingRights = {
  whiteKingside: false,
  whiteQueenside: false,
  blackKingside: false,
  blackQueenside: false,
}

const fail = (error: string): ParseResult => ({ ok: false, error })

/** Parses and fully validates a MeanFEN string. Never throws. */
export function parseMeanFen(text: string): ParseResult {
  const parsed = parseMeanFenUnchecked(text)
  if (!parsed.ok) return parsed
  const problem = validatePosition(parsed.position)
  return problem === null ? parsed : fail(problem)
}

/**
 * Parses MeanFEN syntax WITHOUT the position-legality checks of {@link validatePosition}.
 * For tests that must exercise the generator on positions that cannot occur in play
 * (docs/BLUEPRINT.md D-16). Deliberately not exported from the engine's public index.
 */
export function parseMeanFenUnchecked(text: string): ParseResult {
  if (text.length > MAX_LENGTH) return fail('That MeanFEN is too long.')
  const fields = text.trim().split(/\s+/)
  if (fields.length !== 6) {
    return fail(
      'MeanFEN needs 6 fields: placement, side to move, castling, en passant, halfmove clock and fullmove number.',
    )
  }
  const [placement = '', side = '', castlingField = '', enPassantField = '', halfmoveField = '', fullmoveField = ''] =
    fields

  const board = parsePlacement(placement)
  if (typeof board === 'string') return fail(board)

  if (side !== 'w' && side !== 'b') return fail('The side to move must be "w" or "b".')
  const sideToMove: Color = side === 'w' ? 'white' : 'black'

  const castling = parseCastling(castlingField)
  if (castling === null) return fail('Castling must be "-" or some of K, Q, k, q in that order.')

  const enPassant = parseEnPassant(enPassantField, board, sideToMove)
  if (typeof enPassant === 'string') return fail(enPassant)

  if (!/^\d{1,4}$/.test(halfmoveField)) return fail('The halfmove clock must be a whole number.')
  if (!/^\d{1,4}$/.test(fullmoveField) || Number(fullmoveField) < 1) {
    return fail('The fullmove number must be a whole number of at least 1.')
  }

  return {
    ok: true,
    position: {
      board,
      sideToMove,
      castling,
      enPassant,
      halfmoveClock: Number(halfmoveField),
      fullmoveNumber: Number(fullmoveField),
    },
  }
}

function makePiece(color: Color, type: PieceType, sq: Square, promoted: boolean): Piece {
  const id = `${color === 'white' ? 'w' : 'b'}${LETTER_OF_TYPE[type].toUpperCase()}@${squareName(sq)}`
  return type === 'queen'
    ? { id, color, type, queenOrigin: promoted ? 'promoted' : 'original' }
    : { id, color, type }
}

function parsePlacement(placement: string): (Piece | null)[] | string {
  const rows = placement.split('/')
  if (rows.length !== 8) return 'The placement must have 8 ranks separated by "/".'
  const board: (Piece | null)[] = Array.from({ length: 64 }, () => null)
  for (const [index, row] of rows.entries()) {
    const rank = 7 - index
    let file = 0
    for (let i = 0; i < row.length; i++) {
      const char = row.charAt(i)
      if (char >= '1' && char <= '8') {
        file += Number(char)
        continue
      }
      const type = TYPE_OF_LETTER[char.toLowerCase()]
      if (type === undefined) return `Unexpected character "${char}" in rank ${rank + 1}.`
      if (file > 7) return `Rank ${rank + 1} describes more than 8 squares.`
      const promoted = row.charAt(i + 1) === '~'
      if (promoted) {
        if (type !== 'queen') return 'Only queens can be marked promoted ("Q~" or "q~").'
        i++
      }
      const sq = squareAt(file, rank)
      board[sq] = makePiece(char === char.toUpperCase() ? 'white' : 'black', type, sq, promoted)
      file++
    }
    if (file !== 8) return `Rank ${rank + 1} must describe exactly 8 squares.`
  }
  return board
}

function parseCastling(field: string): CastlingRights | null {
  if (field === '-') return NO_CASTLING
  if (!/^K?Q?k?q?$/.test(field)) return null
  return {
    whiteKingside: field.includes('K'),
    whiteQueenside: field.includes('Q'),
    blackKingside: field.includes('k'),
    blackQueenside: field.includes('q'),
  }
}

function parseEnPassant(field: string, board: Board, sideToMove: Color): Square | null | string {
  if (field === '-') return null
  const sq = parseSquare(field)
  if (sq === null) return `"${field}" is not a square.`
  // White to move: a black pawn just went from rank 7 to rank 5, skipping rank 6 (and vice versa).
  const white = sideToMove === 'white'
  const file = fileOf(sq)
  const pawn = board[squareAt(file, white ? 4 : 3)]
  const consistent =
    rankOf(sq) === (white ? 5 : 2) &&
    !board[sq] &&
    !board[squareAt(file, white ? 6 : 1)] &&
    pawn?.type === 'pawn' &&
    pawn.color === opposite(sideToMove)
  return consistent ? sq : 'The en-passant square does not match a pawn that has just moved two squares.'
}

const COLORS: readonly Color[] = ['white', 'black']
const capitalised = (color: Color): string => (color === 'white' ? 'White' : 'Black')

/** Legality checks for a position that is about to be played from (docs/BLUEPRINT.md §4.6). */
export function validatePosition(position: Position): string | null {
  const { board } = position
  for (const color of COLORS) {
    const pieces = board.filter((piece): piece is Piece => piece?.color === color)
    if (pieces.filter((piece) => piece.type === 'king').length !== 1) {
      return `${capitalised(color)} must have exactly one king.`
    }
    if (pieces.filter((piece) => piece.type === 'queen' && piece.queenOrigin === 'original').length > 1) {
      return `${capitalised(color)} has more than one original queen. Mark promoted queens with "~".`
    }
  }
  for (let sq = 0; sq < 64; sq++) {
    if (board[sq]?.type === 'pawn' && (rankOf(sq) === 0 || rankOf(sq) === 7)) {
      return 'Pawns cannot stand on the first or last rank.'
    }
  }
  const whiteKing = findKing(board, 'white')
  const blackKing = findKing(board, 'black')
  if (whiteKing !== null && blackKing !== null && chebyshev(whiteKing, blackKing) < 2) {
    return 'The kings cannot stand on adjacent squares.'
  }
  if (isInCheck(board, opposite(position.sideToMove))) {
    return `${capitalised(opposite(position.sideToMove))} is in check, but it is not ${capitalised(opposite(position.sideToMove))}'s move.`
  }
  return castlingProblem(position)
}

function castlingProblem({ board, castling }: Position): string | null {
  const has = (sq: Square, color: Color, type: PieceType): boolean => {
    const piece = board[sq]
    return piece?.color === color && piece.type === type
  }
  const rules: readonly [boolean, Color, Square, Square, string][] = [
    [castling.whiteKingside, 'white', 4, 7, 'K'],
    [castling.whiteQueenside, 'white', 4, 0, 'Q'],
    [castling.blackKingside, 'black', 60, 63, 'k'],
    [castling.blackQueenside, 'black', 60, 56, 'q'],
  ]
  for (const [right, color, kingSquare, rookSquare, letter] of rules) {
    if (right && !(has(kingSquare, color, 'king') && has(rookSquare, color, 'rook'))) {
      return `Castling right "${letter}" needs the king and that rook on their starting squares.`
    }
  }
  return null
}

/** The board part of MeanFEN, with `~` after promoted queens. */
export function placementOf(board: Board): string {
  const rows: string[] = []
  for (let rank = 7; rank >= 0; rank--) {
    let row = ''
    let empty = 0
    for (let file = 0; file < 8; file++) {
      const piece = board[squareAt(file, rank)]
      if (!piece) {
        empty++
        continue
      }
      if (empty > 0) row += String(empty)
      empty = 0
      const letter = LETTER_OF_TYPE[piece.type]
      row += piece.color === 'white' ? letter.toUpperCase() : letter
      if (piece.queenOrigin === 'promoted') row += '~'
    }
    if (empty > 0) row += String(empty)
    rows.push(row)
  }
  return rows.join('/')
}

export function castlingOf(castling: CastlingRights): string {
  const text =
    (castling.whiteKingside ? 'K' : '') +
    (castling.whiteQueenside ? 'Q' : '') +
    (castling.blackKingside ? 'k' : '') +
    (castling.blackQueenside ? 'q' : '')
  return text === '' ? '-' : text
}

export function toMeanFen(position: Position): string {
  return [
    placementOf(position.board),
    position.sideToMove === 'white' ? 'w' : 'b',
    castlingOf(position.castling),
    position.enPassant === null ? '-' : squareName(position.enPassant),
    String(position.halfmoveClock),
    String(position.fullmoveNumber),
  ].join(' ')
}

/** The standard starting position, with both queens original. */
export function startingPosition(): Position {
  const parsed = parseMeanFen(START_MEAN_FEN)
  if (!parsed.ok) throw new Error(`Mean Chess: invalid start position (${parsed.error})`)
  return parsed.position
}
