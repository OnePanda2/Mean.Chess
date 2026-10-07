import type { Piece, Position } from '../engine/index.ts'
import {
  BISHOP,
  BLACK,
  CAPTURE,
  CASTLE_KINGSIDE,
  CASTLE_QUEENSIDE,
  DOUBLE_PUSH,
  EMPTY,
  EN_PASSANT,
  KING,
  KNIGHT,
  NO_MOVE,
  PAWN,
  PROMOTED_QUEEN,
  QUEEN,
  QUIET,
  ROOK,
  ROYAL_CAPTURE,
  ROYAL_SLAUGHTER,
  SELF_CAPTURE,
  TIER,
  WHITE,
  encodeMove,
  isRoyal,
  moveToUci,
} from './constants.ts'
import {
  BLACK_KINGSIDE,
  BLACK_QUEENSIDE,
  CASTLING_KEEP,
  KING_LISTS,
  KNIGHT_LISTS,
  PAWN_ATTACK_LISTS,
  RAY_LENGTH,
  RAY_SQUARES,
  RAY_START,
  ROYAL_MIDPOINT,
  WHITE_KINGSIDE,
  WHITE_QUEENSIDE,
} from './geometry.ts'
import { PHASE_WEIGHT, SCORE_EG, SCORE_MG } from './weights.ts'
import {
  CASTLING_HI,
  CASTLING_LO,
  EN_PASSANT_HI,
  EN_PASSANT_LO,
  PIECE_HI,
  PIECE_LO,
  SIDE_HI,
  SIDE_LO,
} from './zobrist.ts'

/** Moves are generated into one shared buffer, 256 slots per ply (no position has more). */
export const MOVES_PER_PLY = 256
/** Deepest make() nesting the board supports: search plies plus quiescence, with a wide margin. */
const MAX_STACK = 512
const HISTORY_CAPACITY = 4096
const PROMOTIONS: readonly number[] = [PROMOTED_QUEEN, ROOK, BISHOP, KNIGHT]

const PIECE_CODES: Readonly<Record<Piece['type'], number>> = {
  pawn: PAWN,
  knight: KNIGHT,
  bishop: BISHOP,
  rook: ROOK,
  queen: QUEEN,
  king: KING,
}

/**
 * A fast, mutable Mean Chess board for the computer opponent's search (docs/AI.md).
 *
 * The rules engine in src/engine stays the authority on legality. This is a second, independent
 * implementation of the same rules, built for speed: integer pieces, make/unmake instead of new
 * objects, and incremental hashing and evaluation terms. tests/ai/board.test.ts proves it agrees
 * with the engine move for move. Royal moves end the game, so they are generated but never made.
 */
export class SearchBoard {
  readonly squares = new Uint8Array(64)
  side = WHITE
  /** Castling-rights bits (geometry.ts). */
  castling = 0
  /** The square a pawn skipped with its last double step, or -1 (engine semantics). */
  enPassant = -1
  halfmove = 0
  /** King squares by colour: index 0 white, 1 black. */
  readonly kings = new Int8Array(2)
  /** How many of each piece code are on the board. */
  readonly counts = new Int8Array(16)
  hashLo = 0
  hashHi = 0
  /** File of the en-passant square while it is part of the hash (a capture is possible), or -1. */
  private hashedEnPassant = -1
  /** Material plus placement, White minus Black, for the middlegame and the endgame. */
  mg = 0
  eg = 0
  /** Game phase: 24 with every minor and major piece on the board, 0 with none. */
  phase = 0

  /** Hashes of every position since the game started (current last), for repetition. */
  readonly historyLo = new Int32Array(HISTORY_CAPACITY)
  readonly historyHi = new Int32Array(HISTORY_CAPACITY)
  historyLength = 0

  /** One shared buffer for generated moves (search and perft index it by ply). */
  readonly moveBuffer = new Int32Array(MOVES_PER_PLY * 128)

  private sp = 0
  private readonly undoCastling = new Uint8Array(MAX_STACK)
  private readonly undoEnPassant = new Int8Array(MAX_STACK)
  private readonly undoHashedEnPassant = new Int8Array(MAX_STACK)
  private readonly undoHalfmove = new Int16Array(MAX_STACK)
  private readonly undoHashLo = new Int32Array(MAX_STACK)
  private readonly undoHashHi = new Int32Array(MAX_STACK)
  private readonly undoMg = new Int32Array(MAX_STACK)
  private readonly undoEg = new Int32Array(MAX_STACK)
  private readonly undoPhase = new Int8Array(MAX_STACK)
  private readonly undoCaptured = new Uint8Array(MAX_STACK)
  private readonly undoSacrificed = new Uint8Array(MAX_STACK)

  /** Builds a board from an engine position (which the engine has already validated). */
  static fromPosition(position: Position): SearchBoard {
    const board = new SearchBoard()
    position.board.forEach((piece, sq) => {
      if (!piece) return
      const type = piece.type === 'queen' && piece.queenOrigin === 'promoted' ? PROMOTED_QUEEN : PIECE_CODES[piece.type]
      board.put(sq, (piece.color === 'white' ? WHITE : BLACK) | type)
    })
    board.side = position.sideToMove === 'white' ? WHITE : BLACK
    if (board.side === BLACK) {
      board.hashLo ^= SIDE_LO
      board.hashHi ^= SIDE_HI
    }
    const { castling } = position
    board.castling =
      (castling.whiteKingside ? WHITE_KINGSIDE : 0) |
      (castling.whiteQueenside ? WHITE_QUEENSIDE : 0) |
      (castling.blackKingside ? BLACK_KINGSIDE : 0) |
      (castling.blackQueenside ? BLACK_QUEENSIDE : 0)
    board.hashLo ^= CASTLING_LO[board.castling] ?? 0
    board.hashHi ^= CASTLING_HI[board.castling] ?? 0
    board.enPassant = position.enPassant ?? -1
    board.hashEnPassant()
    board.halfmove = position.halfmoveClock
    board.historyLo[0] = board.hashLo
    board.historyHi[0] = board.hashHi
    board.historyLength = 1
    return board
  }

  /** Places a piece on an empty square, updating counts, hash and evaluation terms. */
  private put(sq: number, piece: number): void {
    this.squares[sq] = piece
    this.counts[piece] = (this.counts[piece] ?? 0) + 1
    const index = piece * 64 + sq
    this.hashLo ^= PIECE_LO[index] ?? 0
    this.hashHi ^= PIECE_HI[index] ?? 0
    this.mg += SCORE_MG[index] ?? 0
    this.eg += SCORE_EG[index] ?? 0
    this.phase += PHASE_WEIGHT[piece & 7] ?? 0
    if ((piece & 7) === KING) this.kings[piece >> 3] = sq
  }

  /** Removes the piece on `sq` and returns it, updating counts, hash and evaluation terms. */
  private lift(sq: number): number {
    const piece = this.squares[sq] ?? EMPTY
    this.squares[sq] = EMPTY
    this.counts[piece] = (this.counts[piece] ?? 0) - 1
    const index = piece * 64 + sq
    this.hashLo ^= PIECE_LO[index] ?? 0
    this.hashHi ^= PIECE_HI[index] ?? 0
    this.mg -= SCORE_MG[index] ?? 0
    this.eg -= SCORE_EG[index] ?? 0
    this.phase -= PHASE_WEIGHT[piece & 7] ?? 0
    return piece
  }

  /**
   * Hashes the en-passant file only when the side to move has a pawn that could capture there,
   * close to the engine's repetition key (which also checks that the capture is fully legal).
   */
  private hashEnPassant(): void {
    const ep = this.enPassant
    if (ep < 0) return
    const pawn = this.side | PAWN
    const lists = PAWN_ATTACK_LISTS[(this.side ^ 8) >> 3]
    if (!lists) return
    for (let i = lists.start[ep] ?? 0, end = lists.start[ep + 1] ?? 0; i < end; i++) {
      if (this.squares[lists.list[i] ?? 0] === pawn) {
        this.hashedEnPassant = ep & 7
        this.hashLo ^= EN_PASSANT_LO[ep & 7] ?? 0
        this.hashHi ^= EN_PASSANT_HI[ep & 7] ?? 0
        return
      }
    }
  }

  /** The full hash recomputed from scratch (tests compare it with the incremental one). */
  computeHash(): readonly [number, number] {
    let lo = 0
    let hi = 0
    for (let sq = 0; sq < 64; sq++) {
      const piece = this.squares[sq] ?? EMPTY
      if (piece === EMPTY) continue
      lo ^= PIECE_LO[piece * 64 + sq] ?? 0
      hi ^= PIECE_HI[piece * 64 + sq] ?? 0
    }
    if (this.side === BLACK) {
      lo ^= SIDE_LO
      hi ^= SIDE_HI
    }
    lo ^= CASTLING_LO[this.castling] ?? 0
    hi ^= CASTLING_HI[this.castling] ?? 0
    if (this.hashedEnPassant >= 0) {
      lo ^= EN_PASSANT_LO[this.hashedEnPassant] ?? 0
      hi ^= EN_PASSANT_HI[this.hashedEnPassant] ?? 0
    }
    return [lo, hi]
  }

  /** Standard attack detection (engine attacks.ts): royal reach is never an attack. */
  isAttacked(sq: number, by: number): boolean {
    const s = this.squares
    const pawns = PAWN_ATTACK_LISTS[(by ^ 8) >> 3]
    if (pawns) {
      for (let i = pawns.start[sq] ?? 0, end = pawns.start[sq + 1] ?? 0; i < end; i++) {
        if (s[pawns.list[i] ?? 0] === (by | PAWN)) return true
      }
    }
    for (let i = KNIGHT_LISTS.start[sq] ?? 0, end = KNIGHT_LISTS.start[sq + 1] ?? 0; i < end; i++) {
      if (s[KNIGHT_LISTS.list[i] ?? 0] === (by | KNIGHT)) return true
    }
    for (let i = KING_LISTS.start[sq] ?? 0, end = KING_LISTS.start[sq + 1] ?? 0; i < end; i++) {
      if (s[KING_LISTS.list[i] ?? 0] === (by | KING)) return true
    }
    for (let d = 0; d < 8; d++) {
      const start = RAY_START[sq * 8 + d] ?? 0
      const end = start + (RAY_LENGTH[sq * 8 + d] ?? 0)
      for (let i = start; i < end; i++) {
        const piece = s[RAY_SQUARES[i] ?? 0] ?? EMPTY
        if (piece === EMPTY) continue
        if ((piece & 8) === by) {
          const type = piece & 7
          if (type === QUEEN || type === PROMOTED_QUEEN) return true
          if (type === ((d & 1) === 1 ? BISHOP : ROOK)) return true
        }
        break
      }
    }
    return false
  }

  /** Whether `color`'s king is in ordinary check. */
  inCheck(color: number = this.side): boolean {
    return this.isAttacked(this.kings[color >> 3] ?? 0, color ^ 8)
  }

  /** The lowest tier `color` has a piece in (Rules §2.2), or 0 for none. */
  activeTier(color: number): number {
    const counts = this.counts
    if ((counts[color | PAWN] ?? 0) > 0) return 1
    if ((counts[color | KNIGHT] ?? 0) > 0 || (counts[color | BISHOP] ?? 0) > 0) return 2
    if ((counts[color | ROOK] ?? 0) > 0) return 3
    if ((counts[color | PROMOTED_QUEEN] ?? 0) > 0) return 4
    return 0
  }

  /**
   * `color`'s royal move (Rules §2.3), or NO_MOVE: the kings exactly two apart on a straight
   * line, and the midpoint empty (Royal Capture) or holding one of `color`'s eligible pieces
   * (Royal Slaughter). Depends only on the board, so it also answers "could the opponent capture
   * my king if it were their turn" (the Royal Kill Zone).
   */
  royalMove(color: number): number {
    const from = this.kings[color >> 3] ?? 0
    const to = this.kings[(color ^ 8) >> 3] ?? 0
    const midpoint = ROYAL_MIDPOINT[from * 64 + to] ?? -1
    if (midpoint < 0) return NO_MOVE
    const blocker = this.squares[midpoint] ?? EMPTY
    if (blocker === EMPTY) return encodeMove(from, to, ROYAL_CAPTURE)
    const tier = TIER[blocker & 7] ?? 0
    if ((blocker & 8) === color && tier !== 0 && tier === this.activeTier(color)) {
      return encodeMove(from, to, ROYAL_SLAUGHTER)
    }
    return NO_MOVE
  }

  /**
   * Pseudo-legal ordinary moves for the side to move (engine movement.ts), appended to `out` from
   * index `n`; returns the new end. Never captures a king. With `capturesOnly`, only captures,
   * en passant and queen promotions (for quiescence search).
   */
  generatePseudo(out: Int32Array, n: number, capturesOnly: boolean): number {
    const s = this.squares
    const us = this.side
    for (let from = 0; from < 64; from++) {
      const piece = s[from] ?? EMPTY
      if (piece === EMPTY || (piece & 8) !== us) continue
      switch (piece & 7) {
        case PAWN:
          n = this.pawnMoves(out, n, from, capturesOnly)
          break
        case KNIGHT:
          n = this.stepMoves(out, n, from, KNIGHT_LISTS.start, KNIGHT_LISTS.list, capturesOnly)
          break
        case BISHOP:
          n = this.slideMoves(out, n, from, 1, capturesOnly)
          break
        case ROOK:
          n = this.slideMoves(out, n, from, 0, capturesOnly)
          break
        case QUEEN:
        case PROMOTED_QUEEN:
          n = this.slideMoves(out, n, from, 0, capturesOnly)
          n = this.slideMoves(out, n, from, 1, capturesOnly)
          break
        case KING:
          n = this.stepMoves(out, n, from, KING_LISTS.start, KING_LISTS.list, capturesOnly)
          if (!capturesOnly) n = this.castlingMoves(out, n, from)
          break
      }
    }
    return n
  }

  private stepMoves(
    out: Int32Array,
    n: number,
    from: number,
    starts: Int16Array,
    list: Int8Array,
    capturesOnly: boolean,
  ): number {
    const s = this.squares
    const us = this.side
    for (let i = starts[from] ?? 0, end = starts[from + 1] ?? 0; i < end; i++) {
      const to = list[i] ?? 0
      const target = s[to] ?? EMPTY
      if (target === EMPTY) {
        if (!capturesOnly) out[n++] = encodeMove(from, to, QUIET)
      } else if ((target & 8) !== us && (target & 7) !== KING) {
        out[n++] = encodeMove(from, to, CAPTURE)
      }
    }
    return n
  }

  /** Slides along every second direction starting at `first` (0 orthogonal, 1 diagonal). */
  private slideMoves(out: Int32Array, n: number, from: number, first: number, capturesOnly: boolean): number {
    const s = this.squares
    const us = this.side
    for (let d = first; d < 8; d += 2) {
      const start = RAY_START[from * 8 + d] ?? 0
      const end = start + (RAY_LENGTH[from * 8 + d] ?? 0)
      for (let i = start; i < end; i++) {
        const to = RAY_SQUARES[i] ?? 0
        const target = s[to] ?? EMPTY
        if (target === EMPTY) {
          if (!capturesOnly) out[n++] = encodeMove(from, to, QUIET)
          continue
        }
        if ((target & 8) !== us && (target & 7) !== KING) out[n++] = encodeMove(from, to, CAPTURE)
        break
      }
    }
    return n
  }

  private pawnMoves(out: Int32Array, n: number, from: number, capturesOnly: boolean): number {
    const s = this.squares
    const us = this.side
    const forward = us === WHITE ? 8 : -8
    const lastRank = us === WHITE ? 7 : 0
    const oneStep = from + forward
    const promotes = oneStep >> 3 === lastRank
    if ((s[oneStep] ?? EMPTY) === EMPTY) {
      if (promotes) {
        n = addPromotions(out, n, from, oneStep, QUIET, capturesOnly)
      } else if (!capturesOnly) {
        out[n++] = encodeMove(from, oneStep, QUIET)
        const startRank = us === WHITE ? 1 : 6
        if (from >> 3 === startRank && (s[oneStep + forward] ?? EMPTY) === EMPTY) {
          out[n++] = encodeMove(from, oneStep + forward, DOUBLE_PUSH)
        }
      }
    }
    const attacks = PAWN_ATTACK_LISTS[us >> 3]
    if (!attacks) return n
    for (let i = attacks.start[from] ?? 0, end = attacks.start[from + 1] ?? 0; i < end; i++) {
      const to = attacks.list[i] ?? 0
      const target = s[to] ?? EMPTY
      if (target !== EMPTY) {
        if ((target & 8) === us || (target & 7) === KING) continue
        if (promotes) n = addPromotions(out, n, from, to, CAPTURE, capturesOnly)
        else out[n++] = encodeMove(from, to, CAPTURE)
      } else if (to === this.enPassant && s[(from & ~7) | (to & 7)] === ((us ^ 8) | PAWN)) {
        out[n++] = encodeMove(from, to, EN_PASSANT)
      }
    }
    return n
  }

  /** Castling exactly as the engine allows it (engine castling.ts). */
  private castlingMoves(out: Int32Array, n: number, from: number): number {
    const us = this.side
    const them = us ^ 8
    if (from !== (us === WHITE ? 4 : 60)) return n
    const kingside = (this.castling & (us === WHITE ? WHITE_KINGSIDE : BLACK_KINGSIDE)) !== 0
    const queenside = (this.castling & (us === WHITE ? WHITE_QUEENSIDE : BLACK_QUEENSIDE)) !== 0
    if (!kingside && !queenside) return n
    if (this.isAttacked(from, them)) return n
    const s = this.squares
    const rook = us | ROOK
    if (
      kingside &&
      s[from + 3] === rook &&
      s[from + 1] === EMPTY &&
      s[from + 2] === EMPTY &&
      !this.isAttacked(from + 1, them) &&
      !this.isAttacked(from + 2, them)
    ) {
      out[n++] = encodeMove(from, from + 2, CASTLE_KINGSIDE)
    }
    if (
      queenside &&
      s[from - 4] === rook &&
      s[from - 1] === EMPTY &&
      s[from - 2] === EMPTY &&
      s[from - 3] === EMPTY &&
      !this.isAttacked(from - 1, them) &&
      !this.isAttacked(from - 2, them)
    ) {
      out[n++] = encodeMove(from, from - 2, CASTLE_QUEENSIDE)
    }
    return n
  }

  /**
   * Royal Cannibalism moves (Rules §2.4): the king steps onto an adjacent own piece of the active
   * tier and must not be in check afterwards. The caller decides whether the side is desperate.
   */
  private cannibalismMoves(out: Int32Array, n: number): number {
    const us = this.side
    const tier = this.activeTier(us)
    if (tier === 0) return n
    const king = this.kings[us >> 3] ?? 0
    for (let i = KING_LISTS.start[king] ?? 0, end = KING_LISTS.start[king + 1] ?? 0; i < end; i++) {
      const to = KING_LISTS.list[i] ?? 0
      const victim = this.squares[to] ?? EMPTY
      if (victim === EMPTY || (victim & 8) !== us || TIER[victim & 7] !== tier) continue
      const move = encodeMove(king, to, SELF_CAPTURE)
      if (this.isLegal(move)) out[n++] = move
    }
    return n
  }

  /**
   * Whether a pseudo-legal ordinary or cannibalism move leaves the mover's king out of check. Only
   * the squares change while it looks, so it is much cheaper than make/unmake.
   */
  isLegal(move: number): boolean {
    const s = this.squares
    const from = move & 63
    const to = (move >> 6) & 63
    const kind = (move >> 12) & 15
    const us = this.side
    const piece = s[from] ?? EMPTY
    const target = s[to] ?? EMPTY
    const king = (piece & 7) === KING ? to : (this.kings[us >> 3] ?? 0)
    s[from] = EMPTY
    s[to] = piece
    let extra = -1
    let extraPiece = EMPTY
    if (kind === EN_PASSANT) {
      extra = (from & ~7) | (to & 7)
      extraPiece = s[extra] ?? EMPTY
      s[extra] = EMPTY
    } else if (kind === CASTLE_KINGSIDE || kind === CASTLE_QUEENSIDE) {
      extra = kind === CASTLE_KINGSIDE ? from + 3 : from - 4
      extraPiece = s[extra] ?? EMPTY
      s[extra] = EMPTY
      s[kind === CASTLE_KINGSIDE ? from + 1 : from - 1] = extraPiece
    }
    const legal = !this.isAttacked(king, us ^ 8)
    if (kind === CASTLE_KINGSIDE || kind === CASTLE_QUEENSIDE) s[kind === CASTLE_KINGSIDE ? from + 1 : from - 1] = EMPTY
    if (extra >= 0) s[extra] = extraPiece
    s[to] = target
    s[from] = piece
    return legal
  }

  /**
   * Every legal move (Rules §2.5): royal ∪ ordinary ∪ (desperate ? cannibalism : ∅), appended to
   * `out` from `n`; returns the new end. The royal move, if any, comes first.
   */
  generateLegal(out: Int32Array, n: number): number {
    const us = this.side
    const royal = this.royalMove(us)
    if (royal !== NO_MOVE) out[n++] = royal
    const end = this.generatePseudo(out, n, false)
    let kept = n
    for (let i = n; i < end; i++) {
      const move = out[i] ?? NO_MOVE
      if (this.isLegal(move)) out[kept++] = move
    }
    if (royal !== NO_MOVE || !this.inCheck(us)) return kept
    // In check with no royal move: desperate if every ordinary move is suicidal, or there is none.
    for (let i = n; i < kept; i++) {
      const move = out[i] ?? NO_MOVE
      this.make(move)
      const suicidal = this.royalMove(us ^ 8) !== NO_MOVE
      this.unmake(move)
      if (!suicidal) return kept
    }
    return this.cannibalismMoves(out, kept)
  }

  /** Legal moves in coordinate notation (for tests and debugging). */
  legalUci(): string[] {
    const end = this.generateLegal(this.moveBuffer, 0)
    return Array.from(this.moveBuffer.subarray(0, end), moveToUci)
  }

  /** Plays an ordinary or cannibalism move. Royal moves end the game and are never made. */
  make(move: number): void {
    const from = move & 63
    const to = (move >> 6) & 63
    const kind = (move >> 12) & 15
    const promotion = (move >> 16) & 7
    const us = this.side
    const sp = this.sp++
    this.undoCastling[sp] = this.castling
    this.undoEnPassant[sp] = this.enPassant
    this.undoHashedEnPassant[sp] = this.hashedEnPassant
    this.undoHalfmove[sp] = this.halfmove
    this.undoHashLo[sp] = this.hashLo
    this.undoHashHi[sp] = this.hashHi
    this.undoMg[sp] = this.mg
    this.undoEg[sp] = this.eg
    this.undoPhase[sp] = this.phase

    // The old castling and en-passant terms leave the hash; the new ones are added at the end.
    this.hashLo ^= CASTLING_LO[this.castling] ?? 0
    this.hashHi ^= CASTLING_HI[this.castling] ?? 0
    if (this.hashedEnPassant >= 0) {
      this.hashLo ^= EN_PASSANT_LO[this.hashedEnPassant] ?? 0
      this.hashHi ^= EN_PASSANT_HI[this.hashedEnPassant] ?? 0
      this.hashedEnPassant = -1
    }

    let captured = EMPTY
    let sacrificed = EMPTY
    const piece = this.lift(from)
    switch (kind) {
      case CAPTURE:
        captured = this.lift(to)
        break
      case EN_PASSANT:
        captured = this.lift((from & ~7) | (to & 7))
        break
      case SELF_CAPTURE:
        sacrificed = this.lift(to)
        break
      case CASTLE_KINGSIDE:
        this.put(from + 1, this.lift(from + 3))
        break
      case CASTLE_QUEENSIDE:
        this.put(from - 1, this.lift(from - 4))
        break
      default:
        break
    }
    this.put(to, promotion === 0 ? piece : us | promotion)
    this.undoCaptured[sp] = captured
    this.undoSacrificed[sp] = sacrificed

    let castling = this.castling & (CASTLING_KEEP[from] ?? 15) & (CASTLING_KEEP[to] ?? 15)
    if ((piece & 7) === KING) castling &= us === WHITE ? ~(WHITE_KINGSIDE | WHITE_QUEENSIDE) : ~(BLACK_KINGSIDE | BLACK_QUEENSIDE)
    this.castling = castling
    this.hashLo ^= CASTLING_LO[castling] ?? 0
    this.hashHi ^= CASTLING_HI[castling] ?? 0

    this.halfmove = (piece & 7) === PAWN || captured !== EMPTY || sacrificed !== EMPTY ? 0 : this.halfmove + 1
    this.enPassant = kind === DOUBLE_PUSH ? (from + to) >> 1 : -1
    this.side = us ^ 8
    this.hashLo ^= SIDE_LO
    this.hashHi ^= SIDE_HI
    this.hashEnPassant()
    this.historyLo[this.historyLength] = this.hashLo
    this.historyHi[this.historyLength] = this.hashHi
    this.historyLength++
  }

  /** Takes back the last made move, which must be `move`. */
  unmake(move: number): void {
    const from = move & 63
    const to = (move >> 6) & 63
    const kind = (move >> 12) & 15
    const sp = --this.sp
    const s = this.squares
    const counts = this.counts
    const them = this.side
    const us = them ^ 8
    this.historyLength--

    const landed = s[to] ?? EMPTY
    const piece = ((move >> 16) & 7) === 0 ? landed : us | PAWN
    s[to] = EMPTY
    s[from] = piece
    if (piece !== landed) {
      counts[landed] = (counts[landed] ?? 0) - 1
      counts[piece] = (counts[piece] ?? 0) + 1
    }
    if ((piece & 7) === KING) this.kings[us >> 3] = from
    const captured = this.undoCaptured[sp] ?? EMPTY
    const sacrificed = this.undoSacrificed[sp] ?? EMPTY
    switch (kind) {
      case CAPTURE:
        s[to] = captured
        counts[captured] = (counts[captured] ?? 0) + 1
        break
      case EN_PASSANT:
        s[(from & ~7) | (to & 7)] = captured
        counts[captured] = (counts[captured] ?? 0) + 1
        break
      case SELF_CAPTURE:
        s[to] = sacrificed
        counts[sacrificed] = (counts[sacrificed] ?? 0) + 1
        break
      case CASTLE_KINGSIDE:
        s[from + 3] = s[from + 1] ?? EMPTY
        s[from + 1] = EMPTY
        break
      case CASTLE_QUEENSIDE:
        s[from - 4] = s[from - 1] ?? EMPTY
        s[from - 1] = EMPTY
        break
      default:
        break
    }

    this.side = us
    this.castling = this.undoCastling[sp] ?? 0
    this.enPassant = this.undoEnPassant[sp] ?? -1
    this.hashedEnPassant = this.undoHashedEnPassant[sp] ?? -1
    this.halfmove = this.undoHalfmove[sp] ?? 0
    this.hashLo = this.undoHashLo[sp] ?? 0
    this.hashHi = this.undoHashHi[sp] ?? 0
    this.mg = this.undoMg[sp] ?? 0
    this.eg = this.undoEg[sp] ?? 0
    this.phase = this.undoPhase[sp] ?? 0
  }

  /** Passes the turn (null-move pruning). Repetition never looks back past it. */
  makeNull(): void {
    const sp = this.sp++
    this.undoEnPassant[sp] = this.enPassant
    this.undoHashedEnPassant[sp] = this.hashedEnPassant
    this.undoHalfmove[sp] = this.halfmove
    this.undoHashLo[sp] = this.hashLo
    this.undoHashHi[sp] = this.hashHi
    if (this.hashedEnPassant >= 0) {
      this.hashLo ^= EN_PASSANT_LO[this.hashedEnPassant] ?? 0
      this.hashHi ^= EN_PASSANT_HI[this.hashedEnPassant] ?? 0
      this.hashedEnPassant = -1
    }
    this.enPassant = -1
    this.halfmove = 0
    this.side ^= 8
    this.hashLo ^= SIDE_LO
    this.hashHi ^= SIDE_HI
    this.historyLo[this.historyLength] = this.hashLo
    this.historyHi[this.historyLength] = this.hashHi
    this.historyLength++
  }

  unmakeNull(): void {
    const sp = --this.sp
    this.historyLength--
    this.side ^= 8
    this.enPassant = this.undoEnPassant[sp] ?? -1
    this.hashedEnPassant = this.undoHashedEnPassant[sp] ?? -1
    this.halfmove = this.undoHalfmove[sp] ?? 0
    this.hashLo = this.undoHashLo[sp] ?? 0
    this.hashHi = this.undoHashHi[sp] ?? 0
  }

  /**
   * Makes a game move permanently (replaying a game's history): the undo record is dropped. Long
   * games keep only the history that repetition can still reach.
   */
  commit(move: number): void {
    if (isRoyal(move)) throw new Error('A royal move ends the game; there is nothing to search after it.')
    this.make(move)
    this.sp--
    if (this.historyLength > HISTORY_CAPACITY - 600) {
      // Games end at 100 plies without progress (fifty-move rule), so 1,024 is ample.
      const keep = Math.min(this.historyLength, this.halfmove + 1, 1024)
      this.historyLo.copyWithin(0, this.historyLength - keep, this.historyLength)
      this.historyHi.copyWithin(0, this.historyLength - keep, this.historyLength)
      this.historyLength = keep
    }
  }

  /** The legal move written in coordinate notation, or NO_MOVE. */
  findUci(uci: string): number {
    const wanted = uci.trim().toLowerCase()
    const end = this.generateLegal(this.moveBuffer, 0)
    for (let i = 0; i < end; i++) {
      const move = this.moveBuffer[i] ?? NO_MOVE
      if (moveToUci(move) === wanted) return move
    }
    return NO_MOVE
  }

  /**
   * Whether the current position occurred before since the last irreversible move (a repeat with
   * the same side to move). The search scores any repeat as a draw.
   */
  isRepetition(): boolean {
    const current = this.historyLength - 1
    const limit = Math.max(0, current - this.halfmove)
    for (let i = current - 2; i >= limit; i -= 2) {
      if (this.historyLo[i] === this.hashLo && this.historyHi[i] === this.hashHi) return true
    }
    return false
  }

  /** How many times the current position has occurred, this one included (threefold detection). */
  occurrences(): number {
    const current = this.historyLength - 1
    const limit = Math.max(0, current - this.halfmove)
    let count = 1
    for (let i = current - 2; i >= limit; i -= 2) {
      if (this.historyLo[i] === this.hashLo && this.historyHi[i] === this.hashHi) count++
    }
    return count
  }
}

/** A pawn reaching the last rank: all four promotions, or only the queen during quiescence. */
function addPromotions(out: Int32Array, n: number, from: number, to: number, kind: number, queenOnly: boolean): number {
  for (const promotion of PROMOTIONS) {
    out[n++] = encodeMove(from, to, kind, promotion)
    if (queenOnly) break
  }
  return n
}

/** Leaf count of the move tree, counted exactly like the engine's perft (royal moves are leaves). */
export function perft(board: SearchBoard, depth: number, ply = 0): number {
  const out = board.moveBuffer
  const start = ply * MOVES_PER_PLY
  const end = board.generateLegal(out, start)
  if (depth <= 1) return end - start
  let nodes = 0
  for (let i = start; i < end; i++) {
    const move = out[i] ?? NO_MOVE
    if (isRoyal(move)) continue
    board.make(move)
    nodes += perft(board, depth - 1, ply + 1)
    board.unmake(move)
  }
  return nodes
}
