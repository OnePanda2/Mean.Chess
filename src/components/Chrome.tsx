import { RULES_VERSION } from '../engine/index.ts'
import { CrownIcon, PaletteIcon } from './Icons.tsx'

const REPOSITORY = 'https://github.com/OnePanda2/Mean.Chess'

export function TopBar({
  current,
  onTheme,
}: {
  readonly current: 'welcome' | 'play' | 'tutorial' | 'rules'
  readonly onTheme: () => void
}) {
  return (
    <header className="topbar">
      <a className="topbar__brand" href="/" aria-label="Mean Chess home">
        <span className="topbar__logo">
          <CrownIcon />
        </span>
        <span className="topbar__name">Mean Chess</span>
      </a>
      <nav aria-label="Main">
        <ul className="topbar__nav">
          <li>
            <a href="/play/" aria-current={current === 'play' ? 'page' : undefined}>
              Play
            </a>
          </li>
          <li>
            <a href="/tutorial/" aria-current={current === 'tutorial' ? 'page' : undefined}>
              Tutorial
            </a>
          </li>
          <li>
            <a href="/rules/" aria-current={current === 'rules' ? 'page' : undefined}>
              Rules
            </a>
          </li>
          <li className="topbar__source">
            <a href={REPOSITORY} rel="noopener noreferrer">
              Source
            </a>
          </li>
          <li>
            <button type="button" className="topbar__theme" onClick={onTheme}>
              <PaletteIcon />
              <span>Theme</span>
            </button>
          </li>
        </ul>
      </nav>
    </header>
  )
}

export function Footer() {
  return (
    <footer className="footer">
      <p>
        Mean Chess · Rules v{RULES_VERSION} · An independent chess variant ·{' '}
        <a href={REPOSITORY} rel="noopener noreferrer">
          Open source (MIT)
        </a>
      </p>
      <p className="muted">
        Original piece artwork. Display type: Cormorant Garamond, Pacifico, Press Start 2P and Fredoka (SIL Open
        Font License).
      </p>
    </footer>
  )
}
