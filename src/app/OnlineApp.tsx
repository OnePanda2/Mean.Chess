import { useEffect, useMemo, useState } from 'react'
import { analyze, currentPosition, importGame, type GameRecord } from '../engine/index.ts'
import { Board } from '../components/Board.tsx'
import { Footer, TopBar } from '../components/Chrome.tsx'
import { Modal } from '../components/Modal.tsx'
import { PromotionDialog } from '../components/PromotionDialog.tsx'
import { RulesSummary } from '../components/RulesSummary.tsx'
import { MoveList } from '../components/SidePanel.tsx'
import { ThemeDialog } from '../components/ThemeDialog.tsx'
import { PieceStyleContext } from '../components/pieces/pieceStyle.ts'
import { formatGameId, normalizeGameId, opponentOf, type ColorChoice, type Result, type Seat } from '../online/index.ts'
import { useAppearance } from './appearance.ts'
import { createState } from './gameState.ts'
import { createGame, gameInfo, joinGame, loadSeat, onlineAvailable, pruneSeats, saveSeat, type GameInfo, type SeatGrant } from './online/api.ts'
import { resultText } from './online/text.ts'
import { useOnlineGame } from './online/useOnlineGame.ts'
import { themeById } from './themes.ts'

const seatName = (seat: Seat): string => (seat === 'white' ? 'White' : 'Black')

type Screen =
  | { readonly kind: 'home' }
  | { readonly kind: 'loading'; readonly gameId: string }
  | { readonly kind: 'invited'; readonly gameId: string; readonly seat: Seat }
  | { readonly kind: 'playing'; readonly grant: SeatGrant }
  | { readonly kind: 'others'; readonly gameId: string }
  | { readonly kind: 'viewing'; readonly gameId: string; readonly game: GameRecord; readonly result: Result | null }
  | { readonly kind: 'missing' }
  | { readonly kind: 'full'; readonly reopensAt: number | null }
  | { readonly kind: 'unreachable'; readonly retry: () => void }

function gameIdFromUrl(): string | null {
  const raw = new URLSearchParams(window.location.search).get('g')
  return raw ? normalizeGameId(raw) : null
}

function showGame(gameId: string): void {
  window.history.replaceState(null, '', `/online/?g=${gameId}`)
}

/** The online page (/online/): create or join a game with a friend, then play it (ONLINE-PROTOCOL.md §14). */
export function OnlineApp() {
  const [appearance, setAppearance] = useAppearance()
  const [themeOpen, setThemeOpen] = useState(false)
  const [screen, setScreen] = useState<Screen>(() => {
    const gameId = gameIdFromUrl()
    if (!gameId) return { kind: 'home' }
    const seat = loadSeat(gameId)
    return seat ? { kind: 'playing', grant: { gameId, you: seat.you, token: seat.token } } : { kind: 'loading', gameId }
  })

  useEffect(() => {
    pruneSeats()
  }, [])

  // Opening a game link: resume with a stored seat, or ask the server what the game is.
  useEffect(() => {
    if (screen.kind !== 'loading') return
    const { gameId } = screen
    let cancelled = false
    void gameInfo(gameId).then((answer) => {
      if (cancelled) return
      if (!answer.ok) {
        setScreen(answer.error === 'not-found' ? { kind: 'missing' } : { kind: 'unreachable', retry: () => setScreen({ kind: 'loading', gameId }) })
        return
      }
      setScreen(screenFor(gameId, answer.value))
    })
    return () => {
      cancelled = true
    }
  }, [screen])

  if (!onlineAvailable()) {
    return (
      <Page onTheme={() => setThemeOpen(true)} appearance={appearance} themeOpen={themeOpen} setAppearance={setAppearance} closeTheme={() => setThemeOpen(false)}>
        <header className="tutorial__header">
          <p className="hero__eyebrow">Online</p>
          <h1 className="hero__title">Online play is coming soon</h1>
          <p className="hero__lede">Meanwhile, play the computer or a friend on this device.</p>
        </header>
        <OfflineChoices />
      </Page>
    )
  }

  return (
    <Page onTheme={() => setThemeOpen(true)} appearance={appearance} themeOpen={themeOpen} setAppearance={setAppearance} closeTheme={() => setThemeOpen(false)}>
      {screen.kind === 'home' && <HomeScreen onPlaying={(grant) => setScreen({ kind: 'playing', grant })} onFull={(reopensAt) => setScreen({ kind: 'full', reopensAt })} />}
      {screen.kind === 'loading' && <p className="muted">Opening the game…</p>}
      {screen.kind === 'invited' && (
        <InvitedScreen
          gameId={screen.gameId}
          seat={screen.seat}
          onJoined={(grant) => setScreen({ kind: 'playing', grant })}
          onGone={(next) => setScreen(next)}
        />
      )}
      {screen.kind === 'playing' && (
        <GameScreen
          key={screen.grant.gameId}
          grant={screen.grant}
          animate={appearance.animations}
          onNextGame={(grant) => {
            saveSeat(grant)
            showGame(grant.gameId)
            setScreen({ kind: 'playing', grant })
          }}
        />
      )}
      {screen.kind === 'others' && (
        <Notice title="This game is between two other players" text="You can start your own game with a friend." />
      )}
      {screen.kind === 'viewing' && <FinishedView game={screen.game} result={screen.result} gameId={screen.gameId} animate={appearance.animations} />}
      {screen.kind === 'missing' && <Notice title="Game not found" text="This game doesn't exist, or it has expired. Invites last 24 hours; finished games, 30 days." />}
      {screen.kind === 'full' && <FullScreen reopensAt={screen.reopensAt} />}
      {screen.kind === 'unreachable' && (
        <Notice title="Can't reach the game server" text="Check your connection and try again. Your games are saved on the server.">
          <button type="button" className="button button--primary" onClick={screen.retry}>
            Try again
          </button>
        </Notice>
      )}
    </Page>
  )
}

function screenFor(gameId: string, info: GameInfo): Screen {
  if (info.status === 'waiting') return { kind: 'invited', gameId, seat: opponentOf(info.creatorColor) }
  if (info.status === 'active') return { kind: 'others', gameId }
  const loaded = importGame(JSON.stringify({ format: 'mean-chess-game', version: 1, rules: '0.1', start: info.game.start, moves: info.game.moves, result: null }))
  return loaded.ok ? { kind: 'viewing', gameId, game: loaded.game, result: info.result } : { kind: 'missing' }
}

function Page({
  children,
  onTheme,
  appearance,
  themeOpen,
  setAppearance,
  closeTheme,
}: {
  readonly children: React.ReactNode
  readonly onTheme: () => void
  readonly appearance: ReturnType<typeof useAppearance>[0]
  readonly themeOpen: boolean
  readonly setAppearance: ReturnType<typeof useAppearance>[1]
  readonly closeTheme: () => void
}) {
  return (
    <PieceStyleContext value={themeById(appearance.theme).pieceStyle}>
      <TopBar current="play" onTheme={onTheme} />
      <main id="main" className="online">
        {children}
      </main>
      <Footer />
      {themeOpen && <ThemeDialog appearance={appearance} onChange={setAppearance} onClose={closeTheme} />}
    </PieceStyleContext>
  )
}

function OfflineChoices() {
  return (
    <div className="row">
      <a className="button button--primary" href="/play/?new=computer">
        Play the computer
      </a>
      <a className="button" href="/play/?new=friend">
        Play a friend on this device
      </a>
    </div>
  )
}

function Notice({ title, text, children }: { readonly title: string; readonly text: string; readonly children?: React.ReactNode }) {
  return (
    <section className="online__notice">
      <h1 className="hero__title">{title}</h1>
      <p className="hero__lede">{text}</p>
      <div className="row">
        {children}
        <a className="button" href="/online/">
          New online game
        </a>
        <a className="button" href="/play/">
          Play offline
        </a>
      </div>
    </section>
  )
}

function FullScreen({ reopensAt }: { readonly reopensAt: number | null }) {
  const [openedAt] = useState(() => Date.now())
  const hours = reopensAt ? Math.max(0, reopensAt - openedAt) / 3_600_000 : null
  const wait = hours === null ? 'at 00:00 UTC' : `in ${Math.floor(hours)} h ${Math.round((hours % 1) * 60)} min (00:00 UTC)`
  return (
    <section className="online__notice">
      <h1 className="hero__title">Online play is full for today</h1>
      <p className="hero__lede">
        It reopens {wait}. Games already started aren't affected, and invites you've sent still work.
      </p>
      <OfflineChoices />
    </section>
  )
}

function HomeScreen({ onPlaying, onFull }: { readonly onPlaying: (grant: SeatGrant) => void; readonly onFull: (reopensAt: number | null) => void }) {
  const [color, setColor] = useState<ColorChoice>('random')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create(): Promise<void> {
    setBusy(true)
    setError(null)
    const answer = await createGame(color)
    setBusy(false)
    if (answer.ok) {
      saveSeat(answer.value)
      showGame(answer.value.gameId)
      onPlaying(answer.value)
    } else if (answer.error === 'online-full') onFull(answer.reopensAt ?? null)
    else if (answer.error === 'rate-limited') setError('Too many games at once. Wait a minute and try again.')
    else if (answer.error === 'unavailable') setError('Online play is paused right now. Play the computer meanwhile.')
    else setError("Couldn't reach the game server. Check your connection and try again.")
  }

  const normalized = normalizeGameId(code)
  return (
    <>
      <header className="tutorial__header">
        <p className="hero__eyebrow">Online</p>
        <h1 className="hero__title">Play a friend online</h1>
        <p className="hero__lede">Create a game and send your friend the link. No account needed.</p>
      </header>
      <section className="online__create" aria-labelledby="create-title">
        <h2 id="create-title" className="section-title">
          Create a game
        </h2>
        <fieldset className="choice">
          <legend>You play</legend>
          {(['white', 'black', 'random'] as const).map((option) => (
            <label key={option} className="choice__option">
              <input type="radio" name="color" checked={color === option} onChange={() => setColor(option)} />
              <span className="choice__text">
                <strong>{option === 'random' ? 'Random' : seatName(option)}</strong>
              </span>
            </label>
          ))}
        </fieldset>
        <button type="button" className="button button--primary" disabled={busy} onClick={() => void create()}>
          {busy ? 'Creating…' : 'Create invite'}
        </button>
        {error && (
          <p className="banner banner--hint" role="alert">
            {error}
          </p>
        )}
      </section>
      <section className="online__join" aria-labelledby="join-title">
        <h2 id="join-title" className="section-title">
          Join with a code
        </h2>
        <form
          className="row"
          onSubmit={(event) => {
            event.preventDefault()
            if (normalized) window.location.assign(`/online/?g=${normalized}`)
          }}
        >
          <label className="online__code">
            <span className="visually-hidden">Game code</span>
            <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="7KQ2M-X9FTA" autoComplete="off" spellCheck={false} />
          </label>
          <button type="submit" className="button" disabled={!normalized}>
            Join
          </button>
        </form>
      </section>
    </>
  )
}

function InvitedScreen({
  gameId,
  seat,
  onJoined,
  onGone,
}: {
  readonly gameId: string
  readonly seat: Seat
  readonly onJoined: (grant: SeatGrant) => void
  readonly onGone: (screen: Screen) => void
}) {
  const [rulesOpen, setRulesOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function join(): Promise<void> {
    setBusy(true)
    setError(null)
    const answer = await joinGame(gameId)
    setBusy(false)
    if (answer.ok) {
      saveSeat(answer.value)
      onJoined(answer.value)
    } else if (answer.error === 'game-full') onGone({ kind: 'others', gameId })
    else if (answer.error === 'game-over' || answer.error === 'not-found') onGone({ kind: 'missing' })
    else if (answer.error === 'rate-limited') setError('Too many attempts. Wait a minute and try again.')
    else setError("Couldn't reach the game server. Check your connection and try again.")
  }

  return (
    <section className="online__invited">
      <p className="hero__eyebrow">Game {formatGameId(gameId)}</p>
      <h1 className="hero__title">You've been challenged to Mean Chess</h1>
      <p className="hero__lede">You'll play {seatName(seat)}. Mean Chess is chess where kings can kill kings, and a trapped king can eat its own army to survive.</p>
      <div className="row">
        <button type="button" className="button button--primary" disabled={busy} onClick={() => void join()}>
          {busy ? 'Joining…' : 'Join game'}
        </button>
        <button type="button" className="button" onClick={() => setRulesOpen(true)}>
          The rules in one minute
        </button>
        <a className="button" href="/tutorial/" target="_blank" rel="noopener">
          Tutorial
        </a>
      </div>
      {error && (
        <p className="banner banner--hint" role="alert">
          {error}
        </p>
      )}
      {rulesOpen && <RulesSummary onClose={() => setRulesOpen(false)} />}
    </section>
  )
}

function FinishedView({ game, result, gameId, animate }: { readonly game: GameRecord; readonly result: Result | null; readonly gameId: string; readonly animate: boolean }) {
  const state = useMemo(() => createState(game), [game])
  const position = currentPosition(game)
  return (
    <section className="online__game">
      <div className="online__board">
        <Board
          position={position}
          analysis={analyze(position)}
          selected={null}
          lastMove={game.moves.at(-1) ?? null}
          flipped={false}
          interactive={false}
          transition={state.transition}
          animate={animate}
          onSquare={() => undefined}
        />
      </div>
      <aside className="online__panel card">
        <p className="hero__eyebrow">Game {formatGameId(gameId)} · finished</p>
        <p className="online__status">{result ? resultText(result, null) : 'Finished.'}</p>
        <MoveList game={game} notation={state.notation} />
      </aside>
    </section>
  )
}

function GameScreen({ grant, animate, onNextGame }: { readonly grant: SeatGrant; readonly animate: boolean; readonly onNextGame: (grant: SeatGrant) => void }) {
  const online = useOnlineGame({ gameId: grant.gameId, token: grant.token, you: grant.you })
  const { state, meta, you } = online
  const position = currentPosition(state.game)
  const analysis = useMemo(() => analyze(position), [position])
  const [confirmResign, setConfirmResign] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000)
    return () => clearInterval(timer)
  }, [])

  const next = meta.rematch.next
  useEffect(() => {
    if (next) onNextGame({ gameId: next.gameId, you: next.you, token: grant.token })
  }, [next, grant.token, onNextGame])

  if (online.connection === 'closed' && online.closeReason && online.closeReason !== 'stopped') {
    const texts: Record<string, [string, string]> = {
      'not-authenticated': ["You aren't a player in this game", 'This browser no longer holds a seat in it.'],
      'not-found': ['Game not found', "This game doesn't exist, or it has expired."],
      superseded: ['This game is open in another tab', 'Keep playing there.'],
      deleted: ['Game deleted', 'Games are kept for 30 days after they end.'],
      outdated: ['Mean Chess was updated', 'Reload to keep playing.'],
      refused: ['Connection refused', 'Wait half a minute, then reload.'],
    }
    const [title, text] = texts[online.closeReason] ?? ['Disconnected', 'Reload to try again.']
    return <Notice title={title} text={text} />
  }

  const link = `${window.location.origin}/online/?g=${grant.gameId}`
  if (meta.status === 'waiting' || meta.status === null) {
    return (
      <section className="online__waiting">
        <p className="hero__eyebrow">You play {seatName(you)}</p>
        <h1 className="hero__title">Send this link to your friend</h1>
        <div className="online__link">
          <input readOnly value={link} aria-label="Invite link" onFocus={(event) => event.target.select()} />
          <button
            type="button"
            className="button button--primary"
            onClick={() => {
              void navigator.clipboard.writeText(link).then(() => setCopied(true), () => setCopied(false))
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          {'share' in navigator && (
            <button type="button" className="button" onClick={() => void navigator.share({ title: 'Mean Chess', text: "Let's play Mean Chess", url: link }).catch(() => undefined)}>
              Share
            </button>
          )}
        </div>
        <p>
          Or tell them the code: <strong className="online__bigcode">{formatGameId(grant.gameId)}</strong>
        </p>
        <p className="muted">{online.connection === 'open' ? 'Waiting for your friend…' : 'Connecting…'}</p>
        <button type="button" className="button" onClick={online.abort}>
          Cancel invite
        </button>
      </section>
    )
  }

  const opponent = opponentOf(you)
  const finished = meta.status === 'finished'
  const yourTurn = !finished && position.sideToMove === you
  const opponentAway = !finished && meta.presence !== null && !meta.presence.connected[opponent]
  const claimIn = meta.claimableAt === null ? null : Math.max(0, Math.ceil((meta.claimableAt - (now + meta.clockOffset)) / 1_000))
  return (
    <section className="online__game">
      <div className="online__board">
        <Board
          position={position}
          analysis={analysis}
          selected={state.selected}
          lastMove={state.game.moves.at(-1) ?? null}
          flipped={state.flipped}
          interactive={yourTurn && online.connection === 'open' && !online.pending}
          transition={state.transition}
          animate={animate}
          onSquare={online.onSquare}
          onDeselect={online.onDeselect}
        />
      </div>
      <aside className="online__panel card" aria-label="Game status">
        <p className="hero__eyebrow">
          Game {formatGameId(grant.gameId)} · you play {seatName(you)}
        </p>
        <p className="online__status" role="status">
          {finished && meta.result ? resultText(meta.result, you) : yourTurn ? (online.pending ? 'Sending your move…' : 'Your move') : 'Their move'}
        </p>
        {online.connection === 'reconnecting' && (
          <div className="banner banner--hint">
            <span>Reconnecting…</span>
            <button type="button" className="link-button" onClick={online.retryNow}>
              Retry now
            </button>
          </div>
        )}
        {opponentAway && (
          <div className="banner banner--hint">
            <span>Your opponent left the game.</span>
            {claimIn !== null && claimIn > 0 && <span> You can claim the game in {claimIn} s.</span>}
            {claimIn === 0 && (
              <span className="row">
                <button type="button" className="button button--primary" onClick={() => online.claim('win')}>
                  Claim win
                </button>
                <button type="button" className="button" onClick={() => online.claim('draw')}>
                  Call it a draw
                </button>
              </span>
            )}
          </div>
        )}
        {!finished && meta.drawOffer === opponent && (
          <div className="banner banner--hint">
            <span>Your opponent offers a draw.</span>
            <button type="button" className="button button--primary" onClick={() => online.answerDraw(true)}>
              Accept
            </button>
            <button type="button" className="button" onClick={() => online.answerDraw(false)}>
              Decline
            </button>
          </div>
        )}
        {!finished && meta.drawOffer === you && <p className="muted">Draw offered. Waiting for an answer.</p>}
        {!finished && (
          <div className="row">
            {state.game.moves.length < 2 ? (
              <button type="button" className="button" onClick={online.abort}>
                Cancel game
              </button>
            ) : (
              <button type="button" className="button" disabled={meta.drawOffer !== null} onClick={online.offerDraw}>
                Offer draw
              </button>
            )}
            <button type="button" className="button" onClick={() => setConfirmResign(true)}>
              Resign
            </button>
          </div>
        )}
        {finished && (
          <div className="row">
            {meta.rematch.offeredBy === opponent ? (
              <>
                <button type="button" className="button button--primary" onClick={() => online.answerRematch(true)}>
                  Accept rematch
                </button>
                <button type="button" className="button" onClick={() => online.answerRematch(false)}>
                  Decline
                </button>
              </>
            ) : (
              <button type="button" className="button button--primary" disabled={meta.rematch.offeredBy === you || meta.result?.reason === 'aborted'} onClick={online.offerRematch}>
                {meta.rematch.offeredBy === you ? 'Rematch offered' : 'Rematch'}
              </button>
            )}
            <a className="button" href="/online/">
              New game
            </a>
          </div>
        )}
        <MoveList game={state.game} notation={state.notation} />
      </aside>
      {state.promotion && <PromotionDialog color={you} onChoose={online.onPromote} onCancel={online.onCancelPromotion} />}
      {confirmResign && (
        <Modal title="Resign this game?" onClose={() => setConfirmResign(false)}>
          <div className="row">
            <button
              type="button"
              className="button button--primary"
              onClick={() => {
                setConfirmResign(false)
                online.resign()
              }}
            >
              Resign
            </button>
            <button type="button" className="button" onClick={() => setConfirmResign(false)}>
              Keep playing
            </button>
          </div>
        </Modal>
      )}
    </section>
  )
}
