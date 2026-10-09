/** Loads every build input: the PKHeX extract, the PokeAPI CSVs and the HOME sprite manifest. */
import fs from 'node:fs'
import path from 'node:path'
import { parseCsvRecords } from './csv.ts'
import type { CsvRecord } from './csv.ts'
import { PKHEX_DIR, SNAPSHOT_CSV_DIR, SNAPSHOT_CSVS, SPRITE_TREE_FILE, UPSTREAM_CSVS, UPSTREAM_DIR } from './paths.ts'
import type {
  PkBalls, PkEncounterFile, PkEvolution, PkFormsFile, PkGift, PkGoRow, PkLocations, PkMeta, PkStrings, Pair
} from './pkhex-types.ts'
import { assert, fail } from './util.ts'

function readJson<T>(file: string): T {
  if (!fs.existsSync(file)) fail(`Missing input ${file}. Run "npm run data:extract" first.`)
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T
}

export interface PkhexData {
  meta: PkMeta
  encounters: PkEncounterFile
  locations: PkLocations
  gifts: PkGift[]
  go: PkGoRow[]
  forms: PkFormsFile
  presence: Record<string, Pair[]>
  evolutions: Record<string, PkEvolution[]>
  eggs: Record<string, Pair[]>
  balls: Record<string, PkBalls>
  strings: PkStrings
}

export function loadPkhex(): PkhexData {
  const j = <T>(name: string): T => readJson<T>(path.join(PKHEX_DIR, name))
  const meta = j<PkMeta>('meta.json')
  assert(meta.schema === 1, `data/pkhex schema ${meta.schema} is not supported by this builder (expected 1)`)
  const data: PkhexData = {
    meta,
    encounters: j<PkEncounterFile>('encounters.json'),
    locations: j<PkLocations>('locations.json'),
    gifts: j<{ rows: PkGift[] }>('gifts.json').rows,
    go: j<{ rows: PkGoRow[] }>('go.json').rows,
    forms: j<PkFormsFile>('forms.json'),
    presence: j<Record<string, Pair[]>>('presence.json'),
    evolutions: j<Record<string, PkEvolution[]>>('evolutions.json'),
    eggs: j<Record<string, Pair[]>>('eggs.json'),
    balls: j<Record<string, PkBalls>>('balls.json'),
    strings: j<PkStrings>('strings.json')
  }
  assert(data.forms.rows.length === 1025, `forms.json has ${data.forms.rows.length} species, expected 1025`)
  data.forms.rows.forEach((row, i) => {
    assert(row.s === i + 1, `forms.json row ${i} is species ${row.s}`)
    row.forms.forEach((form, f) => assert(form.f === f, `forms.json species ${row.s} form index ${f} is ${form.f}`))
  })
  return data
}

export type CsvSource = 'upstream' | 'snapshot'

export class CsvStore {
  readonly used = new Map<string, CsvSource>()
  private readonly cache = new Map<string, CsvRecord[]>()

  /** Reads a PokeAPI table: the pinned upstream copy when the build requires one, else the snapshot. */
  table(name: string): CsvRecord[] {
    const cached = this.cache.get(name)
    if (cached) return cached
    const upstream = path.join(UPSTREAM_DIR, `${name}.csv`)
    const snapshot = path.join(SNAPSHOT_CSV_DIR, `${name}.csv`)
    let file: string
    let source: CsvSource
    if ((UPSTREAM_CSVS as readonly string[]).includes(name)) {
      if (!fs.existsSync(upstream)) fail(`Missing ${upstream}. Run "node tools/fetch-sources.ts".`)
      file = upstream
      source = 'upstream'
    } else if ((SNAPSHOT_CSVS as readonly string[]).includes(name)) {
      // Upstream-first, as for every table; the snapshot is the documented fallback.
      if (fs.existsSync(upstream)) {
        file = upstream
        source = 'upstream'
      } else {
        if (!fs.existsSync(snapshot)) fail(`Missing ${snapshot}`)
        file = snapshot
        source = 'snapshot'
      }
    } else {
      fail(`CSV "${name}" is not declared in tools/build-data/paths.ts`)
    }
    const records = parseCsvRecords(fs.readFileSync(file, 'utf8'), `${name}.csv`)
    this.cache.set(name, records)
    this.used.set(name, source)
    return records
  }
}

/** Existence manifest of the HOME renders at the pinned sprites commit. */
export class SpriteManifest {
  private readonly base = new Set<string>()
  private readonly shiny = new Set<string>()
  private readonly female = new Set<string>()
  private readonly shinyFemale = new Set<string>()
  /** Git blob hash of each plain render: two keys with the same hash are the same picture. */
  private readonly blobs = new Map<string, string>()

  constructor() {
    const tree = readJson<{ truncated: boolean; tree: { path: string; type: string; sha: string }[] }>(SPRITE_TREE_FILE)
    assert(tree.truncated === false, 'home-sprites-tree.json is a truncated listing')
    for (const entry of tree.tree) {
      if (entry.type !== 'blob') continue
      const m = /^(shiny\/)?(female\/)?([^/]+)\.png$/.exec(entry.path)
      if (!m) fail(`Unexpected path in home-sprites-tree.json: ${entry.path}`)
      const key = m[3]
      if (m[1] && m[2]) this.shinyFemale.add(key)
      else if (m[1]) this.shiny.add(key)
      else if (m[2]) this.female.add(key)
      else {
        this.base.add(key)
        this.blobs.set(key, entry.sha)
      }
    }
    assert(this.base.size > 1500, `HOME manifest only lists ${this.base.size} renders`)
  }

  has(key: string): boolean {
    return this.base.has(key)
  }

  /** Content hash of a render; fails when the manifest does not have it. */
  blob(key: string): string {
    return this.blobs.get(key) ?? fail(`home-sprites-tree.json has no blob hash for ${key}.png`)
  }

  hasShiny(key: string): boolean {
    return this.shiny.has(key)
  }

  /** A female render exists (the shiny female one too, whenever a shiny render exists at all). */
  hasFemale(key: string): boolean {
    return this.female.has(key) && (!this.shiny.has(key) || this.shinyFemale.has(key))
  }

  get size(): number {
    return this.base.size
  }
}
