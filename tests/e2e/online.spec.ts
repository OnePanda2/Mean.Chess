/**
 * Online play end to end (docs/ONLINE-TEST-PLAN.md §6): Alice and Bob in two independent browser
 * contexts (separate storage), against the real game server. Run with `npm run test:e2e`.
 */
import { expect, test, type Browser, type Page, type WebSocketRoute } from '@playwright/test'

/** The line from the jsdom test: White's king walks up behind its e4 pawn; Black's king steps into the Kill Zone. */
const LINE: readonly (readonly [string, string])[] = [
  ['e2', 'e4'],
  ['d7', 'd5'],
  ['e1', 'e2'],
  ['e8', 'd7'],
  ['e2', 'e3'],
  ['d7', 'd6'],
  ['a2', 'a3'],
  ['d6', 'e5'],
]

const square = (page: Page, name: string) => page.getByRole('button', { name: new RegExp(`^${name},`) })
const status = (page: Page) => page.getByRole('status')

interface Player {
  readonly page: Page
  readonly errors: string[]
  readonly close: () => Promise<void>
}

async function player(browser: Browser, viewport?: { width: number; height: number }): Promise<Player> {
  const context = await browser.newContext(viewport ? { viewport } : {})
  const page = await context.newPage()
  const errors: string[] = []
  page.on('console', (message) => {
    // React's dev double mount closes the first socket while it connects; that warning is harmless.
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  return { page, errors, close: () => context.close() }
}

/** Alice creates a game as White; Bob opens the link and joins. Returns the invite link. */
async function startGame(alice: Page, bob: Page): Promise<string> {
  await alice.goto('/online/')
  await alice.getByRole('radio', { name: 'White' }).check()
  await alice.getByRole('button', { name: 'Create invite' }).click()
  const link = await alice.getByRole('textbox', { name: 'Invite link' }).inputValue()
  await bob.goto(link)
  await expect(bob.getByRole('heading', { name: "You've been challenged to Mean Chess" })).toBeVisible()
  await bob.getByRole('button', { name: 'Join game' }).click()
  await expect(status(alice)).toHaveText('Your move')
  await expect(status(bob)).toHaveText('Their move')
  return link
}

async function move(page: Page, from: string, to: string): Promise<void> {
  await square(page, from).click()
  await square(page, to).click()
}

async function playLine(alice: Page, bob: Page, upTo = LINE.length): Promise<void> {
  for (const [ply, [from, to]] of LINE.slice(0, upTo).entries()) {
    const [mover, waiter] = ply % 2 === 0 ? [alice, bob] : [bob, alice]
    await expect(status(mover)).toHaveText('Your move')
    await move(mover, from, to)
    await expect(status(waiter)).toHaveText('Your move')
  }
}

const moveList = (page: Page) => page.locator('.move-list, [aria-label="Moves"]').first().innerText()

test('a full game to a Royal Slaughter, with nothing revealing the Kill Zone', async ({ browser }) => {
  const alice = await player(browser)
  const bob = await player(browser)
  await startGame(alice.page, bob.page)
  await playLine(alice.page, bob.page)

  // Bob stepped into the Kill Zone: neither page warns anyone (D-39, D-46).
  for (const page of [alice.page, bob.page]) {
    await expect(page.getByText(/Kill Zone|Doomed/)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Kill zones' })).toHaveCount(0)
  }
  await square(alice.page, 'e3').click()
  await expect(alice.page.locator('.board__hints .hint--win')).toHaveCount(0)
  await square(alice.page, 'e5').click()

  await expect(status(alice.page)).toHaveText('You win! White wins by Royal Slaughter.')
  await expect(status(bob.page)).toHaveText('You lose. White wins by Royal Slaughter.')
  expect(await moveList(alice.page)).toBe(await moveList(bob.page))
  expect(alice.errors.filter((e) => !e.includes('WebSocket'))).toEqual([])
  expect(bob.errors.filter((e) => !e.includes('WebSocket'))).toEqual([])
  await alice.close()
  await bob.close()
})

test('a reload mid-game puts the same game back', async ({ browser }) => {
  const alice = await player(browser)
  const bob = await player(browser)
  await startGame(alice.page, bob.page)
  await playLine(alice.page, bob.page, 6)
  const before = await moveList(bob.page)
  await bob.page.reload()
  await expect(status(bob.page)).toHaveText('Their move')
  expect(await moveList(bob.page)).toBe(before)
  await move(alice.page, 'a2', 'a3')
  await expect(status(bob.page)).toHaveText('Your move')
  await alice.close()
  await bob.close()
})

test('a network drop: reconnecting, then back with no move lost or doubled', async ({ browser }) => {
  const alice = await player(browser)
  const bob = await player(browser)
  // Alice's game socket goes through a switch: cut it, and refuse new connections while it is off.
  let networkUp = true
  const live: WebSocketRoute[] = []
  await alice.page.routeWebSocket(/\/v1\/games\/[^/]+\/ws$/, (ws) => {
    if (!networkUp) {
      void ws.close({ code: 4000, reason: 'offline' })
      return
    }
    ws.connectToServer()
    live.push(ws)
  })
  await startGame(alice.page, bob.page)
  await move(alice.page, 'e2', 'e4')
  await expect(status(bob.page)).toHaveText('Your move')

  networkUp = false
  for (const ws of live.splice(0)) await ws.close({ code: 4000, reason: 'offline' })
  await expect(alice.page.getByText('Reconnecting…')).toBeVisible()
  // Bob moves while Alice is away.
  await move(bob.page, 'd7', 'd5')
  await alice.page.waitForTimeout(8_000)
  networkUp = true
  await alice.page.getByRole('button', { name: 'Retry now' }).click()
  await expect(status(alice.page)).toHaveText('Your move')
  expect(await moveList(alice.page)).toBe(await moveList(bob.page))
  await move(alice.page, 'g1', 'f3')
  await expect(status(bob.page)).toHaveText('Your move')
  expect(await moveList(alice.page)).toBe(await moveList(bob.page))
  await alice.close()
  await bob.close()
})

test('the opponent leaving is shown', async ({ browser }) => {
  const alice = await player(browser)
  const bob = await player(browser)
  await startGame(alice.page, bob.page)
  await bob.close()
  await expect(alice.page.getByText('Your opponent left the game.')).toBeVisible({ timeout: 30_000 })
  await expect(alice.page.getByText(/You can claim the game in \d+ s/)).toBeVisible()
  await alice.close()
})

test('a rematch opens the next game with colours swapped', async ({ browser }) => {
  const alice = await player(browser)
  const bob = await player(browser)
  await startGame(alice.page, bob.page)
  await bob.page.getByRole('button', { name: 'Resign' }).click()
  await bob.page.getByRole('dialog').getByRole('button', { name: 'Resign' }).click()
  await expect(status(alice.page)).toHaveText('You win! Black resigned. White wins.')
  const firstUrl = alice.page.url()
  await alice.page.getByRole('button', { name: 'Rematch' }).click()
  await bob.page.getByRole('button', { name: 'Accept rematch' }).click()
  await expect(alice.page).not.toHaveURL(firstUrl)
  await expect(alice.page.getByText(/you play Black/i)).toBeVisible()
  await expect(bob.page.getByText(/you play White/i)).toBeVisible()
  await expect(status(bob.page)).toHaveText('Your move')
  await alice.close()
  await bob.close()
})

test('phones: invite, join and the game fit at 375 px in every theme', async ({ browser }) => {
  const phone = { width: 375, height: 812 }
  const alice = await player(browser, phone)
  const bob = await player(browser, phone)
  const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  const themes = ['mean', 'sugar', 'arcade', 'picnic'] as const
  const eachTheme = async (page: Page) => {
    for (const theme of themes) {
      await page.evaluate((t) => (document.documentElement.dataset.theme = t), theme)
      expect(await overflow(page), `${theme} theme`).toBeLessThanOrEqual(0)
    }
  }

  await alice.page.goto('/online/')
  await eachTheme(alice.page)
  await alice.page.getByRole('button', { name: 'Create invite' }).click()
  const link = await alice.page.getByRole('textbox', { name: 'Invite link' }).inputValue()
  await eachTheme(alice.page)
  await bob.page.goto(link)
  await expect(bob.page.getByRole('button', { name: 'Join game' })).toBeVisible()
  await eachTheme(bob.page)
  await bob.page.getByRole('button', { name: 'Join game' }).click()
  await expect(status(bob.page)).toBeVisible()
  await eachTheme(bob.page)
  await eachTheme(alice.page)
  await alice.close()
  await bob.close()
})
