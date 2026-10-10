import { describe, expect, it } from 'vitest'
import { ABILITIES, ABILITY_BY_ID, abilityName } from './abilities'

describe('the ability list', () => {
  it('has unique, positive integer ids in ascending order', () => {
    const ids = ABILITIES.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every((id) => Number.isInteger(id) && id > 0)).toBe(true)
    expect(ids).toEqual([...ids].sort((a, b) => a - b))
    expect(ABILITY_BY_ID.size).toBe(ABILITIES.length)
  })

  it('has a real name for every ability', () => {
    for (const a of ABILITIES) {
      expect(a.name).toBe(a.name.trim())
      expect(a.name).toMatch(/^[A-Z]/)
    }
  })

  it('uses the PKHeX ids', () => {
    expect(abilityName(1)).toBe('Stench')
    expect(abilityName(65)).toBe('Overgrow')
    expect(abilityName(150)).toBe('Imposter')
    expect(abilityName(ABILITIES.length)).toBe(ABILITIES.at(-1)?.name)
  })

  it('knows no name for anything else', () => {
    for (const id of [0, -1, 1.5, ABILITIES.length + 1, undefined, null]) expect(abilityName(id)).toBeUndefined()
  })
})
