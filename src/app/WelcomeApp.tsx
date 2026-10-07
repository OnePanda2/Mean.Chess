import { useState } from 'react'
import { Footer, TopBar } from '../components/Chrome.tsx'
import { MiniBoard } from '../components/MiniBoard.tsx'
import { ThemeDialog } from '../components/ThemeDialog.tsx'
import { PieceStyleContext } from '../components/pieces/pieceStyle.ts'
import { useAppearance } from './appearance.ts'
import { LESSONS } from './lessons.ts'
import { loadSavedGame } from './storage.ts'
import { themeById } from './themes.ts'
import { loadTutorialProgress } from './tutorialProgress.ts'

/** A king about to eat one of his own pawns to escape a back-rank mate (Royal Cannibalism). */
const ART_FEN = 'k7/8/8/8/8/8/5PPP/4r1K1 w - - 0 1'

/** The front door (D-48): learn the rules in the tutorial, or go straight to a game. */
export function WelcomeApp() {
  const [appearance, setAppearance] = useAppearance()
  const [themeOpen, setThemeOpen] = useState(false)
  const [progress] = useState(loadTutorialProgress)
  const [gameInProgress] = useState(() => {
    const game = loadSavedGame()
    return game !== null && game.moves.length > 0 && game.outcome === null
  })

  const tutorialDetail = progress.finished
    ? 'Done. Come back whenever you forget a rule.'
    : progress.lesson > 0
      ? `Continue at lesson ${progress.lesson + 1} of ${LESSONS.length}.`
      : `${LESSONS.length} short lessons on a real board. A few minutes.`

  return (
    <PieceStyleContext value={themeById(appearance.theme).pieceStyle}>
      <TopBar current="welcome" onTheme={() => setThemeOpen(true)} />
      <main id="main" className="welcome">
        <section className="welcome__hero">
          <div className="welcome__intro">
            <p className="hero__eyebrow">A chess variant</p>
            <h1 className="hero__title">Mean Chess</h1>
            <p className="hero__tagline">Chess, but your king is allowed to eat his own army.</p>
            <p className="hero__lede">
              Checkmate isn’t always the end, kings hunt each other, and sometimes a king has to sacrifice his own
              pieces to survive.
            </p>
          </div>
          <div className="welcome__art">
            <MiniBoard fen={ART_FEN} marks={{ f2: 'sacrifice', g2: 'sacrifice', h2: 'sacrifice' }} decorative />
          </div>
        </section>

        <nav className="welcome__choices" aria-label="Get started">
          <a className="welcome-card welcome-card--large" href="/tutorial/">
            {!progress.finished && <span className="welcome-card__badge">Start here</span>}
            <span className="welcome-card__title">Tutorial</span>
            <span className="welcome-card__subtitle">Learn how to play</span>
            <span className="welcome-card__detail">{tutorialDetail}</span>
          </a>
          <a className="welcome-card welcome-card--large" href={gameInProgress ? '/play/' : '/play/?new=choose'}>
            <span className="welcome-card__title">Play</span>
            <span className="welcome-card__subtitle">{gameInProgress ? 'Continue your game' : 'The computer or a friend'}</span>
            <span className="welcome-card__detail">
              {gameInProgress
                ? 'Pick up where you left off.'
                : 'Three levels of computer, from Nice to Ruthless, or a friend on this device.'}
            </span>
          </a>
        </nav>

        <p className="welcome__more">
          <a href="/rules/">Read the full rules →</a>
        </p>
      </main>
      <Footer />
      {themeOpen && <ThemeDialog appearance={appearance} onChange={setAppearance} onClose={() => setThemeOpen(false)} />}
    </PieceStyleContext>
  )
}
