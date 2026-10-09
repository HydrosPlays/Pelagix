/** Per-species detail data from PokeAPI: one Pokédex entry, size and regional dex numbers. */
import type { CsvStore } from './sources.ts'
import { fail, int } from './util.ts'

const ENGLISH = '9'

/** Collapses the hard line breaks, form feeds and soft hyphens (U+00AD) of in-game Pokédex text. */
export function cleanFlavor(text: string): string {
  return text
    .replace(/\xad[\n\f\r]+/g, '') // a soft hyphen at a line end splits one word
    .replace(/\xad/g, '')
    .replace(/-[\n\f\r]+(?=\p{Ll})/gu, '-') // a hard-hyphenated compound keeps its hyphen
    .replace(/[\n\f\r\t\xa0]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim()
    .replace(/^([^"]*)"$/, '$1') // a stray closing quote left by a malformed CSV row
}

/** One English entry per species: the one from the most recent game that has one. */
export function loadFlavor(csv: CsvStore): Map<number, string> {
  const best = new Map<number, { version: number; text: string }>()
  for (const r of csv.table('pokemon_species_flavor_text')) {
    if (r.language_id !== ENGLISH) continue
    const species = int(r.species_id, 'pokemon_species_flavor_text.species_id')
    const version = int(r.version_id, 'pokemon_species_flavor_text.version_id')
    const text = cleanFlavor(r.flavor_text)
    if (text === '') continue
    const current = best.get(species)
    if (!current || version > current.version) best.set(species, { version, text })
  }
  const out = new Map<number, string>()
  for (let s = 1; s <= 1025; s++) {
    const entry = best.get(s)
    if (!entry) fail(`Species ${s} has no English Pokédex entry`)
    out.set(s, entry.text)
  }
  return out
}

/** Regional dex numbers per species, keyed by pokedex identifier (main-series dexes, national excluded). */
export function loadDexNumbers(csv: CsvStore): Map<number, Record<string, number>> {
  const dexes = new Map<string, string>()
  for (const r of csv.table('pokedexes')) {
    if (r.is_main_series === '1' && r.identifier !== 'national') dexes.set(r.id, r.identifier)
  }
  const out = new Map<number, Record<string, number>>()
  // Stable key order: by pokedex id, which follows release order.
  const rows = [...csv.table('pokemon_dex_numbers')].sort((a, b) => int(a.pokedex_id, 'pokedex_id') - int(b.pokedex_id, 'pokedex_id'))
  for (const r of rows) {
    const identifier = dexes.get(r.pokedex_id)
    if (!identifier) continue
    const species = int(r.species_id, 'pokemon_dex_numbers.species_id')
    let record = out.get(species)
    if (!record) out.set(species, (record = {}))
    record[identifier] = int(r.pokedex_number, 'pokemon_dex_numbers.pokedex_number')
  }
  return out
}

export interface PokemonSize {
  /** Metres. */
  height: number
  /** Kilograms. */
  weight: number
}

export function loadSizes(csv: CsvStore): Map<number, PokemonSize> {
  const out = new Map<number, PokemonSize>()
  for (const r of csv.table('pokemon')) {
    // PokeAPI stores decimetres and hectograms.
    out.set(int(r.id, 'pokemon.id'), { height: int(r.height, 'pokemon.height') / 10, weight: int(r.weight, 'pokemon.weight') / 10 })
  }
  return out
}
