import { useId, useState } from 'react'
import { importGame, newGame, parseMeanFen, type GameRecord } from '../engine/index.ts'
import { SCENARIOS, type Scenario } from '../app/scenarios.ts'
import { Modal } from './Modal.tsx'

const GROUPS = [...new Set(SCENARIOS.map((scenario) => scenario.group))]

/** Load a scenario, a MeanFEN or a saved game; copy the current position or game. */
export function ScenarioLab({
  currentFen,
  savedGame,
  onLoad,
  onClose,
}: {
  readonly currentFen: string
  readonly savedGame: string
  readonly onLoad: (game: GameRecord, scenario: Scenario | null) => void
  readonly onClose: () => void
}) {
  const inputId = useId()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  function loadScenario(scenario: Scenario): void {
    const parsed = parseMeanFen(scenario.fen)
    if (parsed.ok) onLoad(newGame(parsed.position), scenario)
  }

  function loadText(): void {
    const input = text.trim()
    if (input === '') {
      setError('Paste a MeanFEN or a saved game first.')
      return
    }
    if (input.startsWith('{')) {
      const loaded = importGame(input)
      if (loaded.ok) onLoad(loaded.game, null)
      else setError(loaded.error)
      return
    }
    const parsed = parseMeanFen(input)
    if (parsed.ok) onLoad(newGame(parsed.position), null)
    else setError(parsed.error)
  }

  return (
    <Modal title="Scenario Lab" onClose={onClose} wide>
      <p className="muted">
        Positions that show each Mean Chess rule. Load one, then play it out on the board. The current game is replaced.
      </p>
      {GROUPS.map((group) => (
        <section key={group} className="scenario-group">
          <h3>{group}</h3>
          <ul className="scenario-list">
            {SCENARIOS.filter((scenario) => scenario.group === group).map((scenario) => (
              <li key={scenario.id}>
                <button type="button" className="scenario" onClick={() => loadScenario(scenario)}>
                  <strong>{scenario.title}</strong>
                  <span>{scenario.prompt}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="scenario-group">
        <h3>Load a position or saved game</h3>
        <label htmlFor={inputId} className="field-label">
          MeanFEN (standard FEN, writing Q~ for a promoted queen) or a saved game
        </label>
        <textarea
          id={inputId}
          className="text-input"
          rows={3}
          spellCheck={false}
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            setError(null)
          }}
        />
        <div className="row">
          <button type="button" className="button" onClick={loadText}>
            Load
          </button>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </section>

      <section className="scenario-group">
        <h3>Share this game</h3>
        <CopyField label="Current position (MeanFEN)" value={currentFen} />
        <CopyField label="Whole game (saved game)" value={savedGame} />
      </section>
    </Modal>
  )
}

function CopyField({ label, value }: { readonly label: string; readonly value: string }) {
  const id = useId()
  const [copied, setCopied] = useState(false)
  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
    } catch {
      const input = document.getElementById(id)
      if (input instanceof HTMLInputElement) input.select()
    }
  }
  return (
    <div className="copy-field">
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <div className="row">
        <input id={id} className="text-input" readOnly value={value} onFocus={(event) => event.target.select()} />
        <button type="button" className="button" onClick={() => void copy()}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}
