/**
 * Self-play for tuning the computer opponent (docs/AI.md). Plays games between two levels through
 * the rules engine, which checks every move, swapping colours each game:
 *
 *   npm run selfplay -- ruthless mean 10
 */
import { ComputerPlayer, isLevel, type Level } from '../src/ai/index.ts'
import { currentPosition, newGame, play, toMeanFen } from '../src/engine/index.ts'

const [firstArg = 'ruthless', secondArg = 'mean', countArg = '6'] = process.argv.slice(2)
if (!isLevel(firstArg) || !isLevel(secondArg)) {
  throw new Error('Usage: npm run selfplay -- <nice|mean|ruthless> <nice|mean|ruthless> [games]')
}
const first: Level = firstArg
const second: Level = secondArg
const games = Number(countArg)
const player = new ComputerPlayer()
const now = (): number => performance.now()
const score: Record<string, number> = { [first]: 0, [second]: 0, draw: 0 }

for (let index = 0; index < games; index++) {
  const white = index % 2 === 0 ? first : second
  const black = index % 2 === 0 ? second : first
  let game = newGame()
  const start = toMeanFen(game.start)
  const moves: string[] = []
  const began = now()
  while (!game.outcome && moves.length < 600) {
    const level = currentPosition(game).sideToMove === 'white' ? white : black
    const reply = player.chooseMove({ start, moves, level, seed: index * 1_000 + moves.length }, now)
    game = play(game, reply.move)
    moves.push(reply.move)
  }
  const outcome = game.outcome
  const winner = outcome?.winner === 'white' ? white : outcome?.winner === 'black' ? black : 'draw'
  score[winner] = (score[winner] ?? 0) + 1
  const seconds = ((now() - began) / 1_000).toFixed(1)
  console.log(
    `${String(index + 1).padStart(3)}. ${white} (White) v ${black} (Black): ${outcome?.kind ?? 'unfinished'}, ` +
      `${winner === 'draw' ? 'drawn' : `${winner} wins`}, ${moves.length} plies, ${seconds} s`,
  )
}
console.log(score)
