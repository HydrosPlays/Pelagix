/**
 * Writes pokedexes.json: every regional Pokédex as the list of its species in regional order,
 * from the same pinned PokeAPI tables the species files take their `dex` numbers from. Runs on
 * its own and as the last step of `npm run data:build`; it reads no other dataset and touches
 * no other file.
 *
 *   node tools/build-data/pokedexes.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import type { PokedexFile } from '../../src/shared/pokedexes.ts'
import { GAME_POKEDEXES, POKEDEX_NAMES } from '../../src/shared/pokedexes.ts'
import { loadDexNumbers } from './details.ts'
import { OUT_DIR } from './paths.ts'
import { CsvStore } from './sources.ts'
import { BuildError, assert, formatBytes } from './util.ts'

export const POKEDEXES_FILE = path.join(OUT_DIR, 'pokedexes.json')

/** Species of every regional Pokédex, ordered by regional number (then national number, for species sharing one). */
export function orderPokedexes(numbers: ReadonlyMap<number, Readonly<Record<string, number>>>): Record<string, number[]> {
  const lists = new Map<string, { species: number; no: number }[]>()
  for (const [species, record] of numbers) {
    for (const [name, no] of Object.entries(record)) {
      let list = lists.get(name)
      if (!list) lists.set(name, (list = []))
      list.push({ species, no })
    }
  }
  const out: Record<string, number[]> = {}
  for (const name of [...lists.keys()].sort()) {
    out[name] = (lists.get(name) ?? []).sort((a, b) => a.no - b.no || a.species - b.species).map((e) => e.species)
  }
  return out
}

function main(): void {
  const pokedexes = orderPokedexes(loadDexNumbers(new CsvStore()))
  for (const [game, names] of Object.entries(GAME_POKEDEXES)) {
    for (const name of names) {
      assert(pokedexes[name] !== undefined, `Game "${game}" names the Pokédex "${name}", which PokeAPI does not have`)
      assert(POKEDEX_NAMES[name] !== undefined, `Pokédex "${name}" has no display name in src/shared/pokedexes.ts`)
    }
  }
  const file: PokedexFile = { v: 1, pokedexes }
  const text = JSON.stringify(file)
  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.writeFileSync(POKEDEXES_FILE, text)
  console.log(`pokedexes.json: ${Object.keys(pokedexes).length} Pokédexes, ${formatBytes(Buffer.byteLength(text))}`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  try {
    main()
  } catch (error) {
    if (!(error instanceof BuildError)) throw error
    console.error(`BUILD FAILED: ${error.message}`)
    process.exit(1)
  }
}
