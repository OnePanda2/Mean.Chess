/** The two sides. */
export type Color = 'white' | 'black'

export type PieceType = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king'

/** Queens remember whether they began the game or were created by promotion (Rules §2.2). */
export type QueenOrigin = 'original' | 'promoted'

export type PromotionType = 'queen' | 'rook' | 'bishop' | 'knight'

/** Sacrifice tiers (Rules §2.2): 1 pawns, 2 knights and bishops, 3 rooks, 4 promoted queens. */
export type Tier = 1 | 2 | 3 | 4

export interface Piece {
  /** Stable identity: assigned when a position is created, kept through promotion. Never hashed. */
  readonly id: string
  readonly color: Color
  readonly type: PieceType
  /** Present exactly when `type` is 'queen'. */
  readonly queenOrigin?: QueenOrigin
}

/** 0 = a1, 1 = b1, … 7 = h1, 8 = a2, … 63 = h8. */
export type Square = number

/** 64 squares indexed by {@link Square}. */
export type Board = readonly (Piece | null)[]

export interface CastlingRights {
  readonly whiteKingside: boolean
  readonly whiteQueenside: boolean
  readonly blackKingside: boolean
  readonly blackQueenside: boolean
}

/** Pure game state. History (for repetition and undo) lives in the game record, not here. */
export interface Position {
  readonly board: Board
  readonly sideToMove: Color
  readonly castling: CastlingRights
  /** The square a pawn skipped with its last double step (traditional FEN meaning), or null. */
  readonly enPassant: Square | null
  readonly halfmoveClock: number
  readonly fullmoveNumber: number
}

export type MoveKind =
  | 'normal'
  | 'capture'
  | 'en-passant'
  | 'castle-kingside'
  | 'castle-queenside'
  | 'self-capture'
  | 'royal-capture'
  | 'royal-slaughter'

export interface Move {
  readonly kind: MoveKind
  readonly from: Square
  readonly to: Square
  /** The moving piece as it stood before the move. */
  readonly piece: Piece
  /** Set on pawn moves to the last rank; independent of whether the move also captures. */
  readonly promotion?: PromotionType
  /** Enemy piece removed by the move. For royal moves this is the enemy king. */
  readonly captured?: Piece
  /** Own piece removed by the move (self-capture and royal slaughter). */
  readonly sacrificed?: Piece
  /** Where the sacrificed piece stood: `to` for a self-capture, the midpoint for a royal slaughter. */
  readonly sacrificeSquare?: Square
  /** Ordinary moves only: after this move the opponent has a royal move (Rules §2.2). */
  readonly suicidal?: boolean
}
