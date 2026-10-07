import { createContext } from 'react'
import type { PieceStyle } from '../../app/themes.ts'

/** Which piece drawings to use. Theme previews provide their own value. */
export const PieceStyleContext = createContext<PieceStyle>('vector')
