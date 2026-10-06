/**
 * Curated positions for the Scenario Lab, the rules page and the landing cards. Every position is
 * from the verified catalogue in docs/BLUEPRINT.md §6.2 (ids in brackets); a UI test proves each
 * one parses and behaves as described.
 */
export interface Scenario {
  readonly id: string
  readonly group: 'Royal Capture' | 'Royal Slaughter' | 'Royal Cannibalism' | 'Kill Zone' | 'Classic positions'
  readonly title: string
  /** What to try, written to the player. */
  readonly prompt: string
  readonly fen: string
}

export const SCENARIOS: readonly Scenario[] = [
  {
    id: 'royal-capture',
    group: 'Royal Capture',
    title: 'Walk into the Kill Zone',
    prompt:
      'Black to move. Step the king to f3: it is legal, but it stands two squares from the white king. Then, as White, capture it.',
    fen: '8/8/8/8/4k3/8/8/7K b - - 0 1', // A1
  },
  {
    id: 'royal-capture-in-check',
    group: 'Royal Capture',
    title: 'Capture while in check',
    prompt: 'White is in check from the rook, yet the king may still capture the enemy king on f3 and win.',
    fen: '8/8/8/8/8/5k2/8/r6K w - - 0 1', // A3
  },
  {
    id: 'corner-zugzwang',
    group: 'Kill Zone',
    title: 'Cornered',
    prompt:
      'The white king has one legal move, and it walks into the Kill Zone. Kings a knight’s jump apart cannot capture each other; two squares apart in a straight line, they can.',
    fen: '8/8/8/8/8/8/2k5/K7 w - - 0 1', // A5
  },
  {
    id: 'slaughter-pawn',
    group: 'Royal Slaughter',
    title: 'King, pawn, king',
    prompt: 'White to move. The pawn between the kings is White’s eligible sacrifice: the king eats it and takes the black king in one move.',
    fen: '8/8/8/8/8/4k3/4P3/4K3 w - - 0 1', // B1
  },
  {
    id: 'slaughter-blocked',
    group: 'Royal Slaughter',
    title: 'Not while a pawn remains',
    prompt: 'The knight between the kings cannot be sacrificed: White still has a pawn on a2, and pawns go first.',
    fen: '8/8/8/8/8/4k3/P3N3/4K3 w - - 0 1', // B3
  },
  {
    id: 'slaughter-knight',
    group: 'Royal Slaughter',
    title: 'The knight is fair game',
    prompt: 'With no pawns left, knights and bishops are eligible. Royal Slaughter through the knight wins.',
    fen: '8/8/8/8/8/4k3/4N3/4K3 w - - 0 1', // B4
  },
  {
    id: 'slaughter-rook',
    group: 'Royal Slaughter',
    title: 'A rook on the diagonal',
    prompt: 'Only rooks remain, so the rook is eligible. On a diagonal it does not attack the black king, so the slaughter is possible.',
    fen: '8/8/8/8/8/4k3/3R4/2K5 w - - 0 1', // B6
  },
  {
    id: 'enemy-blocker',
    group: 'Royal Slaughter',
    title: 'An enemy in the way',
    prompt: 'White cannot jump the black knight. With Black to move, Black slaughters through it instead.',
    fen: '8/8/8/8/8/4k3/4n3/4K3 b - - 0 1', // B9
  },
  {
    id: 'cannibal-back-rank',
    group: 'Royal Cannibalism',
    title: 'Back-rank escape',
    prompt: 'Standard chess calls this checkmate. In Mean Chess the king may eat one of its own pawns to escape.',
    fen: 'k7/8/8/8/8/8/5PPP/4r1K1 w - - 0 1', // C1
  },
  {
    id: 'cannibal-minor',
    group: 'Royal Cannibalism',
    title: 'Smothered by its own army',
    prompt: 'No pawns are left, so the king may eat the adjacent knight or either bishop.',
    fen: '4k3/8/8/8/8/8/5nBB/6NK w - - 0 1', // C3
  },
  {
    id: 'cannibal-blocked',
    group: 'Royal Cannibalism',
    title: 'One pawn too many',
    prompt: 'The same position with a white pawn on a2. Pawns must go first and none is adjacent: checkmate.',
    fen: '4k3/8/8/8/8/8/P4nBB/6NK w - - 0 1', // C4
  },
  {
    id: 'cannibal-promoted-queen',
    group: 'Royal Cannibalism',
    title: 'Sacrificing a promoted queen',
    prompt: 'The queen on g1 was promoted, so it is sacrificable once nothing lower remains.',
    fen: 'b2k4/8/8/8/7r/8/8/6Q~K w - - 0 1', // C7
  },
  {
    id: 'original-queen',
    group: 'Royal Cannibalism',
    title: 'The untouchable queen',
    prompt: 'The same position with the original queen: she can never be sacrificed. Checkmate.',
    fen: 'b2k4/8/8/8/7r/8/8/6QK w - - 0 1', // C8
  },
  {
    id: 'suicidal-escape',
    group: 'Royal Cannibalism',
    title: 'The only escape is suicide',
    prompt: 'Kh2 is legal but walks into the Kill Zone. Because every normal move loses, the king may eat the g2 pawn instead.',
    fen: '8/8/8/8/5k2/8/6P1/r6K w - - 0 1', // C9
  },
  {
    id: 'fools-mate',
    group: 'Classic positions',
    title: 'Fool’s mate fails',
    prompt: 'The fastest checkmate in chess is only check here: the white king eats its d2 or e2 pawn.',
    fen: 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3', // C10
  },
  {
    id: 'scholars-mate',
    group: 'Classic positions',
    title: 'Scholar’s mate works',
    prompt: 'The only pawn the black king could eat is d7, and the queen covers it. Checkmate stands.',
    fen: 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4', // C11
  },
  {
    id: 'castle-into-kill-zone',
    group: 'Kill Zone',
    title: 'Castling into danger',
    prompt: 'O-O is legal even though g1 is two squares from the black king. Royal reach is not an attack, but castling there loses.',
    fen: '8/8/8/8/8/6k1/P4N2/4K2R w K - 0 1', // D1
  },
  {
    id: 'last-pawn',
    group: 'Kill Zone',
    title: 'The poisoned pawn',
    prompt: 'Taking Black’s last pawn makes the black knight on e2 eligible, and Black then slaughters through it.',
    fen: '8/7p/8/8/8/4k3/4n3/4K2R w - - 0 1', // G1
  },
  {
    id: 'stalemate',
    group: 'Classic positions',
    title: 'Stalemate stays stalemate',
    prompt: 'White has no legal move and is not in check. Cannibalism needs check, so this is a draw.',
    fen: 'K7/P7/8/8/8/4k3/8/1r6 w - - 0 1', // E1
  },
]

export function findScenario(id: string): Scenario | undefined {
  return SCENARIOS.find((scenario) => scenario.id === id)
}
