/**
 * Validates the built datasets (src/renderer/public/data) against the contract in
 * src/shared/dex-types.ts and against a table of known facts about the games.
 *
 *   node tools/build-data/validate.ts
 *
 * Exits non-zero and lists every failure when something is wrong.
 */
import fs from 'node:fs'
import path from 'node:path'
import { ABILITY_BY_ID } from '../../src/shared/abilities.ts'
import { BALL_BY_ID } from '../../src/shared/balls.ts'
import type {
  DexIndex, EncounterKind, EncounterRow, FormCategory, FormDetail, FormSummary, SpeciesDetail, SpeciesSummary
} from '../../src/shared/dex-types.ts'
import { GAMES } from '../../src/shared/games.ts'
import { POKEAPI_COMMIT, SPRITES_COMMIT } from '../../src/shared/sprites.ts'
import { FACTS } from './facts.ts'
import type { Fact } from './facts.ts'
import { GAME_POKEDEXES, POKEDEX_NAMES } from '../../src/shared/pokedexes.ts'
import type { PokedexFile } from '../../src/shared/pokedexes.ts'
import { OUT_DIR, OUT_SPECIES_DIR } from './paths.ts'
import { compareRows, isTimeLimited, rowIdentity } from './row-order.ts'
import { SpriteManifest } from './sources.ts'
import { TERM_LANGUAGES, TERMS_DIR } from './terms.ts'
import type { TermsFile } from './terms.ts'

const CATEGORIES: ReadonlySet<string> = new Set<FormCategory>([
  'base', 'regional', 'gender', 'cosmetic', 'changeable', 'fusion', 'event', 'partner', 'mega', 'battle', 'hidden'
])
const REGIONS: ReadonlySet<string> = new Set(['alola', 'galar', 'hisui', 'paldea'])
const TYPES: ReadonlySet<string> = new Set([
  'normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel', 'fire', 'water', 'grass', 'electric',
  'psychic', 'ice', 'dragon', 'dark', 'fairy', 'stellar'
])
const TAGS: ReadonlySet<string> = new Set(['legendary', 'mythical', 'baby', 'starter', 'fossil', 'pseudo-legendary', 'ultra-beast', 'paradox'])
const KINDS: ReadonlySet<string> = new Set<EncounterKind>([
  'wild', 'static', 'gift', 'egg', 'trade', 'raid', 'tera', 'outbreak', 'shadow', 'walker', 'dream', 'event'
])
const VIAS: ReadonlySet<string> = new Set(['stadium', 'stadium2', 'boxrubysapphire', 'colosseum', 'xd', 'ranch', 'ereader', 'ranger', 'home', 'go'])
const SPECIES_COUNT = 1025
const MAX_FAILURES_SHOWN = 80

/** Gold / Silver / Crystal maps that have Headbutt trees (PKHeX EncounterSlot2.TreeIndexes, by name). */
const JOHTO_HEADBUTT_PLACES: ReadonlySet<string> = new Set([
  'Azalea Town', 'Ilex Forest', 'Lake of Rage', 'Route 26', 'Route 27', 'Route 29', 'Route 30', 'Route 31', 'Route 32', 'Route 33',
  'Route 34', 'Route 35', 'Route 36', 'Route 37', 'Route 38', 'Route 39', 'Route 42', 'Route 43', 'Route 44'
])
const JOHTO_GAMES: ReadonlySet<string> = new Set(['gold', 'silver', 'crystal'])
const KALOS_GAMES: ReadonlySet<string> = new Set(['x', 'y'])
/** Legends: Arceus regions, as they appear in "Sub-area (Region)" location names. */
const HISUI_REGIONS = ['Obsidian Fieldlands', 'Crimson Mirelands', 'Cobalt Coastlands', 'Coronet Highlands', 'Alabaster Icelands']
/** Categories whose forms may share a picture with another form: they look the same by design. */
const SAME_LOOK_CATEGORIES: ReadonlySet<string> = new Set(['battle', 'event'])

const failures: string[] = []
let checks = 0
function check(condition: unknown, message: () => string): boolean {
  checks++
  if (!condition) failures.push(message())
  return Boolean(condition)
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v)
const isSortedUnique = (list: number[]): boolean => list.every((v, i) => i === 0 || list[i - 1] < v)
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Display text must be trimmed, printable and not a leaked identifier or stringified non-value. */
function badText(text: unknown, allowEmpty = false): string | undefined {
  if (typeof text !== 'string') return 'not a string'
  if (text === '') return allowEmpty ? undefined : 'empty'
  if (text !== text.trim()) return 'padded'
  if (/undefined|\bnull\b|\bNaN\b|\[object/.test(text)) return 'stringified non-value'
  if (/^[a-z0-9]+(-[a-z0-9]+)+$/.test(text)) return 'looks like an identifier'
  if (/[\x00-\x1f\x7f\xad]/.test(text) || text.includes(String.fromCharCode(0xfffd))) return 'control or replacement character'
  if (/ {2,}/.test(text)) return 'double space'
  return undefined
}

function readJson<T>(file: string): T | undefined {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T
  } catch (error) {
    failures.push(`${path.relative(OUT_DIR, file)}: ${error instanceof Error ? error.message : String(error)}`)
    return undefined
  }
}

const GAME_INDEX = new Map(GAMES.map((g, i) => [g.id, i]))
const GO = GAME_INDEX.get('go')!
const gameName = (i: number): string => GAMES[i]?.id ?? `#${i}`

function checkGameList(list: unknown, what: string): list is number[] {
  const ok = Array.isArray(list) && list.every((g) => isInt(g) && g >= 0 && g < GAMES.length) && isSortedUnique(list as number[])
  check(ok, () => `${what}: not an ascending list of valid game indices: ${JSON.stringify(list)}`)
  return ok
}

interface Loaded {
  index: DexIndex
  details: Map<number, SpeciesDetail>
}

function load(): Loaded | undefined {
  const index = readJson<DexIndex>(path.join(OUT_DIR, 'dex.json'))
  if (!index) return undefined
  const details = new Map<number, SpeciesDetail>()
  const files = fs.existsSync(OUT_SPECIES_DIR) ? fs.readdirSync(OUT_SPECIES_DIR) : []
  const expected = new Set(Array.from({ length: SPECIES_COUNT }, (_, i) => `${i + 1}.json`))
  for (const name of files) check(expected.has(name), () => `species/${name}: unexpected file`)
  for (let id = 1; id <= SPECIES_COUNT; id++) {
    const detail = readJson<SpeciesDetail>(path.join(OUT_SPECIES_DIR, `${id}.json`))
    if (detail) details.set(id, detail)
  }
  return { index, details }
}

function validateIndex(index: DexIndex): void {
  const { meta } = index
  check(typeof meta.builtAt === 'string' && !Number.isNaN(Date.parse(meta.builtAt)), () => `meta.builtAt is not a timestamp: ${meta.builtAt}`)
  check(typeof meta.pkhexVersion === 'string' && /^\d+\.\d+\.\d+$/.test(meta.pkhexVersion), () => `meta.pkhexVersion: ${meta.pkhexVersion}`)
  check(meta.pokeapiCommit === POKEAPI_COMMIT, () => `meta.pokeapiCommit ${meta.pokeapiCommit} is not the pinned ${POKEAPI_COMMIT}`)
  check(meta.spritesCommit === SPRITES_COMMIT, () => `meta.spritesCommit ${meta.spritesCommit} is not the pinned ${SPRITES_COMMIT}`)
  check(JSON.stringify(index.games) === JSON.stringify(GAMES.map((g) => g.id)), () => 'games is not the id list of shared/games.ts, in order')
  check(Array.isArray(index.gameBalls) && index.gameBalls.length === GAMES.length, () => 'gameBalls must have one entry per game')
  index.gameBalls.forEach((balls, i) => {
    check(Array.isArray(balls) && balls.every((b) => BALL_BY_ID.has(b)) && isSortedUnique(balls), () => `gameBalls[${gameName(i)}] has unknown or unsorted ball ids: ${JSON.stringify(balls)}`)
    const g = GAMES[i]
    const source = g.dataFrom ? GAMES[GAME_INDEX.get(g.dataFrom)!] : g
    if (source.pkhex === null) check(balls.length === 0, () => `gameBalls[${g.id}] must be empty: the game has no tables`)
    else check(balls.length > 0, () => `gameBalls[${g.id}] is empty`)
    if (g.dataFrom) check(JSON.stringify(balls) === JSON.stringify(index.gameBalls[GAME_INDEX.get(g.dataFrom)!]), () => `gameBalls[${g.id}] does not mirror ${g.dataFrom}`)
  })
  check(index.species.length === SPECIES_COUNT, () => `species has ${index.species.length} entries, expected ${SPECIES_COUNT}`)
}

function validateForm(sp: SpeciesSummary, form: FormSummary, i: number, manifest: SpriteManifest): void {
  const id = `${sp.id}-${form.f} ${form.full}`
  check(form.f === i, () => `${id}: forms[${i}].f is ${form.f}`)
  check(badText(form.full) === undefined, () => `${id}: full name ${JSON.stringify(form.full)} is ${badText(form.full)}`)
  check(badText(form.name, true) === undefined, () => `${id}: label ${JSON.stringify(form.name)} is ${badText(form.name, true)}`)
  check(CATEGORIES.has(form.cat), () => `${id}: unknown category ${form.cat}`)
  check((form.cat === 'base') === (form.f === 0), () => `${id}: category ${form.cat} on form index ${form.f}`)
  check((form.cat === 'regional') === (form.region !== undefined), () => `${id}: region ${form.region} with category ${form.cat}`)
  if (form.region !== undefined) check(REGIONS.has(form.region), () => `${id}: unknown region ${form.region}`)
  if (form.cat === 'gender') check(form.gender === 'f' || form.gender === 'm', () => `${id}: gender form without gender`)
  // A species whose forms are its genders cannot be single-gendered or genderless.
  if (form.gender !== undefined) check(sp.genderRate > 0 && sp.genderRate < 8, () => `${id}: gender form on a species with genderRate ${sp.genderRate}`)
  // One naming convention: "Droopy Tatsugiri", not "Droopy Form Tatsugiri".
  check(!form.full.endsWith(` Form ${sp.name}`), () => `${id}: full name keeps the word "Form"`)
  // A form the player can switch to at will is of no use without a way to reach it.
  if (form.cat === 'changeable' || form.cat === 'fusion') {
    check(form.obtain.length + form.event.length > 0, () => `${id}: a ${form.cat} form with no game to get it in`)
  }
  if (form.gender !== undefined) check(form.gender === 'm' || form.gender === 'f', () => `${id}: bad gender ${String(form.gender)}`)
  check(Array.isArray(form.types) && form.types.length >= 1 && form.types.length <= 2 && form.types.every((t) => TYPES.has(t)) && new Set(form.types).size === form.types.length, () => `${id}: bad types ${JSON.stringify(form.types)}`)

  check(typeof form.sprite === 'string' && manifest.has(form.sprite), () => `${id}: sprite "${form.sprite}" is not in the HOME manifest`)
  check(typeof form.shiny === 'boolean' && (!form.shiny || manifest.hasShiny(form.sprite)), () => `${id}: shiny flag without shiny/${form.sprite}.png`)
  check(typeof form.female === 'boolean' && (!form.female || manifest.hasFemale(form.sprite)), () => `${id}: female flag without female/${form.sprite}.png`)
  if (form.female) check(sp.genderDiff, () => `${id}: female render on a species without gender differences`)
  if (form.approx !== undefined) check(form.approx === true, () => `${id}: approx must be true or absent`)
  // The app shows Gigantamax renders shiny without a flag of their own, so the shiny file must exist.
  if (form.gmax !== undefined) check(manifest.has(form.gmax) && manifest.hasShiny(form.gmax), () => `${id}: gmax sprite "${form.gmax}" (or its shiny render) is not in the HOME manifest`)
  if (form.variants !== undefined) {
    check(Array.isArray(form.variants) && form.variants.length > 0, () => `${id}: empty variants`)
    form.variants.forEach((v, n) => {
      check(v.id === n, () => `${id}: variant ${n} has id ${v.id}`)
      check(badText(v.name) === undefined, () => `${id}: variant name ${JSON.stringify(v.name)}`)
      check(manifest.has(v.sprite), () => `${id}: variant sprite "${v.sprite}" is not in the HOME manifest`)
      check(!v.shiny || manifest.hasShiny(v.sprite), () => `${id}: variant shiny flag without shiny/${v.sprite}.png`)
    })
  }

  const lists = checkGameList(form.present, `${id} present`) && checkGameList(form.obtain, `${id} obtain`) && checkGameList(form.event, `${id} event`)
  if (lists) {
    const present = new Set(form.present)
    const obtain = new Set(form.obtain)
    check(form.event.every((g) => !obtain.has(g)), () => `${id}: obtain and event overlap`)
    check(form.obtain.every((g) => g === GO || present.has(g)), () => `${id}: obtainable in ${form.obtain.filter((g) => g !== GO && !present.has(g)).map(gameName)} without being present there`)
    check(form.event.every((g) => present.has(g)), () => `${id}: event in ${form.event.filter((g) => !present.has(g)).map(gameName)} without being present there`)
    check(!present.has(GO), () => `${id}: present lists Pokémon GO, which has no data tables`)
    check((form.go !== undefined) === obtain.has(GO), () => `${id}: go flag ${form.go} disagrees with obtain`)
  }
  if (form.go !== undefined) check(form.go === 1 || form.go === 2, () => `${id}: go must be 1 or 2`)
}

function validateRow(row: EncounterRow, where: string, strings: string[], used: Set<number>, genderRate: number): void {
  if (!checkGameList(row.g, `${where} g`)) return
  // The fixed gender has to be one the species can have.
  if (row.d !== undefined) {
    const possible = genderRate === -1 ? row.d === 2 : row.d !== 2 && !(genderRate === 0 && row.d === 1) && !(genderRate === 8 && row.d === 0)
    check(possible, () => `${where}: fixed gender ${row.d} on a species with genderRate ${genderRate}`)
  }
  const place = row.l === undefined ? undefined : strings[row.l]
  // Headbutt only where the game has trees; X / Y ambushes are not tall grass; XD's spots carry their full name.
  if (row.m !== undefined && row.m.startsWith('Headbutt') && row.g.some((g) => JOHTO_GAMES.has(gameName(g)))) {
    check(place !== undefined && JOHTO_HEADBUTT_PLACES.has(place), () => `${where}: Headbutt row at ${place}, which has no Headbutt trees`)
  }
  if (row.m === 'Tall grass') check(!row.g.some((g) => KALOS_GAMES.has(gameName(g))), () => `${where}: an X / Y row labelled "Tall grass" (PKHeX's Grass slots there are ambushes)`)
  if (place !== undefined) check(!['Rock', 'Oasis', 'Cave'].includes(place), () => `${where}: bare Poké Spot name "${place}"`)
  if (row.k === 'event' && row.n !== undefined) check(!/[:,]$/.test(row.n), () => `${where}: event title "${row.n}" is a salutation, not a title`)
  check(row.g.length > 0, () => `${where}: row without games`)
  check(KINDS.has(row.k), () => `${where}: unknown kind ${row.k}`)
  if (row.m !== undefined) check(badText(row.m) === undefined, () => `${where}: method ${JSON.stringify(row.m)} is ${badText(row.m)}`)
  if (row.l !== undefined) {
    if (check(isInt(row.l) && row.l >= 0 && row.l < strings.length, () => `${where}: location index ${row.l} out of range`)) used.add(row.l)
  }
  check(Array.isArray(row.lv) && row.lv.length === 2 && isInt(row.lv[0]) && isInt(row.lv[1]) && row.lv[0] >= 0 && row.lv[0] <= row.lv[1] && row.lv[1] <= 100, () => `${where}: bad level range ${JSON.stringify(row.lv)}`)
  if (row.c !== undefined) check(Array.isArray(row.c) && row.c.length > 0 && row.c.every((c) => badText(c) === undefined) && new Set(row.c).size === row.c.length, () => `${where}: bad conditions ${JSON.stringify(row.c)}`)
  if (row.s !== undefined) check(row.s === 'locked' || row.s === 'forced', () => `${where}: bad shiny state ${String(row.s)}`)
  if (row.b !== undefined) check(BALL_BY_ID.has(row.b), () => `${where}: unknown ball ${row.b}`)
  if (row.d !== undefined) check(row.d === 0 || row.d === 1 || row.d === 2, () => `${where}: bad gender ${String(row.d)}`)
  if (row.n !== undefined) check(badText(row.n) === undefined, () => `${where}: note ${JSON.stringify(row.n)} is ${badText(row.n)}`)
  if (row.via !== undefined) check(VIAS.has(row.via), () => `${where}: unknown via ${row.via}`)
  check((row.via === 'go') === row.g.includes(GO), () => `${where}: via go and the GO game must go together`)
  if (row.g.includes(GO)) check(row.g.length === 1, () => `${where}: a Pokémon GO row lists other games`)
  if (row.rf !== undefined) check(row.rf === 1, () => `${where}: rf must be 1 or absent`)
  for (const g of row.g) {
    const def = GAMES[g]
    const hasData = def.pkhex !== null || def.dataFrom !== undefined
    check(hasData, () => `${where}: row in ${def.id}, a game without tables (it may only appear through via)`)
  }
  if (row.x !== undefined) {
    const x = row.x
    check(row.k === 'event', () => `${where}: event details on a ${row.k} row`)
    check(Object.keys(x).length > 0, () => `${where}: empty event details`)
    if (x.ot !== undefined) check(typeof x.ot === 'string' && x.ot.trim() !== '', () => `${where}: empty OT`)
    if (x.from !== undefined) check(ISO_DATE.test(x.from), () => `${where}: bad date ${x.from}`)
    if (x.to !== undefined) check(ISO_DATE.test(x.to) && x.from !== undefined && x.from <= x.to, () => `${where}: bad window ${x.from}..${x.to}`)
    if (x.id !== undefined) check(isInt(x.id) && x.id > 0, () => `${where}: bad card id ${x.id}`)
  }
}

function validateDetail(sp: SpeciesSummary, detail: SpeciesDetail, index: DexIndex): number {
  const id = `species ${sp.id} ${sp.name}`
  check(detail.id === sp.id, () => `${id}: detail file has id ${detail.id}`)
  check(badText(detail.flavor) === undefined && detail.flavor.length >= 20, () => `${id}: flavor text is ${badText(detail.flavor) ?? 'too short'}`)
  check(typeof detail.height === 'number' && detail.height > 0 && detail.height < 150, () => `${id}: height ${detail.height}`)
  check(typeof detail.weight === 'number' && detail.weight > 0 && detail.weight < 2000, () => `${id}: weight ${detail.weight}`)
  for (const [dex, number] of Object.entries(detail.dex)) {
    check(/^[a-z]+(-[a-z]+)*$/.test(dex) && dex !== 'national', () => `${id}: dex key ${dex}`)
    check(isInt(number) && number >= 0, () => `${id}: dex number ${dex}=${number}`)
  }
  check(Array.isArray(detail.strings) && new Set(detail.strings).size === detail.strings.length, () => `${id}: string table has duplicates`)
  // One spelling per Legends: Arceus place: "Nature's Pantry (Obsidian Fieldlands)" and plain "Nature's Pantry" must not coexist.
  const hisui = GAME_INDEX.get('legendsarceus')!
  const hisuiPlaces = new Set<string>()
  for (const fd of Object.values(detail.forms)) {
    for (const row of fd.rows) if (row.l !== undefined && row.g.includes(hisui) && detail.strings[row.l] !== undefined) hisuiPlaces.add(detail.strings[row.l])
  }
  for (const region of HISUI_REGIONS) {
    for (const s of hisuiPlaces) {
      if (s.endsWith(` (${region})`)) check(!hisuiPlaces.has(s.slice(0, -region.length - 3)), () => `${id}: "${s}" is also listed without its region`)
    }
  }
  detail.strings.forEach((s, i) => check(badText(s) === undefined, () => `${id}: strings[${i}] ${JSON.stringify(s)} is ${badText(s)}`))
  check(detail.strings.every((s, i) => i === 0 || detail.strings[i - 1] < s), () => `${id}: string table is not sorted`)

  // Family: base stage first, parents before children, every node an existing form.
  const formExists = (s: number, f: number): boolean => index.species[s - 1]?.forms[f] !== undefined
  const seen = new Set<string>()
  check(detail.family.length > 0 && detail.family[0].from === undefined, () => `${id}: family does not start with a base stage`)
  check(detail.family.some((n) => n.s === sp.id && n.f === 0), () => `${id}: family does not contain the species itself`)
  for (const node of detail.family) {
    const key = `${node.s}-${node.f}`
    check(formExists(node.s, node.f), () => `${id}: family node ${key} does not exist`)
    check(!seen.has(key), () => `${id}: family lists ${key} twice`)
    check(index.species[node.s - 1]?.family === sp.family, () => `${id}: family node ${key} belongs to another family`)
    check(index.species[node.s - 1]?.forms[node.f]?.cat !== 'hidden', () => `${id}: family shows hidden form ${key}`)
    if (node.from) {
      check(seen.has(`${node.from[0]}-${node.from[1]}`), () => `${id}: family node ${key} comes before its parent ${node.from}`)
      check(badText(node.how) === undefined, () => `${id}: family node ${key} has method ${JSON.stringify(node.how)}`)
    } else check(node.how === undefined, () => `${id}: base stage ${key} has an evolution method`)
    seen.add(key)
  }

  const keys = Object.keys(detail.forms)
  check(keys.length === sp.forms.length && sp.forms.every((f) => detail.forms[String(f.f)] !== undefined), () => `${id}: detail forms ${keys} do not match the summary`)

  let rows = 0
  const usedStrings = new Set<number>()
  const hasHiddenForms = (speciesId: number): boolean => Boolean(index.species[speciesId - 1]?.forms.some((f) => f.cat === 'hidden'))
  for (const form of sp.forms) {
    const fd: FormDetail | undefined = detail.forms[String(form.f)]
    if (!fd) continue
    const where = `${sp.id}-${form.f} ${form.full}`
    rows += fd.rows.length
    fd.rows.forEach((row, i) => validateRow(row, `${where} row ${i}`, detail.strings, usedStrings, sp.genderRate))

    // No two distributions that look the same: event rows may not differ by their card id alone.
    const eventLooks = new Set<string>()
    for (const row of fd.rows) {
      if (row.k !== 'event') continue
      const { id: cardId, ...rest } = row.x ?? {}
      void cardId
      const look = JSON.stringify([row.g, row.m, row.l, row.lv, row.c, row.s, row.b, row.d, row.n, row.via, rest])
      check(!eventLooks.has(look), () => `${where}: two event rows differ only by their card id (${row.n})`)
      eventLooks.add(look)
    }

    // Sorted, and merged: no two rows differ only by level within a game, or only by game.
    for (let i = 1; i < fd.rows.length; i++) {
      if (!check(compareRows(fd.rows[i - 1], fd.rows[i], detail.strings) < 0, () => `${where}: rows ${i - 1} and ${i} are out of order or identical`)) break
    }
    const byIdentity = new Map<string, EncounterRow[]>()
    for (const row of fd.rows) {
      const key = rowIdentity(row, detail.strings)
      const list = byIdentity.get(key)
      if (list) list.push(row)
      else byIdentity.set(key, [row])
    }
    for (const list of byIdentity.values()) {
      if (list.length < 2) continue
      const games = list.flatMap((r) => r.g)
      check(new Set(games).size === games.length, () => `${where}: rows differing only by level share a game (${JSON.stringify(list[0])})`)
      const levels = list.map((r) => r.lv.join('-'))
      check(new Set(levels).size === levels.length, () => `${where}: rows differing only by game were not merged (${JSON.stringify(list[0])})`)
    }

    // obtain / event must agree with the rows.
    const direct = new Set<number>()
    const eventGames = new Set<number>()
    for (const row of fd.rows) for (const g of row.g) (isTimeLimited(row) ? eventGames : direct).add(g)
    const obtain = new Set(form.obtain)
    const eventOnly = new Set(form.event)
    for (const g of direct) check(obtain.has(g), () => `${where}: has a permanent source in ${gameName(g)} but is not obtainable there`)
    for (const g of eventGames) check(obtain.has(g) || eventOnly.has(g), () => `${where}: time-limited row in ${gameName(g)} is reflected in neither obtain nor event`)
    for (const row of fd.rows) for (const g of row.g) check(g === GO || form.present.includes(g), () => `${where}: row in ${gameName(g)}, where the form is not present`)

    const fromForm = (source: { from: [number, number] }): FormSummary | undefined => index.species[source.from[0] - 1]?.forms[source.from[1]]
    for (const source of fd.evolve) {
      check(formExists(source.from[0], source.from[1]), () => `${where}: evolves from missing form ${source.from}`)
      check(badText(source.how) === undefined, () => `${where}: evolution text ${JSON.stringify(source.how)}`)
      const from = fromForm(source)
      // A source within the species is an in-game form change, anything else an evolution.
      const change = source.from[0] === sp.id
      check(!(change && source.from[1] === form.f), () => `${where}: listed as a source of itself`)
      check(change === /^(Change form: |Fuse with )/.test(source.how), () => `${where}: source from ${source.from} reads "${source.how}"`)
      // The player cannot tell a hidden form apart: a form that counts is never said to come from one.
      if (form.cat !== 'hidden') check(from?.cat !== 'hidden', () => `${where}: source ${source.from} is a hidden form`)
      if (checkGameList(source.g, `${where} evolve`)) {
        check(source.g.length > 0, () => `${where}: evolution without games`)
        // A form change may depend on an event item or a fusion partner, and a form that stands in for hidden
        // variants (Spewpa for its patterns) is obtainable in more games than each of them: both pass the
        // status on at "available" strength only. A plain evolution passes "obtainable" on as it is.
        const loose = change || hasHiddenForms(source.from[0])
        for (const g of source.g) {
          const bothThere = g === GO ? form.go !== undefined && from?.go !== undefined : form.present.includes(g) && Boolean(from?.present.includes(g))
          check(bothThere, () => `${where}: evolution listed for ${gameName(g)}, where one end is missing`)
          if (from?.obtain.includes(g)) {
            if (loose) check(obtain.has(g) || eventOnly.has(g), () => `${where}: reached from an obtainable form in ${gameName(g)} but is not available there`)
            else check(obtain.has(g), () => `${where}: evolves from an obtainable form in ${gameName(g)} but is not obtainable there`)
          }
          // What evolves from an event-only Pokémon can be had through that event as well.
          if (from?.event.includes(g)) check(obtain.has(g) || eventOnly.has(g), () => `${where}: evolves from an event-only form in ${gameName(g)} but is listed under neither obtain nor event`)
        }
      }
    }
    if (checkGameList(fd.breed, `${where} breed`)) {
      check(fd.breed.every((g) => form.present.includes(g)), () => `${where}: hatches in a game it is not present in`)
      // Mega Evolutions and battle-only states never come out of an egg.
      check(fd.breed.length === 0 || (form.cat !== 'mega' && form.cat !== 'battle'), () => `${where}: a ${form.cat} form with breeding games`)
    }
    // Anything obtainable must have a reason: a permanent row, an egg, or a source that is itself obtainable.
    for (const g of form.obtain) {
      const reason = direct.has(g) || fd.breed.includes(g) || fd.evolve.some((e) => e.g.includes(g) && Boolean(fromForm(e)?.obtain.includes(g)))
      check(reason, () => `${where}: obtainable in ${gameName(g)} without a row, an egg or an obtainable source`)
    }
    // Event-only needs one too: a time-limited row, an egg, or a source that is available at all.
    for (const g of form.event) {
      const from = (e: { from: [number, number] }): FormSummary | undefined => fromForm(e)
      const reason = eventGames.has(g) || fd.breed.includes(g) || fd.evolve.some((e) => e.g.includes(g) && Boolean(from(e)?.obtain.includes(g) || from(e)?.event.includes(g)))
      check(reason, () => `${where}: event lists ${gameName(g)} without a time-limited row, an egg or an available source`)
    }
  }
  check(usedStrings.size === detail.strings.length, () => `${id}: ${detail.strings.length - usedStrings.size} unused entries in the string table`)
  return rows
}

function validateSpecies(index: DexIndex, details: Map<number, SpeciesDetail>, manifest: SpriteManifest): { forms: number; rows: number } {
  let forms = 0
  let rows = 0
  const slugs = new Set<string>()
  const families = new Map<number, number[]>()
  index.species.forEach((sp, i) => {
    const id = `species ${sp.id} ${sp.name}`
    check(sp.id === i + 1, () => `species[${i}].id is ${sp.id}`)
    check(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(sp.slug) && !slugs.has(sp.slug), () => `${id}: bad or duplicate slug ${sp.slug}`)
    slugs.add(sp.slug)
    check(badText(sp.name) === undefined, () => `${id}: name is ${badText(sp.name)}`)
    check(badText(sp.genus) === undefined && /Pokémon$/.test(sp.genus), () => `${id}: genus ${JSON.stringify(sp.genus)}`)
    check(isInt(sp.gen) && sp.gen >= 1 && sp.gen <= 9, () => `${id}: generation ${sp.gen}`)
    check(Array.isArray(sp.tags) && sp.tags.every((t) => TAGS.has(t)) && new Set(sp.tags).size === sp.tags.length, () => `${id}: tags ${JSON.stringify(sp.tags)}`)
    check(isInt(sp.genderRate) && sp.genderRate >= -1 && sp.genderRate <= 8, () => `${id}: genderRate ${sp.genderRate}`)
    check(typeof sp.genderDiff === 'boolean', () => `${id}: genderDiff`)
    check(isInt(sp.family) && sp.family >= 1 && sp.family <= sp.id, () => `${id}: family ${sp.family}`)
    const members = families.get(sp.family)
    if (members) members.push(sp.id)
    else families.set(sp.family, [sp.id])
    check(Array.isArray(sp.forms) && sp.forms.length >= 1, () => `${id}: no forms`)
    check(manifest.has(String(sp.id)) && manifest.hasShiny(String(sp.id)), () => `${id}: the default HOME render ${sp.id}.png or its shiny version is missing`)
    sp.forms.forEach((form, n) => validateForm(sp, form, n, manifest))
    forms += sp.forms.length
    // Two forms with their own render must not show the same picture, unless they look alike by design.
    const pictures = new Map<string, FormSummary>()
    for (const form of sp.forms) {
      if (form.approx || !manifest.has(form.sprite) || SAME_LOOK_CATEGORIES.has(form.cat)) continue
      const blob = manifest.blob(form.sprite)
      const other = pictures.get(blob)
      if (other) check(other.sprite === form.sprite, () => `${id}: ${other.full} (${other.sprite}) and ${form.full} (${form.sprite}) have byte-identical renders; one must be marked approx`)
      else pictures.set(blob, form)
    }
    const detail = details.get(sp.id)
    if (detail) rows += validateDetail(sp, detail, index)
  })
  // A family id is the lowest national number among its members, and every member lists the same family.
  for (const [family, members] of families) {
    check(Math.min(...members) === family, () => `family ${family}: id is not its lowest member (${members})`)
    for (const s of members) {
      const listed = new Set((details.get(s)?.family ?? []).map((n) => n.s))
      check(members.every((m) => listed.has(m)) && [...listed].every((m) => members.includes(m)), () => `species ${s}: family nodes ${[...listed]} do not match the family's members ${members}`)
    }
  }
  return { forms, rows }
}

// --- facts -------------------------------------------------------------------------------------

function describeFact(fact: Fact, index: DexIndex): string {
  const form = index.species[fact.s - 1]?.forms[fact.f ?? 0]
  const name = form ? form.full : `${fact.s}-${fact.f ?? 0}`
  const { t, s, f, game, ...rest } = fact as Fact & Record<string, unknown>
  void s
  void f
  return `${t} ${name}${game === undefined ? '' : ` in ${String(game)}`} ${JSON.stringify(rest)}`
}

function checkFact(fact: Fact, index: DexIndex, details: Map<number, SpeciesDetail>): string | undefined {
  const f = fact.f ?? 0
  const form = index.species[fact.s - 1]?.forms[f]
  const detail = details.get(fact.s)
  const fd = detail?.forms[String(f)]
  if (!form || !detail || !fd) return 'the form does not exist'
  if (fact.t === 'form') {
    if (fact.cat !== undefined && form.cat !== fact.cat) return `category is ${form.cat}`
    if (fact.full !== undefined && form.full !== fact.full) return `full name is "${form.full}"`
    if (fact.approx !== undefined && Boolean(form.approx) !== fact.approx) return `approx is ${Boolean(form.approx)}`
    if (fact.genderRate !== undefined && index.species[fact.s - 1].genderRate !== fact.genderRate) return `genderRate is ${index.species[fact.s - 1].genderRate}`
    return undefined
  }
  const game = GAME_INDEX.get(fact.game)
  if (game === undefined) return `unknown game ${fact.game}`
  const rows = fd.rows.filter((r) => r.g.includes(game))
  switch (fact.t) {
    case 'row': {
      const match = rows.some((r) => {
        if (r.k !== fact.k) return false
        if (fact.at !== undefined && !(r.l !== undefined && detail.strings[r.l].includes(fact.at))) return false
        if (fact.m !== undefined && !(r.m ?? '').includes(fact.m)) return false
        if (fact.lv !== undefined && !(r.lv[0] <= fact.lv && fact.lv <= r.lv[1])) return false
        if (fact.shiny !== undefined && r.s !== fact.shiny) return false
        if (fact.ball !== undefined && r.b !== fact.ball) return false
        if (fact.gender !== undefined && r.d !== fact.gender) return false
        if (fact.note !== undefined && !(r.n ?? '').includes(fact.note)) return false
        if (fact.c !== undefined && !(r.c ?? []).includes(fact.c)) return false
        if (fact.via !== undefined && r.via !== fact.via) return false
        if (fact.rf && r.rf !== 1) return false
        if (fact.ot !== undefined && r.x?.ot !== fact.ot) return false
        return true
      })
      if (fact.count !== undefined) {
        const n = rows.filter((r) => r.k === fact.k && (fact.lv === undefined || (r.lv[0] <= fact.lv && fact.lv <= r.lv[1]))).length
        if (n !== fact.count) return `${n} ${fact.k} rows${fact.lv === undefined ? '' : ` at level ${fact.lv}`}, expected ${fact.count}`
      }
      if (match) return undefined
      const same = rows.filter((r) => r.k === fact.k)
      return same.length === 0
        ? `no ${fact.k} row in ${fact.game}`
        : `no matching row; ${fact.k} rows there: ${same.slice(0, 4).map((r) => JSON.stringify({ ...r, l: r.l === undefined ? undefined : detail.strings[r.l], g: undefined })).join(' ')}`
    }
    case 'noRow': {
      const hit = rows.find((r) => {
        if (r.k !== fact.k) return false
        if (fact.m !== undefined && !(r.m ?? '').includes(fact.m)) return false
        if (fact.at !== undefined && !(r.l !== undefined && detail.strings[r.l].includes(fact.at))) return false
        return true
      })
      return hit ? `has such a row in ${fact.game}: ${JSON.stringify({ ...hit, l: hit.l === undefined ? undefined : detail.strings[hit.l], g: undefined })}` : undefined
    }
    case 'obtain':
      return form.obtain.includes(game) === fact.yes ? undefined : `obtain is ${form.obtain.includes(game)}`
    case 'eventOnly':
      return form.event.includes(game) && !form.obtain.includes(game) ? undefined : `event ${form.event.includes(game)}, obtain ${form.obtain.includes(game)}`
    case 'evolve': {
      const sources = fd.evolve.filter((e) => e.from[0] === fact.from[0] && e.from[1] === fact.from[1] && e.g.includes(game))
      if (sources.some((e) => e.how.includes(fact.how))) return undefined
      return sources.length === 0 ? 'no such evolution in that game' : `method there: ${sources.map((e) => e.how).join(' / ')}`
    }
    case 'noEvolve': {
      const hit = fd.evolve.find((e) => e.from[0] === fact.from[0] && e.from[1] === fact.from[1] && e.g.includes(game) && (fact.how === undefined || e.how.includes(fact.how)))
      return hit ? `the evolution is listed for that game ("${hit.how}")` : undefined
    }
    case 'breed':
      return fd.breed.includes(game) === fact.yes ? undefined : `breed is ${fd.breed.includes(game)}`
    case 'present':
      return form.present.includes(game) === fact.yes ? undefined : `present is ${form.present.includes(game)}`
  }
}

/** pokedexes.json lists exactly the species whose detail file carries a number in that Pokédex, in the order of those numbers. */
function validatePokedexes(details: Map<number, SpeciesDetail>): void {
  const file = readJson<PokedexFile>(path.join(OUT_DIR, 'pokedexes.json'))
  if (!file) return
  check(file.v === 1 && typeof file.pokedexes === 'object' && file.pokedexes !== null, () => 'pokedexes.json: not a version 1 file')
  const expected = new Map<string, { species: number; no: number }[]>()
  for (const [id, detail] of details) {
    for (const [name, no] of Object.entries(detail.dex)) {
      const list = expected.get(name)
      if (list) list.push({ species: id, no })
      else expected.set(name, [{ species: id, no }])
    }
  }
  const names = Object.keys(file.pokedexes ?? {})
  check(names.length === expected.size && names.every((name) => expected.has(name)), () => `pokedexes.json: holds ${names.length} Pokédexes, the species files name ${expected.size}`)
  for (const [name, list] of expected) {
    const want = list.sort((a, b) => a.no - b.no || a.species - b.species).map((e) => e.species)
    const got = file.pokedexes?.[name]
    check(Array.isArray(got) && got.length === want.length && got.every((s, i) => s === want[i]), () => `pokedexes.json: "${name}" does not match the dex numbers of the species files`)
  }
  for (const [game, own] of Object.entries(GAME_POKEDEXES)) {
    check(GAME_INDEX.has(game), () => `GAME_POKEDEXES: unknown game "${game}"`)
    for (const name of own) check(expected.has(name) && POKEDEX_NAMES[name] !== undefined, () => `GAME_POKEDEXES: "${game}" names "${name}", which has no species or no display name`)
  }
}

/** Largest terms file the installer should carry; a jump past it means something other than names got in. */
const MAX_TERMS_BYTES = 450_000

/**
 * terms/<language>.json: one file per language besides English, every key naming something the
 * datasets have, every text clean, and the tables the games fully translate actually filled.
 */
function validateTerms(index: DexIndex, details: Map<number, SpeciesDetail>): void {
  const species = new Map(index.species.map((s) => [String(s.id), s]))
  const formKeys = new Set<string>()
  const variantKeys = new Set<string>()
  for (const s of index.species) {
    for (const form of s.forms) {
      formKeys.add(`${s.id}-${form.f}`)
      for (const variant of form.variants ?? []) variantKeys.add(`${s.id}-${form.f}-${variant.id}`)
    }
  }
  const places = new Set([...details.values()].flatMap((d) => d.strings))
  const games = new Set(GAMES.map((g) => g.id))
  const groups = new Set(GAMES.map((g) => g.group))
  const allowed: Record<string, (key: string) => boolean> = {
    species: (key) => species.has(key),
    genus: (key) => species.has(key),
    flavor: (key) => species.has(key),
    forms: (key) => formKeys.has(key),
    formFull: (key) => formKeys.has(key),
    variants: (key) => variantKeys.has(key),
    types: (key) => TYPES.has(key),
    abilities: (key) => ABILITY_BY_ID.has(Number(key)),
    balls: (key) => BALL_BY_ID.has(Number(key)),
    games: (key) => games.has(key),
    gameShort: (key) => games.has(key),
    gameGroups: (key) => groups.has(key),
    locations: (key) => places.has(key),
    names: (key) => key.trim() !== ''
  }
  const expected = new Set(TERM_LANGUAGES.map((l) => `${l.id}.json`))
  const present = fs.existsSync(TERMS_DIR) ? fs.readdirSync(TERMS_DIR) : []
  check(present.length === expected.size && present.every((name) => expected.has(name)), () => `terms/: expected ${[...expected].join(', ')}; found ${present.join(', ') || 'nothing'}. Run "node tools/build-data/terms.ts".`)

  for (const { id } of TERM_LANGUAGES) {
    const file = path.join(TERMS_DIR, `${id}.json`)
    if (!fs.existsSync(file)) continue
    const text = fs.readFileSync(file, 'utf8')
    let terms: TermsFile
    try {
      terms = JSON.parse(text) as TermsFile
    } catch {
      check(false, () => `terms/${id}.json is not valid JSON`)
      continue
    }
    check(terms.v === 1 && terms.language === id, () => `terms/${id}.json: wrong version or language`)
    check(Buffer.byteLength(text) <= MAX_TERMS_BYTES, () => `terms/${id}.json is ${Buffer.byteLength(text)} bytes, over the ${MAX_TERMS_BYTES} allowed`)
    for (const [part, isKey] of Object.entries(allowed)) {
      const table = (terms as unknown as Record<string, unknown>)[part]
      if (!check(typeof table === 'object' && table !== null && !Array.isArray(table), () => `terms/${id}.json: "${part}" is missing or not a table`)) continue
      for (const [key, value] of Object.entries(table as Record<string, unknown>)) {
        check(isKey(key), () => `terms/${id}.json: ${part} has the unknown key "${key}"`)
        const clean = typeof value === 'string' && value !== '' && value === value.trim() && !/[\x00-\x1f\x7f\xad\ufffd]/.test(value) && !/undefined|\[object/.test(value)
        check(clean, () => `terms/${id}.json: ${part}["${key}"] is not clean display text: ${JSON.stringify(value)}`)
      }
    }
    const count = (part: keyof TermsFile): number => Object.keys((terms[part] as Record<string, string> | undefined) ?? {}).length
    // The games translate these tables in full; a name left out reads the same as in English (most Italian balls do).
    check(count('abilities') >= 250, () => `terms/${id}.json: only ${count('abilities')} ability names`)
    check(count('types') >= 14, () => `terms/${id}.json: only ${count('types')} type names`)
    check(count('balls') >= 10, () => `terms/${id}.json: only ${count('balls')} ball names`)
    check(count('gameShort') >= 30, () => `terms/${id}.json: only ${count('gameShort')} game names`)
    check(count('genus') >= 850, () => `terms/${id}.json: only ${count('genus')} genus texts`)
    check(count('flavor') >= 700, () => `terms/${id}.json: only ${count('flavor')} Pokédex entries`)
    check(count('formFull') >= 400, () => `terms/${id}.json: only ${count('formFull')} form names`)
    check(count('locations') >= 0.75 * places.size, () => `terms/${id}.json: only ${count('locations')} of ${places.size} place names`)
    // Two forms of one species never read the same.
    for (const s of index.species) {
      const fulls = s.forms.map((form) => terms.formFull?.[`${s.id}-${form.f}`] ?? form.full)
      const labels = s.forms.map((form) => terms.forms?.[`${s.id}-${form.f}`] ?? form.name).filter((label) => label !== '')
      check(new Set(fulls).size === fulls.length, () => `terms/${id}.json: two forms of ${s.name} share a full name`)
      check(new Set(labels).size === labels.length, () => `terms/${id}.json: two forms of ${s.name} share a label`)
    }
  }
}

function main(): void {
  const loaded = load()
  if (!loaded) {
    console.error('VALIDATION FAILED\n  ' + failures.join('\n  '))
    process.exit(1)
  }
  const { index, details } = loaded
  const manifest = new SpriteManifest()
  validateIndex(index)
  const counted = validateSpecies(index, details, manifest)
  validatePokedexes(details)
  validateTerms(index, details)
  check(index.meta.counts.species === index.species.length, () => `meta.counts.species ${index.meta.counts.species} != ${index.species.length}`)
  check(index.meta.counts.forms === counted.forms, () => `meta.counts.forms ${index.meta.counts.forms} != ${counted.forms}`)
  check(index.meta.counts.rows === counted.rows, () => `meta.counts.rows ${index.meta.counts.rows} != ${counted.rows}`)
  const structural = failures.length

  let factFailures = 0
  for (const fact of FACTS) {
    const problem = checkFact(fact, index, details)
    checks++
    if (problem) {
      factFailures++
      failures.push(`FACT ${describeFact(fact, index)}: ${problem}`)
    }
  }

  console.log(`Checked ${index.species.length} species, ${counted.forms} forms, ${counted.rows} rows: ${checks} checks, ${FACTS.length} known facts.`)
  if (failures.length > 0) {
    console.error(`\nVALIDATION FAILED: ${structural} structural problems, ${factFailures} of ${FACTS.length} facts wrong`)
    for (const line of failures.slice(0, MAX_FAILURES_SHOWN)) console.error(`  ${line}`)
    if (failures.length > MAX_FAILURES_SHOWN) console.error(`  ... and ${failures.length - MAX_FAILURES_SHOWN} more`)
    process.exit(1)
  }
  console.log('All structural invariants hold and every known fact is reproduced.')
}

main()
