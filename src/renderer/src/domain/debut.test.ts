/**
 * Debut-generation order ("origin dex") on the real dataset (public/data, built by `npm run data`);
 * skipped when it has not been built. The preference parsing runs on its own.
 */

import { describe, expect, it } from 'vitest'
import type { DexIndex } from '@shared/dex-types'
import { boxRange, buildBoxes, computeStats, generationSpans, romanNumeral, slotGenerations } from '@renderer/features/living/model'
import { DEFAULT_LIVING_PREFS, orderOf, parseLivingPrefs } from '@renderer/features/living/prefs'
import { Dex, validateDexIndex } from '@renderer/lib/data'
import { debutGenerationsOf, debutOrder, formDebutGeneration, inDebutOrder, orderedCollection, slotDebutGeneration } from './debut'
import { gameCollection, NO_POKEDEXES } from './gamedex'
import { buildSlots, collectionFor, RULE_PRESETS } from './slots'

const indexModules = import.meta.glob<DexIndex>('../../public/data/dex.json', { eager: true, import: 'default' })
const raw = Object.values(indexModules)[0]

const FORMS = RULE_PRESETS.forms.rules
const ALL = RULE_PRESETS.completionist.rules

describe('order preference', () => {
  it('reads a value stored before the order existed as National order', () => {
    const old = parseLivingPrefs({ view: 'list', missingOnly: true, seen: { rules: '1100', slots: 1367 } })
    expect(old).toEqual({ view: 'list', missingOnly: true, seen: { rules: '1100', slots: 1367 } })
    expect(orderOf(old)).toBe('national')
    expect(orderOf(DEFAULT_LIVING_PREFS)).toBe('national')
  })

  it('keeps a stored order and drops a malformed one', () => {
    expect(orderOf(parseLivingPrefs({ view: 'boxes', order: 'debut' }))).toBe('debut')
    expect(orderOf(parseLivingPrefs({ order: 'national' }))).toBe('national')
    expect(parseLivingPrefs({ order: 'origin' })).toEqual(DEFAULT_LIVING_PREFS)
    expect(orderOf(parseLivingPrefs({ order: 7 }))).toBe('national')
  })
})

describe.skipIf(!raw)('debut generation on the real dataset', () => {
  const dex = raw ? new Dex(validateDexIndex(raw)) : (undefined as never)
  const debut = (species: number, form = 0): number => {
    const s = dex.species(species)
    const f = dex.form(species, form)
    if (!s || !f) throw new Error(`no form ${species}-${form}`)
    return formDebutGeneration(dex, s, f)
  }

  it('dates each form by the first game that has it', () => {
    expect([debut(52), debut(52, 1), debut(52, 2)]).toEqual([1, 7, 8]) // Meowth, Alolan, Galarian
    expect(debut(58, 1)).toBe(8) // Hisuian Growlithe: Legends: Arceus is Generation VIII
    expect([debut(128, 1), debut(128, 2), debut(128, 3)]).toEqual([9, 9, 9]) // Paldean Tauros
    expect(debut(6, 1)).toBe(6) // Mega Charizard X
    expect(debut(658, 3)).toBe(9) // Mega Greninja, Legends: Z-A
    for (const f of [1, 2, 3, 4, 5]) expect(debut(479, f)).toBe(4) // Rotom forms
    for (const f of [1, 2, 3]) expect(debut(386, f)).toBe(3) // Deoxys forms
    expect(debut(487, 1)).toBe(4) // Origin Forme Giratina
    for (const f of [1, 2, 3, 4, 5, 6, 7]) expect(debut(25, f)).toBe(7) // Pikachu in a cap
    expect(debut(25, 8)).toBe(7) // Partner Pikachu
    expect(debut(172, 1)).toBe(4) // Spiky-eared Pichu
    expect(debut(658, 2)).toBe(7) // Ash-Greninja
    expect(debut(718, 1)).toBe(7) // Zygarde 10%
    expect(debut(901, 1)).toBe(9) // Bloodmoon Ursaluna
  })

  it('is never earlier than the species', () => {
    for (const species of dex.speciesList) for (const form of species.forms) expect(formDebutGeneration(dex, species, form), form.full).toBeGreaterThanOrEqual(species.gen)
  })

  it('dates every Gigantamax slot to Generation VIII, and the other slots by their form', () => {
    const slots = buildSlots(dex, ALL)
    const gmax = slots.filter((slot) => slot.gmax)
    expect(gmax.length).toBeGreaterThan(30)
    for (const slot of gmax) expect(slotDebutGeneration(dex, slot), slot.key).toBe(8)
    // A ♀ half and an Alcremie sweet follow their form.
    const female = slots.find((slot) => slot.key.endsWith(':f'))
    if (female) expect(slotDebutGeneration(dex, female)).toBe(debut(female.species, Number(female.key.split(':')[0]?.split('-')[1] ?? 0)))
    const sweet = slots.find((slot) => slot.key.startsWith('869-') && slot.variant !== undefined)
    expect(sweet && slotDebutGeneration(dex, sweet)).toBe(8)
  })

  describe('slot order', () => {
    const national = buildSlots(dex, FORMS)
    const slots = debutOrder(dex, national)
    const at = (key: string): number => slots.findIndex((slot) => slot.key === key)

    it('runs by debut generation, then National order, with the same slots', () => {
      expect(debutOrder(dex, national)).toBe(slots)
      expect(slots).toHaveLength(national.length)
      expect(new Set(slots)).toEqual(new Set(national))
      const gens = debutGenerationsOf(slots)
      expect(gens).toBeDefined()
      for (let i = 1; i < slots.length; i++) {
        const before = slots[i - 1]!
        const slot = slots[i]!
        expect(gens![i]! > gens![i - 1]! || (gens![i] === gens![i - 1] && slot.species >= before.species), slot.key).toBe(true)
      }
      expect(debutGenerationsOf(national)).toBeUndefined()
    })

    it('puts Alolan Meowth in Generation VII ahead of Rowlet, and Galarian Meowth in VIII', () => {
      const gens = slotGenerations(dex, slots)
      expect(gens[at('52')]).toBe(1)
      expect(gens[at('52-1')]).toBe(7)
      expect(gens[at('722')]).toBe(7)
      expect(at('52-1')).toBeLessThan(at('722'))
      expect(gens[at('52-2')]).toBe(8)
      // Generation VII opens with the first Alolan form, not with Rowlet.
      const seven = generationSpans(dex, slots).find((span) => span.gen === 7)
      expect(slots[seven?.start ?? -1]?.key).toBe('19-1')
      // Forms of one species keep their form order within a generation.
      expect(at('52-1')).toBeLessThan(at('53-1'))
    })

    it('names boxes by the generations they hold', () => {
      const boxes = buildBoxes(slots)
      expect(boxes[0]?.gens).toEqual([1, 1])
      expect(boxRange(boxes[0]!)).toBe('Gen I')
      const span = boxes.find((box) => box.gens && box.gens[0] !== box.gens[1])
      expect(span).toBeDefined()
      expect(boxRange(span!)).toBe(`Gen ${romanNumeral(span!.gens![0])} – ${romanNumeral(span!.gens![1])}`)
      const firstTwo = boxes.find((box) => box.gens?.[0] === 1 && box.gens[1] === 2)
      expect(firstTwo && boxRange(firstTwo)).toBe('Gen I – II')
      // Same packing as National order: thirty to a box.
      expect(boxes.map((box) => box.slots.length)).toEqual(buildBoxes(national).map((box) => box.slots.length))
      // National order keeps its number ranges.
      expect(boxRange(buildBoxes(national)[0]!)).toBe('#0001 – #0024')
    })

    it('counts and targets the generation chips by debut generation', () => {
      const stats = computeStats(dex, slots, new Set())
      const nationalStats = computeStats(dex, national, new Set())
      expect(stats.slots).toBe(nationalStats.slots)
      const seven = stats.gens.find((g) => g.gen === 7)
      expect(seven?.start).toBe(at('19-1'))
      // Alolan forms count in VII here, in I in National order.
      expect(seven!.slots).toBeGreaterThan(nationalStats.gens.find((g) => g.gen === 7)!.slots)
      expect(stats.gens.reduce((n, g) => n + g.slots, 0)).toBe(slots.length)
      for (const g of stats.gens) expect(slotGenerations(dex, slots)[g.start]).toBe(g.gen)
    })
  })

  it('leaves totals alone and a game view in its own order', () => {
    const base = collectionFor(dex, [], FORMS)
    const ordered = inDebutOrder(dex, base)
    expect(ordered.totals).toBe(base.totals)
    expect(orderedCollection(dex, base, 'debut', false)).toBe(ordered)
    expect(orderedCollection(dex, base, 'national', false)).toBe(base)
    const game = gameCollection(dex, NO_POKEDEXES, base, 'sword').collection
    expect(orderedCollection(dex, game, 'debut', true)).toBe(game)
  })
})
