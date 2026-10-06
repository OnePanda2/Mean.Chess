import { RULES_VERSION } from '../engine/index.ts'

/** The rules page. A placeholder until the full rules page lands in milestone M4. */
export function RulesApp() {
  return (
    <main className="page">
      <h1 className="wordmark">Mean Chess Rules v{RULES_VERSION}</h1>
      <p className="muted">
        The full rules page is under construction. <a href="/">Back to the board</a>
      </p>
    </main>
  )
}
