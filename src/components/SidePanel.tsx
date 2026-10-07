import {
  TIER_NAMES,
  type Color,
  type Explanation,
  type GameRecord,
  type Piece,
  type PositionAnalysis,
} from '../engine/index.ts'
import { LEVEL_TEXT, type Opponent } from '../app/opponent.ts'
import { outcomeDetail, outcomeTitle, sideName, statusOf } from '../app/text.ts'
import { PieceImage } from './PieceImage.tsx'

const tierText = (tier: PositionAnalysis['activeTiers'][Color]): string => (tier === null ? 'nothing' : TIER_NAMES[tier])

export function StatusPanel({
  game,
  analysis,
  sideToMove,
  hint,
  opponent,
  thinking,
  notice,
}: {
  readonly game: GameRecord
  readonly analysis: PositionAnalysis
  readonly sideToMove: Color
  readonly hint: Explanation | null
  readonly opponent: Opponent
  /** The computer is choosing its move. */
  readonly thinking: boolean
  /** A short message from the computer, such as a declined draw offer. */
  readonly notice: string | null
}) {
  const yourTurn = opponent.kind === 'friend' || opponent.human === sideToMove
  // Status messages speak to the player about their own king, so only on their turn.
  const status = game.outcome || !yourTurn ? null : statusOf(analysis)
  const turn = game.outcome
    ? 'Game over'
    : opponent.kind === 'friend'
      ? `${sideName(sideToMove)} to move`
      : yourTurn
        ? 'Your move'
        : 'The computer is thinking'
  return (
    <section className="card status-card" aria-label="Game status">
      <p className="turn">
        <span className={`turn__disc turn__disc--${game.outcome ? 'over' : sideToMove}`} aria-hidden="true" />
        {turn}
        {thinking && (
          <span className="thinking" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        )}
      </p>
      {opponent.kind === 'computer' && (
        <p className="matchup">
          You play {sideName(opponent.human)} against the computer: <strong>{LEVEL_TEXT[opponent.level].name}</strong>
        </p>
      )}
      {game.outcome && (
        <div className="banner banner--result">
          <strong>{outcomeTitle(game.outcome, opponent)}</strong>
          <span>{outcomeDetail(game.outcome, opponent)}</span>
        </div>
      )}
      {notice && (
        <div className="banner">
          <span>{notice}</span>
        </div>
      )}
      {status && (
        <div className={`banner banner--${status.tone}`}>
          <strong>{status.title}</strong>
          <span>{status.detail}</span>
        </div>
      )}
      {hint && (
        <div className="banner banner--hint">
          <strong>{hint.title}</strong>
          <span>{hint.detail}</span>
        </div>
      )}
      <dl className="tiers">
        <div>
          <dt>White may sacrifice</dt>
          <dd>{tierText(analysis.activeTiers.white)}</dd>
        </div>
        <div>
          <dt>Black may sacrifice</dt>
          <dd>{tierText(analysis.activeTiers.black)}</dd>
        </div>
      </dl>
    </section>
  )
}

/** Moves in Mean Chess Notation, two per row, numbered from the game's start. */
export function MoveList({ game, notation }: { readonly game: GameRecord; readonly notation: readonly string[] }) {
  const rows: { number: number; white: string | null; black: string | null }[] = []
  let number = game.start.fullmoveNumber
  let index = 0
  if (game.start.sideToMove === 'black' && notation.length > 0) {
    rows.push({ number, white: null, black: notation[0] ?? null })
    number++
    index = 1
  }
  for (; index < notation.length; index += 2) {
    rows.push({ number, white: notation[index] ?? null, black: notation[index + 1] ?? null })
    number++
  }
  return (
    <section className="card moves-card" aria-label="Moves">
      <h2 className="card__title">
        Moves <span className="card__subtitle">Mean Chess notation</span>
      </h2>
      {rows.length === 0 ? (
        <p className="muted">No moves yet.</p>
      ) : (
        <ol className="move-list">
          {rows.map((row) => (
            <li key={row.number}>
              <span className="move-list__number">{row.number}.</span>
              <span className="move-list__move">{row.white ?? '…'}</span>
              <span className="move-list__move">{row.black ?? ''}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

/** Pieces taken by the enemy, and pieces eaten by their own king. */
export function CapturedPieces({ game }: { readonly game: GameRecord }) {
  const taken: Record<Color, Piece[]> = { white: [], black: [] }
  const eaten: Record<Color, Piece[]> = { white: [], black: [] }
  for (const move of game.moves) {
    if (move.captured) taken[move.captured.color].push(move.captured)
    if (move.sacrificed) eaten[move.sacrificed.color].push(move.sacrificed)
  }
  const tray = (pieces: readonly Piece[]) =>
    pieces.length === 0 ? (
      <span className="muted">none</span>
    ) : (
      pieces.map((piece) => <PieceImage key={piece.id} piece={piece} className="tray-piece" />)
    )
  return (
    <section className="card captured-card" aria-label="Captured and sacrificed pieces">
      <h2 className="card__title">Lost pieces</h2>
      <dl className="trays">
        <div>
          <dt>White, taken</dt>
          <dd>{tray(taken.white)}</dd>
        </div>
        <div>
          <dt>White, eaten by own king</dt>
          <dd>{tray(eaten.white)}</dd>
        </div>
        <div>
          <dt>Black, taken</dt>
          <dd>{tray(taken.black)}</dd>
        </div>
        <div>
          <dt>Black, eaten by own king</dt>
          <dd>{tray(eaten.black)}</dd>
        </div>
      </dl>
    </section>
  )
}
