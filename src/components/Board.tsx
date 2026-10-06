import { useRef, useState, type KeyboardEvent } from 'react'
import {
  explainMove,
  fileOf,
  findKing,
  opposite,
  pieceName,
  rankOf,
  royalReach,
  squareAt,
  squareName,
  type Explanation,
  type Move,
  type Piece,
  type Position,
  type PositionAnalysis,
  type Square,
} from '../engine/index.ts'
import { CrownIcon, SacrificeIcon, WarningIcon } from './Icons.tsx'
import { PieceImage } from './PieceImage.tsx'

/** The four levels of emphasis (docs/BLUEPRINT.md §5.3): plus a danger flag that can stack on any. */
type HintBase = 'move' | 'capture' | 'sacrifice' | 'win'

interface Hint {
  readonly base: HintBase
  readonly danger: boolean
  readonly label: string
  readonly explanation: Explanation | null
}

function hintFor(move: Move, analysis: PositionAnalysis): Hint {
  const explanation = explainMove(analysis, move)
  const danger = move.suicidal === true
  if (move.kind === 'royal-capture') return { base: 'win', danger, label: 'Royal Capture, wins the game', explanation }
  if (move.kind === 'royal-slaughter') return { base: 'win', danger, label: 'Royal Slaughter, wins the game', explanation }
  if (move.kind === 'self-capture') {
    return { base: 'sacrifice', danger, label: `sacrifice your ${pieceName(move.sacrificed)} (Royal Cannibalism)`, explanation }
  }
  return move.captured
    ? { base: 'capture', danger, label: 'capture', explanation }
    : { base: 'move', danger, label: 'move here', explanation }
}

/** Visual position of a square: column and row from the top-left, given the orientation. */
const placeOf = (sq: Square, flipped: boolean): { col: number; row: number } =>
  flipped ? { col: 7 - fileOf(sq), row: rankOf(sq) } : { col: fileOf(sq), row: 7 - rankOf(sq) }

const squareAtPlace = (col: number, row: number, flipped: boolean): Square =>
  flipped ? squareAt(7 - col, row) : squareAt(col, 7 - row)

const VISUAL_ORDER = Array.from({ length: 64 }, (_, index) => index)

export interface BoardProps {
  readonly position: Position
  readonly analysis: PositionAnalysis
  readonly selected: Square | null
  readonly lastMove: Move | null
  readonly flipped: boolean
  readonly showKillZones: boolean
  readonly interactive: boolean
  readonly onSquare: (square: Square) => void
  /** Escape pressed on the board. */
  readonly onDeselect?: () => void
  /** Called with the explanation of the hovered or focused target, or null. */
  readonly onHint?: (explanation: Explanation | null) => void
}

export function Board({
  position,
  analysis,
  selected,
  lastMove,
  flipped,
  showKillZones,
  interactive,
  onSquare,
  onDeselect,
  onHint,
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
  const ownKing = findKing(board, sideToMove)
  const checkSquare = analysis.inCheck ? ownKing : null
  const threatSquare = analysis.threat && !analysis.royal ? ownKing : null
  const eligible = new Set(selected === null ? analysis.cannibalism.map((move) => move.to) : [])
  const killZone = new Set(
    showKillZones
      ? royalReach(board, opposite(sideToMove)).filter((sq) => !board[sq] || sq === ownKing)
      : [],
  )
  const pieces: { piece: Piece; sq: Square }[] = []
  board.forEach((piece, sq) => {
    if (piece) pieces.push({ piece, sq })
  })

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
    <div className={`board${interactive ? '' : ' board--inactive'}`} onKeyDown={moveFocus}>
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
            threatSquare === sq ? 'in the Royal Kill Zone' : '',
            hint ? hint.label : '',
            hint?.danger ? 'walks into the Royal Kill Zone' : '',
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
        {pieces.map(({ piece, sq }) => {
          const { col, row } = placeOf(sq, flipped)
          return (
            <div key={piece.id} className="board__piece" style={{ transform: `translate(${col * 100}%, ${row * 100}%)` }}>
              <PieceImage piece={piece} />
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
              {killZone.has(sq) && <span className="hint hint--zone" />}
              {threatSquare === sq && <span className="hint hint--threat" />}
              {eligible.has(sq) && <span className="hint hint--eligible" />}
              {hint?.base === 'move' && <span className="hint hint--dot" />}
              {hint?.base === 'capture' && <span className="hint hint--ring" />}
              {hint?.base === 'sacrifice' && (
                <span className="hint hint--sacrifice">
                  <SacrificeIcon />
                </span>
              )}
              {hint?.base === 'win' && (
                <span className="hint hint--win">
                  <CrownIcon />
                  <span className="hint__label">Win</span>
                </span>
              )}
              {hint?.danger && (
                <span className="hint hint--danger">
                  <WarningIcon />
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
