import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { TutorialApp } from '../../src/app/TutorialApp.tsx'
import { LESSONS } from '../../src/app/lessons.ts'
import { analyze, applyMove, legalMoves, parseMeanFen, type Move, type Position } from '../../src/engine/index.ts'

const square = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name},`) })
const button = (name: string | RegExp) => screen.getByRole('button', { name })
const heading = () => screen.getByRole('heading', { level: 1 }).textContent

/** The player's moves that solve each lesson, as from and to squares (two for a two-step task). */
const SOLUTIONS: Readonly<Record<string, readonly (readonly [string, string])[]>> = {
  cannibalism: [['e1', 'e2']],
  'last-resort': [['d2', 'f1']],
  'safe-square': [['g1', 'h2']],
  'pawns-first': [['g1', 'g2']],
  'knights-bishops': [['g1', 'f2']],
  rooks: [['g1', 'g2']],
  'promoted-queens': [['g1', 'h2']],
  'original-queen': [['g1', 'h2']],
  'royal-capture': [['h1', 'f3']],
  'royal-capture-in-check': [['h1', 'f3']],
  'kill-zone': [['d3', 'c4']],
  shield: [['a2', 'a3']],
  'royal-slaughter': [['e1', 'e3']],
  'slaughter-order': [['e1', 'e3']],
  desperate: [['h1', 'g2']],
  endings: [
    ['d3', 'c2'],
    ['c2', 'a2'],
  ],
}

function position(fen: string): Position {
  const parsed = parseMeanFen(fen)
  if (!parsed.ok) throw new Error(`Invalid lesson position "${fen}": ${parsed.error}`)
  return parsed.position
}

const find = (moves: readonly Move[], [from, to]: readonly [string, string]) =>
  moves.find((move) => toName(move.from) === from && toName(move.to) === to)

describe('the lessons (checked by the rules engine)', () => {
  it.each(LESSONS.map((lesson) => [lesson.id, lesson] as const))('%s is a fair task', (_, lesson) => {
    for (const diagram of lesson.diagrams ?? []) position(diagram.fen)
    const task = lesson.task
    if (!task) {
      expect(lesson.diagrams?.length).toBeGreaterThan(0)
      return
    }
    const before = position(task.fen)
    const [first, second] = SOLUTIONS[lesson.id] ?? []
    const solution = first && find(legalMoves(before), first)
    expect(solution && task.solves(solution, before)).toBe(true)
    if (!task.then) return
    // The opponent has exactly one reply, then the second step has a solution too.
    if (!solution || !second) throw new Error(`${lesson.id} needs a second move`)
    const afterFirst = applyMove(before, solution)
    const replies = legalMoves(afterFirst)
    expect(replies).toHaveLength(1)
    const reply = replies[0]
    if (!reply) return
    const afterReply = applyMove(afterFirst, reply)
    const finish = find(legalMoves(afterReply), second)
    expect(finish && task.then.solves(finish, afterReply)).toBe(true)
  })

  it('teaches the eating order with exactly the right pieces glowing', () => {
    const glowing = (id: string) => {
      const before = position(LESSONS.find((lesson) => lesson.id === id)?.task?.fen ?? '')
      return analyze(before).cannibalism.map((move) => before.board[move.to])
    }
    expect(glowing('pawns-first').map((piece) => piece?.type)).toEqual(['pawn', 'pawn'])
    expect(glowing('knights-bishops').map((piece) => piece?.type ?? '').sort()).toEqual(['bishop', 'knight'])
    expect(glowing('rooks').map((piece) => piece?.type)).toEqual(['rook'])
    expect(glowing('promoted-queens').map((piece) => piece?.queenOrigin)).toEqual(['promoted'])
    // The original queen on h1 stands next to the king too, and never glows.
    expect(glowing('original-queen').map((piece) => piece?.queenOrigin)).toEqual(['promoted'])
    expect(glowing('last-resort')).toEqual([])
    // The pictures: a far pawn makes it checkmate; no check makes it stalemate. No move either way.
    for (const id of ['pawns-first', 'last-resort']) {
      const diagram = LESSONS.find((lesson) => lesson.id === id)?.diagrams?.[0]
      expect(legalMoves(position(diagram?.fen ?? ''))).toHaveLength(0)
    }
  })
})

const toName = (sq: number): string => `${'abcdefgh'.charAt(sq & 7)}${(sq >> 3) + 1}`

async function playMove(user: ReturnType<typeof userEvent.setup>, from: string, to: string): Promise<void> {
  await user.click(square(from))
  await user.click(square(to))
}

describe('the tutorial page', () => {
  it('sends newcomers to learn regular chess first, then brings them back', async () => {
    const user = userEvent.setup()
    render(<TutorialApp />)
    expect(heading()).toBe('Learn Mean Chess')
    await user.click(button(/I’ve never played chess/))
    expect(heading()).toBe('Learn regular chess first')
    const lichess = screen.getByRole('link', { name: /Lichess/ })
    expect(lichess.getAttribute('href')).toBe('https://lichess.org/learn')
    expect(lichess.getAttribute('target')).toBe('_blank')
    expect(screen.getByRole('link', { name: /Chess\.com/ }).getAttribute('href')).toBe(
      'https://www.chess.com/learn-how-to-play-chess',
    )
    await user.click(button(/I know the basics now/))
    expect(heading()).toBe('Your king can eat its own pieces')
  })

  it('teaches every lesson on the board, punishes the Kill Zone, and ends ready to play', async () => {
    const user = userEvent.setup()
    render(<TutorialApp />)
    await user.click(button(/I know how chess works/))
    expect(screen.getByText(`Lesson 1 of ${LESSONS.length}`)).toBeTruthy()

    // It starts with the king eating its own pieces: Fool's mate, with the two pawns it may eat glowing.
    expect(heading()).toBe('Your king can eat its own pieces')
    expect(document.querySelectorAll('.board__hints .hint--eligible')).toHaveLength(2)
    expect(button('Next lesson →')).toHaveProperty('disabled', true)

    for (const lesson of LESSONS) {
      expect(heading()).toBe(lesson.title)
      if (lesson.id === 'royal-capture') {
        // A wrong move earns a hint and a fresh board; Next waits for the answer.
        await playMove(user, 'h1', 'g1')
        expect(screen.getByText(/That was an ordinary king move/)).toBeTruthy()
        expect(button('Next lesson →')).toHaveProperty('disabled', true)
        await user.click(button('Try again'))
      }
      if (lesson.id === 'kill-zone') {
        // Stepping into the Kill Zone: the black king answers by taking the king.
        await playMove(user, 'd3', 'd4')
        expect(await screen.findByText(/The black king took yours: d4/, {}, { timeout: 3_000 })).toBeTruthy()
        await user.click(button('Try again'))
      }
      const [first, second] = SOLUTIONS[lesson.id] ?? []
      if (first) await playMove(user, first[0], first[1])
      if (second && lesson.task?.then) {
        // The opponent's forced reply, then the second step.
        expect(await screen.findByText(lesson.task.then.instruction, {}, { timeout: 3_000 })).toBeTruthy()
        await playMove(user, second[0], second[1])
      }
      if (lesson.task) expect(screen.getByText(lesson.task.then?.success ?? lesson.task.success)).toBeTruthy()
      await user.click(button(lesson === LESSONS.at(-1) ? 'Finish' : 'Next lesson →'))
    }

    expect(heading()).toBe('You’re ready')
    expect(screen.getByRole('link', { name: 'Play the computer' }).getAttribute('href')).toBe('/play/?new=computer')
    expect(screen.getByRole('link', { name: 'Play a friend' }).getAttribute('href')).toBe('/play/?new=friend')
    expect(JSON.parse(window.localStorage.getItem('mean-chess:tutorial:v1') ?? '{}')).toEqual({
      lesson: 0,
      finished: true,
    })
    // Lessons never count towards the Auto difficulty (D-50).
    expect(window.localStorage.getItem('mean-chess:skill:v1')).toBeNull()
    // Every lesson stays one click away.
    const list = within(screen.getByRole('region', { name: 'Revisit a lesson' }))
    await user.click(list.getByRole('button', { name: 'Never the original queen' }))
    expect(heading()).toBe('Never the original queen')
  }, 60_000) // all 16 lessons, with the opponent's timed replies

  it('resumes where the player left off, and lets them skip a lesson', async () => {
    window.localStorage.setItem('mean-chess:tutorial:v1', JSON.stringify({ lesson: 3, finished: false }))
    const user = userEvent.setup()
    render(<TutorialApp />)
    await user.click(button(/Continue where you left off: lesson 4, Pawns first/))
    expect(heading()).toBe('Pawns first')
    await user.click(button('Skip this lesson'))
    expect(heading()).toBe('Then knights and bishops')
    await user.click(button('← Back'))
    expect(heading()).toBe('Pawns first')
  })
})
