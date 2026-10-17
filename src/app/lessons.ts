import { applyMove, chebyshev, findKing, legalMoves, opposite, type Move, type Position } from '../engine/index.ts'
import type { Mark } from '../components/MiniBoard.tsx'

/** A second move to find, after the opponent's forced reply to the first (LessonTask.then). */
export interface LessonFollowUp {
  readonly instruction: string
  readonly solves: (move: Move, before: Position) => boolean
  readonly success: string
  readonly retry: string
}

/** A move for the player to find on a real board (the rules engine judges it). */
export interface LessonTask {
  /** The position, always with the player to move. */
  readonly fen: string
  /** What the player is asked to do. */
  readonly instruction: string
  /** Whether a move solves the task. */
  readonly solves: (move: Move, before: Position) => boolean
  readonly success: string
  /** After a legal move that neither solves the task nor loses the king. */
  readonly retry: string
  /** After a move into the Kill Zone, once the enemy king has taken the player's. */
  readonly punished: string
  /** Optional second step: the opponent plays its only move, then the player finds this one. */
  readonly then?: LessonFollowUp
}

export interface LessonDiagram {
  readonly fen: string
  readonly marks?: Readonly<Record<string, Mark>>
  readonly caption: string
}

export interface Lesson {
  readonly id: string
  readonly title: string
  readonly paragraphs: readonly string[]
  readonly task?: LessonTask
  /** Pictures: beside the text of a lesson with a task, or instead of the board without one. */
  readonly diagrams?: readonly LessonDiagram[]
}

const isRoyalCapture = (move: Move): boolean => move.kind === 'royal-capture'
const isRoyalSlaughter = (move: Move): boolean => move.kind === 'royal-slaughter'
const isCannibalism = (move: Move): boolean => move.kind === 'self-capture'

/** A safe move that brings the player's king closer to the enemy king. */
function approachesSafely(move: Move, before: Position): boolean {
  const enemy = findKing(before.board, opposite(before.sideToMove))
  if (move.piece.type !== 'king' || move.suicidal === true || enemy === null) return false
  return chebyshev(move.to, enemy) < chebyshev(move.from, enemy)
}

/** A safe move after which every move the opponent has walks into the player's Kill Zone. */
function corners(move: Move, before: Position): boolean {
  if (move.suicidal === true) return false
  const replies = legalMoves(applyMove(before, move))
  return replies.length > 0 && replies.every((reply) => reply.suicidal === true)
}

const KILLED = 'The black king took yours. Try again.'
const EAT_GLOWING = 'Select your king, then one of the glowing pieces next to it.'

/**
 * The Mean Chess tutorial (docs/DECISIONS.md D-48, D-53): the rules that differ from standard chess,
 * one at a time, each tried on a real board. It starts with the king eating its own pieces (when, in
 * which order, and never the original queen), then kings capturing kings. tests/ui/tutorial.test.tsx
 * checks every position with the rules engine.
 */
export const LESSONS: readonly Lesson[] = [
  {
    id: 'cannibalism',
    title: 'Your king can eat its own pieces',
    paragraphs: [
      'Everything you know about chess still applies: how the pieces move, check, castling, promotion. Mean Chess gives the king new powers. Here is the first.',
      'This is Fool’s mate, the fastest checkmate in chess. In Mean Chess the game isn’t over: when your king is in check and has no way out, it may eat one of its own pieces standing next to it, and take its square. That is Royal Cannibalism.',
      'The pieces your king may eat glow.',
    ],
    task: {
      fen: 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3',
      instruction: 'Black’s queen has your king in check, and in regular chess you have lost. Save your king by eating one of the glowing pawns.',
      solves: isCannibalism,
      success: 'Escaped. Your king ate its own pawn, and the game goes on.',
      retry: EAT_GLOWING,
      punished: KILLED,
    },
  },
  {
    id: 'last-resort',
    title: 'Only when there is no other way out',
    paragraphs: [
      'Eating your own piece is a last resort. If your king has any normal way out of check (blocking, capturing the attacker or stepping away), it must take it, and nothing glows.',
      'And without check there is no eating at all. If you are not in check and have no legal move, it is stalemate, a draw, exactly as in regular chess.',
    ],
    task: {
      fen: '8/k7/8/8/8/8/3N1PPP/4r1K1 w - - 0 1',
      instruction: 'The rook has your king in check again, but this time your pawns don’t glow. Find the normal way out.',
      solves: (move) => !isCannibalism(move) && move.suicidal !== true,
      success: 'Blocked. Because your knight could block the check, your king was not allowed to eat a pawn.',
      retry: 'Your knight can block the check.',
      punished: KILLED,
    },
    diagrams: [
      {
        fen: '1r5k/8/8/8/8/p7/P7/K7 w - - 0 1',
        marks: { a1: 'danger' },
        caption: 'Stalemate. White is not in check but has no legal move, so the king may not eat its pawn: the game is a draw.',
      },
    ],
  },
  {
    id: 'safe-square',
    title: 'The king must land safely',
    paragraphs: [
      'Your king may only eat a piece if it is safe on that square afterwards. A piece standing on a square the enemy attacks does not glow.',
    ],
    task: {
      fen: 'k7/8/8/2b5/5n2/8/5PPP/4r1K1 w - - 0 1',
      instruction: 'Escape the check by eating a pawn. Why does only one of them glow?',
      solves: isCannibalism,
      success: 'Right. The bishop on c5 watches f2 and the knight on f4 watches g2, so only h2 was safe.',
      retry: EAT_GLOWING,
      punished: KILLED,
    },
  },
  {
    id: 'pawns-first',
    title: 'Pawns first',
    paragraphs: [
      'Your king can’t eat just any piece. It eats in order, cheapest first: pawns, then knights and bishops, then rooks, then promoted queens.',
      'While you have a pawn anywhere on the board, only pawns may be eaten, even if that pawn is far away.',
    ],
    task: {
      fen: 'k7/8/8/8/8/8/5NPP/4r1K1 w - - 0 1',
      instruction: 'Your knight stands next to the king too, but it doesn’t glow. Escape by eating a pawn.',
      solves: (move) => isCannibalism(move) && move.sacrificed?.type === 'pawn',
      success: 'Right. While you have pawns, your knights and bishops can’t be eaten.',
      retry: EAT_GLOWING,
      punished: KILLED,
    },
    diagrams: [
      {
        fen: 'k7/8/8/8/8/P7/5NRB/4r1K1 w - - 0 1',
        marks: { a3: 'path' },
        caption: 'Checkmate. One pawn far away on a3 is enough: the knight and bishop next to the king can’t be eaten, and there is no other way out.',
      },
    ],
  },
  {
    id: 'knights-bishops',
    title: 'Then knights and bishops',
    paragraphs: ['With no pawns left, knights and bishops may be eaten. Rooks still have to wait.'],
    task: {
      fen: 'k7/8/8/8/8/8/5NRB/4r1K1 w - - 0 1',
      instruction: 'The same trap, without the pawn on a3. Escape by eating a knight or a bishop.',
      solves: (move) => isCannibalism(move) && (move.sacrificed?.type === 'knight' || move.sacrificed?.type === 'bishop'),
      success: 'Right. The rook didn’t glow: knights and bishops come before rooks.',
      retry: EAT_GLOWING,
      punished: KILLED,
    },
  },
  {
    id: 'rooks',
    title: 'Then rooks',
    paragraphs: [
      'With no pawns, knights or bishops left, rooks may be eaten.',
      'The queen on h2 is a promoted queen: she was made by promoting a pawn, and the board marks her. She comes last, as the next lesson shows.',
    ],
    task: {
      fen: 'k7/8/8/8/8/3n4/6RQ~/4r1K1 w - - 0 1',
      instruction: 'The knight on d3 guards f2. Escape by eating your rook.',
      solves: (move) => isCannibalism(move) && move.sacrificed?.type === 'rook',
      success: 'Right. Your promoted queen didn’t glow: rooks come before her.',
      retry: EAT_GLOWING,
      punished: KILLED,
    },
  },
  {
    id: 'promoted-queens',
    title: 'Then promoted queens',
    paragraphs: [
      'A promoted queen is the last piece in the order. Once nothing cheaper is left, she may be eaten too.',
    ],
    task: {
      fen: '3k4/8/8/8/8/5q2/7Q~/4r1K1 w - - 0 1',
      instruction: 'Only your promoted queen is left. Escape by eating her.',
      solves: (move) => isCannibalism(move) && move.sacrificed?.type === 'queen',
      success: 'Right. With nothing cheaper left, the promoted queen was food.',
      retry: EAT_GLOWING,
      punished: KILLED,
    },
  },
  {
    id: 'original-queen',
    title: 'Never the original queen',
    paragraphs: [
      'The queen you start the game with is your original queen. Your king can never eat her, not even to escape checkmate.',
      'Every other piece can be eaten once its turn in the order comes: pawns, then knights and bishops, then rooks, then promoted queens.',
    ],
    task: {
      fen: '3k4/8/8/8/8/5q2/7Q~/4r1KQ w - - 0 1',
      instruction: 'Both of your queens stand next to your king, but only one glows. Escape.',
      solves: (move) => isCannibalism(move) && move.sacrificed?.queenOrigin === 'promoted',
      success: 'Right. Your original queen on h1 is safe from your own king, so the promoted queen had to go.',
      retry: EAT_GLOWING,
      punished: KILLED,
    },
  },
  {
    id: 'royal-capture',
    title: 'Kings capture kings',
    paragraphs: [
      'Now the second power. Only a king can capture a king. It does it from exactly two squares away, in a straight line along a row, a column or a diagonal, when the square between them is empty.',
      'That is a Royal Capture, and it ends the game on the spot.',
    ],
    task: {
      fen: '8/8/8/8/8/5k2/8/7K w - - 0 1',
      instruction: 'Your king is on h1, two squares from the black king on f3. Capture it.',
      solves: isRoyalCapture,
      success: 'Royal Capture. The game is over the moment it happens.',
      retry: 'That was an ordinary king move. Select your king and capture the black king on f3.',
      punished: KILLED,
    },
  },
  {
    id: 'royal-capture-in-check',
    title: 'Even when you are in check',
    paragraphs: [
      'Other pieces still give check, but only a king can capture a king. And a Royal Capture is allowed even while your own king is in check.',
    ],
    task: {
      fen: '8/8/8/8/8/5k2/8/r6K w - - 0 1',
      instruction: 'The rook has your king in check. Win anyway.',
      solves: isRoyalCapture,
      success: 'Royal Capture. The check didn’t matter: the game ended with your move.',
      retry: 'Stepping away was legal, but you could win: capture the black king on f3.',
      punished: KILLED,
    },
  },
  {
    id: 'kill-zone',
    title: 'The Kill Zone',
    paragraphs: [
      'It works both ways. If your king ends its move two squares from the enemy king, in a straight line with nothing between them, the enemy king captures yours first. Those squares are the Kill Zone.',
      'Moving into the Kill Zone is legal, and it is not check, but it loses. During a game nothing on the board warns you: you have to see it coming.',
    ],
    task: {
      fen: '8/8/3k4/8/8/3K4/8/8 w - - 0 1',
      instruction: 'Bring your king one step closer to the black king without stepping into its Kill Zone.',
      solves: approachesSafely,
      success:
        'Safe. A king a knight’s jump away cannot capture yours: the two kings are not in a straight line. Straight ahead to d4 would have been the Kill Zone.',
      retry: 'Safe, but no closer. Try a square nearer the black king.',
      punished: 'The black king took yours: d4 is two squares straight below d6 with nothing between. Try again.',
    },
  },
  {
    id: 'shield',
    title: 'Shield your king',
    paragraphs: [
      'A piece standing between the two kings blocks the capture. A king never jumps over an enemy piece.',
      'So your own pieces can shield your king, and moving a shield out of the way hands the enemy king the win.',
    ],
    task: {
      fen: '8/8/8/8/8/4k3/P3N3/4K3 w - - 0 1',
      instruction: 'The black king on e3 is two squares from yours, but your knight on e2 stands between them. Make a move that keeps your king safe.',
      solves: (move) => move.suicidal !== true,
      success: 'Safe. While your knight stands between the kings, the black king cannot reach yours.',
      retry: 'Keep your knight between the kings.',
      punished: 'You moved your shield. With nothing between the kings, the black king took yours. Try again.',
    },
  },
  {
    id: 'royal-slaughter',
    title: 'Royal Slaughter',
    paragraphs: [
      'When the piece between the kings is your own, your king may eat it and capture the enemy king in the same move. That is a Royal Slaughter, and it wins the game.',
      'Only a piece your king could eat counts, in the same order as before: pawns first.',
    ],
    task: {
      fen: '8/8/8/8/8/4k3/4P3/4K3 w - - 0 1',
      instruction: 'Your pawn on e2 stands between the kings. Eat it and capture the black king.',
      solves: isRoyalSlaughter,
      success: 'Royal Slaughter. Your pawn was sacrificed, and the black king is gone.',
      retry: 'Your king can go straight through its own pawn: select the king and capture on e3.',
      punished: KILLED,
    },
  },
  {
    id: 'slaughter-order',
    title: 'The same order applies',
    paragraphs: [
      'In the shield lesson White still had a pawn on a2, so the knight between the kings was only a shield, never food.',
      'Here White has no pawns left, so knights and bishops are next in the order, and the knight can be sacrificed.',
    ],
    task: {
      fen: '8/8/8/8/8/4k3/4N3/4K3 w - - 0 1',
      instruction: 'Royal Slaughter through your knight.',
      solves: isRoyalSlaughter,
      success: 'With no pawns left, the knight was yours to sacrifice.',
      retry: 'Your knight is your cheapest piece now. Select your king and capture on e3, through the knight.',
      punished: 'You moved your knight out from between the kings, and the black king took yours. Try again.',
    },
  },
  {
    id: 'desperate',
    title: 'When every escape is deadly',
    paragraphs: [
      'One more case of “no other way out”: your king does have ordinary escapes, but every one of them walks into the Kill Zone. Then it may eat its own piece too.',
    ],
    task: {
      fen: '8/8/8/8/5k2/8/6P1/r6K w - - 0 1',
      instruction: 'The rook gives check. Find the only escape that does not lose.',
      solves: isCannibalism,
      success: 'Right. Kh2 was legal, but it stood two squares from the black king on a diagonal. Eating the g2 pawn was the only way out.',
      retry: 'Look at your pawn on g2.',
      punished: 'The black king took yours: h2 is two squares from f4 on a diagonal, with g3 empty. Try again.',
    },
  },
  {
    id: 'endings',
    title: 'A lone king can lose',
    paragraphs: [
      'There is no draw for lack of material. A cornered king soon runs out of safe squares, so even kings alone can decide a game.',
      'Draws come from stalemate, the same position three times, fifty moves each without a pawn move, capture or sacrifice, or agreement.',
    ],
    task: {
      fen: '8/8/8/8/8/3K4/8/k7 w - - 0 1',
      instruction: 'Corner the black king: make a move that leaves it no safe square.',
      solves: corners,
      success: 'Cornered. Its only move walks into your Kill Zone.',
      retry: 'The black king still has a safe square. Try to leave it none.',
      punished: 'The black king took yours: c3 is two squares from a1 on a diagonal. Try again.',
      then: {
        instruction: 'The black king had to step into your Kill Zone. Finish it.',
        solves: isRoyalCapture,
        success: 'Royal Capture with kings alone. In Mean Chess, material never saves a game.',
        retry: 'The black king is two squares from yours on the same row, with nothing between. Capture it.',
      },
    },
  },
]
