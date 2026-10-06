import type { Color, PromotionType } from '../engine/index.ts'
import { Modal } from './Modal.tsx'
import { PieceImage } from './PieceImage.tsx'

const CHOICES: readonly { readonly type: PromotionType; readonly name: string; readonly note: string }[] = [
  { type: 'queen', name: 'Queen', note: 'A promoted queen: it can be sacrificed once nothing lower is left.' },
  { type: 'rook', name: 'Rook', note: 'Sacrifice tier 3.' },
  { type: 'bishop', name: 'Bishop', note: 'Sacrifice tier 2.' },
  { type: 'knight', name: 'Knight', note: 'Sacrifice tier 2.' },
]

export function PromotionDialog({
  color,
  onChoose,
  onCancel,
}: {
  readonly color: Color
  readonly onChoose: (type: PromotionType) => void
  readonly onCancel: () => void
}) {
  return (
    <Modal title="Promote the pawn" onClose={onCancel}>
      <div className="promotion-choices">
        {CHOICES.map(({ type, name, note }) => (
          <button key={type} type="button" className="promotion-choice" onClick={() => onChoose(type)}>
            <PieceImage
              piece={
                type === 'queen'
                  ? { id: `promo-${type}`, color, type, queenOrigin: 'promoted' }
                  : { id: `promo-${type}`, color, type }
              }
            />
            <span className="promotion-choice__name">{name}</span>
            <span className="promotion-choice__note">{note}</span>
          </button>
        ))}
      </div>
    </Modal>
  )
}
