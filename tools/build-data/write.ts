/** Writes the datasets: dex.json and species/<id>.json, minified, after removing stale output. */
import fs from 'node:fs'
import path from 'node:path'
import type { DexIndex, SpeciesDetail } from '../../src/shared/dex-types.ts'
import { OUT_DIR, OUT_SPECIES_DIR } from './paths.ts'
import { assert } from './util.ts'

export interface WriteReport {
  dexBytes: number
  speciesBytes: number
  largest: { id: number; bytes: number }[]
}

export function writeDatasets(index: DexIndex, details: SpeciesDetail[]): WriteReport {
  assert(details.length === index.species.length, 'One detail file per species is required')
  fs.mkdirSync(OUT_SPECIES_DIR, { recursive: true })
  // Stale files from an earlier build (a removed species, an old layout) must not survive.
  for (const name of fs.readdirSync(OUT_SPECIES_DIR)) {
    if (name.endsWith('.json')) fs.rmSync(path.join(OUT_SPECIES_DIR, name))
  }
  fs.rmSync(path.join(OUT_DIR, 'dex.json'), { force: true })

  const sizes: { id: number; bytes: number }[] = []
  for (const detail of details) {
    const text = JSON.stringify(detail)
    fs.writeFileSync(path.join(OUT_SPECIES_DIR, `${detail.id}.json`), text)
    sizes.push({ id: detail.id, bytes: Buffer.byteLength(text) })
  }
  const dexText = JSON.stringify(index)
  fs.writeFileSync(path.join(OUT_DIR, 'dex.json'), dexText)

  sizes.sort((a, b) => b.bytes - a.bytes || a.id - b.id)
  return {
    dexBytes: Buffer.byteLength(dexText),
    speciesBytes: sizes.reduce((sum, s) => sum + s.bytes, 0),
    largest: sizes.slice(0, 5)
  }
}
