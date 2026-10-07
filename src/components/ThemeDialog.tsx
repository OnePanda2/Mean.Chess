import type { Appearance } from '../app/appearance.ts'
import { THEMES } from '../app/themes.ts'
import { MiniBoard } from './MiniBoard.tsx'
import { Modal } from './Modal.tsx'
import { PieceStyleContext } from './pieces/pieceStyle.ts'

/** A quiet Italian Game, so every piece type shows in the previews. */
const PREVIEW_FEN = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4'

export function ThemeDialog({
  appearance,
  onChange,
  onClose,
}: {
  readonly appearance: Appearance
  readonly onChange: (next: Appearance) => void
  readonly onClose: () => void
}) {
  return (
    <Modal title="Themes" onClose={onClose} wide>
      <p className="muted">The rules stay mean in every outfit.</p>
      <div className="theme-grid" role="radiogroup" aria-label="Theme">
        {THEMES.map((theme) => {
          const active = appearance.theme === theme.id
          return (
            <button
              key={theme.id}
              type="button"
              role="radio"
              aria-checked={active}
              className={`theme-card${active ? ' theme-card--active' : ''}`}
              onClick={() => onChange({ ...appearance, theme: theme.id })}
            >
              <span className="theme-card__preview" data-theme={theme.id}>
                <PieceStyleContext value={theme.pieceStyle}>
                  <MiniBoard fen={PREVIEW_FEN} decorative />
                </PieceStyleContext>
              </span>
              <span className="theme-card__name">{theme.name}</span>
              <span className="theme-card__tagline">{theme.tagline}</span>
            </button>
          )
        })}
      </div>
      <label className="toggle">
        <input
          type="checkbox"
          checked={appearance.animations}
          onChange={(event) => onChange({ ...appearance, animations: event.target.checked })}
        />
        <span>Animate moves and captures</span>
      </label>
      <p className="muted small">If your device is set to reduce motion, pieces always snap into place.</p>
    </Modal>
  )
}
