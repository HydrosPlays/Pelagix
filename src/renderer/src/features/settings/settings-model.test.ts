import { describe, expect, it } from 'vitest'
import type { DexIndex } from '@shared/dex-types'
import { DEFAULT_RULES, type DexRules } from '@shared/save-types'
import { buildSlots, RULE_KEYS, RULE_PRESETS } from '@renderer/domain/slots'
import { Dex, validateDexIndex } from '@renderer/lib/data'
import { parseSaveReport } from '@renderer/lib/storage'
import { fixtureDex, ID, makeEntry, makeSave } from '@renderer/lib/test-fixture'
import { countSlots, formatBytes, presetChoice, RULE_GROUPS, ruleImpact, sameRules, saveFilePath, shortCommit, signed, summarizeImport } from './settings-model'

const realIndex = Object.values(import.meta.glob<DexIndex>('../../../public/data/dex.json', { eager: true, import: 'default' }))[0]

/** The rule set whose bit `i` (in `RULE_KEYS` order) says whether rule `i` is on. */
const rulesOf = (mask: number): DexRules => Object.fromEntries(RULE_KEYS.map((key, i) => [key, (mask & (1 << i)) !== 0])) as unknown as DexRules
const ALL_MASKS = Array.from({ length: 1 << RULE_KEYS.length }, (_, mask) => mask)

describe('rule groups', () => {
  it('list every rule exactly once', () => {
    const listed = RULE_GROUPS.flatMap((group) => group.keys)
    expect([...listed].sort()).toEqual([...RULE_KEYS].sort())
    expect(new Set(listed).size).toBe(listed.length)
  })

  it('keep the battle-only forms apart from the ones that live in boxes', () => {
    expect(RULE_GROUPS.find((group) => group.id === 'battle')?.keys).toEqual(['mega', 'battle', 'gmax'])
    expect(RULE_GROUPS.every((group) => group.title !== '' && group.description !== '')).toBe(true)
  })
})

describe('presets', () => {
  it('names the preset the rules equal, else custom', () => {
    expect(presetChoice(RULE_PRESETS.species.rules)).toBe('species')
    expect(presetChoice({ ...DEFAULT_RULES })).toBe('forms')
    expect(presetChoice(RULE_PRESETS.completionist.rules)).toBe('completionist')
    expect(presetChoice({ ...DEFAULT_RULES, mega: true })).toBe('custom')
  })

  it('compares rule sets by value', () => {
    expect(sameRules(DEFAULT_RULES, { ...DEFAULT_RULES })).toBe(true)
    expect(sameRules(DEFAULT_RULES, { ...DEFAULT_RULES, gmax: true })).toBe(false)
  })
})

describe('countSlots', () => {
  it('agrees with buildSlots for every one of the 8,192 rule sets (fixture)', () => {
    const species = fixtureDex.speciesList
    for (const mask of ALL_MASKS) {
      const rules = rulesOf(mask)
      expect(countSlots(species, rules), `mask ${mask}`).toBe(buildSlots(fixtureDex, rules).length)
    }
  })

  it('gives one slot per species when every rule is off', () => {
    expect(countSlots(fixtureDex.speciesList, RULE_PRESETS.species.rules)).toBe(fixtureDex.speciesList.length)
    expect(countSlots([], DEFAULT_RULES)).toBe(0)
  })

  it.skipIf(!realIndex)('agrees with buildSlots on the real dataset', () => {
    const dex = new Dex(validateDexIndex(realIndex))
    // The three presets, every single-rule set, and a spread of mixed ones.
    const masks = [0, 8191, ...RULE_KEYS.map((_, i) => 1 << i), ...RULE_KEYS.map((_, i) => 8191 ^ (1 << i)), ...Array.from({ length: 16 }, (_, i) => (i * 2654435761) % 8192)]
    const ruleSets = [{ ...DEFAULT_RULES }, ...masks.map(rulesOf)]
    for (const rules of ruleSets) expect(countSlots(dex.speciesList, rules)).toBe(buildSlots(dex, rules).length)
  })
})

describe('ruleImpact', () => {
  it('is the difference between a rule being on and off, whatever it is now', () => {
    const species = fixtureDex.speciesList
    for (const rules of [RULE_PRESETS.species.rules, DEFAULT_RULES, RULE_PRESETS.completionist.rules]) {
      const impact = ruleImpact(species, rules)
      for (const key of RULE_KEYS) {
        const on = buildSlots(fixtureDex, { ...rules, [key]: true }).length
        const off = buildSlots(fixtureDex, { ...rules, [key]: false }).length
        expect(impact[key], key).toBe(on - off)
        expect(impact[key], key).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('sees that rules interact', () => {
    const species = fixtureDex.speciesList
    // Regional forms add slots under any other rules (Alolan Raichu is in the fixture).
    expect(ruleImpact(species, DEFAULT_RULES).regional).toBeGreaterThan(0)
    expect(ruleImpact(species, RULE_PRESETS.species.rules).regional).toBeGreaterThan(0)
    // Gigantamax adds a slot per slotted form that can Gigantamax, so it grows with the other rules.
    expect(ruleImpact(species, RULE_PRESETS.completionist.rules).gmax).toBeGreaterThanOrEqual(ruleImpact(species, RULE_PRESETS.species.rules).gmax)
  })
})

describe('signed', () => {
  it('writes a change with its sign', () => {
    expect(signed(262)).toBe('+262')
    expect(signed(-12)).toBe('−12')
    expect(signed(0)).toBe('0')
    expect(signed(1234)).toBe('+1,234')
  })
})

describe('formatBytes', () => {
  it('picks a readable unit', () => {
    expect(formatBytes(0)).toBe('0 KB')
    expect(formatBytes(-5)).toBe('0 KB')
    expect(formatBytes(Number.NaN)).toBe('0 KB')
    expect(formatBytes(300)).toBe('1 KB')
    expect(formatBytes(421_888)).toBe('412 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.00 MB')
    expect(formatBytes(40_055_603)).toBe('38.2 MB')
    expect(formatBytes(1.25 * 1024 ** 3)).toBe('1.25 GB')
  })
})

describe('shortCommit', () => {
  it('keeps seven characters', () => {
    expect(shortCommit('35fdbe9bdec8f519f882c3edc3c0185f08af4d86')).toBe('35fdbe9')
    expect(shortCommit(' abc ')).toBe('abc')
    expect(shortCommit('')).toBe('')
  })
})

describe('saveFilePath', () => {
  it('joins with the separator the folder uses', () => {
    expect(saveFilePath('C:\\Users\\hydro\\AppData\\Roaming\\Pelagix')).toBe('C:\\Users\\hydro\\AppData\\Roaming\\Pelagix\\save.json')
    expect(saveFilePath('C:\\Users\\hydro\\AppData\\Roaming\\Pelagix\\')).toBe('C:\\Users\\hydro\\AppData\\Roaming\\Pelagix\\save.json')
    expect(saveFilePath('/home/hydro/.config/Pelagix')).toBe('/home/hydro/.config/Pelagix/save.json')
    expect(saveFilePath('/Users/hydro/Library/Application Support/Pelagix/')).toBe('/Users/hydro/Library/Application Support/Pelagix/save.json')
  })
})

describe('summarizeImport', () => {
  const mine = [makeEntry(ID.pikachu), makeEntry(ID.eevee)]

  it('counts what the file holds and what a merge would add', () => {
    const theirs = makeSave([mine[0]!, makeEntry(ID.mewtwo, 0, { shiny: true }), makeEntry(ID.rotom)])
    theirs.settings.trainerName = 'Maximilian'
    theirs.achievements = { 'first-catch': '2026-01-01T00:00:00.000Z' }
    theirs.updatedAt = '2026-09-30T18:45:00.000Z'
    const summary = summarizeImport(parseSaveReport(theirs), mine)
    expect(summary).toEqual({ entries: 3, dropped: 0, repaired: 0, shiny: 1, achievements: 1, trainerName: 'Maximilian', savedAt: '2026-09-30T18:45:00.000Z', fresh: 2, known: 1, newer: false })
  })

  it('reports dropped and repaired entries and newer files', () => {
    const raw = { version: 99, entries: [mine[0], { species: 'nope', game: 'red' }, { ...makeEntry(ID.eevee), level: 900 }], settings: { theme: 'dark' } }
    const summary = summarizeImport(parseSaveReport(raw), [])
    expect(summary).toMatchObject({ entries: 2, dropped: 1, repaired: 1, fresh: 2, known: 0, newer: true, trainerName: '' })
  })

  it('handles an empty file and an empty save', () => {
    expect(summarizeImport(parseSaveReport(makeSave()), mine)).toMatchObject({ entries: 0, fresh: 0, known: 0, shiny: 0, achievements: 0 })
  })
})
