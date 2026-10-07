import {
  agreeDraw,
  analyze,
  currentPosition,
  findMove,
  newGame,
  play,
  resign,
  toMcn,
  undo,
  type GameRecord,
  type Move,
  type Position,
  type PromotionType,
  type Square,
} from '../engine/index.ts'
import { FRIEND, computerColor, type Opponent } from './opponent.ts'
import type { Scenario } from './scenarios.ts'

/** A pawn has reached the last rank and the player is choosing what it becomes. */
export interface PendingPromotion {
  readonly from: Square
  readonly to: Square
}

/**
 * What just changed on the board, so it can animate the right thing: a move (slide, capture,
 * sacrifice), an undo (pieces slide back, taken pieces reappear) or a reset (a new position).
 */
export interface Transition {
  /** Increases with every change; animations are keyed by it so they play once. */
  readonly id: number
  readonly kind: 'move' | 'undo' | 'reset'
  /** The position shown before the change; null when the page first loads. */
  readonly from: Position | null
  /** The move played (kind 'move' only). */
  readonly move: Move | null
}

/** Everything the play page remembers. The engine stays the only authority on rules. */
export interface GameState {
  readonly game: GameRecord
  /** Mean Chess Notation for each of game.moves, kept in step with it. */
  readonly notation: readonly string[]
  readonly selected: Square | null
  readonly promotion: PendingPromotion | null
  readonly flipped: boolean
  /** The Scenario Lab position being played, if any. */
  readonly scenario: Scenario | null
  readonly transition: Transition
  /** A friend on this device, or the computer (docs/AI.md). */
  readonly opponent: Opponent
  /** How many moves had been played when the computer declined a draw; the notice lasts until the next move. */
  readonly drawDeclinedAt: number | null
}

export type GameAction =
  | { readonly type: 'square'; readonly square: Square }
  | { readonly type: 'promote'; readonly piece: PromotionType }
  | { readonly type: 'cancel-promotion' }
  | { readonly type: 'deselect' }
  | { readonly type: 'undo' }
  | { readonly type: 'start'; readonly opponent: Opponent }
  | { readonly type: 'load'; readonly game: GameRecord; readonly scenario: Scenario | null }
  | { readonly type: 'resign' }
  | { readonly type: 'agree-draw' }
  | { readonly type: 'flip' }
  /** The computer's chosen move, for the position after `ply` moves (stale answers are ignored). */
  | { readonly type: 'computer-move'; readonly uci: string; readonly ply: number }
  /** The computer's answer to a draw offered after `ply` moves. */
  | { readonly type: 'draw-answer'; readonly accept: boolean; readonly ply: number }

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
    scenario: null,
    transition: { id: 0, kind: 'reset', from: null, move: null },
    opponent: FRIEND,
    drawDeclinedAt: null,
    ...options,
  }
}

/** Whether the computer is to move now: the game goes on and no promotion is being chosen. */
export function computerToMove(state: GameState): boolean {
  const color = computerColor(state.opponent)
  return color !== null && !state.game.outcome && currentPosition(state.game).sideToMove === color
}

/** Whether Undo has something to take back: a move of the player's, or a resignation or agreed draw. */
export function canUndo(state: GameState): boolean {
  const { game, opponent } = state
  if (game.outcome?.kind === 'resignation' || game.outcome?.kind === 'agreement') return true
  if (opponent.kind === 'friend') return game.moves.length > 0
  return game.moves.some((move) => move.piece.color === opponent.human)
}

function next(state: GameState, kind: Transition['kind'], move: Move | null = null): Transition {
  return { id: state.transition.id + 1, kind, from: currentPosition(state.game), move }
}

function withMove(state: GameState, move: Move): GameState {
  const before = currentPosition(state.game)
  return {
    ...state,
    game: play(state.game, move),
    notation: [...state.notation, toMcn(before, move)],
    selected: null,
    promotion: null,
    transition: next(state, 'move', move),
  }
}

/** Click or tap on a square: select a piece, play a move, or open the promotion choice. */
function clickSquare(state: GameState, square: Square): GameState {
  if (state.game.outcome || state.promotion || computerToMove(state)) return state
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
      if (!canUndo(state)) return state
      let game = undo(state.game)
      // Against the computer, take back its reply too: Undo returns to the player's own turn.
      const human = state.opponent.kind === 'computer' ? state.opponent.human : null
      while (human && !game.outcome && game.moves.length > 0 && currentPosition(game).sideToMove !== human) {
        game = undo(game)
      }
      return {
        ...state,
        game,
        notation: state.notation.slice(0, game.moves.length),
        selected: null,
        promotion: null,
        drawDeclinedAt: null,
        transition: game.moves.length === state.game.moves.length ? state.transition : next(state, 'undo'),
      }
    }
    case 'start':
      return {
        ...state,
        game: newGame(),
        notation: [],
        selected: null,
        promotion: null,
        scenario: null,
        opponent: action.opponent,
        // Against the computer the player's own side is at the bottom.
        flipped: action.opponent.kind === 'computer' ? action.opponent.human === 'black' : state.flipped,
        drawDeclinedAt: null,
        transition: next(state, 'reset'),
      }
    case 'load':
      // A loaded position or scenario is explored by one person playing both sides.
      return {
        ...state,
        game: action.game,
        notation: notationFor(action.game),
        selected: null,
        promotion: null,
        scenario: action.scenario,
        opponent: FRIEND,
        drawDeclinedAt: null,
        transition: next(state, 'reset'),
      }
    case 'computer-move': {
      if (!computerToMove(state) || state.game.moves.length !== action.ply) return state
      const move = findMove(analyze(currentPosition(state.game)).legal, action.uci)
      return move ? withMove(state, move) : state
    }
    case 'draw-answer':
      if (state.game.outcome || state.game.moves.length !== action.ply) return state
      return action.accept
        ? { ...state, game: agreeDraw(state.game), selected: null }
        : { ...state, drawDeclinedAt: action.ply }
    case 'resign': {
      // Against the computer it is always the player who resigns, even while the computer thinks.
      const loser = state.opponent.kind === 'computer' ? state.opponent.human : currentPosition(state.game).sideToMove
      return { ...state, game: resign(state.game, loser), selected: null }
    }
    case 'agree-draw':
      return { ...state, game: agreeDraw(state.game), selected: null }
    case 'flip':
      return { ...state, flipped: !state.flipped }
  }
}
