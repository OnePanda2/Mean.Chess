import type { Color, Outcome, PositionAnalysis } from '../engine/index.ts'
import type { Opponent } from './opponent.ts'

/** Player-facing copy (docs/BLUEPRINT.md §5.3). Plain text only. */

export const sideName = (color: Color): string => (color === 'white' ? 'White' : 'Black')

export interface Message {
  readonly title: string
  readonly detail: string
}

export function outcomeMessage(outcome: Outcome): Message {
  switch (outcome.kind) {
    case 'royal-capture':
      return { title: `${sideName(outcome.winner)} wins`, detail: 'Royal Capture: the king took the enemy king.' }
    case 'royal-slaughter':
      return {
        title: `${sideName(outcome.winner)} wins`,
        detail: 'Royal Slaughter: the king sacrificed its own piece and took the enemy king.',
      }
    case 'checkmate':
      return {
        title: `${sideName(outcome.winner)} wins`,
        detail: 'Checkmate. No escape was left, not even Royal Cannibalism.',
      }
    case 'resignation':
      return {
        title: `${sideName(outcome.winner)} wins`,
        detail: `${sideName(outcome.winner === 'white' ? 'black' : 'white')} resigned.`,
      }
    case 'stalemate':
      return { title: 'Draw', detail: 'Stalemate: no legal move, and the king is not in check.' }
    case 'threefold':
      return { title: 'Draw', detail: 'The same position occurred three times.' }
    case 'fifty-move':
      return { title: 'Draw', detail: 'Fifty moves each without a pawn move, capture or sacrifice.' }
    case 'agreement':
      return { title: 'Draw', detail: 'Agreed by both players.' }
  }
}

/** The result's headline: "White wins", or against the computer "You win" / "The computer wins". */
export function outcomeTitle(outcome: Outcome, opponent: Opponent): string {
  if (opponent.kind === 'friend' || outcome.winner === null) return outcomeMessage(outcome).title
  return outcome.winner === opponent.human ? 'You win' : 'The computer wins'
}

/** Why the game ended, worded for who was playing. */
export function outcomeDetail(outcome: Outcome, opponent: Opponent): string {
  if (opponent.kind === 'computer') {
    if (outcome.kind === 'agreement') return 'You and the computer agreed to a draw.'
    if (outcome.kind === 'resignation') return 'You resigned.'
  }
  return outcomeMessage(outcome).detail
}

export type StatusTone = 'win' | 'sacrifice' | 'check'

export interface Status extends Message {
  readonly tone: StatusTone
}

/**
 * The most important thing about the position for the player to move, if anything. It never warns
 * about the Royal Kill Zone, before or after a move (DECISIONS.md D-39).
 */
export function statusOf(analysis: PositionAnalysis): Status | null {
  if (analysis.royal) {
    return {
      tone: 'win',
      title: analysis.royal.kind === 'royal-slaughter' ? 'Royal Slaughter available' : 'Royal Capture available',
      detail: 'Your king can take the enemy king and win. Select your king.',
    }
  }
  if (analysis.desperate && analysis.cannibalism.length > 0) {
    return {
      tone: 'sacrifice',
      title: 'Desperate',
      detail:
        analysis.ordinary.length === 0
          ? 'Under normal chess rules this is checkmate. Your king may sacrifice a highlighted piece to escape.'
          : 'Your king may sacrifice a highlighted piece to escape.',
    }
  }
  if (analysis.inCheck) return { tone: 'check', title: 'Check', detail: 'Your king is attacked.' }
  return null
}
