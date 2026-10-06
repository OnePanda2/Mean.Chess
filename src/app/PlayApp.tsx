import { RULES_VERSION } from '../engine/index.ts'

/** The play page. A placeholder until the board UI lands in milestone M4. */
export function PlayApp() {
  return (
    <main className="page">
      <h1 className="wordmark">Mean Chess</h1>
      <p className="tagline">Chess, but your king is allowed to eat his own army.</p>
      <p className="muted">
        Rules v{RULES_VERSION} · under construction · <a href="/rules/">How it works</a>
      </p>
    </main>
  )
}
