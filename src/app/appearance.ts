import { useEffect, useState } from 'react'
import { DEFAULT_THEME, applyTheme, isThemeId, type ThemeId } from './themes.ts'

/** Must match the inline script in index.html and rules/index.html. */
export const APPEARANCE_KEY = 'mean-chess:appearance:v1'

export interface Appearance {
  readonly theme: ThemeId
  /** Slide pieces and animate captures. Reduced-motion system settings still win. */
  readonly animations: boolean
}

export const DEFAULT_APPEARANCE: Appearance = { theme: DEFAULT_THEME, animations: true }

export function loadAppearance(): Appearance {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(APPEARANCE_KEY) ?? '{}')
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_APPEARANCE
    const record = parsed as Record<string, unknown>
    return {
      theme: isThemeId(record.theme) ? record.theme : DEFAULT_THEME,
      animations: record.animations !== false,
    }
  } catch {
    return DEFAULT_APPEARANCE
  }
}

export function saveAppearance(appearance: Appearance): void {
  try {
    window.localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance))
  } catch {
    // Storage unavailable: the choice lasts for this visit only.
  }
}

/** The saved appearance, applied to the page and remembered whenever it changes. */
export function useAppearance(): readonly [Appearance, (next: Appearance) => void] {
  const [appearance, setAppearance] = useState(loadAppearance)
  useEffect(() => {
    applyTheme(appearance.theme)
    saveAppearance(appearance)
  }, [appearance])
  return [appearance, setAppearance] as const
}
