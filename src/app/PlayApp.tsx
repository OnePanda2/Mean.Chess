import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import {
  analyze,
  currentPosition,
  exportGame,
  newGame,
  parseMeanFen,
  toMeanFen,
  type Explanation,
  type GameRecord,
  type Outcome,
  type Square,
} from '../engine/index.ts'
import { Board } from '../components/Board.tsx'
import { Footer, TopBar } from '../components/Chrome.tsx'
import { MiniBoard } from '../components/MiniBoard.tsx'
import { Modal } from '../components/Modal.tsx'
import { PromotionDialog } from '../components/PromotionDialog.tsx'
import { RulesSummary } from '../components/RulesSummary.tsx'
import { ScenarioLab } from '../components/ScenarioLab.tsx'
import { ThemeDialog } from '../components/ThemeDialog.tsx'
import { PieceStyleContext } from '../components/pieces/pieceStyle.ts'
import { CapturedPieces, MoveList, StatusPanel } from '../components/SidePanel.tsx'
import { useAppearance } from './appearance.ts'
import { createState, gameReducer, type GameState } from './gameState.ts'
import { findScenario, type Scenario } from './scenarios.ts'
import { loadPreferences, loadSavedGame, saveGameLocally, savePreferences } from './storage.ts'
import { outcomeMessage, sideName } from './text.ts'
import { themeById } from './themes.ts'

type Dialog = 'none' | 'scenarios' | 'rules' | 'theme' | 'new-game' | 'resign' | 'draw'

interface HoverHint {
  readonly selected: Square | null
  readonly ply: number
  readonly explanation: Explanation | null
}

/** matchMedia is missing in some environments (and in jsdom), whatever the DOM types say. */
function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/** A deep link (/?scenario=id) wins over the saved game; otherwise resume or start fresh. */
function initialState(): GameState {
  const preferences = loadPreferences()
  const requested = new URLSearchParams(window.location.search).get('scenario')
  const scenario = requested ? findScenario(requested) : undefined
  if (scenario) {
    const parsed = parseMeanFen(scenario.fen)
    if (parsed.ok) return createState(newGame(parsed.position), { ...preferences, scenario })
  }
  return createState(loadSavedGame() ?? newGame(), preferences)
}

export function PlayApp() {
  const [state, dispatch] = useReducer(gameReducer, undefined, initialState)
  const [appearance, setAppearance] = useAppearance()
  const [dialog, setDialog] = useState<Dialog>('none')
  // The hovered target's explanation, tied to the selection and ply it was computed for.
  const [hover, setHover] = useState<HoverHint | null>(null)
  // The result dialog is derived: it shows for an ending until the player dismisses that ending.
  const [dismissedOutcome, setDismissedOutcome] = useState<Outcome | null>(null)
  const playArea = useRef<HTMLElement>(null)

  const { game } = state
  const position = currentPosition(game)
  const analysis = useMemo(() => analyze(position), [position])
  const lastMove = game.moves.at(-1) ?? null
  const over = game.outcome !== null
  const hint = hover?.selected === state.selected && hover.ply === game.moves.length ? hover.explanation : null

  useEffect(() => {
    saveGameLocally(game)
  }, [game])
  useEffect(() => {
    savePreferences({ flipped: state.flipped, showKillZones: state.showKillZones })
  }, [state.flipped, state.showKillZones])
  useEffect(() => {
    // A deep link is consumed once; a reload then resumes the game being played.
    if (new URLSearchParams(window.location.search).has('scenario')) {
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  function showBoard(): void {
    const area = playArea.current
    if (!area) return
    if (typeof area.scrollIntoView === 'function') {
      area.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
    }
    area.querySelector<HTMLButtonElement>('.square[tabindex="0"]')?.focus({ preventScroll: true })
  }

  function load(next: GameRecord, scenario: Scenario | null): void {
    dispatch({ type: 'load', game: next, scenario })
    setDialog('none')
    setHover(null)
    showBoard()
  }

  const showResult = game.outcome !== null && game.outcome !== dismissedOutcome && dialog === 'none'
  const announcement = game.outcome
    ? `${outcomeMessage(game.outcome).title}.`
    : `${lastMove ? `${state.notation.at(-1) ?? ''}. ` : ''}${sideName(position.sideToMove)} to move.`

  return (
    <PieceStyleContext value={themeById(appearance.theme).pieceStyle}>
      <TopBar current="play" onTheme={() => setDialog('theme')} />
      <main id="main">
        <section className="hero">
          <p className="hero__eyebrow">A chess variant</p>
          <h1 className="hero__title">Mean Chess</h1>
          <p className="hero__tagline">Chess, but your king is allowed to eat his own army.</p>
          <p className="hero__lede">
            A chess variant where checkmate isn’t always the end, kings can hunt each other, and sometimes the king has
            to sacrifice his own pieces to survive.
          </p>
          <div className="hero__actions">
            <button type="button" className="button button--primary" onClick={showBoard}>
              Play Mean Chess
            </button>
            <a className="button" href="/rules/">
              How it works
            </a>
          </div>
        </section>

        <section className="play" aria-label="Game" ref={playArea}>
          <div className="play__board">
            {state.scenario && (
              <div className="card scenario-card">
                <p className="card__eyebrow">Scenario · {state.scenario.group}</p>
                <h2 className="card__title">{state.scenario.title}</h2>
                <p>{state.scenario.prompt}</p>
              </div>
            )}
            <Board
              position={position}
              analysis={analysis}
              selected={state.selected}
              lastMove={lastMove}
              flipped={state.flipped}
              showKillZones={state.showKillZones}
              interactive={!over}
              transition={state.transition}
              animate={appearance.animations}
              onSquare={(square) => {
                dispatch({ type: 'square', square })
              }}
              onDeselect={() => {
                dispatch({ type: 'deselect' })
              }}
              onHint={(explanation) => {
                setHover({ selected: state.selected, ply: game.moves.length, explanation })
              }}
            />
            <p className="sr-only" aria-live="polite">
              {announcement}
            </p>
          </div>

          <aside className="play__panel" aria-label="Game panel">
            <StatusPanel game={game} analysis={analysis} sideToMove={position.sideToMove} hint={hint} />
            <div className="card controls" role="group" aria-label="Game controls">
              <button
                type="button"
                className="button"
                onClick={() => {
                  if (game.moves.length > 0 && !over) setDialog('new-game')
                  else load(newGame(), null)
                }}
              >
                New game
              </button>
              <button
                type="button"
                className="button"
                disabled={game.moves.length === 0 && !over}
                onClick={() => {
                  dispatch({ type: 'undo' })
                }}
              >
                Undo
              </button>
              <button type="button" className="button" onClick={() => dispatch({ type: 'flip' })}>
                Flip board
              </button>
              <button
                type="button"
                className="button"
                aria-pressed={state.showKillZones}
                onClick={() => dispatch({ type: 'toggle-kill-zones' })}
              >
                Kill zones
              </button>
              <button type="button" className="button" disabled={over} onClick={() => setDialog('draw')}>
                Draw
              </button>
              <button type="button" className="button" disabled={over} onClick={() => setDialog('resign')}>
                Resign
              </button>
              <button type="button" className="button" onClick={() => setDialog('scenarios')}>
                Scenarios
              </button>
              <button type="button" className="button" onClick={() => setDialog('rules')}>
                Rules
              </button>
            </div>
            <MoveList game={game} notation={state.notation} />
            <CapturedPieces game={game} />
          </aside>
        </section>

        <section className="rule-cards" aria-labelledby="rule-cards-title">
          <h2 id="rule-cards-title" className="section-title">
            Three rules that change everything
          </h2>
          <div className="rule-cards__grid">
            <RuleCard
              title="Royal Capture"
              text="Only a king can capture a king, from exactly two squares away in a straight line. It ends the game on the spot."
              fen="8/8/8/8/8/5k2/8/7K w - - 0 1"
              marks={{ f3: 'win' }}
              label="White king on h1 can capture the black king on f3."
              onTry={() => load(scenarioGame('royal-capture'), findScenario('royal-capture') ?? null)}
            />
            <RuleCard
              title="Royal Slaughter"
              text="If your own eligible piece stands between the kings, your king eats it and takes the enemy king in one move."
              fen="8/8/8/8/8/4k3/4P3/4K3 w - - 0 1"
              marks={{ e2: 'sacrifice', e3: 'win' }}
              label="White king on e1 eats its pawn on e2 and captures the black king on e3."
              onTry={() => load(scenarioGame('slaughter-pawn'), findScenario('slaughter-pawn') ?? null)}
            />
            <RuleCard
              title="Royal Cannibalism"
              text="Checkmated? Not yet. A desperate king may eat an adjacent piece of its lowest remaining tier to escape."
              fen="k7/8/8/8/8/8/5PPP/4r1K1 w - - 0 1"
              marks={{ f2: 'sacrifice', g2: 'sacrifice', h2: 'sacrifice' }}
              label="White king on g1 is in a back-rank checkmate, but may eat one of its pawns on f2, g2 or h2."
              onTry={() => load(scenarioGame('cannibal-back-rank'), findScenario('cannibal-back-rank') ?? null)}
            />
          </div>
        </section>
      </main>
      <Footer />

      {state.promotion && (
        <PromotionDialog
          color={position.sideToMove}
          onChoose={(piece) => dispatch({ type: 'promote', piece })}
          onCancel={() => dispatch({ type: 'cancel-promotion' })}
        />
      )}
      {dialog === 'scenarios' && (
        <ScenarioLab
          currentFen={toMeanFen(position)}
          savedGame={exportGame(game)}
          onLoad={load}
          onClose={() => setDialog('none')}
        />
      )}
      {dialog === 'rules' && <RulesSummary onClose={() => setDialog('none')} />}
      {dialog === 'theme' && (
        <ThemeDialog appearance={appearance} onChange={setAppearance} onClose={() => setDialog('none')} />
      )}
      {dialog === 'new-game' && (
        <Confirm
          title="Start a new game?"
          text="The current game will be replaced."
          confirm="New game"
          onConfirm={() => load(newGame(), null)}
          onCancel={() => setDialog('none')}
        />
      )}
      {dialog === 'resign' && (
        <Confirm
          title={`Resign as ${sideName(position.sideToMove)}?`}
          text={`${sideName(position.sideToMove === 'white' ? 'black' : 'white')} will be declared the winner. Undo can take it back.`}
          confirm="Resign"
          onConfirm={() => {
            dispatch({ type: 'resign' })
            setDialog('none')
          }}
          onCancel={() => setDialog('none')}
        />
      )}
      {dialog === 'draw' && (
        <Confirm
          title="Agree to a draw?"
          text="Both players agree to end the game as a draw. Undo can take it back."
          confirm="Agree to a draw"
          onConfirm={() => {
            dispatch({ type: 'agree-draw' })
            setDialog('none')
          }}
          onCancel={() => setDialog('none')}
        />
      )}
      {showResult && (
        <Modal title={outcomeMessage(game.outcome).title} onClose={() => setDismissedOutcome(game.outcome)}>
          <p>{outcomeMessage(game.outcome).detail}</p>
          <div className="row">
            <button type="button" className="button button--primary" onClick={() => load(newGame(), null)}>
              New game
            </button>
            <button
              type="button"
              className="button"
              onClick={() => {
                dispatch({ type: 'undo' })
              }}
            >
              Undo last move
            </button>
            <button type="button" className="button" onClick={() => setDismissedOutcome(game.outcome)}>
              View the board
            </button>
          </div>
        </Modal>
      )}
    </PieceStyleContext>
  )
}

function scenarioGame(id: string): GameRecord {
  const scenario = findScenario(id)
  const parsed = scenario ? parseMeanFen(scenario.fen) : null
  return parsed?.ok ? newGame(parsed.position) : newGame()
}

function RuleCard({
  title,
  text,
  fen,
  marks,
  label,
  onTry,
}: {
  readonly title: string
  readonly text: string
  readonly fen: string
  readonly marks: Parameters<typeof MiniBoard>[0]['marks']
  readonly label: string
  readonly onTry: () => void
}) {
  return (
    <article className="card rule-card">
      <MiniBoard fen={fen} marks={marks} label={label} />
      <h3>{title}</h3>
      <p>{text}</p>
      <button type="button" className="button" onClick={onTry}>
        Try it
      </button>
    </article>
  )
}

function Confirm({
  title,
  text,
  confirm,
  onConfirm,
  onCancel,
}: {
  readonly title: string
  readonly text: string
  readonly confirm: string
  readonly onConfirm: () => void
  readonly onCancel: () => void
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p>{text}</p>
      <div className="row">
        <button type="button" className="button button--primary" onClick={onConfirm}>
          {confirm}
        </button>
        <button type="button" className="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </Modal>
  )
}
