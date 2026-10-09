/**
 * Species tags. Legendary / mythical / baby come from PokeAPI's pokemon_species; the rest are
 * curated national-number lists (there is no data source for them).
 */
import type { SpeciesTag } from '../../src/shared/dex-types.ts'
import type { CsvRecord } from './csv.ts'

const range = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_, i) => from + i)

/** First-partner lines of every generation (all three stages). */
export const STARTER_SPECIES: ReadonlySet<number> = new Set([
  ...range(1, 9), ...range(152, 160), ...range(252, 260), ...range(387, 395), ...range(495, 503),
  ...range(650, 658), ...range(722, 730), ...range(810, 818), ...range(906, 914)
])

/** The first stage of each first-partner line. */
export const STARTER_BASE_SPECIES: ReadonlySet<number> = new Set([
  1, 4, 7, 152, 155, 158, 252, 255, 258, 387, 390, 393, 495, 498, 501, 650, 653, 656, 722, 725, 728, 810, 813, 816, 906, 909, 912
])

/** Pokémon revived from fossils, with their evolutions. */
export const FOSSIL_SPECIES: ReadonlySet<number> = new Set([
  ...range(138, 142), ...range(345, 348), ...range(408, 411), ...range(564, 567), ...range(696, 699), ...range(880, 883)
])

/** The species a fossil is revived into (the unevolved member of each fossil line). */
export const FOSSIL_REVIVED_SPECIES: ReadonlySet<number> = new Set([
  138, 140, 142, 345, 347, 408, 410, 564, 566, 696, 698, 880, 881, 882, 883
])

/** Final stages of the three-stage, 600 base-stat-total lines. */
export const PSEUDO_LEGENDARY_SPECIES: ReadonlySet<number> = new Set([149, 248, 373, 376, 445, 635, 706, 784, 887, 998])

export const ULTRA_BEAST_SPECIES: ReadonlySet<number> = new Set([...range(793, 799), ...range(803, 806)])

/** Ancient and future Paradox Pokémon (Koraidon and Miraidon are tagged legendary instead). */
export const PARADOX_ANCIENT: ReadonlySet<number> = new Set([984, 985, 986, 987, 988, 989, 1005, 1009, 1020, 1021])
export const PARADOX_FUTURE: ReadonlySet<number> = new Set([990, 991, 992, 993, 994, 995, 1006, 1010, 1022, 1023])

/** Native region of each generation's new species, as a RegionId. */
export const GENERATION_REGION: Readonly<Record<number, string>> = {
  1: 'kanto', 2: 'johto', 3: 'hoenn', 4: 'sinnoh', 5: 'unova', 6: 'kalos', 7: 'alola', 8: 'galar', 9: 'paldea'
}

export function speciesTags(id: number, species: CsvRecord): SpeciesTag[] {
  const tags: SpeciesTag[] = []
  if (species.is_legendary === '1') tags.push('legendary')
  if (species.is_mythical === '1') tags.push('mythical')
  if (species.is_baby === '1') tags.push('baby')
  if (STARTER_SPECIES.has(id)) tags.push('starter')
  if (FOSSIL_SPECIES.has(id)) tags.push('fossil')
  if (PSEUDO_LEGENDARY_SPECIES.has(id)) tags.push('pseudo-legendary')
  if (ULTRA_BEAST_SPECIES.has(id)) tags.push('ultra-beast')
  if (PARADOX_ANCIENT.has(id) || PARADOX_FUTURE.has(id)) tags.push('paradox')
  return tags
}
