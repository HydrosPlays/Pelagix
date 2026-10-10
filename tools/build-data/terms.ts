/**
 * Writes terms/<language>.json: the games' own wording for everything the datasets name in
 * English, one file for each of the nine languages besides English. The app loads the file of the
 * language it is shown in (src/renderer/src/i18n/terms.ts); what a file lacks reads in English.
 *
 * Runs on its own and as the last step of `npm run data:build`. It reads the PKHeX extract
 * (localized.json), the PokeAPI tables and the datasets the earlier steps wrote, and touches
 * nothing but the terms folder.
 *
 *   node tools/build-data/terms.ts
 *
 * Where each name comes from:
 * - species, types, abilities, balls, games, items, moves, places: PKHeX's text of the games.
 * - genus and Pokédex entries: PokeAPI.
 * - forms: PokeAPI's form names; where PokeAPI has none in a language, "Species (Qualifier)" from
 *   PKHeX's qualifier of the form.
 * A name with no official text in a language is left out, never guessed.
 */
import fs from 'node:fs'
import path from 'node:path'
import { ABILITIES } from '../../src/shared/abilities.ts'
import { BALLS } from '../../src/shared/balls.ts'
import type { DexIndex, SpeciesDetail, TypeId } from '../../src/shared/dex-types.ts'
import { GAMES } from '../../src/shared/games.ts'
import type { GameDef } from '../../src/shared/games.ts'
import { cleanFlavor } from './details.ts'
import { mapForms } from './form-mapping.ts'
import { GAME_TAG, LocationNames, RELABEL, XD_POKE_SPOT } from './locations.ts'
import { OUT_DIR, OUT_SPECIES_DIR, PKHEX_DIR } from './paths.ts'
import type { PkFormsFile, PkLocalized, PkLocalizedLanguage, PkLocations } from './pkhex-types.ts'
import { CsvStore, SpriteManifest } from './sources.ts'
import { BuildError, assert, fail, formatBytes, int, sf } from './util.ts'

export const TERMS_DIR = path.join(OUT_DIR, 'terms')

export interface TermLanguage {
  id: string
  /** PokeAPI language ids, in order of preference. */
  pokeapi: string[]
  /** The language writes the brand as "Pokémon", so a full game name is "Pokémon " + version. */
  brand: boolean
  /** What a line break inside a Pokédex entry becomes. */
  joinLines: string
}

/** The nine languages that get a file. */
export const TERM_LANGUAGES: readonly TermLanguage[] = [
  // PokeAPI: 11 is Japanese with kanji, 1 the kana-only text of the older games.
  { id: 'ja', pokeapi: ['11', '1'], brand: false, joinLines: '' },
  { id: 'fr', pokeapi: ['5'], brand: true, joinLines: ' ' },
  { id: 'it', pokeapi: ['8'], brand: true, joinLines: ' ' },
  { id: 'de', pokeapi: ['6'], brand: true, joinLines: ' ' },
  { id: 'es', pokeapi: ['7'], brand: true, joinLines: ' ' },
  // PokeAPI has no Latin American Spanish: its texts fall back to Spanish.
  { id: 'es-419', pokeapi: ['7'], brand: true, joinLines: ' ' },
  { id: 'ko', pokeapi: ['3'], brand: false, joinLines: ' ' },
  { id: 'zh-Hans', pokeapi: ['12'], brand: false, joinLines: '' },
  { id: 'zh-Hant', pokeapi: ['4'], brand: false, joinLines: '' }
]

/** One language file. Every part is keyed as `TermData` in src/renderer/src/i18n/terms.ts. */
export interface TermsFile {
  v: 1
  language: string
  species: Record<string, string>
  genus: Record<string, string>
  forms: Record<string, string>
  formFull: Record<string, string>
  variants: Record<string, string>
  types: Record<string, string>
  abilities: Record<string, string>
  balls: Record<string, string>
  games: Record<string, string>
  gameShort: Record<string, string>
  gameGroups: Record<string, string>
  flavor: Record<string, string>
  locations: Record<string, string>
  /** English name -> name, for the items, moves and species the evolution texts mention (also when it reads the same). */
  names: Record<string, string>
}

interface Coverage {
  species: number
  genus: number
  flavor: number
  formsFromPokeapi: number
  formsComposed: number
  formsEnglish: number
  locations: number
  locationConflicts: number
  names: number
}

const TYPE_IDS: ReadonlySet<string> = new Set<TypeId>([
  'normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel', 'fire', 'water', 'grass', 'electric',
  'psychic', 'ice', 'dragon', 'dark', 'fairy', 'stellar'
])

/** Oldest first: a place two games name differently takes the newer game's name. */
const LOCATION_SETS = ['Gen1', 'Gen2', 'Gen3', 'CXD', 'Gen4', 'Gen5', 'Gen6', 'Gen7', 'Gen7b', 'Gen8', 'Gen8b', 'Gen8a', 'Gen9', 'Gen9a']

const tidy = (text: string | undefined): string => (text ?? '').replace(/\s+/g, ' ').trim()

/** Text of this language at an index, or "" when it has none of its own (missing, or the English line again). */
function own(list: readonly string[], english: readonly string[], index: number): string {
  const text = tidy(list[index])
  return text === '' || text === tidy(english[index]) ? '' : text
}

/** English line -> this language's line, over two line-aligned tables. The first line with a name wins. */
function dictionary(english: readonly string[], list: readonly string[]): Map<string, string> {
  const out = new Map<string, string>()
  english.forEach((name, i) => {
    const key = tidy(name)
    const text = own(list, english, i)
    if (key !== '' && text !== '' && !out.has(key)) out.set(key, text)
  })
  return out
}

// ---------------------------------------------------------------- inputs

interface Inputs {
  index: DexIndex
  localized: PkLocalized
  english: PkLocalizedLanguage
  /** `sf(species, form)` -> PokeAPI pokemon_form id. */
  formRow: Map<number, number>
  /** PokeAPI language id -> species -> { name, genus }. */
  speciesNames: Map<string, Map<number, { name: string; genus: string }>>
  /** PokeAPI language id -> pokemon_form id -> names. */
  formNames: Map<string, Map<number, { form: string; pokemon: string }>>
  /** PokeAPI language id -> species -> raw text of the newest game that has an entry. */
  flavor: Map<string, Map<number, string>>
  /** Every distinct location name of the species files. */
  places: string[]
  /** Every distinct `how` text of the species files. */
  hows: string[]
  englishLocations: PkLocations
}

function readJson<T>(file: string, hint: string): T {
  if (!fs.existsSync(file)) fail(`Missing ${file}. ${hint}`)
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T
}

function loadInputs(): Inputs {
  const built = 'Run "node tools/build-data/index.ts" first.'
  const extracted = 'Run "npm run data:extract" first.'
  const index = readJson<DexIndex>(path.join(OUT_DIR, 'dex.json'), built)
  const details = index.species.map((s) => readJson<SpeciesDetail>(path.join(OUT_SPECIES_DIR, `${s.id}.json`), built))
  const localized = readJson<PkLocalized>(path.join(PKHEX_DIR, 'localized.json'), extracted)
  const english = localized['en'] ?? fail('localized.json has no English tables')
  for (const { id } of TERM_LANGUAGES) assert(localized[id] !== undefined, `localized.json has no "${id}" tables`)
  const pkForms = readJson<PkFormsFile>(path.join(PKHEX_DIR, 'forms.json'), extracted)
  const englishLocations = readJson<PkLocations>(path.join(PKHEX_DIR, 'locations.json'), extracted)

  const csv = new CsvStore()
  const mapping = mapForms(pkForms, csv, new SpriteManifest())
  const formRow = new Map<number, number>()
  for (const [key, mapped] of mapping.forms) if (mapped.row) formRow.set(key, mapped.row.id)

  const speciesNames = new Map<string, Map<number, { name: string; genus: string }>>()
  for (const r of csv.table('pokemon_species_names')) {
    let table = speciesNames.get(r.local_language_id)
    if (!table) speciesNames.set(r.local_language_id, (table = new Map()))
    table.set(int(r.pokemon_species_id, 'pokemon_species_names.pokemon_species_id'), { name: tidy(r.name), genus: tidy(r.genus) })
  }
  const formNames = new Map<string, Map<number, { form: string; pokemon: string }>>()
  for (const r of csv.table('pokemon_form_names')) {
    let table = formNames.get(r.local_language_id)
    if (!table) formNames.set(r.local_language_id, (table = new Map()))
    table.set(int(r.pokemon_form_id, 'pokemon_form_names.pokemon_form_id'), { form: tidy(r.form_name), pokemon: tidy(r.pokemon_name) })
  }
  const newest = new Map<string, Map<number, { version: number; text: string }>>()
  for (const r of csv.table('pokemon_species_flavor_text')) {
    if (r.flavor_text.trim() === '') continue
    let table = newest.get(r.language_id)
    if (!table) newest.set(r.language_id, (table = new Map()))
    const species = int(r.species_id, 'pokemon_species_flavor_text.species_id')
    const version = int(r.version_id, 'pokemon_species_flavor_text.version_id')
    const current = table.get(species)
    if (!current || version > current.version) table.set(species, { version, text: r.flavor_text })
  }
  const flavor = new Map<string, Map<number, string>>()
  for (const [language, table] of newest) flavor.set(language, new Map([...table].map(([species, entry]) => [species, entry.text])))

  const places = new Set<string>()
  const hows = new Set<string>()
  for (const detail of details) {
    for (const name of detail.strings) places.add(name)
    for (const node of detail.family) if (node.how !== undefined) hows.add(node.how)
    for (const form of Object.values(detail.forms)) for (const source of form.evolve) hows.add(source.how)
  }
  return { index, localized, english, formRow, speciesNames, formNames, flavor, englishLocations, places: [...places].sort(), hows: [...hows].sort() }
}

// ---------------------------------------------------------------- Pokédex text

/** In-game Pokédex text as one paragraph; `joinLines` is what a line break becomes in the language. */
export function cleanLocalFlavor(text: string, joinLines: string): string {
  if (joinLines === ' ') return cleanFlavor(text)
  return text
    .replace(/\xad/g, '')
    .replace(/[\n\f\r\t]+/g, joinLines)
    .replace(/\xa0/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim()
}

// ---------------------------------------------------------------- games

const loose = (text: string): string => text.replace(/[,!:]/g, '').replace(/\s+/g, ' ').trim()

/** PKHeX names Blue and Green on one line: "Blue [INT]/Green [JP]". */
const BLUE_GREEN = /^(.+) \[[^\]]+\]\/(.+) \[[^\]]+\]$/

function gameTerms(lang: PkLocalizedLanguage, english: PkLocalizedLanguage, brand: boolean): Pick<TermsFile, 'games' | 'gameShort' | 'gameGroups'> {
  const games: Record<string, string> = {}
  const gameShort: Record<string, string> = {}
  /** Game id -> the version's name in this language, where PKHeX's English name is the app's short name. */
  const version = new Map<string, string>()
  const blueGreenEn = BLUE_GREEN.exec(english.games['GN'] ?? '')
  const blueGreen = BLUE_GREEN.exec(lang.games['GN'] ?? '')
  for (const game of GAMES) {
    let en = game.pkhex ? tidy(english.games[game.pkhex]) : ''
    let local = game.pkhex ? tidy(lang.games[game.pkhex]) : ''
    if (game.id === 'blue' || game.id === 'green') {
      const part = game.id === 'blue' ? 1 : 2
      en = tidy(blueGreenEn?.[part])
      local = tidy(blueGreen?.[part])
    }
    if (en === '' || local === '' || loose(en) !== loose(game.short)) continue
    version.set(game.id, local)
    if (local !== game.short) gameShort[game.id] = local
    // The full name is the brand and the version: "Pokémon Scarlet", "Pokémon: Let's Go, Pikachu!".
    const prefix = game.name.endsWith(en) ? game.name.slice(0, -en.length) : undefined
    if (prefix !== 'Pokémon ' && prefix !== 'Pokémon: ') continue
    // The games' text has the version names only. Languages that write the brand "Pokémon" keep it;
    // the others show the version name alone rather than a brand nobody checked.
    const name = brand ? `${prefix}${local}` : local
    if (name !== game.name) games[game.id] = name
  }

  const gameGroups: Record<string, string> = {}
  const members = new Map<string, GameDef[]>()
  for (const game of GAMES) members.set(game.group, [...(members.get(game.group) ?? []), game])
  const list = (names: string[]): string => (names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`)
  for (const [group, own] of members) {
    const groupName = own[0].groupName
    // Only groups whose English name is exactly its members' short names, listed.
    if (groupName !== list(own.map((game) => game.short))) continue
    if (!own.every((game) => version.has(game.id))) continue
    const name = list(own.map((game) => version.get(game.id)!))
    if (name !== groupName) gameGroups[group] = name
  }
  return { games, gameShort, gameGroups }
}

// ---------------------------------------------------------------- forms

/** A PKHeX form qualifier as display text ("*Teal" marks a battle-only state). */
const qualifier = (q: string | undefined): string => tidy((q ?? '').replace(/^\*/, ''))

interface FormResult {
  forms: Record<string, string>
  formFull: Record<string, string>
  fromPokeapi: number
  composed: number
  english: number
}

interface NamedForm {
  f: number
  label: string
  full: string
  q: string
  source: 'pokeapi' | 'composed' | 'english'
}

function formTerms(input: Inputs, language: TermLanguage, speciesName: (id: number) => string): FormResult {
  const lang = input.localized[language.id]
  const api = (row: number | undefined): { form: string; pokemon: string } => {
    if (row !== undefined) {
      for (const id of language.pokeapi) {
        const names = input.formNames.get(id)?.get(row)
        if (names && (names.form !== '' || names.pokemon !== '')) return names
      }
    }
    return { form: '', pokemon: '' }
  }
  const result: FormResult = { forms: {}, formFull: {}, fromPokeapi: 0, composed: 0, english: 0 }

  for (const species of input.index.species) {
    const s = species.id
    const localSpecies = speciesName(s)
    const named: NamedForm[] = []
    for (const form of species.forms) {
      const row = input.formRow.get(sf(s, form.f))
      const q = qualifier(lang.forms[String(s)]?.[form.f])
      // PokeAPI names Alcremie's rows after cream and sweet; the form index is the cream alone.
      const names = s === 869 ? { form: '', pokemon: '' } : api(row)
      const n: NamedForm = { f: form.f, label: form.name, full: form.full, q, source: 'english' }
      if (form.f === 0 && form.full === species.name) {
        // The species itself: its name, and the label of its default form when it has one.
        n.full = localSpecies
        const label = form.name === '' ? '' : names.form || q
        if (label !== '') {
          n.label = label
          n.source = names.form !== '' ? 'pokeapi' : 'composed'
        }
      } else if (row === undefined) {
        // Forms PokeAPI has no row for carry hand-written English names ("Hisuian Arcanine (Lord)"): no official text.
      } else if (names.form !== '' || names.pokemon !== '') {
        n.label = names.form || q || form.name
        // Some languages only have the form name, and for a Mega that is already the whole name ("Méga-Dracaufeu X").
        n.full = names.pokemon || (n.label.includes(localSpecies) ? n.label : `${localSpecies} (${n.label})`)
        n.source = 'pokeapi'
      } else if (q !== '') {
        n.label = q
        n.full = `${localSpecies} (${q})`
        n.source = 'composed'
      }
      named.push(n)
    }

    // Two forms of one species must never share a label or a full name: fall back to the qualifier, then to English.
    for (const field of ['full', 'label'] as const) {
      const english = (n: NamedForm): string => {
        const form = species.forms.find((x) => x.f === n.f)!
        return field === 'full' ? form.full : form.name
      }
      const clashes = (): NamedForm[][] => {
        const groups = new Map<string, NamedForm[]>()
        for (const n of named) if (n[field] !== '') groups.set(n[field], [...(groups.get(n[field]) ?? []), n])
        return [...groups.values()].filter((g) => g.length > 1)
      }
      for (const group of clashes()) {
        for (const n of group) {
          if (n.q === '' || n.f === 0) continue
          n[field] = field === 'full' ? `${localSpecies} (${n.q})` : n.q
          n.source = 'composed'
        }
      }
      for (let round = 0; round < 4 && clashes().length > 0; round++) {
        for (const group of clashes()) {
          for (const n of group) {
            n[field] = english(n)
            n.source = 'english'
          }
        }
      }
      assert(clashes().length === 0, `${language.id}: forms of species ${s} still share a ${field} name`)
    }

    for (const n of named) {
      const form = species.forms.find((x) => x.f === n.f)!
      if (n.label !== form.name) result.forms[`${s}-${n.f}`] = n.label
      if (n.full !== form.full) result.formFull[`${s}-${n.f}`] = n.full
      // Counted over the forms that are more than the plain species.
      if (n.f === 0 && form.name === '') continue
      if (n.source === 'pokeapi') result.fromPokeapi++
      else if (n.source === 'composed') result.composed++
      else result.english++
    }
  }
  return result
}

// ---------------------------------------------------------------- places

/** Removes one trailing bracketed tag: " (FRLG)", " (2)", " (-)". */
const dropTag = (text: string): string => text.replace(/\s*[(（][^()（）]*[)）]$/, '')

/** A PKHeX location name of another language as a display name, cleaned the way locations.ts cleans the English one. */
function localPlace(set: string, englishRaw: string, localRaw: string, gameId: string): string | undefined {
  let local: string
  if (set === 'CXD') {
    const strip = (text: string): string => text.replace(/( \[\d+\])+$/, '')
    const englishParts = strip(englishRaw).split(' / ')
    const localParts = strip(localRaw).split(' / ')
    if (strip(englishRaw) === strip(localRaw) || englishParts.length !== localParts.length) return undefined
    const tag = gameId === 'colosseum' ? ' (C)' : ' (XD)'
    const at = englishParts.findIndex((part) => part.endsWith(tag))
    if (at < 0 || XD_POKE_SPOT[englishParts[at].slice(0, -tag.length)]) return undefined
    local = dropTag(localParts[at])
  } else if (RELABEL[`${set}:${englishRaw}`] || englishRaw === 'Cold Storage/PWT') {
    return undefined
  } else if (englishRaw === 'Battle Tower (RS) / Battle Frontier (E)') {
    const parts = localRaw.split(' / ')
    if (parts.length !== 2) return undefined
    local = dropTag(parts[gameId === 'emerald' ? 1 : 0])
  } else {
    let english = englishRaw
    local = localRaw
    for (const suffix of [/ \(-\)$/, / \(\d+\)$/, GAME_TAG]) {
      if (!suffix.test(english)) continue
      english = english.replace(suffix, '')
      local = dropTag(local)
    }
  }
  local = tidy(local)
  return local === '' ? undefined : local
}

function placeTerms(input: Inputs, lang: PkLocalizedLanguage): { locations: Record<string, string>; conflicts: number } {
  const englishNames = new LocationNames(input.englishLocations)
  const known = new Map<string, string>()
  const conflicts = new Set<string>()
  for (const set of LOCATION_SETS) {
    const table = input.englishLocations[set]
    if (!table) continue
    for (const [id, englishRaw] of Object.entries(table)) {
      const localRaw = lang.locations[set]?.[id] ?? ''
      if (localRaw === '' || localRaw === englishRaw) continue
      GAMES.forEach((game, gameIdx) => {
        if (set === 'CXD' && game.id !== 'colosseum' && game.id !== 'xd') return
        let english: string | undefined
        try {
          english = englishNames.name(set, Number(id), gameIdx)
        } catch (error) {
          // A place only one of Colosseum and XD has.
          if (!(error instanceof BuildError)) throw error
        }
        if (english === undefined) return
        const local = localPlace(set, englishRaw, localRaw, game.id)
        if (local === undefined || local === english) return
        const before = known.get(english)
        if (before !== undefined && before !== local) conflicts.add(english)
        known.set(english, local)
      })
    }
  }
  const locations: Record<string, string> = {}
  for (const place of input.places) {
    let local = known.get(place)
    if (local === undefined) {
      // "Bridge Field (Wild Area)", "Castaway Shore (Cobalt Coastlands)": an area and the place it lies in.
      const parts = /^(.+) \((.+)\)$/.exec(place)
      const area = parts && known.get(parts[1])
      const within = parts && known.get(parts[2])
      if (area && within) local = `${area} (${within})`
    }
    if (local !== undefined) locations[place] = local
  }
  return { locations, conflicts: [...conflicts].filter((name) => locations[name] !== undefined).length }
}

// ---------------------------------------------------------------- one language

function buildLanguage(input: Inputs, language: TermLanguage): { file: TermsFile; coverage: Coverage } {
  const lang = input.localized[language.id]
  const english = input.english
  const api = <T>(tables: Map<string, Map<number, T>>, key: number, has: (value: T) => boolean): T | undefined => {
    for (const id of language.pokeapi) {
      const value = tables.get(id)?.get(key)
      if (value !== undefined && has(value)) return value
    }
    return undefined
  }

  const species: Record<string, string> = {}
  const genus: Record<string, string> = {}
  const flavor: Record<string, string> = {}
  for (const s of input.index.species) {
    const name = own(lang.species, english.species, s.id)
    if (name !== '' && name !== s.name) species[s.id] = name
    const localGenus = api(input.speciesNames, s.id, (v) => v.genus !== '')?.genus
    if (localGenus !== undefined && localGenus !== s.genus) genus[s.id] = localGenus
    const text = api(input.flavor, s.id, (v) => v.trim() !== '')
    if (text !== undefined) {
      const clean = cleanLocalFlavor(text, language.joinLines)
      if (clean !== '') flavor[s.id] = clean
    }
  }
  const englishSpecies = new Map(input.index.species.map((s) => [s.id, s.name]))
  const speciesName = (id: number): string => species[id] ?? englishSpecies.get(id)!

  const types: Record<string, string> = {}
  english.types.forEach((name, i) => {
    const id = name.toLowerCase()
    const text = own(lang.types, english.types, i)
    if (TYPE_IDS.has(id) && text !== '') types[id] = text
  })

  const abilities: Record<string, string> = {}
  for (const ability of ABILITIES) {
    const text = own(lang.abilities, english.abilities, ability.id)
    if (text !== '' && tidy(english.abilities[ability.id]) === ability.name) abilities[ability.id] = text
  }

  const items = dictionary(english.items, lang.items)
  const moves = dictionary(english.moves, lang.moves)
  const balls: Record<string, string> = {}
  for (const ball of BALLS) {
    // The four Hisuian balls carry a hand-written "(Hisui)" and stay English.
    const text = tidy(english.balls[ball.id]) === ball.name ? own(lang.balls, english.balls, ball.id) : (items.get(ball.name) ?? '')
    if (text !== '') balls[ball.id] = text
  }

  const formResult = formTerms(input, language, speciesName)
  const variants: Record<string, string> = {}
  for (const s of input.index.species) {
    for (const form of s.forms) {
      for (const variant of form.variants ?? []) {
        // Alcremie's sweets are items.
        const text = items.get(variant.name)
        if (text !== undefined) variants[`${s.id}-${form.f}-${variant.id}`] = text
      }
    }
  }

  const places = placeTerms(input, lang)

  // Names the evolution texts mention, so the app can rebuild those sentences in this language.
  const names: Record<string, string> = {}
  const mentioned = (how: string, name: string): boolean => {
    const at = how.indexOf(name)
    if (at < 0) return false
    const before = how[at - 1]
    const after = how[at + name.length]
    return (before === undefined || before === ' ') && (after === undefined || after === ' ' || after === ',' || after === ')')
  }
  // A name that reads the same in this language is listed too: the app only fills in names it finds here.
  const withEnglish = (list: readonly string[], local: Map<string, string>): [string, string][] =>
    list.map(tidy).filter((name) => name !== '').map((name): [string, string] => [name.replace(/[‘’]/g, "'"), local.get(name) ?? name])
  const candidates: [string, string][] = [
    ...withEnglish(english.items, items),
    ...withEnglish(english.moves, moves),
    ...input.index.species.map((s): [string, string] => [s.name, speciesName(s.id)])
  ]
  for (const [name, text] of candidates) {
    if (name.length < 3 || names[name] !== undefined) continue
    if (input.hows.some((how) => mentioned(how, name))) names[name] = text
  }

  const file: TermsFile = {
    v: 1, language: language.id, species, genus, forms: formResult.forms, formFull: formResult.formFull, variants, types, abilities, balls,
    ...gameTerms(lang, english, language.brand), flavor, locations: places.locations, names
  }
  return {
    file,
    coverage: {
      species: Object.keys(species).length, genus: Object.keys(genus).length, flavor: Object.keys(flavor).length,
      formsFromPokeapi: formResult.fromPokeapi, formsComposed: formResult.composed, formsEnglish: formResult.english,
      locations: Object.keys(places.locations).length, locationConflicts: places.conflicts, names: Object.keys(names).length
    }
  }
}

function main(): void {
  const input = loadInputs()
  fs.mkdirSync(TERMS_DIR, { recursive: true })
  for (const name of fs.readdirSync(TERMS_DIR)) if (name.endsWith('.json')) fs.rmSync(path.join(TERMS_DIR, name))
  console.log(`terms: ${input.places.length} place names and ${input.hows.length} evolution texts in the datasets`)
  console.log('language       size  species  genus  entries  forms: PokeAPI / composed / English  places (named differently between games)  names')
  for (const language of TERM_LANGUAGES) {
    const { file, coverage: c } = buildLanguage(input, language)
    const text = JSON.stringify(file)
    fs.writeFileSync(path.join(TERMS_DIR, `${language.id}.json`), text)
    console.log(
      `${language.id.padEnd(8)} ${formatBytes(Buffer.byteLength(text)).padStart(10)} ${String(c.species).padStart(8)} ${String(c.genus).padStart(6)} ${String(c.flavor).padStart(8)}` +
        `  ${`${c.formsFromPokeapi} / ${c.formsComposed} / ${c.formsEnglish}`.padEnd(34)} ${`${c.locations} (${c.locationConflicts})`.padEnd(41)} ${c.names}`
    )
  }
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
