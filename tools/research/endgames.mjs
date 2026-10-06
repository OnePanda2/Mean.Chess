// Research: solve tiny Mean Chess endgames by retrograde fixpoint, under the rules the founder chose:
//  - Royal Capture: enemy king exactly 2 squares away on one of the 8 straight lines,
//    midpoint empty  -> Royal Capture (immediate win)
//    midpoint = own piece of the active sacrifice tier -> Royal Slaughter (immediate win)
//  - Kill Zone is legal ground; adjacent kings illegal; only kings capture kings.
//  - Cannibalism irrelevant here (the lone king has nothing to eat; the strong side is never in check).
// Material: White K (+ optional N or B) vs Black lone K.  No 50-move rule (theoretical value).
const NONE = 64;
const W = 0, B = 1;
const f = s => s & 7, r = s => s >> 3;
const cheb = (a, b) => Math.max(Math.abs(f(a) - f(b)), Math.abs(r(a) - r(b)));
const on = (ff, rr) => ff >= 0 && ff < 8 && rr >= 0 && rr < 8;
const KING = [], KNIGHT = [], DIAG = [];
for (let s = 0; s < 64; s++) {
  KING[s] = []; KNIGHT[s] = []; DIAG[s] = [];
  for (let df = -1; df <= 1; df++) for (let dr = -1; dr <= 1; dr++) if ((df || dr) && on(f(s) + df, r(s) + dr)) KING[s].push(s + df + 8 * dr);
  for (const [df, dr] of [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]) if (on(f(s) + df, r(s) + dr)) KNIGHT[s].push(s + df + 8 * dr);
  for (const [df, dr] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const ray = []; let ff = f(s) + df, rr = r(s) + dr;
    while (on(ff, rr)) { ray.push(ff + 8 * rr); ff += df; rr += dr; }
    DIAG[s].push(ray);
  }
}
// Does white piece (type 'N'|'B') on p attack square t, given blocker squares (array)?
function pieceAttacks(type, p, t, blockers) {
  if (p === NONE || p === t) return false;
  if (type === 'N') return KNIGHT[p].includes(t);
  for (const ray of DIAG[p]) for (const s of ray) { if (s === t) return true; if (blockers.includes(s)) break; }
  return false;
}
// Royal move available to side whose king is kx against enemy king ke; mid holds `midOwner`.
function royalAvailable(kx, ke, p, side) {
  const df = f(ke) - f(kx), dr = r(ke) - r(kx);
  const adf = Math.abs(df), adr = Math.abs(dr);
  const ray = (adf === 2 && adr === 0) || (adf === 0 && adr === 2) || (adf === 2 && adr === 2);
  if (!ray) return false;
  const mid = kx + df / 2 + 8 * (dr / 2);
  if (mid !== p) return true;            // empty midpoint -> Royal Capture
  return side === W;                     // White's own N/B is the active tier (no pawns) -> Royal Slaughter; for Black it's an enemy blocker
}

function solve(type) {
  const N = 64 * 64 * 65 * 2;
  const idx = (wk, bk, p, stm) => ((wk * 64 + bk) * 65 + p) * 2 + stm;
  const val = new Uint8Array(N);        // 0 unknown, 1 WIN, 2 LOSS, 3 DRAW(stalemate), 255 invalid
  const ply = new Uint16Array(N);
  const start = new Int32Array(N + 1), edges = [];
  for (let wk = 0; wk < 64; wk++) for (let bk = 0; bk < 64; bk++) for (let p = 0; p <= 64; p++) for (let stm = 0; stm < 2; stm++) {
    const i = idx(wk, bk, p, stm);
    start[i] = edges.length;
    if (wk === bk || cheb(wk, bk) < 2 || p === wk || p === bk) { val[i] = 255; continue; }
    const blackInCheck = pieceAttacks(type, p, bk, [wk]);
    if (stm === W && blackInCheck) { val[i] = 255; continue; }
    if (stm === W ? royalAvailable(wk, bk, p, W) : royalAvailable(bk, wk, p, B)) { val[i] = 1; continue; }
    if (stm === W) {
      for (const t of KING[wk]) if (t !== p && cheb(t, bk) >= 2) edges.push(idx(t, bk, p, B));
      if (p !== NONE) {
        if (type === 'N') { for (const t of KNIGHT[p]) if (t !== wk && t !== bk) edges.push(idx(wk, bk, t, B)); }
        else for (const ray of DIAG[p]) for (const t of ray) { if (t === wk || t === bk) break; edges.push(idx(wk, bk, t, B)); }
      }
    } else {
      for (const t of KING[bk]) {
        if (t === wk || cheb(t, wk) < 2) continue;
        if (t === p) { edges.push(idx(wk, t, NONE, W)); continue; }      // capture the piece
        if (pieceAttacks(type, p, t, [wk])) continue;                     // origin square vacated
        edges.push(idx(wk, t, p, W));
      }
    }
    if (edges.length === start[i]) val[i] = (stm === B && blackInCheck) ? 2 : 3;  // mate : stalemate
  }
  start[N] = edges.length;
  const E = Int32Array.from(edges);
  for (let changed = true, it = 1; changed; it++) {
    changed = false;
    for (let i = 0; i < N; i++) {
      if (val[i] !== 0) continue;
      let anyLoss = false, allWin = true;
      for (let e = start[i]; e < start[i + 1]; e++) { const v = val[E[e]]; if (v === 2) { anyLoss = true; break; } if (v !== 1) allWin = false; }
      if (anyLoss) { val[i] = 1; ply[i] = it; changed = true; }
      else if (allWin) { val[i] = 2; ply[i] = it; changed = true; }
    }
  }
  return { val, ply, idx };
}

const name = s => 'abcdefgh'[f(s)] + (r(s) + 1);
function report(type) {
  const { val, ply, idx } = solve(type);
  const tally = (pieceSlice, stm) => {
    const c = { WIN: 0, LOSS: 0, DRAW: 0 }; let deepest = null;
    for (let wk = 0; wk < 64; wk++) for (let bk = 0; bk < 64; bk++) for (const p of pieceSlice) {
      const i = idx(wk, bk, p, stm), v = val[i];
      if (v === 255) continue;
      if (v === 1) { c.WIN++; if (!deepest || ply[i] > deepest.ply) deepest = { ply: ply[i], wk, bk, p }; }
      else if (v === 2) c.LOSS++; else c.DRAW++;
    }
    return { c, deepest };
  };
  const pieces = [...Array(64).keys()];
  if (type === 'N') {
    const kk = tally([NONE], W);
    const nonImmediate = (() => { let n = 0; for (let wk = 0; wk < 64; wk++) for (let bk = 0; bk < 64; bk++) { const i = idx(wk, bk, NONE, W); if (val[i] === 1 && ply[i] > 0) n++; } return n; })();
    console.log(`K vs K (side to move): ${JSON.stringify(kk.c)}; forced wins that are NOT an immediate Royal Capture: ${nonImmediate}`);
    if (kk.deepest && kk.deepest.ply > 0) console.log(`  deepest K-vs-K win: K${name(kk.deepest.wk)} vs K${name(kk.deepest.bk)}, side to move wins in ${kk.deepest.ply} plies`);
  }
  for (const stm of [W, B]) {
    const t = tally(pieces, stm);
    const total = t.c.WIN + t.c.LOSS + t.c.DRAW;
    const pct = k => (100 * t.c[k] / total).toFixed(1) + '%';
    console.log(`K+${type} vs K, ${stm === W ? 'White' : 'Black'} to move: WIN ${pct('WIN')}  LOSS ${pct('LOSS')}  DRAW ${pct('DRAW')}  (n=${total})` +
      (t.deepest ? `; longest forced win ${t.deepest.ply} plies e.g. WK${name(t.deepest.wk)} ${type}${name(t.deepest.p)} BK${name(t.deepest.bk)}` : ''));
  }
  return { val, idx };
}

const kn = report('N');
report('B');
// Spot-check the hand-derived corner zugzwang: Black Ka1 vs White Kc2, Black to move -> Black loses.
console.log('spot-check Ka1(b) vs Kc2(w), Black to move =', ['?', 'WIN', 'LOSS', 'DRAW'][kn.val[kn.idx(10, 0, NONE, B)]] ?? kn.val[kn.idx(10, 0, NONE, B)]);
