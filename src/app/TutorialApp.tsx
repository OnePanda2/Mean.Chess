import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { analyze, currentPosition, newGame, parseMeanFen, royalMove, toUci } from '../engine/index.ts'
import { Board } from '../components/Board.tsx'
import { Footer, TopBar } from '../components/Chrome.tsx'
import { MiniBoard } from '../components/MiniBoard.tsx'
import { ThemeDialog } from '../components/ThemeDialog.tsx'
import { PieceStyleContext } from '../components/pieces/pieceStyle.ts'
import { useAppearance } from './appearance.ts'
import { createState, gameReducer, type GameState } from './gameState.ts'
import { LESSONS, type Lesson, type LessonTask } from './lessons.ts'
import { loadTutorialProgress, saveTutorialProgress, type TutorialProgress } from './tutorialProgress.ts'
import { themeById } from './themes.ts'

type View =
  | { readonly kind: 'choose' }
  | { readonly kind: 'learn-chess' }
  | { readonly kind: 'lesson'; readonly index: number }
  | { readonly kind: 'done' }

/** Free places to learn regular chess first (the tutorial assumes it, D-48). */
const CHESS_BASICS = [
  {
    href: 'https://lichess.org/learn',
    name: 'Lichess: Learn chess',
    detail: 'Free interactive lessons: how each piece moves, check and checkmate, by playing.',
  },
  {
    href: 'https://www.chess.com/learn-how-to-play-chess',
    name: 'Chess.com: How to play chess',
    detail: 'A short illustrated guide to the rules, from setting up the board to checkmate.',
  },
] as const

/** The tutorial page (D-48): do you know chess? Then the Mean Chess lessons, one board at a time. */
export function TutorialApp() {
  const [appearance, setAppearance] = useAppearance()
  const [themeOpen, setThemeOpen] = useState(false)
  const [progress, setProgress] = useState<TutorialProgress>(loadTutorialProgress)
  const [view, setView] = useState<View>({ kind: 'choose' })
  const main = useRef<HTMLElement>(null)
  const changed = useRef(false)

  // A new step starts at the top, with focus on its heading (for keyboard and screen-reader users).
  useEffect(() => {
    if (!changed.current) {
      changed.current = true
      return
    }
    const area = main.current
    if (!area) return
    if (typeof area.scrollIntoView === 'function') area.scrollIntoView({ block: 'start' })
    area.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true })
  }, [view])

  function show(next: View): void {
    setView(next)
  }

  function openLesson(index: number): void {
    const next = { ...progress, lesson: index }
    setProgress(next)
    saveTutorialProgress(next)
    show({ kind: 'lesson', index })
  }

  function finish(): void {
    const next = { lesson: 0, finished: true }
    setProgress(next)
    saveTutorialProgress(next)
    show({ kind: 'done' })
  }

  return (
    <PieceStyleContext value={themeById(appearance.theme).pieceStyle}>
      <TopBar current="tutorial" onTheme={() => setThemeOpen(true)} />
      <main id="main" className="tutorial" ref={main}>
        {view.kind === 'choose' && (
          <ChooseStep
            progress={progress}
            onKnowChess={() => openLesson(0)}
            onNewToChess={() => show({ kind: 'learn-chess' })}
            onOpen={openLesson}
          />
        )}
        {view.kind === 'learn-chess' && (
          <LearnChessStep onStart={() => openLesson(0)} onBack={() => show({ kind: 'choose' })} />
        )}
        {view.kind === 'lesson' && (
          <LessonStep
            key={view.index}
            index={view.index}
            animate={appearance.animations}
            onBack={() => (view.index === 0 ? show({ kind: 'choose' }) : openLesson(view.index - 1))}
            onNext={() => (view.index === LESSONS.length - 1 ? finish() : openLesson(view.index + 1))}
          />
        )}
        {view.kind === 'done' && <DoneStep onOpen={openLesson} />}
      </main>
      <Footer />
      {themeOpen && <ThemeDialog appearance={appearance} onChange={setAppearance} onClose={() => setThemeOpen(false)} />}
    </PieceStyleContext>
  )
}

function ChooseStep({
  progress,
  onKnowChess,
  onNewToChess,
  onOpen,
}: {
  readonly progress: TutorialProgress
  readonly onKnowChess: () => void
  readonly onNewToChess: () => void
  readonly onOpen: (index: number) => void
}) {
  const resume = !progress.finished && progress.lesson > 0 ? LESSONS[progress.lesson] : undefined
  return (
    <>
      <header className="tutorial__header">
        <p className="hero__eyebrow">Tutorial</p>
        <h1 className="hero__title" tabIndex={-1}>Learn Mean Chess</h1>
        <p className="hero__lede">
          {LESSONS.length} short lessons on a real board. It takes a few minutes, and you can come back any time.
        </p>
      </header>
      {resume && (
        <button type="button" className="button button--primary tutorial__resume" onClick={() => onOpen(progress.lesson)}>
          Continue where you left off: lesson {progress.lesson + 1}, {resume.title}
        </button>
      )}
      <section className="tutorial__question" aria-labelledby="question-title">
        <h2 id="question-title" className="section-title">
          Do you know how to play regular chess?
        </h2>
        <div className="welcome__choices">
          <button type="button" className="welcome-card" onClick={onKnowChess}>
            <span className="welcome-card__title">I know how chess works</span>
            <span className="welcome-card__detail">Start with what Mean Chess changes.</span>
          </button>
          <button type="button" className="welcome-card" onClick={onNewToChess}>
            <span className="welcome-card__title">I’ve never played chess</span>
            <span className="welcome-card__detail">Learn the basics first, then come back.</span>
          </button>
        </div>
      </section>
      {(progress.finished || progress.lesson > 0) && <LessonList onOpen={onOpen} />}
    </>
  )
}

function LearnChessStep({ onStart, onBack }: { readonly onStart: () => void; readonly onBack: () => void }) {
  return (
    <>
      <header className="tutorial__header">
        <p className="hero__eyebrow">Tutorial</p>
        <h1 className="hero__title" tabIndex={-1}>Learn regular chess first</h1>
        <p className="hero__lede">
          Mean Chess is regular chess with a few extra rules about kings, so you will need the basics first: how each
          piece moves, check and checkmate. These free guides teach them step by step.
        </p>
      </header>
      <ul className="tutorial__links">
        {CHESS_BASICS.map((link) => (
          <li key={link.href}>
            <a className="welcome-card" href={link.href} target="_blank" rel="noopener noreferrer">
              <span className="welcome-card__title">{link.name} ↗</span>
              <span className="welcome-card__detail">{link.detail}</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="muted">Come back when you know how the pieces move. This page will be here.</p>
      <div className="row">
        <button type="button" className="button button--primary" onClick={onStart}>
          I know the basics now: start the tutorial
        </button>
        <button type="button" className="button" onClick={onBack}>
          Back
        </button>
      </div>
    </>
  )
}

function LessonStep({
  index,
  animate,
  onBack,
  onNext,
}: {
  readonly index: number
  readonly animate: boolean
  readonly onBack: () => void
  readonly onNext: () => void
}) {
  const lesson: Lesson | undefined = LESSONS[index]
  // Each attempt is a fresh board: "Try again" remounts it.
  const [attempt, setAttempt] = useState(0)
  const [solved, setSolved] = useState(false)
  const markSolved = useCallback(() => {
    setSolved(true)
  }, [])
  if (!lesson) return null
  const last = index === LESSONS.length - 1
  // Pictures that go with a task: under the text on wide screens, after the board on phones.
  const extra = lesson.task && lesson.diagrams && lesson.diagrams.length > 0 ? lesson.diagrams : null
  return (
    <article className={`lesson${extra ? ' lesson--with-extra' : ''}`} aria-labelledby="lesson-title">
      <div className="lesson__text">
        <p className="lesson__count">
          Lesson {index + 1} of {LESSONS.length}
        </p>
        <div className="lesson__progress" aria-hidden="true">
          <span style={{ width: `${((index + 1) / LESSONS.length) * 100}%` }} />
        </div>
        <h1 id="lesson-title" className="lesson__title" tabIndex={-1}>
          {lesson.title}
        </h1>
        {lesson.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
      {extra && (
        <div className="lesson__extra">
          <LessonDiagrams diagrams={extra} />
        </div>
      )}
      <div className="lesson__practice">
        {lesson.task ? (
          <LessonPractice
            key={attempt}
            task={lesson.task}
            animate={animate}
            onSolved={markSolved}
            onRetry={() => setAttempt((count) => count + 1)}
          />
        ) : (
          <LessonDiagrams diagrams={lesson.diagrams} />
        )}
      </div>
      <nav className="lesson__nav" aria-label="Lessons">
        <button type="button" className="button" onClick={onBack}>
          ← Back
        </button>
        <button
          type="button"
          className="button button--primary"
          disabled={lesson.task !== undefined && !solved}
          onClick={onNext}
        >
          {last ? 'Finish' : 'Next lesson →'}
        </button>
        {lesson.task && !solved && (
          <button type="button" className="link-button" onClick={onNext}>
            Skip this lesson
          </button>
        )}
      </nav>
    </article>
  )
}

function LessonDiagrams({ diagrams = [] }: { readonly diagrams?: Lesson['diagrams'] }) {
  return diagrams.map((diagram) => (
    <figure key={diagram.fen} className="lesson__diagram">
      <MiniBoard fen={diagram.fen} marks={diagram.marks} label={diagram.caption} />
      <figcaption>{diagram.caption}</figcaption>
    </figure>
  ))
}

type PracticeResult = 'solved' | 'halfway' | 'replying' | 'answering' | 'punished' | 'retry' | null

/**
 * Where the lesson stands after the moves so far. The player's moves are at even plies; with a
 * follow-up, ply 1 is the opponent's forced reply and ply 2 is the player's second move.
 */
function practiceResult(task: LessonTask, game: GameState['game']): PracticeResult {
  const judge = (ply: number, solves: LessonTask['solves']): PracticeResult | 'ok' => {
    const move = game.moves[ply]
    const before = game.positions[ply]
    if (!move || !before) return null
    if (solves(move, before)) return 'ok'
    if (move.suicidal !== true) return 'retry'
    return game.moves.length > ply + 1 ? 'punished' : 'answering'
  }
  const first = judge(0, task.solves)
  if (first !== 'ok') return first
  if (!task.then) return 'solved'
  if (game.moves.length === 1) return 'replying'
  const second = judge(2, task.then.solves)
  if (second === null) return 'halfway'
  return second === 'ok' ? 'solved' : second
}

/** The player's turn on the lesson board; a move into the Kill Zone is answered by the enemy king. */
function LessonPractice({
  task,
  animate,
  onSolved,
  onRetry,
}: {
  readonly task: LessonTask
  readonly animate: boolean
  readonly onSolved: () => void
  readonly onRetry: () => void
}) {
  const [state, dispatch] = useReducer(gameReducer, task, lessonState)
  const { game } = state
  const position = currentPosition(game)
  const analysis = useMemo(() => analyze(position), [position])
  const result = practiceResult(task, game)
  // The second step of a two-step task, once the opponent has replied.
  const followUp = game.moves.length >= 2 ? task.then : undefined

  useEffect(() => {
    if (result === 'solved') onSolved()
  }, [result, onSolved])

  // The opponent's turn: after a move into the Kill Zone its king takes the player's; after the
  // first step of a two-step task it plays its only move.
  useEffect(() => {
    if (result !== 'answering' && result !== 'replying') return
    const reply =
      result === 'answering' ? royalMove(position.board, position.sideToMove) : (analysis.legal[0] ?? null)
    if (!reply) return
    const ply = game.moves.length
    const timer = setTimeout(() => {
      dispatch({ type: 'computer-move', uci: toUci(reply), ply })
    }, 500)
    return () => {
      clearTimeout(timer)
    }
  }, [result, position, analysis, game.moves.length])

  const feedback =
    result === 'solved'
      ? { tone: 'success', text: task.then?.success ?? task.success }
      : result === 'punished'
        ? { tone: 'failure', text: task.punished }
        : result === 'retry'
          ? { tone: 'hint', text: followUp?.retry ?? task.retry }
          : result === 'halfway' || result === 'replying'
            ? { tone: 'success', text: task.success }
            : null

  return (
    <>
      <p className="lesson__task">
        <strong>Your move:</strong> {followUp?.instruction ?? task.instruction}
      </p>
      <Board
        position={position}
        analysis={analysis}
        selected={state.selected}
        lastMove={game.moves.at(-1) ?? null}
        flipped={state.flipped}
        interactive={result === null || result === 'halfway'}
        transition={state.transition}
        animate={animate}
        onSquare={(square) => {
          dispatch({ type: 'square', square })
        }}
        onDeselect={() => {
          dispatch({ type: 'deselect' })
        }}
      />
      <div className="lesson__feedback" aria-live="polite">
        {feedback && (
          <div className={`banner banner--${feedback.tone}`}>
            <span>{feedback.text}</span>
          </div>
        )}
        {(result === 'retry' || result === 'punished') && (
          <button type="button" className="button" onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    </>
  )
}

/**
 * A lesson position as a game: the player moves, and the "computer" side is the enemy king, which
 * only ever answers a move into its Kill Zone (LessonPractice plays that reply itself).
 */
function lessonState(task: LessonTask): GameState {
  const parsed = parseMeanFen(task.fen)
  if (!parsed.ok) throw new Error(`Invalid lesson position: ${parsed.error}`)
  const human = parsed.position.sideToMove
  return createState(newGame(parsed.position), {
    opponent: { kind: 'computer', level: 'mean', human },
    flipped: human === 'black',
  })
}

function DoneStep({ onOpen }: { readonly onOpen: (index: number) => void }) {
  return (
    <>
      <header className="tutorial__header">
        <p className="hero__eyebrow">Tutorial complete</p>
        <h1 className="hero__title" tabIndex={-1}>You’re ready</h1>
        <p className="hero__lede">
          That is everything Mean Chess adds to chess. When your king is trapped, the pieces it may eat glow, just as in
          the lessons. But nothing on the board warns you about the Kill Zone or tells you when you can win: watch the
          kings.
        </p>
      </header>
      <div className="row tutorial__play">
        <a className="button button--primary" href="/play/?new=computer">
          Play the computer
        </a>
        <a className="button" href="/play/?new=friend">
          Play a friend
        </a>
        <a className="button" href="/rules/">
          Read the full rules
        </a>
      </div>
      <p className="muted">Forgot a rule? The tutorial is always one click away: Tutorial, at the top of every page.</p>
      <LessonList onOpen={onOpen} />
    </>
  )
}

function LessonList({ onOpen }: { readonly onOpen: (index: number) => void }) {
  return (
    <section className="tutorial__lessons" aria-labelledby="lessons-title">
      <h2 id="lessons-title" className="section-title">
        Revisit a lesson
      </h2>
      <ol>
        {LESSONS.map((lesson, index) => (
          <li key={lesson.id}>
            <button type="button" className="link-button" onClick={() => onOpen(index)}>
              {lesson.title}
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}
