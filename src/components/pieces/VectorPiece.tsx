import type { ReactNode } from 'react'
import type { PieceType } from '../../engine/index.ts'

/*
 * Original Mean Chess piece artwork, vector edition. Drawn on a 100×100 grid with sharp,
 * mitred silhouettes. Every colour comes from CSS custom properties (styles/pieces.css), so one
 * drawing is reused by every theme that uses vector pieces.
 *
 *   .pa-body   filled shape with an outline       (--pf fill, --ps stroke)
 *   .pa-line   a carved line in the detail colour  (--pd)
 *   .pa-mark   a small filled detail               (--pd)
 *   .pa-accent eyes, windows and jewels            (--piece-accent)
 */

const PLINTH = 'M19 91 H81 L77 81 H23 Z'
/** The queen's flared skirt. */
const ROYAL_SKIRT = 'M35 59 H65 C64 68 69 76 74 81 H26 C31 76 36 68 35 59 Z'

const DRAWINGS: Readonly<Record<PieceType, ReactNode>> = {
  // The Warlord (D-51, founder's pick of three sketches): a crowned great helm with a red T-visor and
  // armoured shoulders, under the cross. Wider and taller than the queen; no bishop-like dome.
  king: (
    <>
      <path className="pa-body" d="M46 1 H54 V8 H62 V15 H54 V27 H46 V15 H38 V8 H46 Z" />
      <path className="pa-body" d="M24 36 L27 23 L34 30 L41 21 L47 29 L50 25 L53 29 L59 21 L66 30 L73 23 L76 36 Z" />
      <path className="pa-body" d="M23 35 H77 L75 55 L64 61 H36 L25 55 Z" />
      <path className="pa-accent" d="M32 43 H68 V47.5 H53 V57 H47 V47.5 H32 Z" />
      <path className="pa-body" d="M15 61 L30 57 H70 L85 61 L79 67 H21 Z" />
      <path className="pa-body" d="M30 67 H70 C70 72 74 77 79 81 H21 C26 77 30 72 30 67 Z" />
    </>
  ),
  queen: (
    <>
      <path className="pa-body" d="M28 52 L21 25 L35 39 L37 17 L45 37 L50 12 L55 37 L63 17 L65 39 L79 25 L72 52 Z" />
      <circle className="pa-accent" cx="21" cy="23" r="4" />
      <circle className="pa-accent" cx="37" cy="15" r="4" />
      <circle className="pa-accent" cx="50" cy="10" r="4" />
      <circle className="pa-accent" cx="63" cy="15" r="4" />
      <circle className="pa-accent" cx="79" cy="23" r="4" />
      <path className="pa-body" d="M28 52 H72 L69 59 H31 Z" />
      <path className="pa-body" d={ROYAL_SKIRT} />
      <path className="pa-line" d="M41 66 H59" />
    </>
  ),
  rook: (
    <>
      <path className="pa-body" d="M25 13 H36 V21 H44 V13 H56 V21 H64 V13 H75 V34 H25 Z" />
      <path className="pa-body" d="M26 34 H74 L71 41 H29 Z" />
      <path className="pa-body" d="M32 41 H68 L71 72 H29 Z" />
      <path className="pa-accent" d="M47 47 H53 V63 H47 Z" />
      <path className="pa-body" d="M25 72 H75 L77 81 H23 Z" />
    </>
  ),
  bishop: (
    <>
      <circle className="pa-body" cx="50" cy="11" r="6" />
      <path className="pa-body" d="M50 18 C37 28 32 41 35 52 C37 59 43 63 50 63 C57 63 63 59 65 52 C68 41 63 28 50 18 Z" />
      <path className="pa-cut" d="M42 33 L59 50" />
      <path className="pa-body" d="M37 63 H63 L60 70 H40 Z" />
      <path className="pa-body" d="M41 70 C40 75 33 78 27 81 H73 C67 78 60 75 59 70 Z" />
    </>
  ),
  knight: (
    <>
      <path
        className="pa-body"
        d="M29 81 L33 62 C26 60 20 56 16 50 L14 43 L21 36 L30 32 L36 21 L40 8 L47 17 L53 9 L57 21 C70 25 78 39 78 57 L76 81 Z"
      />
      <path className="pa-line" d="M57 21 C66 28 71 40 71 57" />
      <path className="pa-line" d="M33 62 C39 57 41 50 38 44" />
      <path className="pa-accent" d="M31 30 L39 27 L37 34 Z" />
      <circle className="pa-mark" cx="20" cy="44" r="2" />
    </>
  ),
  pawn: (
    <>
      <circle className="pa-body" cx="50" cy="27" r="12" />
      <path className="pa-body" d="M38 42 H62 L65 49 H35 Z" />
      <path className="pa-body" d="M41 49 C41 61 35 72 28 81 H72 C65 72 59 61 59 49 Z" />
    </>
  ),
}

export function VectorPiece({ type }: { readonly type: PieceType }) {
  return (
    <svg className="piece-art piece-art--vector" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      {DRAWINGS[type]}
      <path className="pa-body" d={PLINTH} />
    </svg>
  )
}
