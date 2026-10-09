import { describe, expect, it } from 'vitest'
import type { DexIndex, FormSummary, SpeciesSummary } from '@shared/dex-types'
import { DEFAULT_RULES, type CatchEntry, type DexRules } from '@shared/save-types'
import { Dex } from '@renderer/lib/data'
import { fixtureDex as dex, ID, makeEntry, makeSave } from '@renderer/lib/test-fixture'
import {
  buildSlots, collectionFor, computeCollection, isFormSlotted, matchRulePreset, RULE_INFO, RULE_KEYS, RULE_PRESETS, slotKeyFor, slotTarget,
  type LivingSlot
} from './slots'

const NONE = RULE_PRESETS.species.rules
const ALL = RULE_PRESETS.completionist.rules
const only = (...keys: Array<keyof DexRules>): DexRules => ({ ...NONE, ...Object.fromEntries(keys.map((k) => [k, true])) })
const keysOf = (slots: LivingSlot[], species: number): string[] => slots.filter((s) => s.species === species).map((s) => s.key)
const find = (rules: DexRules, key: string): LivingSlot => {
  const slot = buildSlots(dex, rules).find((s) => s.key === key)
  if (!slot) throw new Error(`no slot ${key}`)
  return slot
}
const key = (rules: DexRules, species: number, form = 0, extra: Partial<CatchEntry> = {}): string | null =>
  slotKeyFor(makeEntry(species, form, extra), dex, rules)

describe('rule presets', () => {
  it('species turns everything off, forms is the default, completionist turns everything on', () => {
    expect(Object.values(NONE).every((v) => v === false)).toBe(true)
    expect(RULE_PRESETS.forms.rules).toEqual(DEFAULT_RULES)
    expect(Object.values(ALL).every((v) => v === true)).toBe(true)
    for (const preset of Object.values(RULE_PRESETS)) {
      expect(Object.keys(preset.rules).sort()).toEqual([...RULE_KEYS].sort())
      expect(preset.label).not.toBe('')
      expect(preset.description).not.toBe('')
    }
  })

  it('does not share the DEFAULT_RULES object', () => {
    expect(RULE_PRESETS.forms.rules).not.toBe(DEFAULT_RULES)
  })

  it('recognises a preset by value and returns null for a custom mix', () => {
    expect(matchRulePreset({ ...DEFAULT_RULES })).toBe('forms')
    expect(matchRulePreset({ ...NONE })).toBe('species')
    expect(matchRulePreset({ ...ALL })).toBe('completionist')
    expect(matchRulePreset({ ...DEFAULT_RULES, mega: true })).toBeNull()
  })

  it('describes every rule', () => {
    expect(Object.keys(RULE_INFO).sort()).toEqual([...RULE_KEYS].sort())
  })
})

describe('buildSlots', () => {
  it('gives every species exactly its base slot when all rules are off', () => {
    const slots = buildSlots(dex, NONE)
    expect(slots.map((s) => s.key)).toEqual(dex.speciesList.map((s) => String(s.id)))
    expect(slots.every((s) => s.form === 0 && s.cat === 'base')).toBe(true)
  })

  it.each<[keyof DexRules, number]>([
    ['regional', 25], // + Alolan Raichu
    ['genderForms', 25], // + Meowstic (Female)
    ['genderDiffs', 29], // Venusaur, Pikachu, Raichu, Eevee, Meowstic split in two
    ['cosmetic', 76], // + 27 Unown, 17 Vivillon, 8 Alcremie creams
    ['changeable', 46], // + 5 Rotom, 17 Arceus
    ['fusion', 26], // + 2 Kyurem
    ['event', 35], // + 8 cap Pikachu, Spiky-eared Pichu, Fancy and Poké Ball Vivillon
    ['partner', 26], // + partner Pikachu and Eevee
    ['alcremieSweets', 30], // Alcremie's one slot becomes 7
    ['mega', 31], // + Venusaur, Raichu x2, Mewtwo x2, Meowstic x2
    ['battle', 25], // + Crowned Zacian
    ['gmax', 28] // + Venusaur, Pikachu, Eevee, Alcremie
  ])('rule %s alone yields %i slots', (rule, count) => {
    expect(buildSlots(dex, only(rule))).toHaveLength(count)
  })

  it('counts the default and the completionist dex', () => {
    expect(buildSlots(dex, DEFAULT_RULES)).toHaveLength(104)
    expect(buildSlots(dex, ALL)).toHaveLength(193)
  })

  it('never slots hidden forms', () => {
    const slots = buildSlots(dex, ALL)
    expect(slots.some((s) => s.cat === 'hidden')).toBe(false)
    expect(keysOf(slots, ID.koraidon)).toEqual(['1007'])
    expect(keysOf(slots, ID.scatterbug)).toEqual(['664'])
    expect(keysOf(slots, ID.arceus)).not.toContain('493-18')
  })

  it('orders slots by national dex number, then by form', () => {
    const slots = buildSlots(dex, ALL)
    for (let i = 1; i < slots.length; i++) {
      const a = slots[i - 1]!
      const b = slots[i]!
      expect(a.species < b.species || (a.species === b.species && a.form <= b.form)).toBe(true)
    }
    expect(keysOf(slots, ID.pikachu)).toEqual(['25:m', '25:f', '25:gmax', '25-1', '25-2', '25-3', '25-4', '25-5', '25-6', '25-7', '25-8', '25-9'])
  })

  it('keys non-base forms as species-form', () => {
    expect(keysOf(buildSlots(dex, only('regional')), ID.raichu)).toEqual(['26', '26-1'])
    expect(find(only('regional'), '26-1')).toMatchObject({ species: 26, form: 1, cat: 'regional', label: 'Alolan Raichu' })
  })

  it('returns the same array for equal rules', () => {
    expect(buildSlots(dex, { ...DEFAULT_RULES })).toBe(buildSlots(dex, { ...DEFAULT_RULES }))
    expect(buildSlots(dex, NONE)).not.toBe(buildSlots(dex, DEFAULT_RULES))
  })

  describe('gender differences', () => {
    it('splits a slot whose form has a female render into male and female', () => {
      const slots = buildSlots(dex, only('genderDiffs'))
      expect(keysOf(slots, ID.pikachu)).toEqual(['25:m', '25:f'])
      const male = find(only('genderDiffs'), '25:m')
      const female = find(only('genderDiffs'), '25:f')
      expect(male).toMatchObject({ gender: 'm', label: 'Pikachu ♂' })
      expect(female).toMatchObject({ gender: 'f', label: 'Pikachu ♀' })
      expect(male.spritePath(false)).toBe('25.png')
      expect(female.spritePath(false)).toBe('female/25.png')
      expect(female.spritePath(true)).toBe('shiny/female/25.png')
    })

    it('leaves species without a gender difference alone', () => {
      expect(keysOf(buildSlots(dex, only('genderDiffs')), ID.bulbasaur)).toEqual(['1'])
      expect(keysOf(buildSlots(dex, only('genderDiffs')), ID.mewtwo)).toEqual(['150'])
    })

    it('splits only the forms that have a female render', () => {
      // Alolan Raichu has no female render, base Raichu does.
      expect(keysOf(buildSlots(dex, only('genderDiffs', 'regional')), ID.raichu)).toEqual(['26:m', '26:f', '26-1'])
      // Mega Venusaur and cap Pikachu neither.
      expect(keysOf(buildSlots(dex, only('genderDiffs', 'mega')), ID.venusaur)).toEqual(['3:m', '3:f', '3-1'])
    })

    it('does not split a species whose genders are separate forms with their own slots', () => {
      expect(keysOf(buildSlots(dex, only('genderDiffs', 'genderForms')), ID.meowstic)).toEqual(['678', '678-1'])
      expect(keysOf(buildSlots(dex, only('genderDiffs')), ID.meowstic)).toEqual(['678:m', '678:f'])
      expect(keysOf(buildSlots(dex, only('genderForms')), ID.meowstic)).toEqual(['678', '678-1'])
    })
  })

  describe('gender forms', () => {
    it('labels and tags each form with the gender it implies', () => {
      expect(find(DEFAULT_RULES, '678')).toMatchObject({ label: 'Meowstic (Male)', gender: 'm', cat: 'base' })
      expect(find(DEFAULT_RULES, '678-1')).toMatchObject({ label: 'Meowstic (Female)', gender: 'f', cat: 'gender' })
      expect(find(DEFAULT_RULES, '678-1').spritePath(false)).toBe('10025.png')
    })

    it('names a lone base slot after the species', () => {
      const slot = find(NONE, '678')
      expect(slot.label).toBe('Meowstic')
      expect(slot.gender).toBeUndefined()
    })

    it('makes each half of a gender split the form bound to that gender when the rule is off', () => {
      const rules = only('genderDiffs')
      expect(find(rules, '678:m')).toMatchObject({ label: 'Meowstic ♂', gender: 'm', form: 0, cat: 'base' })
      expect(find(rules, '678:f')).toMatchObject({ label: 'Meowstic ♀', gender: 'f', form: 1, cat: 'base' })
      expect(find(rules, '678:m').spritePath(false)).toBe('678.png')
      expect(find(rules, '678:f').spritePath(true)).toBe('shiny/10025.png')
      expect(slotTarget(find(rules, '678:f'))).toEqual({ species: 678, form: 1, gender: 'f' })
      // With other Meowstic slots around, the halves go by their form names.
      const withMega = only('genderDiffs', 'mega')
      expect(keysOf(buildSlots(dex, withMega), ID.meowstic)).toEqual(['678:m', '678:f', '678-2', '678-3'])
      expect(find(withMega, '678:m').label).toBe('Meowstic (Male)')
      expect(find(withMega, '678:f').label).toBe('Meowstic (Female)')
      expect(find(withMega, '678-3')).toMatchObject({ label: 'Mega Meowstic (Female)', gender: 'f', cat: 'mega' })
      // Ordinary gender differences keep the symbols.
      expect(find(only('genderDiffs', 'regional'), '26:f').label).toBe('Raichu ♀')
    })
  })

  describe('variants', () => {
    it('turns each slotted form with variants into one slot per variant', () => {
      const slots = buildSlots(dex, only('alcremieSweets', 'cosmetic'))
      const alcremie = keysOf(slots, ID.alcremie)
      expect(alcremie).toHaveLength(63)
      expect(alcremie.slice(0, 8)).toEqual(['869:v0', '869:v1', '869:v2', '869:v3', '869:v4', '869:v5', '869:v6', '869-1:v0'])
      expect(alcremie).not.toContain('869')
      expect(alcremie).not.toContain('869-1')
    })

    it('labels and draws the variant', () => {
      const slot = find(only('alcremieSweets', 'cosmetic'), '869-1:v3')
      expect(slot).toMatchObject({ species: 869, form: 1, variant: 3, label: 'Alcremie (Ruby Cream) · Star Sweet', cat: 'cosmetic' })
      expect(slot.spritePath(false)).toBe('869-ruby-cream-star-sweet.png')
      expect(slot.spritePath(true)).toBe('shiny/869-ruby-cream-star-sweet.png')
      expect(find(only('alcremieSweets'), '869:v0').spritePath(false)).toBe('869.png')
    })

    it('only affects forms that are slotted', () => {
      expect(keysOf(buildSlots(dex, only('alcremieSweets')), ID.alcremie)).toHaveLength(7)
      expect(keysOf(buildSlots(dex, only('cosmetic')), ID.alcremie)).toHaveLength(9)
    })
  })

  describe('gigantamax', () => {
    it('adds a G-Max slot after each slotted form that can Gigantamax', () => {
      expect(keysOf(buildSlots(dex, only('gmax')), ID.pikachu)).toEqual(['25', '25:gmax'])
      expect(keysOf(buildSlots(dex, only('gmax')), ID.raichu)).toEqual(['26'])
      const slot = find(only('gmax'), '25:gmax')
      expect(slot).toMatchObject({ gmax: true, form: 0, label: 'Gigantamax Pikachu' })
      expect(slot.gender).toBeUndefined()
      expect(slot.spritePath(false)).toBe('10199.png')
      expect(slot.spritePath(true)).toBe('shiny/10199.png')
    })

    it('adds one per form, not per variant or gender', () => {
      const alcremie = keysOf(buildSlots(dex, ALL), ID.alcremie)
      expect(alcremie.filter((k) => k.endsWith(':gmax'))).toHaveLength(9)
      expect(alcremie).toHaveLength(72)
      expect(keysOf(buildSlots(dex, only('gmax', 'genderDiffs')), ID.eevee)).toEqual(['133:m', '133:f', '133:gmax'])
    })

    it('skips forms that are not slotted', () => {
      expect(keysOf(buildSlots(dex, only('gmax')), ID.alcremie)).toEqual(['869', '869:gmax'])
    })
  })

  describe('labels and renders', () => {
    it('shows a lone base slot as the species, with the species default render', () => {
      const vivillon = find(NONE, '666')
      expect(vivillon.label).toBe('Vivillon')
      expect(vivillon.spritePath(false)).toBe('666.png')
      expect(vivillon.spritePath(true)).toBe('shiny/666.png')
      expect(find(NONE, '201').label).toBe('Unown')
    })

    it('shows the base slot as form 0 once other forms have slots', () => {
      const vivillon = find(only('cosmetic'), '666')
      expect(vivillon.label).toBe('Vivillon (Icy Snow)')
      expect(vivillon.spritePath(false)).toBe('666-icy-snow.png')
      expect(find(only('cosmetic'), '666-6').spritePath(false)).toBe('666.png')
      expect(find(only('cosmetic'), '201').label).toBe('Unown A')
      expect(find(only('cosmetic'), '201-1').label).toBe('Unown B')
    })

    it('falls back to the normal render when a form has no shiny one', () => {
      expect(find(only('event'), '25-1').spritePath(true)).toBe('10094.png')
      expect(find(only('event'), '25-7').spritePath(true)).toBe('shiny/10148.png')
    })
  })

  describe('forms that exist in no game', () => {
    const form = (f: number, cat: FormSummary['cat'], present: number[], extra: Partial<FormSummary> = {}): FormSummary => ({
      f, name: `F${f}`, full: `Testmon F${f}`, cat, types: ['normal'], sprite: '1', shiny: true, female: false, present, obtain: [], event: [], ...extra
    })
    const species: SpeciesSummary = {
      id: 7, slug: 'testmon', name: 'Testmon', genus: 'Test Pokémon', gen: 1, tags: [], genderRate: 4, genderDiff: false, family: 1,
      forms: [form(0, 'base', []), form(1, 'cosmetic', []), form(2, 'cosmetic', [0]), form(3, 'mega', [])]
    }
    const index: DexIndex = {
      meta: { builtAt: '', pkhexVersion: '', pokeapiCommit: '', spritesCommit: '', counts: { species: 1, forms: 4, rows: 0 } },
      games: ['red'], gameBalls: [[4]], species: [species]
    }
    const mini = new Dex(index)

    it('never get a slot, whatever the rules', () => {
      expect(buildSlots(mini, ALL).map((s) => s.key)).toEqual(['7', '7-2'])
      expect(isFormSlotted(species, species.forms[1]!, ALL)).toBe(false)
      expect(isFormSlotted(species, species.forms[2]!, ALL)).toBe(true)
    })

    it('still keep the base slot', () => {
      expect(isFormSlotted(species, species.forms[0]!, NONE)).toBe(true)
      expect(buildSlots(mini, NONE).map((s) => s.key)).toEqual(['7'])
    })

    it('send their entries to the base slot', () => {
      expect(slotKeyFor({ species: 7, form: 1 }, mini, ALL)).toBe('7')
      expect(slotKeyFor({ species: 7, form: 2 }, mini, ALL)).toBe('7-2')
    })
  })
})

describe('slotKeyFor', () => {
  it('returns null for a species the dataset does not know', () => {
    expect(key(DEFAULT_RULES, 9999)).toBeNull()
  })

  it('uses the form slot when its category is on', () => {
    expect(key(DEFAULT_RULES, ID.raichu, 1)).toBe('26-1')
    expect(key(DEFAULT_RULES, ID.unown, 5)).toBe('201-5')
    expect(key(DEFAULT_RULES, ID.rotom, 2)).toBe('479-2')
    expect(key(only('event'), ID.pichu, 1)).toBe('172-1')
  })

  it('falls back to the base slot when the form has no slot under the rules', () => {
    expect(key(NONE, ID.raichu, 1)).toBe('26') // species-only dex: Alolan Raichu fills Raichu
    expect(key(NONE, ID.unown, 5)).toBe('201')
    expect(key(DEFAULT_RULES, ID.mewtwo, 1)).toBe('150') // mega off
    expect(key(DEFAULT_RULES, ID.pikachu, 8)).toBe('25:m') // partner off, base is split
    expect(key(DEFAULT_RULES, ID.pichu, 1)).toBe('172')
    expect(key(ALL, ID.arceus, 18)).toBe('493') // hidden form
    expect(key(ALL, ID.koraidon, 3)).toBe('1007')
  })

  it('falls back to the base slot for a form index the dataset does not know', () => {
    expect(key(ALL, ID.bulbasaur, 99)).toBe('1')
  })

  it('puts unknown and genderless entries in the male slot of a gender split', () => {
    expect(key(DEFAULT_RULES, ID.pikachu)).toBe('25:m')
    expect(key(DEFAULT_RULES, ID.pikachu, 0, { gender: 'n' })).toBe('25:m')
    expect(key(DEFAULT_RULES, ID.pikachu, 0, { gender: 'm' })).toBe('25:m')
    expect(key(DEFAULT_RULES, ID.pikachu, 0, { gender: 'f' })).toBe('25:f')
  })

  it('ignores gender where the slot is not split', () => {
    expect(key(DEFAULT_RULES, ID.bulbasaur, 0, { gender: 'f' })).toBe('1')
    expect(key(DEFAULT_RULES, ID.raichu, 1, { gender: 'f' })).toBe('26-1')
    expect(key(NONE, ID.pikachu, 0, { gender: 'f' })).toBe('25')
  })

  it('lets a female-bound form fill the female slot even without a gender', () => {
    const rules = only('genderDiffs')
    expect(key(rules, ID.meowstic, 1)).toBe('678:f')
    expect(key(rules, ID.meowstic, 0)).toBe('678:m')
    // The form decides, not a contradicting gender field.
    expect(key(rules, ID.meowstic, 1, { gender: 'm' })).toBe('678:f')
    expect(key(rules, ID.meowstic, 0, { gender: 'f' })).toBe('678:m')
  })

  it('maps gender forms to their own slots when the rule is on', () => {
    expect(key(DEFAULT_RULES, ID.meowstic, 0)).toBe('678')
    expect(key(DEFAULT_RULES, ID.meowstic, 1)).toBe('678-1')
    expect(key(NONE, ID.meowstic, 1)).toBe('678')
  })

  it('maps variants to per-variant slots only when the rule is on', () => {
    const sweets = only('alcremieSweets', 'cosmetic')
    expect(key(sweets, ID.alcremie, 1, { variant: 3 })).toBe('869-1:v3')
    expect(key(sweets, ID.alcremie, 1)).toBe('869-1:v0') // unknown variant counts as the first
    expect(key(sweets, ID.alcremie, 1, { variant: 42 })).toBe('869-1:v0')
    expect(key(only('cosmetic'), ID.alcremie, 1, { variant: 3 })).toBe('869-1')
    expect(key(NONE, ID.alcremie, 1, { variant: 3 })).toBe('869')
  })

  it('keeps the variant when the cream falls back to the base form', () => {
    expect(key(only('alcremieSweets'), ID.alcremie, 4, { variant: 5 })).toBe('869:v5')
  })

  it('maps Gigantamax entries to the G-Max slot only when the rule is on and the form has one', () => {
    expect(key(only('gmax'), ID.pikachu, 0, { gmax: true })).toBe('25:gmax')
    expect(key(only('gmax'), ID.pikachu, 0)).toBe('25')
    expect(key(NONE, ID.pikachu, 0, { gmax: true })).toBe('25')
    expect(key(DEFAULT_RULES, ID.pikachu, 0, { gmax: true, gender: 'f' })).toBe('25:f')
    expect(key(only('gmax'), ID.raichu, 0, { gmax: true })).toBe('26')
    expect(key(ALL, ID.pikachu, 0, { gmax: true, gender: 'f' })).toBe('25:gmax')
    expect(key(ALL, ID.alcremie, 2, { gmax: true, variant: 4 })).toBe('869-2:gmax')
    expect(key(only('gmax'), ID.alcremie, 2, { gmax: true })).toBe('869:gmax') // cream not slotted: base G-Max
  })

  it('always names a slot that exists, for every combination of rules', () => {
    // Every form, with each attribute that can change the slot.
    const probes: Array<Pick<CatchEntry, 'species' | 'form' | 'variant' | 'gender' | 'gmax'>> = []
    for (const species of dex.speciesList) {
      for (const form of [...species.forms.map((f) => f.f), 77]) {
        const info = dex.form(species.id, form)
        const genders = species.genderDiff ? ([undefined, 'm', 'f', 'n'] as const) : ([undefined] as const)
        const variants = info?.variants ? [undefined, 0, 6, 99] : [undefined]
        const gmaxes = species.forms.some((f) => f.gmax) ? [false, true] : [false]
        for (const gender of genders) for (const variant of variants) for (const gmax of gmaxes) probes.push({ species: species.id, form, gender, variant, gmax })
      }
    }
    expect(probes.length).toBeGreaterThan(250)

    let checked = 0
    for (let mask = 0; mask < 1 << RULE_KEYS.length; mask++) {
      const rules = Object.fromEntries(RULE_KEYS.map((k, i) => [k, (mask & (1 << i)) !== 0])) as unknown as DexRules
      const slots = buildSlots(dex, rules)
      const keys = new Set(slots.map((s) => s.key))
      if (keys.size !== slots.length) throw new Error(`duplicate slot keys for rules ${JSON.stringify(rules)}`)
      for (const species of dex.speciesList) {
        if (!slots.some((s) => s.species === species.id && s.form === species.forms[0]!.f && !s.gmax)) throw new Error(`no base slot for ${species.name}`)
      }
      for (const probe of probes) {
        const k = slotKeyFor(probe, dex, rules)
        if (k === null || !keys.has(k)) throw new Error(`slotKeyFor(${JSON.stringify(probe)}) = ${k} does not exist under ${JSON.stringify(rules)}`)
        checked++
      }
    }
    expect(checked).toBe(probes.length * 4096)
  })

  it('round-trips: an entry built from a slot target lands in that slot', () => {
    for (const rules of [NONE, DEFAULT_RULES, ALL, only('genderDiffs'), only('alcremieSweets', 'gmax')]) {
      for (const slot of buildSlots(dex, rules)) {
        expect(slotKeyFor(slotTarget(slot), dex, rules)).toBe(slot.key)
      }
    }
  })
})

describe('computeCollection', () => {
  it('reports an untouched dex', () => {
    const c = computeCollection(dex, makeSave())
    expect(c.totals).toEqual({ slots: 104, caught: 0, shiny: 0, species: 24, speciesCaught: 0 })
    expect(c.caught.size).toBe(0)
    expect(c.bySlot.size).toBe(0)
    expect(c.slots).toBe(buildSlots(dex, DEFAULT_RULES))
  })

  it('maps entries to slots and derives caught, shiny and species sets', () => {
    const a = makeEntry(ID.pikachu, 0, { gender: 'm' })
    const b = makeEntry(ID.pikachu, 0, { gender: 'f', shiny: true })
    const c1 = makeEntry(ID.raichu, 1, { shiny: true })
    const d1 = makeEntry(ID.bulbasaur)
    const d2 = makeEntry(ID.bulbasaur)
    const lost = makeEntry(9999)
    const c = computeCollection(dex, makeSave([a, b, c1, d1, d2, lost]))

    expect([...c.caught].sort()).toEqual(['1', '25:f', '25:m', '26-1'])
    expect([...c.caughtShiny].sort()).toEqual(['25:f', '26-1'])
    expect([...c.speciesCaught].sort((x, y) => x - y)).toEqual([1, 25, 26])
    expect([...c.speciesShiny].sort((x, y) => x - y)).toEqual([25, 26])
    expect(c.bySlot.get('1')).toEqual([d1, d2])
    expect(c.bySlot.get('25:f')).toEqual([b])
    expect(c.totals).toEqual({ slots: 104, caught: 4, shiny: 2, species: 24, speciesCaught: 3 })
    expect(c.unplaced).toEqual([lost])
    expect(c.slotOfEntry.get(c1.id)).toBe('26-1')
    expect(c.slotOfEntry.has(lost.id)).toBe(false)
  })

  it('needs a shiny entry in the slot itself to call it shiny', () => {
    const c = computeCollection(dex, makeSave([makeEntry(ID.raichu, 0, { shiny: true }), makeEntry(ID.raichu, 1)]))
    expect(c.caughtShiny.has('26:m')).toBe(true)
    expect(c.caught.has('26-1')).toBe(true)
    expect(c.caughtShiny.has('26-1')).toBe(false)
  })

  it('follows the rules of the save', () => {
    const entries = [makeEntry(ID.pikachu, 0, { gender: 'f' }), makeEntry(ID.raichu, 1), makeEntry(ID.unown, 3), makeEntry(ID.unown, 4)]
    const c = computeCollection(dex, makeSave(entries, NONE))
    expect([...c.caught].sort()).toEqual(['201', '25', '26'])
    expect(c.bySlot.get('201')).toHaveLength(2)
    expect(c.totals.slots).toBe(24)
    expect(c.rules).toEqual(NONE)
  })

  it('offers slot lookups', () => {
    const c = computeCollection(dex, makeSave())
    expect(c.slotByKey.get('26-1')?.label).toBe('Alolan Raichu')
    expect(c.slotsBySpecies.get(ID.raichu)?.map((s) => s.key)).toEqual(['26:m', '26:f', '26-1'])
    expect(c.slotByKey.size).toBe(c.slots.length)
  })

  it('reuses the latest result for identical inputs and recomputes for new ones', () => {
    const entries = [makeEntry(ID.eevee)]
    const rules = { ...DEFAULT_RULES }
    const first = collectionFor(dex, entries, rules)
    expect(collectionFor(dex, entries, rules)).toBe(first)
    const more = [...entries, makeEntry(ID.mewtwo)]
    const second = collectionFor(dex, more, rules)
    expect(second).not.toBe(first)
    expect(second.totals.caught).toBe(2)
    expect(first.totals.caught).toBe(1)
  })
})
