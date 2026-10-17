import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { importGame } from '../../src/engine/index.ts'

const root = resolve(import.meta.dirname, '../..')
const PAGES = ['index.html', 'play/index.html', 'tutorial/index.html', 'rules/index.html'] as const

const meta = (html: string, property: string): string | undefined =>
  new RegExp(`<meta (?:property|name)="${property}" content="([^"]*)"`).exec(html)?.[1]

describe('the press kit (docs/PRESS-KIT.md)', () => {
  it.each(PAGES)('gives %s a link preview that points at the press image', (page) => {
    const html = readFileSync(resolve(root, page), 'utf8')
    expect(meta(html, 'og:image')).toBe('https://meanchess.siddheshthapa.com/press/og.png')
    expect(meta(html, 'og:title')).toBeTruthy()
    expect(meta(html, 'og:description')).toBe(/name="description"\s+content="([^"]+)"/.exec(html)?.[1])
    expect(meta(html, 'twitter:card')).toBe('summary_large_image')
    const path = page === 'index.html' ? '/' : `/${page.replace('index.html', '')}`
    expect(meta(html, 'og:url')).toBe(`https://meanchess.siddheshthapa.com${path}`)
  })

  it('ships every file the press kit lists', () => {
    for (const file of [
      'og.png',
      'social-preview.png',
      'screenshot-mean.png',
      'screenshot-themes.png',
      'royal-slaughter.mp4',
      'royal-slaughter.gif',
      'cannibalism.mp4',
      'cannibalism.gif',
      'example-game.json',
      ...[1, 2, 3, 4, 5, 6, 7].map((n) => `diagrams/${n}-`),
    ]) {
      const dir = resolve(root, 'public/press')
      const found = file.endsWith('-')
        ? readdirSync(resolve(dir, 'diagrams')).some((name) => `diagrams/${name}`.startsWith(file))
        : existsSync(resolve(dir, file))
      expect(found, file).toBe(true)
    }
  })

  it('offers a real example game that ends in a Royal Slaughter', () => {
    const loaded = importGame(readFileSync(resolve(root, 'public/press/example-game.json'), 'utf8'))
    if (!loaded.ok) throw new Error(loaded.error)
    expect(loaded.game.outcome?.kind).toBe('royal-slaughter')
    expect(loaded.game.moves.at(-1)?.kind).toBe('royal-slaughter')
  })
})

