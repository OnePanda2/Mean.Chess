import { useContext } from 'react'
import type { Piece } from '../engine/index.ts'
import { PixelPiece } from './pieces/PixelPiece.tsx'
import { PieceStyleContext } from './pieces/pieceStyle.ts'
import { VectorPiece } from './pieces/VectorPiece.tsx'

/**
 * A piece in the current theme's artwork (original Mean Chess drawings, vector or pixel).
 * A promoted queen carries a small mark so it is never mistaken for the original.
 */
export function PieceImage({ piece, className }: { readonly piece: Piece; readonly className?: string }) {
  const style = useContext(PieceStyleContext)
  const promoted = piece.queenOrigin === 'promoted'
  return (
    <span className={`piece-image piece-image--${piece.color}${className ? ` ${className}` : ''}`}>
      {style === 'pixel' ? <PixelPiece type={piece.type} /> : <VectorPiece type={piece.type} />}
      {promoted && <span className="promoted-mark" title="Promoted queen: can be sacrificed" />}
    </span>
  )
}
