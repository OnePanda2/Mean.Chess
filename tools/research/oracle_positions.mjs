// Research oracle (NOT the product engine): chess.js for standard legality + a thin Mean layer,
// used only to validate the blueprint's acceptance-test positions and expected results.
// Rules implemented exactly as decided:
//   royal: enemy king exactly 2 away on one of 8 straight lines; midpoint empty -> Royal Capture,
//          midpoint = own piece of the active tier -> Royal Slaughter. Available any time.
//   desperate: in check AND no royal move AND every ordinary legal move is suicidal
//              (suicidal = after it the opponent has a royal move). Includes "no ordinary moves".
//   cannibalism (only when desperate): king onto adjacent own piece of the active tier; the
//              resulting king square must not be attacked and not adjacent to the enemy king.
import { Chess } from 'chess.js';

const FILES = 'abcdefgh';
const sqName = (f, r) => FILES[f] + (r + 1);
const parseSq = s => ({ f: FILES.indexOf(s[0]), r: Number(s[1]) - 1 });

// MeanFEN: standard FEN where a promoted queen is written Q~ / q~.
function parseMeanFen(mfen) {
  const [placement, ...rest] = mfen.split(' ');
  const promoted = new Set();
  const ranks = placement.split('/');
  ranks.forEach((row, i) => {
    let f = 0; const r = 7 - i;
    for (let k = 0; k < row.length; k++) {
      const ch = row[k];
      if (/\d/.test(ch)) { f += Number(ch); continue; }
      if (row[k + 1] === '~') { promoted.add(sqName(f, r)); k++; }
      f++;
    }
  });
  return { fen: [placement.replace(/~/g, ''), ...rest].join(' '), promoted };
}

const TIER = { p: 1, n: 2, b: 2, r: 3 };
function tierOf(piece, square, promoted) {
  if (piece.type === 'q') return promoted.has(square) ? 4 : null; // original queen: never
  return TIER[piece.type] ?? null;                               // king: never
}
function activeTier(chess, color, promoted) {
  let t = Infinity;
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const s = sqName(f, r), p = chess.get(s);
    if (p && p.color === color) { const tt = tierOf(p, s, promoted); if (tt !== null) t = Math.min(t, tt); }
  }
  return t;
}
function kingOf(chess, color) {
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) { const p = chess.get(sqName(f, r)); if (p && p.type === 'k' && p.color === color) return { f, r }; }
  return null;
}
function royalMoves(chess, color, promoted) {
  const k = kingOf(chess, color), ek = kingOf(chess, color === 'w' ? 'b' : 'w');
  if (!k || !ek) return [];
  const df = ek.f - k.f, dr = ek.r - k.r, adf = Math.abs(df), adr = Math.abs(dr);
  const ray = (adf === 2 && adr === 0) || (adf === 0 && adr === 2) || (adf === 2 && adr === 2);
  if (!ray) return [];
  const mid = sqName(k.f + df / 2, k.r + dr / 2), mp = chess.get(mid);
  const label = `K${sqName(k.f, k.r)}x${sqName(ek.f, ek.r)}`;
  if (!mp) return [`ROYAL CAPTURE ${label}`];
  if (mp.color === color && tierOf(mp, mid, promoted) === activeTier(chess, color, promoted)) return [`ROYAL SLAUGHTER ${label} (eats own ${mp.type.toUpperCase()}${promoted.has(mid) ? '~' : ''} on ${mid})`];
  return [];
}
function movePromoted(promoted, m) {
  const next = new Set([...promoted].filter(s => s !== m.from && s !== m.to));
  if (promoted.has(m.from)) next.add(m.to);
  if (m.promotion === 'q') next.add(m.to);
  return next;
}
function analyse(title, mfen) {
  const { fen, promoted } = parseMeanFen(mfen);
  let chess;
  try { chess = new Chess(fen); } catch (e) { console.log(`\n### ${title}\n  chess.js REJECTED: ${e.message}`); return; }
  const us = chess.turn(), them = us === 'w' ? 'b' : 'w';
  const themInCheck = (() => { const k = kingOf(chess, them); return chess.isAttacked(sqName(k.f, k.r), us); })();
  const ordinary = chess.moves({ verbose: true });
  const royal = royalMoves(chess, us, promoted);
  const suicidal = ordinary.filter(m => { const c = new Chess(chess.fen()); c.move(m); return royalMoves(c, them, movePromoted(promoted, m)).length > 0; });
  const inCheck = chess.inCheck();
  const desperate = inCheck && royal.length === 0 && suicidal.length === ordinary.length;
  const cannibal = [];
  if (desperate) {
    const k = kingOf(chess, us), ek = kingOf(chess, them), tier = activeTier(chess, us, promoted);
    for (let df = -1; df <= 1; df++) for (let dr = -1; dr <= 1; dr++) {
      if (!df && !dr) continue;
      const t = { f: k.f + df, r: k.r + dr };
      if (t.f < 0 || t.f > 7 || t.r < 0 || t.r > 7) continue;
      const ts = sqName(t.f, t.r), p = chess.get(ts);
      if (!p || p.color !== us || tierOf(p, ts, promoted) !== tier) continue;
      if (Math.max(Math.abs(t.f - ek.f), Math.abs(t.r - ek.r)) <= 1) continue;
      const c = new Chess(chess.fen());
      c.remove(sqName(k.f, k.r)); c.remove(ts); c.put({ type: 'k', color: us }, ts);
      if (c.isAttacked(ts, them)) continue;
      const after = new Set([...promoted].filter(s => s !== ts));
      const sui = royalMoves(c, them, after).length > 0;
      cannibal.push(`K${sqName(k.f, k.r)}x${ts}(own ${p.type.toUpperCase()}${promoted.has(ts) ? '~' : ''})${sui ? ' [suicidal]' : ''}`);
    }
  }
  const total = royal.length + ordinary.length + cannibal.length;
  const meanStatus = total === 0 ? (inCheck ? 'CHECKMATE' : 'STALEMATE') : royal.length ? 'ROYAL WIN AVAILABLE' : desperate ? (cannibal.length ? 'DESPERATE (cannibalism available)' : 'DOOMED (only suicidal moves)') : inCheck ? 'CHECK' : 'ongoing';
  const stdStatus = chess.isCheckmate() ? 'checkmate' : chess.isStalemate() ? 'stalemate' : chess.inCheck() ? 'check' : 'ongoing';
  console.log(`\n### ${title}\n  ${mfen}`);
  console.log(`  legal-at-this-turn: ${themInCheck ? 'NO (side not to move is in check)' : 'yes'} | standard: ${stdStatus}, ${ordinary.length} moves | MEAN: ${meanStatus}`);
  if (royal.length) console.log(`  royal: ${royal.join('; ')}`);
  if (ordinary.length && ordinary.length <= 8) console.log(`  ordinary: ${ordinary.map(m => m.san + (suicidal.includes(m) ? '[suicidal]' : '')).join(' ')}`);
  else if (suicidal.length) console.log(`  suicidal ordinary: ${suicidal.map(m => m.san).join(' ')} (of ${ordinary.length})`);
  if (desperate) console.log(`  cannibalism: ${cannibal.join(', ') || 'none legal'}`);
}

const P = [
  ['A1 Royal Capture setup (Black to move, Kf3 walks into the Kill Zone)', '8/8/8/8/4k3/8/8/7K b - - 0 1'],
  ['A2 ...after 1...Kf3: White to move', '8/8/8/8/8/5k2/8/7K w - - 0 1'],
  ['A3 Royal Capture while in ordinary check (handoff s.11)', '8/8/8/8/8/5k2/8/r6K w - - 0 1'],
  ['A4 Distance 3: no capture', '8/8/8/8/8/8/8/K2k4 w - - 0 1'],
  ['A5 Knight-shaped distance 2 = safe stand-off; corner zugzwang', '8/8/8/8/8/8/2k5/K7 w - - 0 1'],
  ['B1 Slaughter through pawn (vertical)', '8/8/8/8/8/4k3/4P3/4K3 w - - 0 1'],
  ['B2 Same, Black to move: blocked by enemy pawn', '8/8/8/8/8/4k3/4P3/4K3 b - - 0 1'],
  ['B3 Knight blocker while a pawn exists elsewhere: NO slaughter', '8/8/8/8/8/4k3/P3N3/4K3 w - - 0 1'],
  ['B4 Knight blocker, no pawns: slaughter', '8/8/8/8/8/4k3/4N3/4K3 w - - 0 1'],
  ['B5 Bishop blocker on a file, no pawns: slaughter', '8/8/8/8/8/4k3/4B3/4K3 w - - 0 1'],
  ['B6 Rook blocker on a diagonal, rook tier: slaughter', '8/8/8/8/8/4k3/3R4/2K5 w - - 0 1'],
  ['B7 Rook blocker while a knight exists: NO slaughter', '8/8/8/8/8/4k3/3R4/2K4N w - - 0 1'],
  ['B8 Enemy knight between kings (White to move): no capture', '8/8/8/8/8/4k3/4n3/4K3 w - - 0 1'],
  ['B9 Same, Black to move: Black slaughters through its own knight', '8/8/8/8/8/4k3/4n3/4K3 b - - 0 1'],
  ['B10 Promoted queen between kings: ILLEGAL position (queen gives check)', '8/8/8/8/8/4k3/4Q~3/4K3 w - - 0 1'],
  ['B11 Pawn on its capture diagonal between kings: ILLEGAL (pawn gives check)', '8/8/8/8/8/4k3/3P4/2K5 w - - 0 1'],
  ['B12 Pawn diagonal the other way: slaughter', '8/8/8/8/8/4K3/3P4/2k5 w - - 0 1'],
  ['C1 Back-rank mate -> pawn cannibalism', 'k7/8/8/8/8/8/5PPP/4r1K1 w - - 0 1'],
  ['C2 Back-rank, f2 covered by a bishop -> only g2/h2', 'k7/8/8/2b5/8/8/5PPP/4r1K1 w - - 0 1'],
  ['C3 Smothered by own minors, no pawns -> minor cannibalism', '4k3/8/8/8/8/8/5nBB/6NK w - - 0 1'],
  ['C4 Same + a pawn on a2 -> hierarchy blocks -> MEAN CHECKMATE', '4k3/8/8/8/8/8/P4nBB/6NK w - - 0 1'],
  ['C5 Rook tier (double check)', 'b2k4/8/8/8/8/8/5n1R/6RK w - - 0 1'],
  ['C6 Rook tier blocked by a knight elsewhere -> MEAN CHECKMATE', 'b2k4/8/8/8/8/8/5n1R/N5RK w - - 0 1'],
  ['C7 Promoted queen tier', 'b2k4/8/8/8/7r/8/8/6Q~K w - - 0 1'],
  ['C8 Original queen trap -> MEAN CHECKMATE', 'b2k4/8/8/8/7r/8/8/6QK w - - 0 1'],
  ['C9 Only escape is suicidal -> cannibalism allowed (founder decision)', '8/8/8/8/5k2/8/6P1/r6K w - - 0 1'],
  ["C10 Fool's mate is not mate", 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3'],
  ["C11 Scholar's mate still mates", 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4'],
  ['C12 Smothered mate (Nf7#) -> pawn cannibalism', '6rk/5Npp/8/8/8/8/8/K7 b - - 0 1'],
  ['G1 Capturing the last enemy pawn arms their Royal Slaughter (Rxh7 suicidal)', '8/7p/8/8/8/4k3/4n3/4K2R w - - 0 1'],
  ['D1 Castling into the Kill Zone is legal (and suicidal)', '8/8/8/8/8/6k1/P4N2/4K2R w K - 0 1'],
  ['D2 Castling through a square adjacent to the enemy king: illegal', '8/8/8/8/8/8/P4Nk1/4K2R w K - 0 1'],
  ['E1 Stalemate with an eatable pawn: still stalemate', 'K7/P7/8/8/8/4k3/8/1r6 w - - 0 1'],
];
for (const [t, f] of P) analyse(t, f);
