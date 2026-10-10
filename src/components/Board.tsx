import { useRef, useState, type CSSProperties, type KeyboardEvent, type ReactElement } from 'react'
import {
  explainMove,
  fileOf,
  findKing,
  pieceName,
  rankOf,
  squareAt,
  squareName,
  type Explanation,
  type Move,
  type Piece,
  type Position,
  type PositionAnalysis,
  type Square,
} from '../engine/index.ts'
import { SLICE_MS, type Badge, type BadgeKind } from '../app/ending.ts'
import type { Transition } from '../app/gameState.ts'
import { CrownIcon, FlagIcon, HalfIcon, SacrificeIcon, SkullIcon } from './Icons.tsx'
import { PieceImage } from './PieceImage.tsx'

/**
 * How a legal target is marked. Nothing marks a move that walks into the Royal Kill Zone (D-39), and
 * a Royal Capture or Slaughter looks like any ordinary capture, with no "wins the game" text (D-46):
 * spotting both is part of the game.
 */
type HintBase = 'move' | 'capture' | 'sacrifice'

interface Hint {
  readonly base: HintBase
  readonly label: string
  readonly explanation: Explanation | null
}

function hintFor(move: Move, analysis: PositionAnalysis): Hint {
  if (move.kind === 'royal-capture' || move.kind === 'royal-slaughter') {
    return { base: 'capture', label: 'capture', explanation: null }
  }
  const explanation = explainMove(analysis, move)
  if (move.kind === 'self-capture') {
    return { base: 'sacrifice', label: `sacrifice your ${pieceName(move.sacrificed)} (Royal Cannibalism)`, explanation }
  }
  return move.captured
    ? { base: 'capture', label: 'capture', explanation }
    : { base: 'move', label: 'move here', explanation }
}

/** Visual position of a square: column and row from the top-left, given the orientation. */
const placeOf = (sq: Square, flipped: boolean): { col: number; row: number } =>
  flipped ? { col: 7 - fileOf(sq), row: rankOf(sq) } : { col: fileOf(sq), row: 7 - rankOf(sq) }

const squareAtPlace = (col: number, row: number, flipped: boolean): Square =>
  flipped ? squareAt(7 - col, row) : squareAt(col, 7 - row)

const VISUAL_ORDER = Array.from({ length: 64 }, (_, index) => index)

/** A captured or sacrificed piece, shown for one animation where it stood (styles/pieces.css). */
interface Ghost {
  readonly piece: Piece
  readonly sq: Square
  readonly variant: 'taken' | 'eaten' | 'royal' | 'sliced'
}

/** What to animate for this transition: ghosts, pieces that reappear, a promotion, a flash. */
function motionFor(transition: Transition, board: readonly (Piece | null)[]) {
  const ghosts: Ghost[] = []
  const appear = new Set<string>()
  let promoted: string | null = null
  let flash: 'royal' | 'sacrifice' | null = null
  // A Royal Slaughter slices the king's own piece first; the king strikes once it has gone (D-52).
  let slaughterer: string | null = null
  const { move } = transition
  if (transition.kind === 'move' && move) {
    const royal = move.kind === 'royal-capture' || move.kind === 'royal-slaughter'
    if (move.captured) {
      const sq = move.kind === 'en-passant' ? squareAt(fileOf(move.to), rankOf(move.from)) : move.to
      ghosts.push({ piece: move.captured, sq, variant: royal ? 'royal' : 'taken' })
    }
    if (move.sacrificed && move.sacrificeSquare !== undefined) {
      const variant = move.kind === 'royal-slaughter' ? 'sliced' : 'eaten'
      ghosts.push({ piece: move.sacrificed, sq: move.sacrificeSquare, variant })
    }
    if (move.kind === 'royal-slaughter') slaughterer = move.piece.id
    if (move.promotion) promoted = move.piece.id
    flash = royal ? 'royal' : move.kind === 'self-capture' ? 'sacrifice' : null
  } else if (transition.from) {
    // Undo or a new position: pieces that were not on the board a moment ago fade in.
    const before = new Set(transition.from.board.flatMap((piece) => (piece ? [piece.id] : [])))
    for (const piece of board) if (piece && !before.has(piece.id)) appear.add(piece.id)
  }
  return { ghosts, appear, promoted, flash, slaughterer }
}

/**
 * Blood from the cut (viewBox units). The slash runs from (104,18) to (-4,72), so y = 72 - 0.54x; the
 * drips start where it crosses the middle of a piece, and run down its body.
 */
const DRIPS = [
  { x: 37, y: 52, length: 24, delay: 170 },
  { x: 45, y: 47.7, length: 33, delay: 230 },
  { x: 54, y: 42.8, length: 27, delay: 190 },
  { x: 62, y: 38.5, length: 19, delay: 280 },
] as const
const SPLATTER = [
  { cx: 46, cy: 47, r: 2.6, dx: -18, dy: -15 },
  { cx: 55, cy: 42, r: 2.2, dx: 16, dy: -19 },
  { cx: 40, cy: 50, r: 1.8, dx: -22, dy: 6 },
  { cx: 60, cy: 39, r: 1.7, dx: 22, dy: 3 },
  { cx: 50, cy: 45, r: 1.4, dx: 5, dy: -24 },
] as const

/** Royal Slaughter (D-52): the king's own piece is cut in half, bleeds, and fades before the king strikes. */
function SlicedPiece({ piece }: { readonly piece: Piece }) {
  return (
    <div className="slice">
      <div className="slice__half slice__half--upper">
        <PieceImage piece={piece} />
      </div>
      <div className="slice__half slice__half--lower">
        <PieceImage piece={piece} />
      </div>
      <svg className="slice__fx" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <g className="slice__blood">
          <ellipse className="slice__pool" cx="48" cy="88" rx="28" ry="5" />
          {DRIPS.map((drip) => (
            <g
              key={drip.x}
              className="slice__drip"
              style={{ '--drip-delay': `${drip.delay}ms`, '--bead-rise': `-${drip.length}px` } as CSSProperties}
            >
              <rect className="slice__stream" x={drip.x - 2.3} y={drip.y} width="4.6" height={drip.length} rx="2.3" />
              <circle className="slice__bead" cx={drip.x} cy={drip.y + drip.length - 1.5} r="3.3" />
            </g>
          ))}
          {SPLATTER.map((drop) => (
            <circle
              key={`${drop.cx}-${drop.cy}`}
              className="slice__spray"
              cx={drop.cx}
              cy={drop.cy}
              r={drop.r}
              style={{ '--dx': `${drop.dx}px`, '--dy': `${drop.dy}px` } as CSSProperties}
            />
          ))}
        </g>
        <line className="slice__blade" x1="104" y1="18" x2="-4" y2="72" pathLength={1} />
      </svg>
    </div>
  )
}

const BADGE_ICONS: Readonly<Record<BadgeKind, () => ReactElement>> = {
  crown: CrownIcon,
  skull: SkullIcon,
  flag: FlagIcon,
  draw: HalfIcon,
}

/** How a finished game is marked on the board (D-52): badges on the kings, after the final move. */
export interface BoardEnding {
  /** Changes with each new ending, so its animations play once. */
  readonly key: string
  readonly badges: readonly Badge[]
  /** When the badges appear, in milliseconds (they wait for the final move's animation). */
  readonly delayMs: number
}

export interface BoardProps {
  readonly position: Position
  readonly analysis: PositionAnalysis
  readonly selected: Square | null
  readonly lastMove: Move | null
  readonly flipped: boolean
  readonly interactive: boolean
  /** The latest change, for animation (gameState.ts). */
  readonly transition: Transition
  /** False when the player switched movement off. */
  readonly animate: boolean
  readonly onSquare: (square: Square) => void
  /** Escape pressed on the board. */
  readonly onDeselect?: () => void
  /** Called with the explanation of the hovered or focused target, or null. */
  readonly onHint?: (explanation: Explanation | null) => void
  /** A finished game's badges (play page only). */
  readonly ending?: BoardEnding | null
}

export function Board({
  position,
  analysis,
  selected,
  lastMove,
  flipped,
  interactive,
  transition,
  animate,
  onSquare,
  onDeselect,
  onHint,
  ending = null,
}: BoardProps) {
  const { board, sideToMove } = position
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const [focusSquare, setFocusSquare] = useState<Square>(squareAtPlace(0, 7, flipped))

  const targets = new Map<Square, Hint>()
  if (selected !== null) {
    for (const move of analysis.legal) {
      if (move.from === selected && !targets.has(move.to)) targets.set(move.to, hintFor(move, analysis))
    }
  }
  const checkSquare = analysis.inCheck ? findKing(board, sideToMove) : null
  const eligible = new Set(selected === null ? analysis.cannibalism.map((move) => move.to) : [])
  const pieces: { piece: Piece; sq: Square }[] = []
  board.forEach((piece, sq) => {
    if (piece) pieces.push({ piece, sq })
  })
  // Rendered in a fixed order (by identity, not by square), so React never has to move a piece's
  // element when the piece moves: moving an element cancels its CSS slide, and the piece would jump.
  pieces.sort((a, b) => (a.piece.id < b.piece.id ? -1 : a.piece.id > b.piece.id ? 1 : 0))
  const motion = motionFor(transition, board)
  const translate = (sq: Square): string => {
    const { col, row } = placeOf(sq, flipped)
    return `translate(${col * 100}%, ${row * 100}%)`
  }

  function moveFocus(event: KeyboardEvent<HTMLDivElement>): void {
    const steps: Readonly<Record<string, readonly [number, number]>> = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
    }
    const step = steps[event.key]
    if (!step) {
      if (event.key === 'Escape') onDeselect?.()
      return
    }
    event.preventDefault()
    const { col, row } = placeOf(focusSquare, flipped)
    const next = squareAtPlace(Math.min(7, Math.max(0, col + step[0])), Math.min(7, Math.max(0, row + step[1])), flipped)
    setFocusSquare(next)
    buttons.current[next]?.focus()
  }

  return (
    <div
      className={`board${interactive ? '' : ' board--inactive'}${animate ? '' : ' board--still'}`}
      style={{ '--slice-duration': `${SLICE_MS}ms` } as CSSProperties}
      onKeyDown={moveFocus}
    >
      <div className="board__squares" role="group" aria-label="Mean Chess board">
        {VISUAL_ORDER.map((index) => {
          const sq = squareAtPlace(index % 8, Math.floor(index / 8), flipped)
          const piece = board[sq] ?? null
          const hint = targets.get(sq)
          const light = (fileOf(sq) + rankOf(sq)) % 2 === 1
          const { col, row } = placeOf(sq, flipped)
          const classes = [
            'square',
            light ? 'square--light' : 'square--dark',
            lastMove && (lastMove.from === sq || lastMove.to === sq) ? 'square--last' : '',
            selected === sq ? 'square--selected' : '',
            checkSquare === sq ? 'square--check' : '',
            piece?.color === sideToMove && interactive ? 'square--movable' : '',
          ]
          const label = [
            squareName(sq),
            piece ? `${piece.color} ${pieceName(piece)}` : 'empty',
            selected === sq ? 'selected' : '',
            checkSquare === sq ? 'in check' : '',
            hint ? hint.label : '',
            eligible.has(sq) ? 'can be sacrificed' : '',
          ]
          return (
            <button
              key={sq}
              ref={(element) => {
                buttons.current[sq] = element
              }}
              type="button"
              className={classes.filter(Boolean).join(' ')}
              data-square={squareName(sq)}
              tabIndex={sq === focusSquare ? 0 : -1}
              aria-label={label.filter(Boolean).join(', ')}
              onClick={() => {
                if (interactive) onSquare(sq)
              }}
              onMouseEnter={() => onHint?.(hint?.explanation ?? null)}
              onFocus={() => {
                setFocusSquare(sq)
                onHint?.(hint?.explanation ?? null)
              }}
            >
              {row === 7 && <span className="coord coord--file">{squareName(sq).charAt(0)}</span>}
              {col === 0 && <span className="coord coord--rank">{squareName(sq).charAt(1)}</span>}
            </button>
          )
        })}
      </div>

      <div className="board__pieces" aria-hidden="true">
        {ending?.badges
          .filter((badge) => badge.kind === 'crown')
          .map((badge) => (
            <div key={`glow-${ending.key}`} className="board__glow-cell" style={{ transform: translate(badge.sq) }}>
              <div className="board__glow" style={{ '--badge-delay': `${ending.delayMs}ms` } as CSSProperties} />
            </div>
          ))}
        {motion.ghosts.map((ghost) => (
          <div
            key={`ghost-${transition.id}-${ghost.piece.id}`}
            className={[
              'board__ghost',
              `board__ghost--${ghost.variant}`,
              motion.slaughterer && ghost.variant === 'royal' ? 'board__ghost--after-slice' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ transform: translate(ghost.sq) }}
          >
            {ghost.variant === 'sliced' ? (
              <SlicedPiece piece={ghost.piece} />
            ) : (
              <div className="board__art">
                <PieceImage piece={ghost.piece} />
              </div>
            )}
          </div>
        ))}
        {pieces.map(({ piece, sq }) => {
          const classes = [
            'board__piece',
            motion.appear.has(piece.id) ? 'board__piece--appear' : '',
            motion.promoted === piece.id ? 'board__piece--promoted' : '',
            motion.slaughterer === piece.id ? 'board__piece--after-slice' : '',
          ]
          return (
            <div key={piece.id} className={classes.filter(Boolean).join(' ')} style={{ transform: translate(sq) }}>
              <div className="board__art">
                <PieceImage piece={piece} />
              </div>
            </div>
          )
        })}
      </div>

      <div className="board__hints" aria-hidden="true">
        {VISUAL_ORDER.map((index) => {
          const sq = squareAtPlace(index % 8, Math.floor(index / 8), flipped)
          const hint = targets.get(sq)
          return (
            <div key={sq} className="hint-cell">
              {eligible.has(sq) && <span className="hint hint--eligible" />}
              {hint?.base === 'move' && <span className="hint hint--dot" />}
              {hint?.base === 'capture' && <span className="hint hint--ring" />}
              {hint?.base === 'sacrifice' && (
                <span className="hint hint--sacrifice">
                  <SacrificeIcon />
                </span>
              )}
            </div>
          )
        })}
      </div>

      {ending && ending.badges.length > 0 && (
        <div className="board__badges" aria-hidden="true">
          {ending.badges.map((badge) => {
            const Icon = BADGE_ICONS[badge.kind]
            return (
              <div
                key={`${ending.key}-${badge.kind}-${badge.sq}`}
                className="board__badge-cell"
                style={{ transform: translate(badge.sq) }}
              >
                <span
                  className={`end-badge end-badge--${badge.kind} end-badge--${badge.corner}`}
                  style={{ '--badge-delay': `${ending.delayMs}ms` } as CSSProperties}
                >
                  <Icon />
                </span>
              </div>
            )
          })}
        </div>
      )}

      {motion.flash && (
        <div
          key={`flash-${transition.id}`}
          className={`board__flash board__flash--${motion.flash}${motion.slaughterer ? ' board__flash--after-slice' : ''}`}
          aria-hidden="true"
        />
      )}
    </div>
  )
}
