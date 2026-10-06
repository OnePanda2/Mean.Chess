/**
 * Perft from the command line (handoff §26):
 *
 *   npm run perft -- <position> <depth> [--divide | --detailed]
 *
 * <position> is a MeanFEN in quotes or one of: start, kiwipete, position3, position4, position5,
 * position6. Runs directly under Node's TypeScript type stripping (Node 22.18+ / 24+).
 */
import { parseMeanFen, perft, perftDetailed, perftDivide } from '../src/engine/index.ts'

const NAMED: Readonly<Record<string, string>> = {
  start: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  kiwipete: 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
  position3: '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
  position4: 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',
  position5: 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',
  position6: 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10',
}

const [positionArgument = 'start', depthArgument = '4', mode = ''] = process.argv.slice(2)
const fen = NAMED[positionArgument] ?? positionArgument
const depth = Number(depthArgument)
const parsed = parseMeanFen(fen)

if (!parsed.ok || !Number.isInteger(depth) || depth < 0) {
  console.error(parsed.ok ? `Bad depth "${depthArgument}".` : `Bad position: ${parsed.error}`)
  console.error('Usage: npm run perft -- <MeanFEN | start | kiwipete | position3..6> <depth> [--divide | --detailed]')
  process.exit(1)
}

const started = performance.now()
if (mode === '--divide') {
  let total = 0
  for (const [move, nodes] of [...perftDivide(parsed.position, depth)].sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`${move}: ${nodes}`)
    total += nodes
  }
  console.log(`\nTotal: ${total}`)
} else if (mode === '--detailed') {
  console.table(perftDetailed(parsed.position, depth))
} else {
  console.log(`perft(${depth}) = ${perft(parsed.position, depth)}`)
}
console.log(`${((performance.now() - started) / 1000).toFixed(2)} s`)
