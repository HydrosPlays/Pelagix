/**
 * "Import from ShinyDex" as pure functions: the entries of a ShinyDex export or the rows of a saved
 * History page (`ShinyDexHistory`) become the same preview rows and entries as a game save's
 * Pokémon (see model.ts). A row says which Pokémon, which game, how and when; a page also says in
 * which ball, an export whatever details it holds. Nothing else is filled in, and nothing but
 * entries ever comes out of here: rules, settings and achievements are not the import's business.
 */

import { BALL_BY_ID, BALLS } from '@shared/balls'
import { GAME_BY_ID, type GameDef } from '@shared/games'
import type { CatchEntry, DexRules, EntryKind } from '@shared/save-types'
import type { ShinyDexFailure, ShinyDexHistory, ShinyDexKnown, ShinyDexRow } from '@shared/shinydex-types'
import { collectionFor, slotKeyFor } from '@renderer/domain/slots'
import { draftToInput, settleDraft, TEXT_LIMITS, type Draft } from '@renderer/features/entry/draft'
import type { Dex } from '@renderer/lib/data'
import { ENTRY_KINDS, formatCount, isIsoDate, plural } from '@renderer/lib/format'
import { normalizeText } from '@renderer/lib/search'
import type { EntryInput } from '@renderer/store/save'
import { byFingerprint, type ImportSource, type Preview, type PreviewOptions, type PreviewRow } from './model'

// ---------------------------------------------------------------- wording

/** One plain sentence per way reading the picked file can fail. */
export const SHINYDEX_FAILURE_TEXT: Readonly<Record<ShinyDexFailure, string>> = {
  'not-shinydex': 'That file is neither a ShinyDex export nor a saved ShinyDex History page: no shinies were found in it.',
  'too-large': 'That file is too large to be a ShinyDex export or a saved ShinyDex page.',
  unreadable: 'That file could not be opened. Another program may be using it.'
}

export function shinyDexFailureText(reason: unknown): string {
  return typeof reason === 'string' && Object.hasOwn(SHINYDEX_FAILURE_TEXT, reason) ? SHINYDEX_FAILURE_TEXT[reason as ShinyDexFailure] : 'Something went wrong while reading that file.'
}

// ---------------------------------------------------------------- games

/** Letters and digits only, lower case: how every slug and name below is compared. */
const compact = (text: string): string => normalizeText(text).replace(/ /g, '')

/**
 * ShinyDex's game slugs (the file name of its game icon, and the game of an export's entry) that differ from the app's game ids.
 * Every other slug is the app's id as it stands: "firered", "soulsilver", "brilliantdiamond", "y".
 * Only "za" is seen in a real page; the rest are the spellings such an icon is likely to have.
 */
const GAME_ALIASES: Readonly<Record<string, string>> = {
  za: 'legendsza',
  legendsza: 'legendsza',
  pla: 'legendsarceus',
  arceus: 'legendsarceus',
  lgp: 'letsgopikachu',
  lge: 'letsgoeevee',
  letsgopikachu: 'letsgopikachu',
  letsgoeevee: 'letsgoeevee'
}

/** Games a hunt is logged in; the app's other ids (HOME, the Stadium games ...) are never a ShinyDex game. */
const HUNT_GAME = (g: GameDef): boolean => g.kind === 'main' || g.id === 'colosseum' || g.id === 'xd' || g.id === 'go'

export function gameOfSlug(slug: string): GameDef | undefined {
  const key = compact(slug)
  const game = GAME_BY_ID.get(Object.hasOwn(GAME_ALIASES, key) ? GAME_ALIASES[key]! : key)
  return game && HUNT_GAME(game) ? game : undefined
}

// ---------------------------------------------------------------- methods

/**
 * The entry kind a ShinyDex method clearly implies, by the method's name without case and
 * punctuation. Anything else is "other": Soft Resets can be a gift, a fossil or a legendary, and
 * the Game Corner hands out prizes. The method text itself is always kept as the entry's method.
 */
const METHOD_KINDS: Readonly<Record<string, EntryKind>> = Object.fromEntries(
  (
    [
      ['wild', ['Random Encounters', 'Random Encounter', 'Horde Encounters', 'Horde Encounter', 'Hordes', 'Safari Encounters', 'Safari Zone', 'Friend Safari', 'Poké Radar', 'PokéRadar', 'Radar', 'Radar Chaining', 'Chain Fishing', 'Fishing', 'Zone Resets', 'Bench Resets', 'Hyperspace Encounter', 'Hyperspace Encounters', 'Run Away', 'SOS Chaining', 'SOS Calls', 'SOS', 'DexNav', 'DexNav Chaining', 'Headbutt', 'Rock Smash', 'Surfing', 'Sandwich', 'Sandwich Method', 'Catch Combo', 'Ultra Wormholes']],
      ['bred', ['Masuda Method', 'Breeding', 'Egg Hatching', 'Eggs', 'Egg']],
      ['raid', ['Dynamax Adventures', 'Dynamax Adventure', 'Max Raid Battles', 'Max Raids', 'Max Raid', 'Raids', 'Raid']],
      ['tera', ['Tera Raid Battles', 'Tera Raids', 'Tera Raid']],
      ['outbreak', ['Mass Outbreaks', 'Mass Outbreak', 'Outbreaks', 'Outbreak', 'Massive Mass Outbreaks']]
    ] as const
  ).flatMap(([kind, names]) => names.map((name) => [compact(name), kind]))
)

export function kindOfMethod(method: string): EntryKind {
  const key = compact(method)
  return Object.hasOwn(METHOD_KINDS, key) ? METHOD_KINDS[key]! : 'other'
}

/**
 * The kind of a row. A method of ShinyDex's decides, also against an export's own kind: the export
 * marks everything as wild, Masuda Method and Dynamax Adventures included. For any other method an
 * export's kind stands when it is one the app has; everything else is "other".
 */
export function kindOfRow(row: Pick<ShinyDexRow, 'method' | 'known'>): EntryKind {
  const key = compact(row.method)
  if (Object.hasOwn(METHOD_KINDS, key)) return METHOD_KINDS[key]!
  const own = row.known?.kind.trim().toLowerCase()
  return ENTRY_KINDS.find((k) => k === own) ?? 'other'
}

// ---------------------------------------------------------------- balls

const BALL_BY_NAME: ReadonlyMap<string, number> = new Map(BALLS.map((b) => [compact(b.name), b.id]))

/** "nestBall" -> the Nest Ball's id, by the ball's name; null for a ball the app does not know. */
export function ballOfSlug(slug: string): number | null {
  return BALL_BY_NAME.get(compact(slug)) ?? null
}

// ---------------------------------------------------------------- Pokémon

const REGION_WORDS: Readonly<Record<string, string>> = { alola: 'alola', alolan: 'alola', galar: 'galar', galarian: 'galar', hisui: 'hisui', hisuian: 'hisui', paldea: 'paldea', paldean: 'paldea' }

interface Names {
  /** Display names ("Galarian Meowth", "Meowth") to species and form. */
  byName: Map<string, [number, number]>
  /** Species slugs ("mr-mime" as "mrmime") to species. */
  bySlug: Map<string, number>
}
const NAMES = new WeakMap<Dex, Names>()

function namesOf(dex: Dex): Names {
  let names = NAMES.get(dex)
  if (names) return names
  names = { byName: new Map(), bySlug: new Map() }
  for (const s of dex.speciesList) {
    if (s.slug !== '') names.bySlug.set(compact(s.slug), s.id)
    // A species' own name always means its first form, whatever a form of another species is called.
    names.byName.set(compact(s.name), [s.id, s.forms[0]?.f ?? 0])
  }
  for (const s of dex.speciesList) {
    for (const f of s.forms) {
      const key = compact(f.full)
      if (f.cat !== 'hidden' && key !== '' && !names.byName.has(key)) names.byName.set(key, [s.id, f.f])
    }
  }
  NAMES.set(dex, names)
  return names
}

/**
 * The species and form of a row, or null when the datasets do not know it. Never a guess:
 * - an entry of an export names both by number, and they stand when the datasets have that form;
 * - the name as shown is a form's full name ("Galarian Meowth") or a species' name ("Meowth");
 * - else the picture's slug is a species' slug, alone or with a region ("ponyta-galarian");
 * - a slug ending in "-f" / "-m" picks the form of that gender where the species has one
 *   (Meowstic, Indeedee ...) and otherwise only says which picture ShinyDex showed.
 */
export function resolvePokemon(dex: Dex, row: Pick<ShinyDexRow, 'name' | 'pokemon' | 'known'>): [number, number] | null {
  if (row.known) return dex.form(row.known.species, row.known.form) ? [row.known.species, row.known.form] : null
  const names = namesOf(dex)
  const exact = names.bySlug.get(compact(row.pokemon))
  const parts = row.pokemon.toLowerCase().split('-').filter(Boolean)
  const last = parts.at(-1) ?? ''
  // "nidoran-f" is a species of its own: a tail only counts when the whole slug is not one.
  const tail = exact === undefined && (last === 'f' || last === 'm' || Object.hasOwn(REGION_WORDS, last)) ? last : ''
  const speciesId = exact ?? (tail !== '' ? names.bySlug.get(compact(parts.slice(0, -1).join('-'))) : undefined)
  const species = speciesId === undefined ? undefined : dex.species(speciesId)
  const first = species?.forms[0]?.f ?? 0
  const region = tail !== '' && Object.hasOwn(REGION_WORDS, tail) ? REGION_WORDS[tail] : undefined
  const regional = region === undefined ? undefined : species?.forms.find((f) => f.region === region)

  let found = names.byName.get(compact(row.name)) ?? null
  if (found === null && species) {
    if (region === undefined) found = [species.id, first]
    else if (regional) found = [species.id, regional.f]
  }
  if (found === null) return null
  if (species && found[0] === species.id && found[1] === first) {
    // The name alone says neither a region ShinyDex left out of it nor a female form.
    const gendered = tail === 'f' || tail === 'm' ? species.forms.find((f) => f.cat === 'gender' && f.gender === tail) : undefined
    const other = regional ?? gendered
    if (other) found = [species.id, other.f]
  }
  return found
}

// ---------------------------------------------------------------- entries

const FINGERPRINT_PREFIX = 'shinydex:'

/**
 * What the app remembers of a row, so that it is not imported twice. One scheme for both files, so
 * that the export and the saved page of the same history, in either order, add nothing twice. No
 * id of a hunt is on the page, so this is what both files say of it: the Pokémon as the datasets
 * know it (species.form), the game as the app's id, the method and the day, then a running number
 * among the rows of the file that agree in all of these (two Pichu on one day by the same method
 * are "#0" and "#1"). The ball is not part of it: an export has none.
 *
 * It survives: the other kind of file, saving the page again, with another browser, in another
 * language of ShinyDex, with or without its pictures loaded; hunts added since (only they are new,
 * wherever they sit in the file); hunts removed; another spelling of a game. It does not survive a
 * hunt being edited on ShinyDex (Pokémon, game, method or date): that hunt then counts as a new
 * one. Game-save fingerprints never start with "shinydex:".
 */
export function fingerprintsOf(dex: Dex, rows: readonly ShinyDexRow[]): (string | null)[] {
  const seen = new Map<string, number>()
  return rows.map((row) => {
    const found = resolvePokemon(dex, row)
    const game = gameOfSlug(row.game)
    if (found === null || !game || row.date === null) return null
    const facts = `${found[0]}.${found[1]}|${game.id}|${compact(row.method).slice(0, 48)}|${row.date}`
    const n = seen.get(facts) ?? 0
    seen.set(facts, n + 1)
    return `${FINGERPRINT_PREFIX}${facts}#${n}`
  })
}

/** The entry a user would have logged by hand for this hunt, without id and timestamps. */
export function entryFromRow(dex: Dex, row: ShinyDexRow, pokemon: readonly [number, number], gameId: string, fingerprint: string, today: string): EntryInput {
  // A row of a page has none of an export's details.
  const known: Partial<ShinyDexKnown> = row.known ?? {}
  const kind = kindOfRow(row)
  const origin = known.origin
  const draft: Draft = {
    species: pokemon[0],
    form: pokemon[1],
    variant: null,
    game: gameId,
    kind,
    method: row.method.trim().slice(0, TEXT_LIMITS.method),
    location: (known.location ?? '').trim().slice(0, TEXT_LIMITS.location),
    origin: kind === 'evolved' && origin && dex.form(origin[0], origin[1]) ? [origin[0], origin[1]] : null,
    ball: row.known ? (known.ball !== undefined && BALL_BY_ID.has(known.ball) ? known.ball : null) : ballOfSlug(row.ball),
    gender: null,
    shiny: known.shiny !== false,
    gmax: false,
    alpha: false,
    level: known.level !== undefined && Number.isInteger(known.level) && known.level >= 1 && known.level <= 100 ? known.level : null,
    date: isIsoDate(row.date) && row.date <= today ? row.date : '',
    nickname: (known.nickname ?? '').trim().slice(0, TEXT_LIMITS.nickname),
    ot: (known.ot ?? '').trim().slice(0, TEXT_LIMITS.ot),
    notes: '',
    ability: null,
    abilityHidden: false,
    pid: '',
    ivs: [],
    evs: [],
    inHome: false
  }
  return { ...draftToInput(settleDraft(dex, draft)), fingerprint }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

/**
 * Sorts every row of the file into new, already imported or cannot be imported, and builds the
 * entry of each importable one. Nothing in here throws.
 */
export function buildShinyDexPreview(dex: Dex, history: ShinyDexHistory, existing: readonly CatchEntry[], rules: DexRules, options: Pick<PreviewOptions, 'today'>): Preview {
  const known = byFingerprint(existing)
  const collection = collectionFor(dex, existing, rules)
  const claimed = new Set<string>()
  const counts = { new: 0, imported: 0, egg: 0, unsupported: 0, fills: 0, completes: 0 }
  const list: readonly unknown[] = Array.isArray(history?.rows) ? history.rows : []
  const text = (v: unknown): boolean => v === undefined || typeof v === 'string'
  const validKnown = (k: unknown): boolean =>
    k === undefined ||
    (isRecord(k) && typeof k['species'] === 'number' && typeof k['form'] === 'number' && typeof k['shiny'] === 'boolean' && typeof k['kind'] === 'string' && text(k['location']) && text(k['ot']) && text(k['nickname']) &&
      (k['ball'] === undefined || typeof k['ball'] === 'number') && (k['level'] === undefined || typeof k['level'] === 'number') &&
      (k['origin'] === undefined || (Array.isArray(k['origin']) && k['origin'].length === 2 && k['origin'].every((n) => typeof n === 'number'))))
  const valid = (raw: unknown): raw is ShinyDexRow =>
    isRecord(raw) && typeof raw['name'] === 'string' && typeof raw['pokemon'] === 'string' && typeof raw['game'] === 'string' && typeof raw['method'] === 'string' && typeof raw['ball'] === 'string' && (raw['date'] === null || typeof raw['date'] === 'string') && validKnown(raw['known'])
  const blank: ShinyDexRow = { index: 0, name: '', pokemon: '', game: '', method: '', date: null, ball: '' }
  let prints: (string | null)[]
  try {
    prints = fingerprintsOf(dex, list.map((raw) => (valid(raw) ? raw : blank)))
  } catch {
    prints = []
  }

  const rows = list.map((raw, index): PreviewRow => {
    const shiny = !(valid(raw) && raw.known?.shiny === false)
    const cannot = (name: string, reason: string, at: readonly [number, number] = [0, 0], game?: GameDef): PreviewRow => ({ index, pokemon: { species: at[0], form: at[1], shiny, gender: 'n', fingerprint: '' }, status: 'unsupported', reason, name, game, fills: false })
    try {
      if (!valid(raw)) return cannot('Unknown Pokémon', 'It could not be read.')
      const shown = raw.name.trim() || dex.species(raw.known?.species ?? 0)?.name || 'Unknown Pokémon'
      const found = resolvePokemon(dex, raw)
      if (found === null) return cannot(shown, 'Pelagix does not know this Pokémon.')
      const name = dex.form(found[0], found[1])?.full ?? shown
      const game = gameOfSlug(raw.game)
      if (!game) return cannot(name, `Game not recognised${raw.game !== '' ? ` (${raw.game})` : ''}.`, found)
      const fingerprint = prints[index]
      if (raw.date === null || typeof fingerprint !== 'string') return cannot(name, 'Its date could not be read.', found, game)

      const entry = entryFromRow(dex, raw, found, game.id, fingerprint, options.today)
      const pokemon = { species: found[0], form: found[1], shiny, gender: entry.gender ?? 'n', fingerprint }
      const slotKey = slotKeyFor(entry, dex, rules) ?? undefined
      if (known.has(fingerprint)) return { index, pokemon, status: 'imported', name, game, entry, slotKey, fills: false }
      const fills = slotKey !== undefined && !collection.caught.has(slotKey) && !claimed.has(slotKey)
      if (fills) claimed.add(slotKey)
      return { index, pokemon, status: 'new', name, game, entry, slotKey, fills }
    } catch {
      return cannot('Unknown Pokémon', 'It could not be read.')
    }
  })

  for (const row of rows) {
    counts[row.status]++
    if (row.fills) counts.fills++
  }
  return { rows, counts, askGames: [] }
}

/** A ShinyDex export or a saved ShinyDex History page as the preview window shows it. */
export function shinyDexSource(history: ShinyDexHistory): ImportSource {
  const fromExport = history.source === 'export'
  const count = plural(history.rows.length, 'shiny Pokémon', 'shiny Pokémon')
  const notes = [
    history.dropped > 0 ? `This file lists more shinies than Pelagix reads at once. The last ${formatCount(history.dropped)} are left out.` : '',
    history.unusable > 0 ? `${plural(history.unusable, 'entry', 'entries')} in this file could not be read and ${history.unusable === 1 ? 'is' : 'are'} left out.` : ''
  ].filter(Boolean)
  return {
    fileName: history.fileName,
    icon: 'sparkle',
    description: fromExport
      ? `${history.fileName} is a ShinyDex export with ${count}. Nothing has changed yet, and the file is only read. Only its Pokémon are read: game, method, date and whatever details it holds. Your rules, settings and achievements stay as they are.`
      : `${history.fileName} is a saved ShinyDex history with ${count}. Nothing has changed yet, and the file is only read. Game, method, date and ball come from ShinyDex; anything else you add by hand.`,
    ...(notes.length > 0 && { note: notes.join(' ') }),
    empty: 'There are no shinies in this file.',
    listLabel: 'Shinies in this file',
    columns: 'hunt',
    preview: (dex, existing, rules, options) => buildShinyDexPreview(dex, history, existing, rules, options)
  }
}
