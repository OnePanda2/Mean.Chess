import { chebyshev, findKing, opposite, type Move, type Position } from '../engine/index.ts'
import type { Mark } from '../components/MiniBoard.tsx'

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
  /** Pictures for lessons without a task. */
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

const KILLED = 'The black king took yours. Try again.'

/**
 * The Mean Chess tutorial (docs/DECISIONS.md D-48): the rules that differ from standard chess, one
 * at a time, each tried on a real board. tests/ui/tutorial.test.tsx checks every position with the
 * rules engine.
 */
export const LESSONS: readonly Lesson[] = [
  {
    id: 'royal-capture',
    title: 'Kings capture kings',
    paragraphs: [
      'Everything you know about chess still applies: how the pieces move, check, checkmate, castling. Mean Chess adds a few rules about kings.',
      'Only a king can capture a king. It does it from exactly two squares away, in a straight line along a row, a column or a diagonal, when the square between them is empty. That is a Royal Capture, and it ends the game on the spot, even if your own king is in check.',
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
      'Only some pieces may be eaten this way, as the next lesson explains. A pawn always may, as long as you have one.',
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
    id: 'sacrifice-order',
    title: 'Pawns go first',
    paragraphs: [
      'Your king may only eat pieces from your lowest group still on the board: pawns first, then knights and bishops, then rooks, then promoted queens. Your original queen can never be eaten.',
      'In the shield lesson White still had a pawn, so the knight could not be eaten. Here White has no pawns left, so knights and bishops are fair game.',
    ],
    task: {
      fen: '8/8/8/8/8/4k3/4N3/4K3 w - - 0 1',
      instruction: 'Royal Slaughter through your knight.',
      solves: isRoyalSlaughter,
      success: 'With no pawns left, the knight was yours to sacrifice.',
      retry: 'Your knight is your lowest group now. Select your king and capture on e3, through the knight.',
      punished: 'You moved your knight out from between the kings, and the black king took yours. Try again.',
    },
  },
  {
    id: 'cannibalism',
    title: 'Royal Cannibalism',
    paragraphs: [
      'Checkmated? Not yet. When your king is in check and has no safe way out, it may eat a piece next to it, from your lowest group, to escape. That is Royal Cannibalism.',
      'If no such piece is next to your king, or the escape square is still attacked, checkmate stands.',
    ],
    task: {
      fen: 'k7/8/8/8/8/8/5PPP/4r1K1 w - - 0 1',
      instruction: 'In regular chess this is checkmate. Escape by eating one of your own pawns.',
      solves: isCannibalism,
      success: 'Escaped. Your king ate its own pawn and lives on.',
      retry: 'Select your king and move it onto one of your pawns on f2, g2 or h2.',
      punished: KILLED,
    },
  },
  {
    id: 'desperate',
    title: 'When every escape is deadly',
    paragraphs: [
      'Cannibalism is also allowed when your king does have ordinary escapes, but every one of them walks into the Kill Zone.',
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
    title: 'Queens, and how games end',
    paragraphs: [
      'The queen you start with is your original queen: she can never be eaten. A queen made by promotion is a promoted queen, marked on the board, and she is the last group your king may eat.',
      'A game ends with a Royal Capture or Royal Slaughter, with checkmate, or when a player resigns. It is a draw after stalemate, when the same position happens three times, after fifty moves each without a pawn move, capture or sacrifice, or by agreement.',
      'Unlike regular chess, a lack of material is never a draw. Even a lone knight can win, because a cornered king soon has nowhere safe to go.',
    ],
    diagrams: [
      {
        fen: '8/8/8/8/8/8/2k5/K7 w - - 0 1',
        marks: { a2: 'danger' },
        caption: 'Cornered: White’s only legal move, to a2, walks into the Kill Zone.',
      },
    ],
  },
]
