/** Small inline icons. Decorative: the meaning is always also given in text. */

export function CrownIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3 18 1.5 7.5l5.5 4.5L12 4l5 8 5.5-4.5L21 18z" fill="currentColor" />
      <rect x="3" y="19.5" width="18" height="2.5" rx="1" fill="currentColor" />
    </svg>
  )
}

export function SacrificeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <path d="m7.5 7.5 9 9m0-9-9 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

export function WarningIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 2.5 23 21.5H1z" fill="currentColor" />
      <path d="M12 9v6" stroke="#0d0d0f" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="12" cy="18" r="1.4" fill="#0d0d0f" />
    </svg>
  )
}

export function PaletteIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 2.5C6.5 2.5 2 6.6 2 11.7c0 4 3.2 7.8 7.4 7.8 1.3 0 1.9-.8 1.9-1.7 0-1.2-1-1.6-1-2.6 0-.9.8-1.6 1.7-1.6h2.6c3.8 0 7.4-2.3 7.4-6C22 5.7 17.6 2.5 12 2.5z"
        fill="currentColor"
      />
      <circle cx="7" cy="10" r="1.6" fill="var(--surface)" />
      <circle cx="11" cy="6.5" r="1.6" fill="var(--surface)" />
      <circle cx="16" cy="7.5" r="1.6" fill="var(--surface)" />
    </svg>
  )
}
