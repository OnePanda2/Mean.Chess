import { opponentOf, type Result, type Seat } from '../../online/index.ts'

const seatName = (seat: Seat): string => (seat === 'white' ? 'White' : 'Black')

/** How an online game ended, in words (ONLINE-PROTOCOL.md §7). */
export function resultText(result: Result, you: Seat | null): string {
  const winner = result.winner ? seatName(result.winner) : null
  const by: Record<Result['reason'], string> = {
    'royal-capture': `${winner ?? ''} wins by Royal Capture.`,
    'royal-slaughter': `${winner ?? ''} wins by Royal Slaughter.`,
    checkmate: `${winner ?? ''} wins by checkmate.`,
    stalemate: 'Draw by stalemate.',
    threefold: 'Draw by threefold repetition.',
    'fifty-move': 'Draw by the fifty-move rule.',
    resignation: `${result.winner ? seatName(opponentOf(result.winner)) : ''} resigned. ${winner ?? ''} wins.`,
    agreement: 'Draw by agreement.',
    'claim-win': `${winner ?? ''} claimed the win after the opponent left.`,
    'claim-draw': 'Draw: called after the opponent left.',
    aborted: 'The game was cancelled.',
    abandoned: 'The game was abandoned.',
    'move-limit': 'Draw: the move limit was reached.',
  }
  const line = by[result.reason]
  if (!you || !result.winner) return line
  return `${result.winner === you ? 'You win! ' : 'You lose. '}${line}`
}
