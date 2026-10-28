import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeSocket, resetServer, scriptedPlayer, type FakeServer } from './onlineHarness.ts'

const square = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name},`) })
const seatIn = (gameId: string) => (JSON.parse(localStorage.getItem(`mean-chess:online:v1:${gameId}`) ?? '{}') as { you?: string }).you
const status = () => screen.getByRole('status').textContent

let server: FakeServer

async function loadApp() {
  vi.resetModules()
  vi.stubEnv('VITE_ONLINE_URL', 'https://server.test')
  const { OnlineApp } = await import('../../src/app/OnlineApp.tsx')
  return OnlineApp
}

beforeEach(() => {
  server = resetServer()
  vi.stubGlobal('WebSocket', FakeSocket)
  vi.stubGlobal('fetch', server.fetch)
  window.history.replaceState(null, '', '/online/')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('the online page', () => {
  it('says online play is coming soon when no server is configured', async () => {
    vi.resetModules()
    vi.stubEnv('VITE_ONLINE_URL', '')
    const { OnlineApp } = await import('../../src/app/OnlineApp.tsx')
    render(<OnlineApp />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Online play is coming soon')
    expect(screen.getByRole('link', { name: 'Play the computer' }).getAttribute('href')).toBe('/play/?new=computer')
  })

  it('creates an invite, waits, and plays a real game against a friend to a Royal Slaughter', async () => {
    const OnlineApp = await loadApp()
    const user = userEvent.setup()
    render(<OnlineApp />)
    await user.click(screen.getByRole('radio', { name: 'White' }))
    await user.click(screen.getByRole('button', { name: 'Create invite' }))

    // Waiting: the link and the code.
    expect(await screen.findByRole('heading', { name: 'Send this link to your friend' })).toBeTruthy()
    const gameId = [...server.rooms.keys()][0] ?? ''
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Invite link' }).value).toBe(`${window.location.origin}/online/?g=${gameId}`)
    expect(window.location.search).toBe(`?g=${gameId}`)
    expect(seatIn(gameId)).toBe('white')

    // The friend joins and connects.
    const friendToken = 'friend'.padEnd(43, 'f')
    act(() => {
      server.joinAs(gameId, friendToken)
    })
    const friend = scriptedPlayer(gameId, friendToken)
    await act(async () => {
      await friend.hello()
    })
    await waitFor(() => expect(status()).toBe('Your move'))

    // A real game: White's king walks up behind its e4 pawn, Black's king steps into the Kill Zone.
    const line: [string, string][] = [['e2', 'e4'], ['d7', 'd5'], ['e1', 'e2'], ['e8', 'd7'], ['e2', 'e3'], ['d7', 'd6'], ['a2', 'a3'], ['d6', 'e5']]
    for (const [ply, [from, to]] of line.entries()) {
      if (ply % 2 === 0) {
        await user.click(square(from))
        await user.click(square(to))
        await waitFor(() => expect(friend.last()).toMatchObject({ t: 'moved', ply: ply + 1 }))
      } else {
        await act(async () => {
          friend.move(ply, `${from}${to}`)
          await Promise.resolve()
        })
        await waitFor(() => expect(status()).toBe('Your move'))
      }
    }
    expect(screen.getByLabelText(/^e5, black king/)).toBeTruthy()
    // The Royal Slaughter: through White's own pawn on e4.
    await user.click(square('e3'))
    // The Kill Zone is never revealed online either (D-39): the winning capture looks like any move.
    expect(document.querySelectorAll('.board__hints .hint--win')).toHaveLength(0)
    expect(screen.queryByText(/Kill Zone|Doomed/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Kill zones' })).toBeNull()
    await user.click(square('e5'))
    await waitFor(() => expect(status()).toBe('You win! White wins by Royal Slaughter.'))
    expect(server.rooms.get(gameId)?.result).toEqual({ winner: 'white', reason: 'royal-slaughter' })
  })

  it('lets an invited friend read the rules and join from the link', async () => {
    const OnlineApp = await loadApp()
    // Someone else created the game.
    await server.fetch('https://server.test/v1/games', { method: 'POST', body: JSON.stringify({ protocol: 1, rules: '0.1', color: 'black' }) })
    const gameId = [...server.rooms.keys()][0] ?? ''
    window.history.replaceState(null, '', `/online/?g=${gameId.toLowerCase()}`)
    const user = userEvent.setup()
    render(<OnlineApp />)
    expect(await screen.findByRole('heading', { name: "You've been challenged to Mean Chess" })).toBeTruthy()
    expect(screen.getByText(/You'll play White/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'The rules in one minute' }))
    expect(screen.getByRole('dialog', { name: 'Mean Chess in one minute' })).toBeTruthy()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Close/ }))
    await user.click(screen.getByRole('button', { name: 'Join game' }))
    await waitFor(() => expect(status()).toBe('Your move'))
    expect(server.rooms.get(gameId)?.status).toBe('active')
  })

  it('shows strangers that a game is taken, and finished games read-only', async () => {
    const OnlineApp = await loadApp()
    await server.fetch('https://server.test/v1/games', { method: 'POST', body: JSON.stringify({ protocol: 1, rules: '0.1', color: 'white' }) })
    const gameId = [...server.rooms.keys()][0] ?? ''
    server.joinAs(gameId, 'other'.padEnd(43, 'o'))
    window.history.replaceState(null, '', `/online/?g=${gameId}`)
    const { unmount } = render(<OnlineApp />)
    expect(await screen.findByRole('heading', { name: 'This game is between two other players' })).toBeTruthy()
    unmount()

    window.history.replaceState(null, '', '/online/?g=ZZZZZZZZZZ')
    render(<OnlineApp />)
    expect(await screen.findByRole('heading', { name: 'Game not found' })).toBeTruthy()
  })

  it('offers the computer instead when online play is full for the day', async () => {
    const OnlineApp = await loadApp()
    server.nextCreateError = { status: 503, body: { error: 'online-full', reopensAt: Date.now() + 3 * 3_600_000 } }
    const user = userEvent.setup()
    render(<OnlineApp />)
    await user.click(screen.getByRole('button', { name: 'Create invite' }))
    expect(await screen.findByRole('heading', { name: 'Online play is full for today' })).toBeTruthy()
    expect(screen.getByText(/It reopens in 2 h|It reopens in 3 h/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Play the computer' })).toBeTruthy()
  })

  it('resumes after a dropped connection, and handles resignation and a rematch', async () => {
    const OnlineApp = await loadApp()
    const user = userEvent.setup()
    render(<OnlineApp />)
    await user.click(screen.getByRole('button', { name: 'Create invite' }))
    await screen.findByRole('heading', { name: 'Send this link to your friend' })
    const gameId = [...server.rooms.keys()][0] ?? ''
    const friendToken = 'friend'.padEnd(43, 'f')
    act(() => {
      server.joinAs(gameId, friendToken)
    })
    const friend = scriptedPlayer(gameId, friendToken)
    await act(async () => {
      await friend.hello()
    })
    await waitFor(() => expect(status()).toBe('Your move'))

    // The page's socket drops: it reconnects by itself and gets the full state.
    const pageSocket = server.sockets.find((s) => s !== friend.socket && s.readyState === FakeSocket.OPEN)
    await act(async () => {
      pageSocket?.close(1006)
      await new Promise((r) => setTimeout(r, 50))
    })
    await waitFor(() => expect(server.sockets.filter((s) => s !== friend.socket && s.readyState === FakeSocket.OPEN)).toHaveLength(1))
    await waitFor(() => expect(status()).toBe('Your move'))

    // The friend resigns; the page offers a rematch, the friend accepts, and the next game opens.
    await act(async () => {
      friend.send({ t: 'resign' })
      await Promise.resolve()
    })
    await waitFor(() => expect(status()).toBe('You win! Black resigned. White wins.'))
    await user.click(screen.getByRole('button', { name: 'Rematch' }))
    await act(async () => {
      friend.send({ t: 'rematch-answer', accept: true })
      await Promise.resolve()
    })
    await waitFor(() => expect(window.location.search).toMatch(/^\?g=NEXT/))
    const next = window.location.search.slice(3)
    expect(seatIn(next)).toBe('black')
  })

  it('offers to finish against the computer when the server stays unreachable', async () => {
    const OnlineApp = await loadApp()
    const user = userEvent.setup()
    render(<OnlineApp />)
    await user.click(screen.getByRole('radio', { name: 'White' }))
    await user.click(screen.getByRole('button', { name: 'Create invite' }))
    await screen.findByRole('heading', { name: 'Send this link to your friend' })
    const gameId = [...server.rooms.keys()][0] ?? ''
    const friendToken = 'friend'.padEnd(43, 'f')
    act(() => {
      server.joinAs(gameId, friendToken)
    })
    const friend = scriptedPlayer(gameId, friendToken)
    await act(async () => {
      await friend.hello()
    })
    await waitFor(() => expect(status()).toBe('Your move'))
    await user.click(square('e2'))
    await user.click(square('e4'))
    await waitFor(() => expect(friend.last()).toMatchObject({ t: 'moved', ply: 1 }))

    // The server goes away: first "Reconnecting…", then after 30 s the computer is offered.
    server.down = true
    await act(async () => {
      server.sockets.find((s) => s !== friend.socket && s.readyState === FakeSocket.OPEN)?.close(1006)
      await Promise.resolve()
    })
    // A quick blip shows nothing; after 2 s the player is told.
    expect(screen.queryByText('Reconnecting…')).toBeNull()
    expect(await screen.findByText('Reconnecting…', undefined, { timeout: 4_000 })).toBeTruthy()
    const realNow = Date.now.bind(Date)
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => realNow() + 31_000)
    const finish = await screen.findByRole('button', { name: 'Finish this position against the computer' }, { timeout: 3_000 })
    expect(screen.getByRole('button', { name: 'Keep waiting' })).toBeTruthy()
    await user.click(finish)
    clock.mockRestore()

    // The local board gets exactly this game, against the computer, from White's side.
    expect(JSON.parse(localStorage.getItem('mean-chess:game:v1') ?? '{}')).toMatchObject({ moves: ['e2e4'] })
    expect(JSON.parse(localStorage.getItem('mean-chess:opponent:v1') ?? '{}')).toEqual({ kind: 'computer', level: 'nice', human: 'white', auto: true })
  })

  it('a page opened mid-game (a reload) still receives the opponent’s moves', async () => {
    const OnlineApp = await loadApp()
    const user = userEvent.setup()
    const first = render(<OnlineApp />)
    await user.click(screen.getByRole('radio', { name: 'White' }))
    await user.click(screen.getByRole('button', { name: 'Create invite' }))
    await screen.findByRole('heading', { name: 'Send this link to your friend' })
    const gameId = [...server.rooms.keys()][0] ?? ''
    const friendToken = 'friend'.padEnd(43, 'f')
    act(() => {
      server.joinAs(gameId, friendToken)
    })
    const friend = scriptedPlayer(gameId, friendToken)
    await act(async () => {
      await friend.hello()
    })
    await user.click(square('e2'))
    await user.click(square('e4'))
    await act(async () => {
      friend.move(1, 'd7d5')
      await Promise.resolve()
    })
    await waitFor(() => expect(status()).toBe('Your move'))

    // Reload: the page loads the game from the server's state, then the friend's next move must still show.
    first.unmount()
    render(<OnlineApp />)
    await waitFor(() => expect(status()).toBe('Your move'))
    await user.click(square('g1'))
    await user.click(square('f3'))
    await waitFor(() => expect(friend.last()).toMatchObject({ t: 'moved', ply: 3 }))
    await act(async () => {
      friend.move(3, 'b8c6')
      await Promise.resolve()
    })
    await waitFor(() => expect(status()).toBe('Your move'))
    expect(screen.getByLabelText(/^c6, black knight/)).toBeTruthy()
  })
})
