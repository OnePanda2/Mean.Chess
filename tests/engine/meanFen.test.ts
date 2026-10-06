import { describe, expect, it } from 'vitest'
import { START_MEAN_FEN, parseMeanFen, startingPosition, toMeanFen } from '../../src/engine/index.ts'
import { position } from './helpers.ts'

describe('MeanFEN', () => {
  it('round-trips the starting position', () => {
    const start = startingPosition()
    expect(toMeanFen(start)).toBe(START_MEAN_FEN)
    expect(start.sideToMove).toBe('white')
    expect(start.board.filter(Boolean)).toHaveLength(32)
    expect(start.castling).toEqual({
      whiteKingside: true,
      whiteQueenside: true,
      blackKingside: true,
      blackQueenside: true,
    })
  })

  it('marks both starting queens original and gives every piece a unique, readable id', () => {
    const start = startingPosition()
    const queens = start.board.filter((piece) => piece?.type === 'queen')
    expect(queens.map((queen) => queen?.queenOrigin)).toEqual(['original', 'original'])
    const ids = start.board.flatMap((piece) => (piece ? [piece.id] : []))
    expect(new Set(ids).size).toBe(32)
    expect(start.board[4]?.id).toBe('wK@e1')
    expect(start.board[59]?.id).toBe('bQ@d8')
  })

  it('reads and writes the promoted-queen mark', () => {
    const fen = '3qk3/8/8/8/8/8/8/Q~3K3 w - - 0 1'
    const pos = position(fen)
    expect(pos.board[0]?.queenOrigin).toBe('promoted') // a1
    expect(pos.board[59]?.queenOrigin).toBe('original') // d8
    expect(toMeanFen(pos)).toBe(fen)
  })

  it('accepts a plain FEN and treats its queens as original', () => {
    const pos = position('3qk3/8/8/8/8/8/8/Q3K3 w - - 0 1')
    expect(pos.board[0]?.queenOrigin).toBe('original')
  })

  it.each([
    ['too few fields', '8/8/8/8/8/8/8/8 w - -', '6 fields'],
    ['an unknown piece letter', 'rnbqkbnr/ppppxppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'Unexpected character "x"'],
    ['a rank of nine squares', 'rnbqkbnr/ppppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'more than 8 squares'],
    ['a rank of seven squares', 'rnbqkbnr/ppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'exactly 8 squares'],
    ['seven ranks', 'rnbqkbnr/pppppppp/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', '8 ranks'],
    ['a promoted rook', '4k3/8/8/8/8/8/8/R~3K3 w - - 0 1', 'Only queens'],
    ['an unknown side to move', '4k3/8/8/8/8/8/8/4K3 x - - 0 1', 'side to move'],
    ['malformed castling', '4k3/8/8/8/8/8/8/4K3 w KK - 0 1', 'Castling must be'],
    ['a castling right without its rook', '4k3/8/8/8/8/8/8/4K3 w K - 0 1', 'Castling right "K"'],
    ['an en-passant square off the board', '4k3/8/8/8/8/8/8/4K3 w - e9 0 1', 'is not a square'],
    ['an en-passant square with no pawn behind it', '4k3/8/8/8/8/8/8/4K3 w - e6 0 1', 'does not match'],
    ['a non-numeric halfmove clock', '4k3/8/8/8/8/8/8/4K3 w - - x 1', 'halfmove clock'],
    ['a fullmove number of zero', '4k3/8/8/8/8/8/8/4K3 w - - 0 0', 'fullmove number'],
    ['two white kings', '4k3/8/8/8/8/8/8/K3K3 w - - 0 1', 'White must have exactly one king'],
    ['no black king', '8/8/8/8/8/8/8/4K3 w - - 0 1', 'Black must have exactly one king'],
    ['adjacent kings', '8/8/8/8/8/8/4k3/4K3 w - - 0 1', 'adjacent'],
    ['a pawn on the last rank', 'P3k3/8/8/8/8/8/8/4K3 w - - 0 1', 'first or last rank'],
    ['two original queens on one side', '4k3/8/8/8/8/8/8/QQ2K3 w - - 0 1', 'more than one original queen'],
    ['the side that just moved in check', '4k3/8/8/8/8/8/8/4RK2 w - - 0 1', 'Black is in check'],
    ['absurdly long input', 'x'.repeat(201), 'too long'],
  ])('rejects %s', (_label, fen, message) => {
    const parsed = parseMeanFen(fen)
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.error).toContain(message)
  })
})
