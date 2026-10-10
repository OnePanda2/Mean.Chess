/** Small inline icons. Decorative: the meaning is always also given in text. */

export function CrownIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3 18 1.5 7.5l5.5 4.5L12 4l5 8 5.5-4.5L21 18z" fill="currentColor" />
      <rect x="3" y="19.5" width="18" height="2.5" rx="1" fill="currentColor" />
    </svg>
  )
}

/** A king that fell: royal capture, royal slaughter or checkmate (D-52). */
export function SkullIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 2.5c-5 0-8.5 3.5-8.5 8.2 0 2.8 1.3 4.6 3 5.6V19c0 1 .8 1.8 1.8 1.8h7.4c1 0 1.8-.8 1.8-1.8v-2.7c1.7-1 3-2.8 3-5.6 0-4.7-3.5-8.2-8.5-8.2z"
        fill="currentColor"
      />
      <circle cx="8.6" cy="11.4" r="2.3" fill="var(--badge-ink)" />
      <circle cx="15.4" cy="11.4" r="2.3" fill="var(--badge-ink)" />
      <path d="M12 14.2l-1.5 2.6h3z" fill="var(--badge-ink)" />
      <path d="M9.5 18.2v2.4m2.5-2.4v2.4m2.5-2.4v2.4" stroke="var(--badge-ink)" strokeWidth="1.2" />
    </svg>
  )
}

/** A resignation (D-52). */
export function FlagIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 2.5v19" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M6.2 3.6c3.5-1.6 6 1.5 9.5.2 1.6-.6 2.8-.6 3.8-.3v9.2c-1-.3-2.2-.3-3.8.3-3.5 1.3-6-1.8-9.5-.2z" fill="currentColor" />
    </svg>
  )
}

/** A draw: half a point each (D-52). */
export function HalfIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5.2 6.2 7.6 4.6V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M17.4 3.5 6.6 20.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M14 14.4c.4-1.3 1.5-2 2.8-2 1.5 0 2.6 1 2.6 2.3 0 2-3.3 3.1-5.4 5.3h5.6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
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
