import { RULES_VERSION } from '../engine/index.ts'
import { CrownIcon } from './Icons.tsx'

const REPOSITORY = 'https://github.com/OnePanda2/Mean.Chess'

export function TopBar({ current }: { readonly current: 'play' | 'rules' }) {
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
            <a href="/" aria-current={current === 'play' ? 'page' : undefined}>
              Play
            </a>
          </li>
          <li>
            <a href="/rules/" aria-current={current === 'rules' ? 'page' : undefined}>
              Rules
            </a>
          </li>
          <li>
            <a href={REPOSITORY} rel="noopener noreferrer">
              Source
            </a>
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
        Piece artwork by Colin M.L. Burnett (Cburnett), used under the BSD licence.
      </p>
    </footer>
  )
}
