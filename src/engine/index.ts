/**
 * Public entry point of the Mean Chess rules engine.
 *
 * The engine is pure, deterministic TypeScript with no React or DOM dependencies
 * (enforced by eslint.config.js). Code outside src/engine imports from this file only.
 */

/** Version of the written rules (docs/RULES.md) that this engine implements. */
export const RULES_VERSION = '0.1'

export type {
  Board,
  CastlingRights,
  Color,
  Move,
  MoveKind,
  Piece,
  PieceType,
  Position,
  PromotionType,
  QueenOrigin,
  Square,
  Tier,
} from './types.ts'

export { chebyshev, fileOf, opposite, parseSquare, rankOf, squareAt, squareName } from './squares.ts'
export { findKing, pieceAt } from './board.ts'
export { isInCheck, isSquareAttacked } from './attacks.ts'
export { applyMove } from './apply.ts'
export { legalMoves, ordinaryLegalMoves } from './legalMoves.ts'
export {
  NO_CASTLING,
  START_MEAN_FEN,
  parseMeanFen,
  placementOf,
  startingPosition,
  toMeanFen,
  validatePosition,
  type ParseResult,
} from './meanFen.ts'
export { positionKey } from './hashing.ts'
export { findMove, toUci } from './notation.ts'
export {
  agreeDraw,
  currentPosition,
  newGame,
  play,
  resign,
  undo,
  type GameRecord,
  type Outcome,
} from './game.ts'
export { perft, perftDetailed, perftDivide, type PerftCounts } from './perft.ts'
