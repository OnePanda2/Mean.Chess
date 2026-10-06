import {
  agreeDraw,
  analyze,
  currentPosition,
  newGame,
  play,
  resign,
  toMcn,
  undo,
  type GameRecord,
  type Move,
  type PromotionType,
  type Square,
} from '../engine/index.ts'
import type { Scenario } from './scenarios.ts'

/** A pawn has reached the last rank and the player is choosing what it becomes. */
export interface PendingPromotion {
  readonly from: Square
  readonly to: Square
}

/** Everything the play page remembers. The engine stays the only authority on rules. */
export interface GameState {
  readonly game: GameRecord
  /** Mean Chess Notation for each of game.moves, kept in step with it. */
  readonly notation: readonly string[]
  readonly selected: Square | null
  readonly promotion: PendingPromotion | null
  readonly flipped: boolean
  readonly showKillZones: boolean
  /** The Scenario Lab position being played, if any. */
  readonly scenario: Scenario | null
}

export type GameAction =
  | { readonly type: 'square'; readonly square: Square }
  | { readonly type: 'promote'; readonly piece: PromotionType }
  | { readonly type: 'cancel-promotion' }
  | { readonly type: 'deselect' }
  | { readonly type: 'undo' }
  | { readonly type: 'new-game' }
  | { readonly type: 'load'; readonly game: GameRecord; readonly scenario: Scenario | null }
  | { readonly type: 'resign' }
  | { readonly type: 'agree-draw' }
  | { readonly type: 'flip' }
  | { readonly type: 'toggle-kill-zones' }

export function notationFor(game: GameRecord): string[] {
  return game.moves.map((move, index) => toMcn(game.positions[index] ?? game.start, move))
}

export function createState(game: GameRecord, options: Partial<GameState> = {}): GameState {
  return {
    game,
    notation: notationFor(game),
    selected: null,
    promotion: null,
    flipped: false,
    showKillZones: false,
    scenario: null,
    ...options,
  }
}

function withMove(state: GameState, move: Move): GameState {
  const before = currentPosition(state.game)
  return {
    ...state,
    game: play(state.game, move),
    notation: [...state.notation, toMcn(before, move)],
    selected: null,
    promotion: null,
  }
}

/** Click or tap on a square: select a piece, play a move, or open the promotion choice. */
function clickSquare(state: GameState, square: Square): GameState {
  if (state.game.outcome || state.promotion) return state
  const position = currentPosition(state.game)
  const { legal } = analyze(position)
  if (state.selected !== null) {
    const from = state.selected
    const moves = legal.filter((move) => move.from === from && move.to === square)
    if (moves.length > 1) return { ...state, promotion: { from, to: square } } // only promotions share from/to
    const [move] = moves
    if (move) return withMove(state, move)
  }
  const piece = position.board[square]
  const selectable = piece?.color === position.sideToMove && legal.some((move) => move.from === square)
  return { ...state, selected: selectable && state.selected !== square ? square : null }
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'square':
      return clickSquare(state, action.square)
    case 'promote': {
      if (!state.promotion) return state
      const { from, to } = state.promotion
      const move = analyze(currentPosition(state.game)).legal.find(
        (candidate) => candidate.from === from && candidate.to === to && candidate.promotion === action.piece,
      )
      return move ? withMove(state, move) : { ...state, promotion: null }
    }
    case 'cancel-promotion':
      return { ...state, promotion: null }
    case 'deselect':
      return { ...state, selected: null }
    case 'undo': {
      const game = undo(state.game)
      return { ...state, game, notation: state.notation.slice(0, game.moves.length), selected: null, promotion: null }
    }
    case 'new-game':
      return { ...state, game: newGame(), notation: [], selected: null, promotion: null, scenario: null }
    case 'load':
      return {
        ...state,
        game: action.game,
        notation: notationFor(action.game),
        selected: null,
        promotion: null,
        scenario: action.scenario,
      }
    case 'resign':
      return { ...state, game: resign(state.game, currentPosition(state.game).sideToMove), selected: null }
    case 'agree-draw':
      return { ...state, game: agreeDraw(state.game), selected: null }
    case 'flip':
      return { ...state, flipped: !state.flipped }
    case 'toggle-kill-zones':
      return { ...state, showKillZones: !state.showKillZones }
  }
}
