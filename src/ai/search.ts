import { MOVES_PER_PLY, type SearchBoard } from './board.ts'
import {
  BISHOP,
  CAPTURE,
  EN_PASSANT,
  KNIGHT,
  NO_MOVE,
  PAWN,
  PROMOTED_QUEEN,
  QUEEN,
  ROOK,
  SELF_CAPTURE,
  isRoyal,
  moveFrom,
  moveKind,
  movePromotion,
  moveTo,
} from './constants.ts'
import { evaluate } from './evaluate.ts'
import { chebyshev } from './geometry.ts'

/** A royal move available right now: the side to move wins. Faster wins score higher (WIN − ply). */
export const WIN = 30_000
/** Scores beyond this are forced wins or losses rather than evaluations. */
export const WIN_THRESHOLD = WIN - 1_000
const INFINITY = 32_000
/** Deepest ply, quiescence included; the board's move buffer holds 128 plies. */
const MAX_PLY = 120
/** Plies of quiescence that answer a check or a royal threat with every move, not just captures. */
const EVASION_PLIES = 4
/** Pessimism for a royal threat still standing where quiescence stops looking. */
const UNANSWERED_THREAT = 200

const EXACT = 1
const LOWER = 2
const UPPER = 3

/** Move ordering: most valuable victim first, least valuable attacker first (MVV-LVA). */
const VICTIM: readonly number[] = [0, 100, 320, 330, 500, 960, 940, 0]
const ATTACKER: readonly number[] = [0, 1, 2, 3, 4, 5, 5, 6]

/** Positions searched before, by hash: best move, score and how deep the search went. */
export class TranspositionTable {
  readonly mask: number
  readonly keys: Int32Array
  readonly moves: Int32Array
  readonly scores: Int16Array
  readonly depths: Int8Array
  readonly flags: Uint8Array

  constructor(bits = 19) {
    const size = 1 << bits
    this.mask = size - 1
    this.keys = new Int32Array(size)
    this.moves = new Int32Array(size)
    this.scores = new Int16Array(size)
    this.depths = new Int8Array(size)
    this.flags = new Uint8Array(size)
  }
}

export interface SearchOptions {
  /** Deepest iteration. */
  readonly maxDepth: number
  /** Stop after about this many nodes (deterministic tests). */
  readonly maxNodes?: number
  /** Milliseconds to think, measured with `now`. The first iteration always completes. */
  readonly timeLimit?: number
  readonly now?: () => number
  /** Ignore royal moves for both sides: a beginner who does not see the Kill Zone this move. */
  readonly blind?: boolean
  /**
   * Choose the move with some randomness: every root move gets an exact score, each score gets up
   * to ±`noise` centipawns of error, and the move is drawn among those within `variety` of the
   * best. Forced wins and losses are never blurred.
   */
  readonly choice?: { readonly variety: number; readonly noise: number; readonly random: () => number }
}

export interface SearchResult {
  readonly move: number
  /** From the side to move's point of view, in centipawns (or ±WIN − plies for a forced result). */
  readonly score: number
  readonly depth: number
  readonly nodes: number
}

/** Chooses a move for the side to move. Throws if there is no legal move (the game is over). */
export function search(board: SearchBoard, options: SearchOptions, table = new TranspositionTable(16)): SearchResult {
  return new SearchRun(board, table, options).run()
}

const toTable = (score: number, ply: number): number =>
  score >= WIN_THRESHOLD ? score + ply : score <= -WIN_THRESHOLD ? score - ply : score
const fromTable = (score: number, ply: number): number =>
  score >= WIN_THRESHOLD ? score - ply : score <= -WIN_THRESHOLD ? score + ply : score

class SearchRun {
  private nodes = 0
  private stopped = false
  private completedDepth = 0
  private extensionLimit = 0
  private readonly deadline: number
  private readonly maxNodes: number
  private readonly now: () => number
  private readonly blind: boolean
  private readonly killers = new Int32Array(MAX_PLY * 2)
  private readonly history = new Int32Array(2 * 4096)
  private readonly order = new Int32Array(MOVES_PER_PLY * 128)
  private readonly board: SearchBoard
  private readonly table: TranspositionTable
  private readonly options: SearchOptions

  constructor(board: SearchBoard, table: TranspositionTable, options: SearchOptions) {
    this.board = board
    this.table = table
    this.options = options
    this.now = options.now ?? (() => 0)
    this.deadline = options.timeLimit === undefined ? Infinity : this.now() + options.timeLimit
    this.maxNodes = options.maxNodes ?? Infinity
    this.blind = options.blind === true
  }

  run(): SearchResult {
    const board = this.board
    const out = board.moveBuffer
    const end = board.generateLegal(out, 0)
    let moves = Array.from(out.subarray(0, end))
    if (moves.length === 0) throw new Error('No legal moves: the game is over.')
    // A royal move wins on the spot. A blind search overlooks it, unless it is the only move.
    const royal = moves.find(isRoyal)
    if (royal !== undefined && (!this.blind || moves.every(isRoyal))) {
      return { move: royal, score: WIN - 1, depth: 1, nodes: 1 }
    }
    if (this.blind) moves = moves.filter((move) => !isRoyal(move))

    const choice = this.options.choice
    const start = this.now()
    this.scoreMoves(moves, 0)
    let bestMove = moves[0] ?? NO_MOVE
    let bestScore = -INFINITY
    let lastScores: number[] = []
    const scores = new Array<number>(moves.length).fill(-INFINITY)
    // A forced move needs no deep thought; a shallow look still gives it a score.
    const maxDepth = moves.length === 1 ? Math.min(this.options.maxDepth, 3) : this.options.maxDepth

    for (let depth = 1; depth <= maxDepth; depth++) {
      this.extensionLimit = depth * 2 + 4
      let alpha = -INFINITY
      let iterationBest = NO_MOVE
      let iterationScore = -INFINITY
      for (let i = 0; i < moves.length; i++) {
        const move = moves[i] ?? NO_MOVE
        board.make(move)
        let score: number
        if (choice || i === 0) {
          score = -this.negamax(depth - 1, -INFINITY, choice ? INFINITY : -alpha, 1, true)
        } else {
          score = -this.negamax(depth - 1, -alpha - 1, -alpha, 1, true)
          if (score > alpha && !this.halted()) score = -this.negamax(depth - 1, -INFINITY, -alpha, 1, true)
        }
        board.unmake(move)
        if (this.halted()) break
        scores[i] = score
        if (score > iterationScore) {
          iterationScore = score
          iterationBest = move
        }
        if (score > alpha) alpha = score
      }
      if (this.halted()) break
      bestMove = iterationBest
      bestScore = iterationScore
      this.completedDepth = depth
      // Next iteration: best first, then by this iteration's scores.
      const ranked = moves.map((move, index) => ({ move, score: scores[index] ?? -INFINITY }))
      ranked.sort((a, b) => b.score - a.score)
      moves = ranked.map((entry) => entry.move)
      lastScores = ranked.map((entry) => entry.score)
      if (Math.abs(bestScore) >= WIN_THRESHOLD) break
      if (this.options.timeLimit !== undefined && this.now() - start > this.options.timeLimit * 0.5) break
    }

    if (choice && lastScores.length === moves.length) {
      const blurred = lastScores.map((score) =>
        Math.abs(score) >= WIN_THRESHOLD ? score : score + (choice.random() * 2 - 1) * choice.noise,
      )
      const top = Math.max(...blurred)
      const candidates = moves.filter((_, index) => (blurred[index] ?? -INFINITY) >= top - choice.variety)
      const picked = candidates[Math.floor(choice.random() * candidates.length)]
      if (picked !== undefined) {
        bestMove = picked
        bestScore = lastScores[moves.indexOf(picked)] ?? bestScore
      }
    }
    // Negating a draw's 0 gives -0; report it as plain 0.
    return { move: bestMove, score: bestScore === 0 ? 0 : bestScore, depth: this.completedDepth, nodes: this.nodes }
  }

  /** Read through a method: a narrowed `this.stopped` would wrongly survive the calls in between. */
  private halted(): boolean {
    return this.stopped
  }

  private checkLimits(): void {
    if (this.completedDepth === 0) return // the first iteration always finishes
    if (this.nodes >= this.maxNodes || this.now() >= this.deadline) this.stopped = true
  }

  private negamax(depth: number, alpha: number, beta: number, ply: number, allowNull: boolean): number {
    const board = this.board
    if ((++this.nodes & 1023) === 0) this.checkLimits()
    if (this.halted()) return 0
    const us = board.side
    const out = board.moveBuffer
    const start = ply * MOVES_PER_PLY

    if (board.halfmove >= 100) {
      // Fifty-move rule: a draw, unless this very position is checkmate (Rules §2.6 order).
      if (board.inCheck(us) && board.generateLegal(out, start) === start) return -(WIN - ply)
      return 0
    }
    if (board.isRepetition()) return 0
    if (!this.blind && board.royalMove(us) !== NO_MOVE) return WIN - ply
    if (ply >= MAX_PLY - 1) return evaluate(board)

    const inCheck = board.inCheck(us)
    const threatened = !this.blind && board.royalMove(us ^ 8) !== NO_MOVE
    if ((inCheck || threatened) && ply < this.extensionLimit) depth++
    if (depth <= 0) return this.quiesce(alpha, beta, ply, 0)

    const table = this.table
    const slot = board.hashLo & table.mask
    let tableMove = NO_MOVE
    if (table.flags[slot] !== 0 && table.keys[slot] === board.hashHi) {
      tableMove = table.moves[slot] ?? NO_MOVE
      if ((table.depths[slot] ?? 0) >= depth) {
        const score = fromTable(table.scores[slot] ?? 0, ply)
        const flag = table.flags[slot]
        if (flag === EXACT || (flag === LOWER && score >= beta) || (flag === UPPER && score <= alpha)) return score
      }
    }

    // Null move: if passing still holds beta, a real move will too. Not near the enemy king (royal
    // tactics are full of zugzwang) and not without pieces (pawn endings likewise).
    if (
      allowNull &&
      !inCheck &&
      !threatened &&
      depth >= 3 &&
      beta < WIN_THRESHOLD &&
      chebyshev(board.kings[0] ?? 0, board.kings[1] ?? 0) > 4 &&
      this.hasPieces(us) &&
      evaluate(board) >= beta
    ) {
      board.makeNull()
      const score = -this.negamax(depth - 1 - (depth >= 6 ? 3 : 2), -beta, -beta + 1, ply + 1, false)
      board.unmakeNull()
      if (this.halted()) return 0
      if (score >= beta) return score >= WIN_THRESHOLD ? beta : score
    }

    let end = inCheck ? board.generateLegal(out, start) : board.generatePseudo(out, start, false)
    if (inCheck && this.blind) end = this.dropRoyal(start, end)
    this.scoreRange(start, end, tableMove, ply)

    const originalAlpha = alpha
    let best = -INFINITY
    let bestMove = NO_MOVE
    let legal = 0
    for (let i = start; i < end; i++) {
      const move = this.pickNext(i, end)
      if (!inCheck && !board.isLegal(move)) continue
      legal++
      const kind = moveKind(move)
      const quiet = kind !== CAPTURE && kind !== EN_PASSANT && movePromotion(move) === 0
      board.make(move)
      let score: number
      if (legal === 1) {
        score = -this.negamax(depth - 1, -beta, -alpha, ply + 1, true)
      } else {
        const reduction =
          depth >= 3 && legal > 3 && quiet && !inCheck && !threatened && kind !== SELF_CAPTURE && !this.isKiller(move, ply)
            ? legal > 8
              ? 2
              : 1
            : 0
        score = -this.negamax(depth - 1 - reduction, -alpha - 1, -alpha, ply + 1, true)
        if (score > alpha && reduction > 0) score = -this.negamax(depth - 1, -alpha - 1, -alpha, ply + 1, true)
        if (score > alpha && score < beta) score = -this.negamax(depth - 1, -beta, -alpha, ply + 1, true)
      }
      board.unmake(move)
      if (this.halted()) return 0
      if (score > best) {
        best = score
        bestMove = move
        if (score > alpha) {
          alpha = score
          if (score >= beta) {
            if (quiet) this.rewardQuiet(move, ply, depth)
            break
          }
        }
      }
    }
    if (legal === 0) return inCheck ? -(WIN - ply) : 0 // checkmate, or stalemate

    const flag = best >= beta ? LOWER : best > originalAlpha ? EXACT : UPPER
    if ((table.depths[slot] ?? 0) <= depth || table.keys[slot] !== board.hashHi || flag === EXACT) {
      table.keys[slot] = board.hashHi
      table.moves[slot] = bestMove
      table.scores[slot] = toTable(best, ply)
      table.depths[slot] = depth
      table.flags[slot] = flag
    }
    return best
  }

  /** Captures until the position is quiet; checks and royal threats are answered in full. */
  private quiesce(alpha: number, beta: number, ply: number, depth: number): number {
    const board = this.board
    if ((++this.nodes & 1023) === 0) this.checkLimits()
    if (this.halted()) return 0
    const us = board.side
    if (!this.blind && board.royalMove(us) !== NO_MOVE) return WIN - ply
    if (ply >= MAX_PLY - 1) return evaluate(board)
    const inCheck = board.inCheck(us)
    const threatened = !this.blind && board.royalMove(us ^ 8) !== NO_MOVE
    const out = board.moveBuffer
    const start = ply * MOVES_PER_PLY

    if ((inCheck || threatened) && depth < EVASION_PLIES) {
      let end = inCheck ? board.generateLegal(out, start) : board.generatePseudo(out, start, false)
      if (inCheck && this.blind) end = this.dropRoyal(start, end)
      this.scoreRange(start, end, NO_MOVE, ply)
      let best = -INFINITY
      let legal = 0
      for (let i = start; i < end; i++) {
        const move = this.pickNext(i, end)
        if (!inCheck && !board.isLegal(move)) continue
        legal++
        board.make(move)
        const score = -this.quiesce(-beta, -alpha, ply + 1, depth + 1)
        board.unmake(move)
        if (this.halted()) return 0
        if (score > best) {
          best = score
          if (score > alpha) {
            alpha = score
            if (score >= beta) break
          }
        }
      }
      if (legal === 0) return inCheck ? -(WIN - ply) : 0
      return best
    }

    const standPat = evaluate(board) - (threatened ? UNANSWERED_THREAT : 0)
    if (standPat >= beta) return standPat
    if (standPat > alpha) alpha = standPat
    let best = standPat
    const end = board.generatePseudo(out, start, true)
    this.scoreRange(start, end, NO_MOVE, ply)
    for (let i = start; i < end; i++) {
      const move = this.pickNext(i, end)
      const promotion = movePromotion(move) !== 0
      if (!promotion) {
        // Delta pruning: even winning this piece for free would not reach alpha.
        const victim = moveKind(move) === EN_PASSANT ? PAWN : (board.squares[moveTo(move)] ?? 0) & 7
        if (standPat + (VICTIM[victim] ?? 0) + 200 < alpha) continue
      }
      if (!board.isLegal(move)) continue
      board.make(move)
      const score = -this.quiesce(-beta, -alpha, ply + 1, depth + 1)
      board.unmake(move)
      if (this.halted()) return 0
      if (score > best) {
        best = score
        if (score > alpha) {
          alpha = score
          if (score >= beta) break
        }
      }
    }
    return best
  }

  private hasPieces(color: number): boolean {
    const counts = this.board.counts
    return (
      (counts[color | KNIGHT] ?? 0) +
        (counts[color | BISHOP] ?? 0) +
        (counts[color | ROOK] ?? 0) +
        (counts[color | QUEEN] ?? 0) +
        (counts[color | PROMOTED_QUEEN] ?? 0) >
      0
    )
  }

  /** Removes royal moves from a generated range (blind search does not see them). */
  private dropRoyal(start: number, end: number): number {
    const out = this.board.moveBuffer
    let kept = start
    for (let i = start; i < end; i++) {
      const move = out[i] ?? NO_MOVE
      if (!isRoyal(move)) out[kept++] = move
    }
    return kept
  }

  private isKiller(move: number, ply: number): boolean {
    return this.killers[ply * 2] === move || this.killers[ply * 2 + 1] === move
  }

  private rewardQuiet(move: number, ply: number, depth: number): void {
    if (this.killers[ply * 2] !== move) {
      this.killers[ply * 2 + 1] = this.killers[ply * 2] ?? NO_MOVE
      this.killers[ply * 2] = move
    }
    const index = (this.board.side >> 3) * 4096 + (move & 4095)
    this.history[index] = Math.min(1_000_000, (this.history[index] ?? 0) + depth * depth)
  }

  /** Ordering scores for the moves in out[start, end): table move, captures, promotions, killers, history. */
  private scoreRange(start: number, end: number, tableMove: number, ply: number): void {
    const board = this.board
    const out = board.moveBuffer
    const s = board.squares
    const killerA = this.killers[ply * 2] ?? NO_MOVE
    const killerB = this.killers[ply * 2 + 1] ?? NO_MOVE
    const side = (board.side >> 3) * 4096
    for (let i = start; i < end; i++) {
      const move = out[i] ?? NO_MOVE
      let score: number
      if (move === tableMove) score = 3_000_000
      else {
        const kind = moveKind(move)
        const promotion = movePromotion(move)
        if (kind === CAPTURE || kind === EN_PASSANT) {
          const victim = kind === EN_PASSANT ? PAWN : (s[moveTo(move)] ?? 0) & 7
          const attacker = (s[moveFrom(move)] ?? 0) & 7
          score = 2_000_000 + (VICTIM[victim] ?? 0) * 8 - (ATTACKER[attacker] ?? 0) + (promotion === PROMOTED_QUEEN ? 5_000 : 0)
        } else if (promotion !== 0) score = promotion === PROMOTED_QUEEN ? 1_900_000 : -1
        else if (move === killerA) score = 1_800_000
        else if (move === killerB) score = 1_700_000
        else if (kind === SELF_CAPTURE) score = 1_600_000
        else score = this.history[side + (move & 4095)] ?? 0
      }
      this.order[i] = score
    }
  }

  /** Moves the best-scored remaining move to index i and returns it (selection sort, lazily). */
  private pickNext(i: number, end: number): number {
    const out = this.board.moveBuffer
    const order = this.order
    let best = i
    let bestScore = order[i] ?? 0
    for (let j = i + 1; j < end; j++) {
      const score = order[j] ?? 0
      if (score > bestScore) {
        bestScore = score
        best = j
      }
    }
    if (best !== i) {
      const move = out[best] ?? NO_MOVE
      out[best] = out[i] ?? NO_MOVE
      out[i] = move
      order[best] = order[i] ?? 0
      order[i] = bestScore
    }
    return out[i] ?? NO_MOVE
  }

  /** Initial order of root moves: captures and promotions first. */
  private scoreMoves(moves: number[], ply: number): void {
    const out = this.board.moveBuffer
    moves.forEach((move, index) => {
      out[index] = move
    })
    this.scoreRange(0, moves.length, NO_MOVE, ply)
    const ranked = moves.map((move, index) => ({ move, score: this.order[index] ?? 0 }))
    ranked.sort((a, b) => b.score - a.score)
    ranked.forEach((entry, index) => {
      moves[index] = entry.move
    })
  }
}
