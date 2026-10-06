/**
 * Public entry point of the Mean Chess rules engine.
 *
 * The engine is pure, deterministic TypeScript with no React or DOM dependencies
 * (enforced by eslint.config.js). Code outside src/engine imports from this file only.
 */

export { RULES_VERSION } from './version.ts'

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
export { TIER_NAMES, activeTier, isEligible, tierOf } from './hierarchy.ts'
export { blockedRoyal, royalMove, type BlockReason, type BlockedRoyal } from './royalCapture.ts'
export { legalMoves, moveLayers, ordinaryLegalMoves, type MoveLayers } from './legalMoves.ts'
export {
  analyze,
  explainBlocked,
  explainIneligible,
  explainMove,
  pieceName,
  type Explanation,
  type PositionAnalysis,
} from './analysis.ts'
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
export { findMove, toAsciiMcn, toMcn, toUci } from './notation.ts'
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
export {
  GAME_FORMAT,
  exportGame,
  importGame,
  loadGame,
  saveGame,
  type LoadResult,
  type SavedGame,
} from './serialization.ts'
export { perft, perftDetailed, perftDivide, type PerftCounts } from './perft.ts'
