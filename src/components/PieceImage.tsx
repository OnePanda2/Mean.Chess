import bB from '../assets/pieces/bB.svg'
import bK from '../assets/pieces/bK.svg'
import bN from '../assets/pieces/bN.svg'
import bP from '../assets/pieces/bP.svg'
import bQ from '../assets/pieces/bQ.svg'
import bR from '../assets/pieces/bR.svg'
import wB from '../assets/pieces/wB.svg'
import wK from '../assets/pieces/wK.svg'
import wN from '../assets/pieces/wN.svg'
import wP from '../assets/pieces/wP.svg'
import wQ from '../assets/pieces/wQ.svg'
import wR from '../assets/pieces/wR.svg'
import type { Piece, PieceType } from '../engine/index.ts'

// Piece artwork: Cburnett (Colin M.L. Burnett), BSD-3-Clause; see THIRD_PARTY_NOTICES.md.
const IMAGES: Readonly<Record<'white' | 'black', Readonly<Record<PieceType, string>>>> = {
  white: { king: wK, queen: wQ, rook: wR, bishop: wB, knight: wN, pawn: wP },
  black: { king: bK, queen: bQ, rook: bR, bishop: bB, knight: bN, pawn: bP },
}

/** A piece drawing. A promoted queen carries a small brass mark so it is never mistaken for the original. */
export function PieceImage({ piece, className }: { readonly piece: Piece; readonly className?: string }) {
  const promoted = piece.queenOrigin === 'promoted'
  return (
    <span className={`piece-image${className ? ` ${className}` : ''}`}>
      <img src={IMAGES[piece.color][piece.type]} alt="" draggable={false} />
      {promoted && <span className="promoted-mark" title="Promoted queen: can be sacrificed" />}
    </span>
  )
}
