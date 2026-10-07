import type { PieceType } from '../../engine/index.ts'

/*
 * Original Mean Chess piece artwork, 8-bit edition: 16×16 sprites drawn cell by cell.
 *   .  empty   o  outline   f  fill   h  highlight   a  accent (eyes, gems, windows)
 * Colours come from the same CSS custom properties as the vector set (styles/pieces.css).
 */
export const PIXEL_SPRITES: Readonly<Record<PieceType, readonly string[]>> = {
  king: [
    '......oooo......',
    '......offo......',
    '....oooffooo....',
    '....offffffo....',
    '....oooffooo....',
    '......offo......',
    '...ooooffoooo...',
    '..offffffffffo..',
    '..offhffffhffo..',
    '..offffaaffffo..',
    '...offffffffo...',
    '...oooooooooo...',
    '....offffffo....',
    '...offffffffo...',
    '..oooooooooooo..',
    '................',
  ],
  queen: [
    '................',
    '.oo....oo....oo.',
    '.oao..oaao..oao.',
    '.ofo..offo..ofo.',
    '.offo.offo.offo.',
    '.offfoffffofffo.',
    '.offffffffffffo.',
    '..offhffffhffo..',
    '..offffffffffo..',
    '...oooooooooo...',
    '....offffffo....',
    '....offaaffo....',
    '...offffffffo...',
    '..offffffffffo..',
    '..oooooooooooo..',
    '................',
  ],
  rook: [
    '................',
    '..ooo.oooo.ooo..',
    '..ofo.offo.ofo..',
    '..ofoooffooofo..',
    '..offffffffffo..',
    '..oooooooooooo..',
    '...offffffffo...',
    '...offfaafffo...',
    '...offfaafffo...',
    '...offhfffffo...',
    '...offffffffo...',
    '..oooooooooooo..',
    '..offffffffffo..',
    '.offffffffffffo.',
    '.oooooooooooooo.',
    '................',
  ],
  bishop: [
    '.......oo.......',
    '......offo......',
    '.......oo.......',
    '......offo......',
    '.....offffo.....',
    '.....offfao.....',
    '....offfaffo....',
    '....offafffo....',
    '....ofaffffo....',
    '.....offffo.....',
    '......oooo......',
    '.....offffo.....',
    '....offffffo....',
    '...offffffffo...',
    '..oooooooooooo..',
    '................',
  ],
  knight: [
    '................',
    '.......o.oo.....',
    '......ofoffo....',
    '.....offfffo....',
    '....offaffffo...',
    '...offffffhfo...',
    '..offfffffhfo...',
    '.offffffffffo...',
    '.ooooooffffffo..',
    '......offffffo..',
    '.....offffffffo.',
    '.....offffffffo.',
    '....offffffffo..',
    '...offffffffffo.',
    '..oooooooooooo..',
    '................',
  ],
  pawn: [
    '................',
    '................',
    '......oooo......',
    '.....offhfo.....',
    '.....offffo.....',
    '.....offffo.....',
    '......oooo......',
    '.....offffo.....',
    '......offo......',
    '......offo......',
    '.....offffo.....',
    '....offffffo....',
    '...offffffffo...',
    '..offffffffffo..',
    '..oooooooooooo..',
    '................',
  ],
}

export type Cell = 'o' | 'f' | 'h' | 'a'

export interface Run {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly cell: Cell
}

export const CELL_CLASS: Readonly<Record<Cell, string>> = { o: 'px-o', f: 'px-f', h: 'px-h', a: 'px-a' }

/** Merges each row's equal neighbouring cells into one rect: ~40 rects per sprite instead of ~150. */
export function spriteRuns(sprite: readonly string[]): Run[] {
  const runs: Run[] = []
  sprite.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const cell = row.charAt(x)
      let end = x + 1
      while (row.charAt(end) === cell) end++
      if (cell === 'o' || cell === 'f' || cell === 'h' || cell === 'a') runs.push({ x, y, width: end - x, cell })
      x = end
    }
  })
  return runs
}

export const SPRITE_RUNS: Readonly<Record<PieceType, readonly Run[]>> = {
  king: spriteRuns(PIXEL_SPRITES.king),
  queen: spriteRuns(PIXEL_SPRITES.queen),
  rook: spriteRuns(PIXEL_SPRITES.rook),
  bishop: spriteRuns(PIXEL_SPRITES.bishop),
  knight: spriteRuns(PIXEL_SPRITES.knight),
  pawn: spriteRuns(PIXEL_SPRITES.pawn),
}
