/**
 * Checks the real dataset (public/data, built by `npm run data`) against everything the app
 * assumes about it. Skipped when the dataset has not been built. No counts are pinned here: the
 * numbers move with every data build, the invariants must not.
 */

import { describe, expect, it } from 'vitest'
import type { DexIndex, SpeciesDetail } from '@shared/dex-types'
import type { DexRules } from '@shared/save-types'
import { Dex, validateDexIndex, validateSpeciesDetail } from '@renderer/lib/data'
import { getDexSearch } from '@renderer/lib/search'
import { speciesSpritePath } from '@renderer/lib/sprites'
import { checkEntry } from '@renderer/lib/storage'
import { makeEntry, makeSave } from '@renderer/lib/test-fixture'
import { presetFromBreed, presetFromEvolve, presetFromRow, sourcesByGame } from './encounters'
import { computeProgress } from './progress'
import { buildSlots, computeCollection, RULE_KEYS, RULE_PRESETS, slotKeyFor, slotTarget } from './slots'

const indexModules = import.meta.glob<DexIndex>('../../public/data/dex.json', { eager: true, import: 'default' })
const detailLoaders = import.meta.glob<SpeciesDetail>('../../public/data/species/*.json', { import: 'default' })
const raw = Object.values(indexModules)[0]

/** What the main process accepts after `sprite://home/` (see main/sprite-request.ts). */
const SPRITE_PATH = /^(?:shiny\/)?(?:female\/)?[a-z0-9-]+\.png$/
const STAMP = '2026-01-01T00:00:00.000Z'
const isCleanEntry = (preset: object): boolean => {
  const check = checkEntry({ shiny: false, ...preset, id: 'x', createdAt: STAMP }, STAMP)
  return check.entry !== null && !check.repaired
}

describe.skipIf(!raw)('real dataset', () => {
  const dex = raw ? new Dex(validateDexIndex(raw)) : (undefined as never)

  it('has a valid index that only names known games', () => {
    expect(dex.unknownGameIds).toEqual([])
    expect(dex.speciesList.length).toBeGreaterThan(1000)
    expect(dex.meta.counts.species).toBe(dex.speciesList.length)
    for (const species of dex.speciesList) {
      expect(species.forms[0], species.name).toMatchObject({ f: 0, cat: 'base' })
      for (const form of species.forms) {
        expect(dex.form(species.id, form.f), `${species.name} form ${form.f}`).toBe(form)
        expect(form.obtain.some((g) => form.event.includes(g)), `${form.full}: obtain and event overlap`).toBe(false)
      }
    }
  })

  it('yields unique slot keys, valid render paths and consistent entry mapping under any rules', () => {
    // Both extremes, the default, and a spread of mixed rule sets.
    const masks = [0, 4095, ...Array.from({ length: 24 }, (_, i) => (i * 2654435761) % 4096)]
    const ruleSets: DexRules[] = [
      RULE_PRESETS.forms.rules,
      ...masks.map((mask) => Object.fromEntries(RULE_KEYS.map((k, i) => [k, (mask & (1 << i)) !== 0])) as unknown as DexRules)
    ]
    for (const rules of ruleSets) {
      const slots = buildSlots(dex, rules)
      const keys = new Set(slots.map((s) => s.key))
      expect(keys.size, 'duplicate slot keys').toBe(slots.length)
      for (const slot of slots) {
        if (!SPRITE_PATH.test(slot.spritePath(false)) || !SPRITE_PATH.test(slot.spritePath(true))) throw new Error(`bad render path for slot ${slot.key}`)
        if (slotKeyFor(slotTarget(slot), dex, rules) !== slot.key) throw new Error(`slot ${slot.key} is not reachable through its own target`)
      }
      for (const species of dex.speciesList) {
        for (const form of species.forms) {
          const key = slotKeyFor({ species: species.id, form: form.f, gender: 'f', gmax: true, variant: 3 }, dex, rules)
          if (key === null || !keys.has(key)) throw new Error(`${form.full} maps to a missing slot (${key})`)
        }
      }
    }
    for (const species of dex.speciesList) expect(speciesSpritePath(species, true)).toMatch(SPRITE_PATH)
  })

  it('can be completed: one entry per slot fills the whole completionist dex', () => {
    const rules = RULE_PRESETS.completionist.rules
    const entries = buildSlots(dex, rules).map((slot) => makeEntry(slot.species, slot.form, { ...slotTarget(slot), date: '2026-01-01' }))
    const save = makeSave(entries, rules)
    const collection = computeCollection(dex, save)
    expect(collection.totals.caught).toBe(collection.totals.slots)
    expect(collection.unplaced).toEqual([])
    const progress = computeProgress(dex, save, collection, { now: new Date(2026, 0, 1) })
    expect(progress.totals.completion).toBe(1)
    expect(progress.families.complete).toBe(progress.families.total)
    expect(progress.nextUncaught).toEqual([])
  })

  it('is searchable by name and number', () => {
    const search = getDexSearch(dex)
    expect(search.search('pikachu')[0]?.species.id).toBe(25)
    expect(search.search('#0001')[0]?.species.id).toBe(1)
    expect(search.search('flabebe')[0]?.species.id).toBe(669)
    expect(search.search('mr mime')[0]?.species.id).toBe(122)
  })

  it('has a usable detail file for every species: every source turns into a clean entry', async () => {
    const files = Object.entries(detailLoaders)
    expect(files).toHaveLength(dex.speciesList.length)
    for (const [path, load] of files) {
      const id = Number(/(\d+)\.json$/.exec(path)?.[1])
      const species = dex.species(id)
      if (!species) throw new Error(`${path} has no species in dex.json`)
      const detail = validateSpeciesDetail(await load(), id)
      for (const node of detail.family) if (!dex.form(node.s, node.f)) throw new Error(`${species.name}: family names unknown form ${node.s}-${node.f}`)
      for (const form of species.forms) {
        if (!detail.forms[String(form.f)]) throw new Error(`${form.full}: no detail record`)
        for (const source of sourcesByGame(dex, detail, form)) {
          for (const row of source.rows) {
            if (row.l !== undefined && typeof detail.strings[row.l] !== 'string') throw new Error(`${form.full}: dangling location index`)
            if (!isCleanEntry(presetFromRow(id, form, source.game, detail, row))) throw new Error(`${form.full} in ${source.game.id}: ${row.k} row does not make a valid entry`)
            if (!dex.isObtainable(form, source.game.id) && !dex.isEventOnly(form, source.game.id)) throw new Error(`${form.full}: row in ${source.game.id}, which is neither in obtain nor in event`)
          }
          for (const evolve of source.evolve) if (!isCleanEntry(presetFromEvolve(id, form, source.game, evolve))) throw new Error(`${form.full}: bad evolution source`)
          if (source.breed && !isCleanEntry(presetFromBreed(id, form, source.game))) throw new Error(`${form.full}: bad breeding source`)
        }
      }
    }
  }, 120_000)
})
