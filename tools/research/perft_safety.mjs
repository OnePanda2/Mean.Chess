// Research: for standard perft positions, find the depths at which Mean Chess perft
// must equal standard perft, and predict the first diverging depth.
//
// Mean Chess legal moves = standard legal moves
//   + royal moves (kings at ray-distance 2)          -> impossible if king distance >= 3 at the node
//   + cannibalism (in check, no royal, every ordinary move suicidal)
//       suicidal needs post-move ray-distance 2      -> impossible if king distance >= 4 at the node
//       so with distance >= 4 cannibalism == "standard checkmate"
// Therefore perft(D) agrees with standard iff every INTERNAL node (depth 0..D-1)
// has king distance >= 4 and is not a standard checkmate.
import { Chess } from 'chess.js';

const positions = {
  start: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  kiwipete: 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
  pos3: '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
  pos4: 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',
  pos5: 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',
  pos6: 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10',
};

const FILES = 'abcdefgh';
function kingSquares(chess) {
  const b = chess.board(); // b[0] = rank 8
  const res = {};
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const p = b[r][f];
    if (p && p.type === 'k') res[p.color] = { f, r: 7 - r };
  }
  return res;
}
const dist = (a, b) => Math.max(Math.abs(a.f - b.f), Math.abs(a.r - b.r));
const sq = ({ f, r }) => FILES[f] + (r + 1);

// Tier of a piece for the cannibalism hierarchy (queens here are all "original" in these positions
// unless promoted in-tree; chess.js can't tell, so we treat queens as never-eligible: conservative,
// and correct for the start position where no promotions happen before depth 5).
const TIER = { p: 1, n: 2, b: 2, r: 3 };
function activeTier(chess, color) {
  let t = Infinity;
  for (const row of chess.board()) for (const p of row) if (p && p.color === color && TIER[p.type]) t = Math.min(t, TIER[p.type]);
  return t;
}
// Legal cannibalism moves for the side to move (assumes desperation already established).
function cannibalismMoves(chess) {
  const us = chess.turn(), them = us === 'w' ? 'b' : 'w';
  const ks = kingSquares(chess), k = ks[us], ek = ks[them];
  const tier = activeTier(chess, us);
  const out = [];
  for (let df = -1; df <= 1; df++) for (let dr = -1; dr <= 1; dr++) {
    if (!df && !dr) continue;
    const t = { f: k.f + df, r: k.r + dr };
    if (t.f < 0 || t.f > 7 || t.r < 0 || t.r > 7) continue;
    const p = chess.get(sq(t));
    if (!p || p.color !== us || TIER[p.type] !== tier) continue;
    if (dist(t, ek) <= 1) continue; // adjacent kings
    const c = new Chess(chess.fen());
    c.remove(sq(k)); c.remove(sq(t)); c.put({ type: 'k', color: us }, sq(t));
    if (!c.isAttacked(sq(t), them)) out.push(`K${sq(k)}x${sq(t)}(own ${p.type.toUpperCase()})`);
  }
  return out;
}

function analyse(name, fen, maxDepth) {
  const chess = new Chess(fen);
  const mates = Array(maxDepth + 1).fill(0);
  const minDist = Array(maxDepth + 1).fill(99);
  const nodes = Array(maxDepth + 1).fill(0);
  const mateDetails = [];
  // Internal nodes only (depth < maxDepth); leaves are bulk-counted.
  // Uses chess.js internals (0x88 squares, no SAN) — the same path its own perft() takes.
  const k0x = s => ({ f: s & 15, r: s >> 4 });
  function walk(d) {
    nodes[d]++;
    minDist[d] = Math.min(minDist[d], dist(k0x(chess._kings.w), k0x(chess._kings.b)));
    const moves = chess._moves({ legal: true });
    if (moves.length === 0) {
      if (chess._isKingAttacked(chess._turn)) {
        mates[d]++;
        const pub = new Chess(chess.fen());
        mateDetails.push({ depth: d, fen: pub.fen(), escapes: cannibalismMoves(pub) });
      }
      return;
    }
    if (d === maxDepth - 1) { nodes[d + 1] += moves.length; return; }
    for (const m of moves) { chess._makeMove(m); walk(d + 1); chess._undoMove(); }
  }
  walk(0);
  // First depth D at which an internal node breaks equivalence.
  let safeUpTo = maxDepth;
  for (let d = 0; d < maxDepth; d++) {
    if (mates[d] > 0 || minDist[d] < 4) { safeUpTo = d; break; }
  }
  console.log(`\n== ${name} ==`);
  console.log('depth:   ' + nodes.map((_, i) => String(i).padStart(9)).join(''));
  console.log('nodes:   ' + nodes.map(n => String(n).padStart(9)).join(''));
  console.log('mates:   ' + mates.map(n => String(n).padStart(9)).join(''));
  console.log('minKdist:' + minDist.map(n => String(n).padStart(9)).join(''));
  console.log(`Mean perft == standard perft for all depths <= ${safeUpTo}` + (safeUpTo < maxDepth ? '' : ` (checked to ${maxDepth})`));
  if (mateDetails.length) {
    const extra = mateDetails.filter(m => m.depth === safeUpTo).reduce((s, m) => s + m.escapes.length, 0);
    console.log(`Internal standard mates at depth ${safeUpTo}: ${mateDetails.filter(m => m.depth === safeUpTo).length}; cannibalism escapes found: ${extra}`);
    for (const m of mateDetails.slice(0, 10)) console.log(`  d${m.depth} ${m.fen}  ->  ${m.escapes.join(', ') || 'NO ESCAPE (still mate)'}`);
  }
}

const which = process.argv[2];
const depth = Number(process.argv[3] || 3);
analyse(which, positions[which], depth);
