import { Modal } from './Modal.tsx'

/** The in-game quick reference. The canonical text is the rules page (docs/RULES.md). */
export function RulesSummary({ onClose }: { readonly onClose: () => void }) {
  return (
    <Modal title="Mean Chess in one minute" onClose={onClose}>
      <dl className="rules-summary">
        <dt>Standard chess</dt>
        <dd>Every normal chess rule applies, unless changed below. Kings may never stand next to each other.</dd>
        <dt>Royal Capture</dt>
        <dd>
          Only a king can capture a king. It may do so from exactly two squares away in a straight line (rank, file
          or diagonal) when the square between is empty. That wins at once, even while in check.
        </dd>
        <dt>Royal Kill Zone</dt>
        <dd>
          Standing two squares from the enemy king is legal, not check. But if the enemy king can capture yours on its
          turn, it will. The board won’t warn you: watch for it yourself.
        </dd>
        <dt>Royal Slaughter</dt>
        <dd>
          If one of your own eligible pieces stands between the kings, your king may eat it and capture the enemy king
          in one move. Enemy pieces cannot be jumped.
        </dd>
        <dt>Sacrifice tiers</dt>
        <dd>
          Pawns, then knights and bishops, then rooks, then promoted queens. Only your lowest remaining tier is
          eligible. The original queen can never be sacrificed.
        </dd>
        <dt>Royal Cannibalism</dt>
        <dd>
          In check, with no royal move and no safe normal move, your king may eat an adjacent eligible piece of your own
          to escape.
        </dd>
        <dt>Draws</dt>
        <dd>Stalemate, threefold repetition, the fifty-move rule or agreement. Material alone never draws.</dd>
      </dl>
      <p className="row">
        <a href="/tutorial/">Learn them on a board: the tutorial →</a>
        <a href="/rules/">Read the full rules (v0.1) →</a>
      </p>
    </Modal>
  )
}
