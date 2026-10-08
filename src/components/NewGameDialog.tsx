import { useState } from 'react'
import { LEVELS, type Level } from '../ai/levels.ts'
import { FRIEND, LEVEL_TEXT, type Opponent } from '../app/opponent.ts'
import type { Color } from '../engine/index.ts'
import { Modal } from './Modal.tsx'

type Side = Color | 'random'

const SIDES: readonly { readonly value: Side; readonly label: string }[] = [
  { value: 'white', label: 'White' },
  { value: 'black', label: 'Black' },
  { value: 'random', label: 'Random' },
]

/** Choose who to play: a friend on this device, or the computer at a level and side. */
export function NewGameDialog({
  initial,
  autoLevel,
  replacing,
  onStart,
  onClose,
}: {
  /** Preselected choices: usually the current opponent. */
  readonly initial: Opponent
  /** The level the Auto difficulty would pick now (D-50). */
  readonly autoLevel: Level
  /** A game is in progress and will be replaced. */
  readonly replacing: boolean
  readonly onStart: (opponent: Opponent) => void
  readonly onClose: () => void
}) {
  const [kind, setKind] = useState<Opponent['kind']>(initial.kind)
  // Auto is the default unless the player chose a level for their last game against the computer.
  const [level, setLevel] = useState<Level | 'auto'>(
    initial.kind === 'computer' && initial.auto !== true ? initial.level : 'auto',
  )
  const [side, setSide] = useState<Side>(initial.kind === 'computer' ? initial.human : 'white')

  return (
    <Modal title="New game" onClose={onClose}>
      <form
        className="new-game"
        onSubmit={(event) => {
          event.preventDefault()
          if (kind === 'friend') {
            onStart(FRIEND)
            return
          }
          const human: Color = side === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : side
          onStart(
            level === 'auto' ? { kind: 'computer', level: autoLevel, human, auto: true } : { kind: 'computer', level, human },
          )
        }}
      >
        <fieldset className="choice">
          <legend>Opponent</legend>
          <label className="choice__option">
            <input type="radio" name="opponent" checked={kind === 'computer'} onChange={() => setKind('computer')} />
            <span className="choice__text">
              <strong>The computer</strong>
              <span>Play against Mean Chess’s own AI.</span>
            </span>
          </label>
          <label className="choice__option">
            <input type="radio" name="opponent" checked={kind === 'friend'} onChange={() => setKind('friend')} />
            <span className="choice__text">
              <strong>A friend</strong>
              <span>Two players taking turns on this device.</span>
            </span>
          </label>
        </fieldset>

        {kind === 'computer' && (
          <>
            <fieldset className="choice">
              <legend>Difficulty</legend>
              <label className="choice__option">
                <input type="radio" name="level" checked={level === 'auto'} onChange={() => setLevel('auto')} />
                <span className="choice__text">
                  <strong>Auto</strong>
                  <span>
                    Picks a level from your results: {LEVEL_TEXT[autoLevel].name} for now. Two wins in a row move it
                    up, two losses move it down.
                  </span>
                </span>
              </label>
              {LEVELS.map((option) => (
                <label key={option} className="choice__option">
                  <input type="radio" name="level" checked={level === option} onChange={() => setLevel(option)} />
                  <span className="choice__text">
                    <strong>{LEVEL_TEXT[option].name}</strong>
                    <span>{LEVEL_TEXT[option].description}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <fieldset className="choice choice--inline">
              <legend>You play</legend>
              {SIDES.map((option) => (
                <label key={option.value} className="choice__option">
                  <input
                    type="radio"
                    name="side"
                    checked={side === option.value}
                    onChange={() => setSide(option.value)}
                  />
                  <span className="choice__text">
                    <strong>{option.label}</strong>
                  </span>
                </label>
              ))}
            </fieldset>
          </>
        )}

        {replacing && <p className="muted small">Your current game will be replaced.</p>}
        <div className="row">
          <button type="submit" className="button button--primary">
            Start game
          </button>
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  )
}
