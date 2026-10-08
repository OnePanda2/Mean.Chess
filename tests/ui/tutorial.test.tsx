import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { TutorialApp } from '../../src/app/TutorialApp.tsx'
import { LESSONS } from '../../src/app/lessons.ts'
import { legalMoves, parseMeanFen, type Position } from '../../src/engine/index.ts'

const square = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name},`) })
const button = (name: string | RegExp) => screen.getByRole('button', { name })
const heading = () => screen.getByRole('heading', { level: 1 }).textContent

/** A move that solves each lesson, as from and to squares. */
const SOLUTIONS: Readonly<Record<string, readonly [string, string]>> = {
  'royal-capture': ['h1', 'f3'],
  'kill-zone': ['d3', 'c4'],
  shield: ['a2', 'a3'],
  'royal-slaughter': ['e1', 'e3'],
  'sacrifice-order': ['e1', 'e3'],
  cannibalism: ['g1', 'g2'],
  desperate: ['h1', 'g2'],
}

function position(fen: string): Position {
  const parsed = parseMeanFen(fen)
  if (!parsed.ok) throw new Error(`Invalid lesson position "${fen}": ${parsed.error}`)
  return parsed.position
}

describe('the lessons (checked by the rules engine)', () => {
  it.each(LESSONS.map((lesson) => [lesson.id, lesson] as const))('%s is a fair task', (_, lesson) => {
    for (const diagram of lesson.diagrams ?? []) position(diagram.fen)
    const task = lesson.task
    if (!task) {
      expect(lesson.diagrams?.length).toBeGreaterThan(0)
      return
    }
    const before = position(task.fen)
    const moves = legalMoves(before)
    expect(moves.some((move) => task.solves(move, before))).toBe(true)
    // The listed solution is legal and solves it.
    const [from, to] = SOLUTIONS[lesson.id] ?? ['', '']
    const solution = moves.find((move) => `${move.from}` && toName(move.from) === from && toName(move.to) === to)
    expect(solution && task.solves(solution, before)).toBe(true)
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
    expect(heading()).toBe('Kings capture kings')
  })

  it('teaches every lesson on the board, punishes the Kill Zone, and ends ready to play', async () => {
    const user = userEvent.setup()
    render(<TutorialApp />)
    await user.click(button(/I know how chess works/))
    expect(screen.getByText(`Lesson 1 of ${LESSONS.length}`)).toBeTruthy()

    // A wrong move earns a hint and a fresh board; Next waits for the answer.
    expect(button('Next lesson →')).toHaveProperty('disabled', true)
    await playMove(user, 'h1', 'g1')
    expect(screen.getByText(/That was an ordinary king move/)).toBeTruthy()
    await user.click(button('Try again'))
    await playMove(user, 'h1', 'f3')
    expect(screen.getByText(/Royal Capture\. The game is over/)).toBeTruthy()
    await user.click(button('Next lesson →'))

    // Stepping into the Kill Zone: the black king answers by taking the king.
    expect(heading()).toBe('The Kill Zone')
    await playMove(user, 'd3', 'd4')
    expect(await screen.findByText(/The black king took yours: d4/, {}, { timeout: 3_000 })).toBeTruthy()
    await user.click(button('Try again'))

    for (const lesson of LESSONS.slice(1)) {
      expect(heading()).toBe(lesson.title)
      const solution = SOLUTIONS[lesson.id]
      if (solution) {
        await playMove(user, solution[0], solution[1])
        expect(screen.getByText(lesson.task?.success ?? '')).toBeTruthy()
      }
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
    await user.click(list.getByRole('button', { name: 'Royal Cannibalism' }))
    expect(heading()).toBe('Royal Cannibalism')
  })

  it('resumes where the player left off, and lets them skip a lesson', async () => {
    window.localStorage.setItem('mean-chess:tutorial:v1', JSON.stringify({ lesson: 3, finished: false }))
    const user = userEvent.setup()
    render(<TutorialApp />)
    await user.click(button(/Continue where you left off: lesson 4, Royal Slaughter/))
    expect(heading()).toBe('Royal Slaughter')
    await user.click(button('Skip this lesson'))
    expect(heading()).toBe('Pawns go first')
    await user.click(button('← Back'))
    expect(heading()).toBe('Royal Slaughter')
  })
})
