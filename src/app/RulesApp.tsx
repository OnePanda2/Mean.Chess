import { useState, type ReactNode } from 'react'
import { RULES_VERSION } from '../engine/index.ts'
import { Footer, TopBar } from '../components/Chrome.tsx'
import { MiniBoard, type Mark } from '../components/MiniBoard.tsx'
import { ThemeDialog } from '../components/ThemeDialog.tsx'
import { PieceStyleContext } from '../components/pieces/pieceStyle.ts'
import { useAppearance } from './appearance.ts'
import { themeById } from './themes.ts'

/** The rules page (handoff §29). Formal text: the canonical source is docs/RULES.md. */
export function RulesApp() {
  const [appearance, setAppearance] = useAppearance()
  const [themeOpen, setThemeOpen] = useState(false)
  return (
    <PieceStyleContext value={themeById(appearance.theme).pieceStyle}>
      <TopBar current="rules" onTheme={() => setThemeOpen(true)} />
      <main id="main" className="rules">
        <header className="rules__header">
          <p className="hero__eyebrow">Specification</p>
          <h1 className="hero__title">
            Mean Chess Rules <span className="rules__version">v{RULES_VERSION}</span>
          </h1>
          <p className="hero__lede">
            Mean Chess is played exactly like standard chess, except for the rules on this page. Where this page and
            the code disagree, this page is right.
          </p>
          <nav aria-label="Contents" className="rules__toc">
            <ol>
              <li><a href="#standard">Standard chess</a></li>
              <li><a href="#royal-capture">Royal Capture</a></li>
              <li><a href="#kill-zone">The Royal Kill Zone</a></li>
              <li><a href="#adjacent-kings">Adjacent kings</a></li>
              <li><a href="#hierarchy">The sacrifice hierarchy</a></li>
              <li><a href="#queens">Original and promoted queens</a></li>
              <li><a href="#royal-slaughter">Royal Slaughter</a></li>
              <li><a href="#cannibalism">Royal Cannibalism</a></li>
              <li><a href="#ending">How the game ends</a></li>
              <li><a href="#notation">Notation</a></li>
            </ol>
          </nav>
        </header>

        <RuleSection id="standard" number={1} title="Standard chess">
          <p>
            All standard rules of chess apply: the board, the starting position, how every piece moves and captures,
            castling, en passant, promotion to a queen, rook, bishop or knight, check, checkmate and stalemate. White
            moves first. A move may never leave your own king in check.
          </p>
        </RuleSection>

        <RuleSection
          id="royal-capture"
          number={2}
          title="Royal Capture"
          diagram={{
            fen: '8/8/8/8/8/5k2/8/7K w - - 0 1',
            marks: { f3: 'win' },
            label: 'White king on h1, black king on f3: White can capture it.',
            scenario: 'royal-capture',
          }}
        >
          <p>Only a king can capture a king. Other pieces still give check, but they never capture a king.</p>
          <p>
            A king may capture the enemy king when the enemy king stands <strong>exactly two squares away</strong> on
            the same rank, file or diagonal, and the square between them is empty. This is a Royal Capture. It ends
            the game immediately and the capturing side wins.
          </p>
          <p>
            From h1, a king can capture on f1, f3 and h3. Squares a knight’s jump away, such as f2 or g3, are out of
            reach. A Royal Capture is allowed even when the capturing king is in check.
          </p>
        </RuleSection>

        <RuleSection
          id="kill-zone"
          number={3}
          title="The Royal Kill Zone"
          diagram={{
            fen: '8/8/8/8/4k3/8/8/7K b - - 0 1',
            marks: { f3: 'danger' },
            label: 'Black king on e4 may step to f3, two squares from the white king.',
            scenario: 'royal-capture',
          }}
        >
          <p>
            The squares from which the enemy king could capture yours form the Royal Kill Zone. Standing in it is{' '}
            <strong>legal and is not check</strong>: you may move into it, castle into it and remain in it. But if it
            is the enemy’s turn and their king can capture yours, they win.
          </p>
          <p>
            A move after which the opponent has a Royal Capture or Royal Slaughter is called <em>suicidal</em>. During a
            game the board never warns you: spotting the Kill Zone, yours and your opponent’s, is part of the game.
          </p>
        </RuleSection>

        <RuleSection id="adjacent-kings" number={4} title="Adjacent kings">
          <p>
            As in standard chess, the kings may never stand on neighbouring squares. Two squares apart is allowed, and
            is exactly where a Royal Capture becomes possible.
          </p>
        </RuleSection>

        <RuleSection id="hierarchy" number={5} title="The sacrifice hierarchy">
          <p>Some rules let a king remove one of its own pieces. Which pieces qualify is fixed by class:</p>
          <table className="tier-table">
            <thead>
              <tr>
                <th scope="col">Tier</th>
                <th scope="col">Pieces</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>1</td><td>Pawns</td></tr>
              <tr><td>2</td><td>Knights and bishops</td></tr>
              <tr><td>3</td><td>Rooks</td></tr>
              <tr><td>4</td><td>Promoted queens</td></tr>
              <tr><td>Never</td><td>The original queen and the king</td></tr>
            </tbody>
          </table>
          <p>
            Only pieces of your <strong>lowest tier that still has a piece anywhere on the board</strong> are eligible.
            While you have a single pawn left, only pawns may be sacrificed, however far away it stands.
          </p>
        </RuleSection>

        <RuleSection id="queens" number={6} title="Original and promoted queens">
          <p>
            A queen that began the game is the <strong>original queen</strong>. She can never be sacrificed. A queen
            created by promotion is a <strong>promoted queen</strong> for the rest of the game and belongs to tier 4.
            The board marks promoted queens with a small brass dot. A pawn promoted to a rook, bishop or knight is
            simply that piece.
          </p>
        </RuleSection>

        <RuleSection
          id="royal-slaughter"
          number={7}
          title="Royal Slaughter"
          diagram={{
            fen: '8/8/8/8/8/4k3/4P3/4K3 w - - 0 1',
            marks: { e2: 'sacrifice', e3: 'win' },
            label: 'White king e1, white pawn e2, black king e3: White may slaughter.',
            scenario: 'slaughter-pawn',
          }}
        >
          <p>
            If the kings are two squares apart in a straight line and the square between them holds one of{' '}
            <strong>your own eligible pieces</strong>, your king may remove that piece and capture the enemy king, as a
            single move. This is a Royal Slaughter and it wins the game. No check is required.
          </p>
          <p>
            Kings never jump: an enemy piece between the kings blocks the line, and so does any of your pieces that is
            not eligible. Because a piece standing between the kings that attacks the enemy king would be giving
            check, a queen can never be slaughtered through, a rook only on a diagonal, a bishop only on a rank or
            file, and a pawn only on a rank, a file or the diagonal behind it.
          </p>
        </RuleSection>

        <RuleSection
          id="cannibalism"
          number={8}
          title="Royal Cannibalism"
          diagram={{
            fen: 'k7/8/8/8/8/8/5PPP/4r1K1 w - - 0 1',
            marks: { f2: 'sacrifice', g2: 'sacrifice', h2: 'sacrifice' },
            label: 'A back-rank checkmate in standard chess. In Mean Chess the king may eat f2, g2 or h2.',
            scenario: 'cannibal-back-rank',
          }}
        >
          <p>Your king is <strong>desperate</strong> when all of the following are true:</p>
          <ol>
            <li>it is in check;</li>
            <li>you have no Royal Capture or Royal Slaughter;</li>
            <li>you have no other legal move, or every one of them is suicidal.</li>
          </ol>
          <p>
            A desperate king may move onto an adjacent square occupied by one of your own eligible pieces, removing
            that piece. This is Royal Cannibalism. The king must not be in check afterwards. Your other legal moves
            remain available.
          </p>
          <p>Cannibalism is never allowed when you are not in check: a position with no legal move is stalemate.</p>
        </RuleSection>

        <RuleSection id="ending" number={9} title="How the game ends">
          <ol>
            <li>
              <strong>Royal Capture or Royal Slaughter:</strong> the capturing side wins at once. This overrides
              everything below.
            </li>
            <li>
              <strong>Checkmate:</strong> the side to move is in check and has no legal move at all, including Royal
              Cannibalism. That side loses.
            </li>
            <li>
              <strong>Stalemate:</strong> the side to move has no legal move and is not in check. Draw.
            </li>
            <li>
              <strong>Fifty-move rule:</strong> 100 moves in a row (50 by each side) without a pawn move, a capture or
              a sacrifice. Draw.
            </li>
            <li>
              <strong>Threefold repetition:</strong> the same position for the third time, with the same player to
              move, the same castling and en-passant possibilities, and the same queens counted as original or
              promoted. Draw.
            </li>
            <li>
              <strong>Agreement or resignation.</strong>
            </li>
          </ol>
          <p>
            There is <strong>no draw for insufficient material</strong>. In Mean Chess a lone knight or bishop can
            force a win against a bare king, and two bare kings can still capture each other.
          </p>
        </RuleSection>

        <RuleSection id="notation" number={10} title="Notation">
          <p>The move list uses Mean Chess notation: standard algebraic notation, plus:</p>
          <dl className="notation-list">
            <dt><code>K×K</code></dt>
            <dd>Royal Capture.</dd>
            <dt><code>K×P×K</code></dt>
            <dd>Royal Slaughter through a pawn (N, B, R or Q~ for other pieces).</dd>
            <dt><code>K×e2(own P)</code></dt>
            <dd>Royal Cannibalism: the king eats its own pawn on e2.</dd>
            <dt><code>Q~</code></dt>
            <dd>A promoted queen.</dd>
          </dl>
        </RuleSection>
      </main>
      <Footer />
      {themeOpen && (
        <ThemeDialog appearance={appearance} onChange={setAppearance} onClose={() => setThemeOpen(false)} />
      )}
    </PieceStyleContext>
  )
}

interface Diagram {
  readonly fen: string
  readonly marks: Readonly<Record<string, Mark>>
  readonly label: string
  readonly scenario: string
}

function RuleSection({
  id,
  number,
  title,
  diagram,
  children,
}: {
  readonly id: string
  readonly number: number
  readonly title: string
  readonly diagram?: Diagram
  readonly children: ReactNode
}) {
  return (
    <section id={id} className={`rule${diagram ? ' rule--with-diagram' : ''}`} aria-labelledby={`${id}-title`}>
      <div className="rule__text">
        <h2 id={`${id}-title`}>
          <span className="rule__number">{number}.</span> {title}
        </h2>
        {children}
      </div>
      {diagram && (
        <figure className="rule__diagram">
          <MiniBoard fen={diagram.fen} marks={diagram.marks} label={diagram.label} />
          <figcaption>
            {diagram.label} <a href={`/?scenario=${diagram.scenario}`}>Try this position →</a>
          </figcaption>
        </figure>
      )}
    </section>
  )
}
