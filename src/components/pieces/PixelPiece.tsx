import type { PieceType } from '../../engine/index.ts'
import { CELL_CLASS, SPRITE_RUNS } from './pixelSprites.ts'

/** A 16×16 pixel-art piece (see pixelSprites.ts), drawn with crisp edges at any size. */
export function PixelPiece({ type }: { readonly type: PieceType }) {
  return (
    <svg
      className="piece-art piece-art--pixel"
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      {SPRITE_RUNS[type].map((run) => (
        <rect key={`${run.x}-${run.y}`} className={CELL_CLASS[run.cell]} x={run.x} y={run.y} width={run.width} height={1} />
      ))}
    </svg>
  )
}
