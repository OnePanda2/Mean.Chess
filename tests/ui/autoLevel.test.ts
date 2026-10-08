import { describe, expect, it } from 'vitest'
import { NEW_SKILL, isSkill, recordResult, resultFor, type Skill } from '../../src/app/autoLevel.ts'
import { loadSkill, saveSkill } from '../../src/app/storage.ts'

const at = (level: Skill['level'], streak = 0): Skill => ({ level, streak })

describe('the Auto difficulty (D-50)', () => {
  it('starts at Nice', () => {
    expect(NEW_SKILL).toEqual(at('nice'))
    expect(loadSkill()).toEqual(at('nice'))
  })

  it('steps up after two wins in a row and down after two losses in a row', () => {
    let skill = recordResult(NEW_SKILL, 'nice', 'win')
    expect(skill).toEqual(at('nice', 1))
    skill = recordResult(skill, 'nice', 'win')
    expect(skill).toEqual(at('mean'))
    skill = recordResult(recordResult(skill, 'mean', 'win'), 'mean', 'win')
    expect(skill).toEqual(at('ruthless'))
    skill = recordResult(recordResult(skill, 'ruthless', 'loss'), 'ruthless', 'loss')
    expect(skill).toEqual(at('mean'))
  })

  it('never goes above Ruthless or below Nice', () => {
    expect(recordResult(at('ruthless', 1), 'ruthless', 'win')).toEqual(at('ruthless'))
    expect(recordResult(at('nice', -1), 'nice', 'loss')).toEqual(at('nice'))
  })

  it('needs the results in a row: a draw or the other result starts the count again', () => {
    expect(recordResult(at('mean', 1), 'mean', 'draw')).toEqual(at('mean'))
    expect(recordResult(at('mean', 1), 'mean', 'loss')).toEqual(at('mean', -1))
    expect(recordResult(at('mean', -1), 'mean', 'win')).toEqual(at('mean', 1))
  })

  it('counts a win against a harder level and a loss against an easier one', () => {
    expect(recordResult(at('nice', 1), 'ruthless', 'win')).toEqual(at('mean'))
    expect(recordResult(at('ruthless', -1), 'nice', 'loss')).toEqual(at('mean'))
  })

  it('ignores a win against an easier level and a loss against a harder one', () => {
    expect(recordResult(at('mean', 1), 'nice', 'win')).toEqual(at('mean', 1))
    expect(recordResult(at('mean', -1), 'ruthless', 'loss')).toEqual(at('mean', -1))
  })

  it('reads the player’s result from the outcome, and resigning is a loss', () => {
    expect(resultFor(null, 'white')).toBeNull()
    expect(resultFor({ kind: 'royal-capture', winner: 'white' }, 'white')).toBe('win')
    expect(resultFor({ kind: 'resignation', winner: 'black' }, 'white')).toBe('loss')
    expect(resultFor({ kind: 'threefold', winner: null }, 'black')).toBe('draw')
  })

  it('remembers the record on this device and ignores anything malformed', () => {
    saveSkill(at('ruthless', -1))
    expect(loadSkill()).toEqual(at('ruthless', -1))
    for (const text of ['{"level":"easy","streak":0}', '{"level":"mean","streak":5}', '{"level":"mean"}', 'nonsense']) {
      window.localStorage.setItem('mean-chess:skill:v1', text)
      expect(loadSkill()).toEqual(NEW_SKILL)
    }
    expect(isSkill(at('mean', 1))).toBe(true)
    expect(isSkill(null)).toBe(false)
  })
})
