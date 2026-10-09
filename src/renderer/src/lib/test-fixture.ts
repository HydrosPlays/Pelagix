/**
 * Test-only helpers: the development fixture (public/data-fixture) as a `Dex`, and terse builders
 * for entries and saves. Never import this from app code - it would bundle the fixture.
 */

import type { DexIndex, SpeciesDetail } from '@shared/dex-types'
import { createEmptySave, type CatchEntry, type DexRules, type SaveFile } from '@shared/save-types'
import { Dex } from './data'

// Loaded through Vite globs rather than TypeScript imports: the JSON lives outside the tsconfig
// `include`, and its inferred literal type would be useless anyway.
const indexModules = import.meta.glob<DexIndex>('../../public/data-fixture/dex.json', { eager: true, import: 'default' })
const detailModules = import.meta.glob<SpeciesDetail>('../../public/data-fixture/species/*.json', { eager: true, import: 'default' })

const [rawIndex] = Object.values(indexModules)
if (!rawIndex) throw new Error('public/data-fixture/dex.json is missing')

export const fixtureIndex: DexIndex = rawIndex
export const fixtureDex = new Dex(fixtureIndex, 'fixture')

/** Every species detail file of the fixture, by national dex number. */
export const fixtureDetails: ReadonlyMap<number, SpeciesDetail> = new Map(Object.values(detailModules).map((d) => [d.id, d]))

/** National dex numbers used throughout the tests. */
export const ID = {
  bulbasaur: 1, ivysaur: 2, venusaur: 3, pikachu: 25, raichu: 26, eevee: 133, mewtwo: 150, pichu: 172, unown: 201,
  rotom: 479, arceus: 493, kyurem: 646, scatterbug: 664, spewpa: 665, vivillon: 666, espurr: 677, meowstic: 678,
  milcery: 868, alcremie: 869, zacian: 888, sprigatito: 906, floragato: 907, meowscarada: 908, koraidon: 1007
} as const

let sequence = 0

/** A valid entry with a unique id and increasing timestamps; override anything through `extra`. */
export function makeEntry(species: number, form = 0, extra: Partial<CatchEntry> = {}): CatchEntry {
  sequence++
  const stamp = new Date(Date.UTC(2026, 0, 1, 12, 0, sequence)).toISOString()
  return { id: `e${sequence}`, species, form, shiny: false, game: 'scarlet', kind: 'wild', createdAt: stamp, updatedAt: stamp, ...extra }
}

/** A save holding `entries`, with the default rules patched by `rules`. */
export function makeSave(entries: CatchEntry[] = [], rules: Partial<DexRules> = {}): SaveFile {
  const save = createEmptySave('2026-01-01T00:00:00.000Z')
  return { ...save, entries, settings: { ...save.settings, rules: { ...save.settings.rules, ...rules } } }
}
