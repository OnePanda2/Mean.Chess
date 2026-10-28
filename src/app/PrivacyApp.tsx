import { useState } from 'react'
import { Footer, TopBar } from '../components/Chrome.tsx'
import { ThemeDialog } from '../components/ThemeDialog.tsx'
import { PieceStyleContext } from '../components/pieces/pieceStyle.ts'
import { useAppearance } from './appearance.ts'
import { themeById } from './themes.ts'

const ISSUES = 'https://github.com/OnePanda2/Mean.Chess/issues'

/** The privacy page (docs/ONLINE-SECURITY.md §8). It must describe only what actually runs. */
export function PrivacyApp() {
  const [appearance, setAppearance] = useAppearance()
  const [themeOpen, setThemeOpen] = useState(false)
  return (
    <PieceStyleContext value={themeById(appearance.theme).pieceStyle}>
      <TopBar current="privacy" onTheme={() => setThemeOpen(true)} />
      <main id="main" className="rules privacy">
        <header className="rules__header">
          <p className="hero__eyebrow">Privacy</p>
          <h1 className="hero__title">What Mean Chess keeps</h1>
          <p className="hero__lede">
            Almost nothing. There are no accounts, no names, no email addresses, no cookies, no ads and no tracking, and
            nothing is ever sold.
          </p>
          <p className="muted">Last updated 28 October 2026.</p>
        </header>

        <section className="rule">
          <h2>On your device</h2>
          <p>
            Your browser keeps a few things in its own storage so the site remembers them for you: the game you're
            playing, your theme and settings, your tutorial progress, and how you've been doing against the computer
            (for the Auto difficulty). None of it leaves your device. Clearing your browser's site data deletes it.
          </p>
          <p>
            When you play online, your browser also keeps a private key for each game, so it can rejoin if your
            connection drops. Keys are deleted after 30 days.
          </p>
        </section>

        <section className="rule">
          <h2>Online games</h2>
          <p>
            An online game is stored on our game server while it's played: the moves, when they were made, and the
            result. That's what lets you reconnect and share the link to a finished game. Nothing about who you are is
            stored with it.
          </p>
          <ul>
            <li>An invite nobody joins is deleted after 24 hours.</li>
            <li>A finished game is deleted 30 days after it ends.</li>
            <li>A game left untouched for 7 days is closed, then deleted 30 days later.</li>
          </ul>
        </section>

        <section className="rule">
          <h2>Internet addresses</h2>
          <p>
            Like every website, the services that deliver Mean Chess see your internet (IP) address. Our own code
            never stores it. To stop one address from using up everyone's daily share of free online games, the game
            server keeps a scrambled, one-way fingerprint of the address (a hash with a random value that changes every
            day). It can't be turned back into the address, and it's deleted 48 hours after the day ends.
          </p>
        </section>

        <section className="rule">
          <h2>Logs</h2>
          <p>
            The game server writes short technical log lines (for example "game created", with the game's code) so we
            can fix problems. They contain no addresses or keys and are deleted automatically after a few days.
          </p>
        </section>

        <section className="rule">
          <h2>Who handles the data</h2>
          <ul>
            <li>
              <strong>GitHub</strong> hosts this website (GitHub Pages).{' '}
              <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" rel="noopener noreferrer">
                GitHub's privacy statement
              </a>
            </li>
            <li>
              <strong>Cloudflare</strong> runs the online game server.{' '}
              <a href="https://www.cloudflare.com/privacypolicy/" rel="noopener noreferrer">
                Cloudflare's privacy policy
              </a>
            </li>
          </ul>
        </section>

        <section className="rule">
          <h2>Children</h2>
          <p>Mean Chess has no chat and no names, and asks nobody for personal details, so there's nothing to share.</p>
        </section>

        <section className="rule">
          <h2>Questions, or deleting a game</h2>
          <p>
            Open an issue on <a href={ISSUES} rel="noopener noreferrer">GitHub</a>. To have an online game deleted
            early, give its code (for example 7KQ2M-X9FTA). Issues are public, so please don't post personal details
            there.
          </p>
          <p>If anything on this page changes, the date at the top changes with it.</p>
        </section>
      </main>
      <Footer />
      {themeOpen && <ThemeDialog appearance={appearance} onChange={setAppearance} onClose={() => setThemeOpen(false)} />}
    </PieceStyleContext>
  )
}
