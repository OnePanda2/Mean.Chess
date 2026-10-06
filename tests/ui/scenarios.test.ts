import { describe, expect, it } from 'vitest'
import { SCENARIOS } from '../../src/app/scenarios.ts'
import { analyze, newGame, parseMeanFen, type PositionAnalysis } from '../../src/engine/index.ts'

function analysisOf(id: string): PositionAnalysis {
  const scenario = SCENARIOS.find((candidate) => candidate.id === id)
  if (!scenario) throw new Error(`no scenario ${id}`)
  const parsed = parseMeanFen(scenario.fen)
  if (!parsed.ok) throw new Error(parsed.error)
  return analyze(parsed.position)
}

describe('Scenario Lab catalogue', () => {
  it('has unique ids and only valid positions', () => {
    expect(new Set(SCENARIOS.map((scenario) => scenario.id)).size).toBe(SCENARIOS.length)
    for (const scenario of SCENARIOS) expect(parseMeanFen(scenario.fen).ok, scenario.id).toBe(true)
  })

  it('shows what each scenario promises', () => {
    expect(analysisOf('royal-capture').ordinary.some((move) => move.suicidal)).toBe(true)
    expect(analysisOf('royal-capture-in-check').royal?.kind).toBe('royal-capture')
    expect(analysisOf('corner-zugzwang').legal.every((move) => move.suicidal)).toBe(true)
    expect(analysisOf('slaughter-pawn').royal?.kind).toBe('royal-slaughter')
    expect(analysisOf('slaughter-blocked').royal).toBeNull()
    expect(analysisOf('slaughter-knight').royal?.kind).toBe('royal-slaughter')
    expect(analysisOf('slaughter-rook').royal?.kind).toBe('royal-slaughter')
    expect(analysisOf('enemy-blocker').royal?.kind).toBe('royal-slaughter')
    expect(analysisOf('cannibal-back-rank').cannibalism).toHaveLength(3)
    expect(analysisOf('cannibal-minor').cannibalism).toHaveLength(3)
    expect(analysisOf('cannibal-promoted-queen').cannibalism).toHaveLength(1)
    expect(analysisOf('suicidal-escape').cannibalism).toHaveLength(1)
    expect(analysisOf('fools-mate').cannibalism).toHaveLength(2)
    expect(analysisOf('castle-into-kill-zone').ordinary.some((move) => move.kind === 'castle-kingside' && move.suicidal)).toBe(true)
    expect(analysisOf('last-pawn').ordinary.filter((move) => move.suicidal)).toHaveLength(1)
  })

  it('ends at once where it says checkmate or stalemate', () => {
    const outcome = (id: string) => {
      const parsed = parseMeanFen(SCENARIOS.find((s) => s.id === id)?.fen ?? '')
      return parsed.ok ? newGame(parsed.position).outcome?.kind : 'invalid'
    }
    expect(outcome('cannibal-blocked')).toBe('checkmate')
    expect(outcome('original-queen')).toBe('checkmate')
    expect(outcome('scholars-mate')).toBe('checkmate')
    expect(outcome('stalemate')).toBe('stalemate')
  })
})
