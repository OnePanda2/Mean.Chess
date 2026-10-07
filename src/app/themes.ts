/** Visual themes. Each is a set of CSS custom properties keyed by [data-theme] (styles/themes.css). */
export type ThemeId = 'mean' | 'sugar' | 'arcade' | 'picnic'
export type PieceStyle = 'vector' | 'pixel'

export interface Theme {
  readonly id: ThemeId
  readonly name: string
  readonly tagline: string
  readonly pieceStyle: PieceStyle
  /** Browser UI colour (<meta name="theme-color">). */
  readonly chrome: string
}

const MEAN: Theme = {
  id: 'mean',
  name: 'Mean',
  tagline: 'Bone, umber and blood. The original.',
  pieceStyle: 'vector',
  chrome: '#0b0b0d',
}

export const THEMES: readonly Theme[] = [
  MEAN,
  { id: 'sugar', name: 'Sugar', tagline: 'Pink, sweet and completely ruthless.', pieceStyle: 'vector', chrome: '#ffe3ee' },
  { id: 'arcade', name: 'Arcade', tagline: 'Eight bits of betrayal.', pieceStyle: 'pixel', chrome: '#1d2b53' },
  { id: 'picnic', name: 'Picnic', tagline: 'A sunny afternoon of regicide.', pieceStyle: 'vector', chrome: '#fbf3df' },
]

export const DEFAULT_THEME: ThemeId = 'mean'

export const isThemeId = (value: unknown): value is ThemeId => THEMES.some((theme) => theme.id === value)

export function themeById(id: ThemeId): Theme {
  return THEMES.find((theme) => theme.id === id) ?? MEAN
}

/** Switches the whole page to `id`. index.html applies the saved theme before first paint. */
export function applyTheme(id: ThemeId): void {
  document.documentElement.dataset.theme = id
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeById(id).chrome)
}
