import { fileOf, parseMeanFen, parseSquare, rankOf, squareAt } from '../engine/index.ts'
import { CrownIcon, SacrificeIcon, WarningIcon } from './Icons.tsx'
import { PieceImage } from './PieceImage.tsx'

export type Mark = 'win' | 'sacrifice' | 'danger' | 'path'

/** A static diagram board for rules and cards. Not interactive. */
export function MiniBoard({
  fen,
  marks = {},
  label,
}: {
  readonly fen: string
  readonly marks?: Readonly<Record<string, Mark>>
  readonly label: string
}) {
  const parsed = parseMeanFen(fen)
  if (!parsed.ok) return null
  const { board } = parsed.position
  const marked = new Map<number, Mark>()
  for (const [name, mark] of Object.entries(marks)) {
    const sq = parseSquare(name)
    if (sq !== null) marked.set(sq, mark)
  }
  return (
    <div className="mini-board" role="img" aria-label={label}>
      {Array.from({ length: 64 }, (_, index) => {
        const sq = squareAt(index % 8, 7 - Math.floor(index / 8))
        const piece = board[sq]
        const mark = marked.get(sq)
        const light = (fileOf(sq) + rankOf(sq)) % 2 === 1
        return (
          <div key={sq} className={`mini-square ${light ? 'square--light' : 'square--dark'}${mark ? ` mini-square--${mark}` : ''}`}>
            {piece && <PieceImage piece={piece} />}
            {mark === 'win' && (
              <span className="mini-mark">
                <CrownIcon />
              </span>
            )}
            {mark === 'sacrifice' && (
              <span className="mini-mark">
                <SacrificeIcon />
              </span>
            )}
            {mark === 'danger' && (
              <span className="mini-mark">
                <WarningIcon />
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
