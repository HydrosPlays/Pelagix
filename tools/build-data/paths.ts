import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

export const ROOT = path.resolve(here, '..', '..')
export const PKHEX_DIR = path.join(ROOT, 'data', 'pkhex')
export const SOURCES_DIR = path.join(ROOT, 'data', 'sources')
export const UPSTREAM_DIR = path.join(SOURCES_DIR, 'pokeapi-upstream')
export const SNAPSHOT_CSV_DIR = path.join(ROOT, 'PokeAPI', 'data', 'v2', 'csv')
export const SPRITE_TREE_FILE = path.join(SOURCES_DIR, 'home-sprites-tree.json')
export const OUT_DIR = path.join(ROOT, 'src', 'renderer', 'public', 'data')
export const OUT_SPECIES_DIR = path.join(OUT_DIR, 'species')

/**
 * PokeAPI CSVs the build must read from the pinned upstream copy (ids in these tables changed
 * since the local snapshot was taken, so mixing snapshot rows in would be wrong).
 * tools/fetch-sources.ts downloads exactly this list.
 */
export const UPSTREAM_CSVS = [
  'pokemon',
  'pokemon_forms',
  'pokemon_form_names',
  'pokemon_form_types',
  'pokemon_species',
  'pokemon_species_names',
  'pokemon_types',
  'pokedexes',
  'pokemon_dex_numbers',
  'versions',
  'encounters',
  'encounter_slots',
  'encounter_methods',
  'location_areas',
  'location_names'
] as const

/**
 * CSVs the build may take from the local PokeAPI snapshot (species-keyed text, which upstream did
 * not renumber). A copy placed in data/sources/pokeapi-upstream still wins.
 */
export const SNAPSHOT_CSVS = ['pokemon_species_flavor_text'] as const
