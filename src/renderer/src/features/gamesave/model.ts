/**
 * "Import from a game save" as pure functions: what the reader found (`GameSaveContents`) becomes
 * preview rows, and the chosen rows become ordinary entries, built the way the entry editor builds
 * them. Nothing here touches the save store or the picked file.
 */

import { BALL_BY_ID } from '@shared/balls'
import type { GameSaveContents, GameSaveFailure, GameSavePokemon, PkhexVersion } from '@shared/game-save-types'
import { GAMES, GAME_BY_ID, type GameDef } from '@shared/games'
import type { CatchEntry, DexRules, EntryKind } from '@shared/save-types'
import type { IconName } from '@renderer/components/ui'
import { collectionFor, slotKeyFor } from '@renderer/domain/slots'
import { draftToInput, settleDraft, TEXT_LIMITS, type Draft } from '@renderer/features/entry/draft'
import { t, type MessageKey } from '@renderer/i18n/runtime'
import { formFullName, gameName, gameShortName, speciesName } from '@renderer/i18n/terms'
import type { Dex } from '@renderer/lib/data'
import { englishKindLabel, isIsoDate, labelTable } from '@renderer/lib/format'
import type { EntryCompletion, EntryInput, EntryPatch } from '@renderer/store/save'

// ---------------------------------------------------------------- wording

const FAILURES: readonly GameSaveFailure[] = ['not-a-save', 'too-large', 'unreadable', 'reader-missing', 'reader-failed', 'timed-out']

/** One plain sentence per way reading a save can fail, read in the active language whenever it is asked for. */
export const FAILURE_TEXT: Readonly<Record<GameSaveFailure, string>> = labelTable(FAILURES, (reason) => t(`gamesave.failure.${reason}` as MessageKey))

export function failureText(reason: unknown): string {
  return (typeof reason === 'string' && Object.hasOwn(FAILURE_TEXT, reason) ? FAILURE_TEXT[reason as GameSaveFailure] : undefined) ?? FAILURE_TEXT['reader-failed']
}

// ---------------------------------------------------------------- games

const GAME_BY_PKHEX: ReadonlyMap<string, GameDef> = new Map(GAMES.flatMap((g) => (g.pkhex === null ? [] : [[g.pkhex, g] as const])))

/** PKHeX `GameVersion` names that stand for several games, as the app's game ids. */
const VERSION_GROUPS: Readonly<Record<string, readonly string[]>> = {
  RB: ['red', 'green', 'blue'],
  RBY: ['red', 'green', 'blue', 'yellow'],
  GS: ['gold', 'silver'],
  GSC: ['gold', 'silver', 'crystal'],
  RS: ['ruby', 'sapphire'],
  RSE: ['ruby', 'sapphire', 'emerald'],
  FRLG: ['firered', 'leafgreen'],
  CXD: ['colosseum', 'xd'],
  DP: ['diamond', 'pearl'],
  DPPt: ['diamond', 'pearl', 'platinum'],
  HGSS: ['heartgold', 'soulsilver'],
  BW: ['black', 'white'],
  B2W2: ['black2', 'white2'],
  XY: ['x', 'y'],
  ORAS: ['omegaruby', 'alphasapphire'],
  SM: ['sun', 'moon'],
  USUM: ['ultrasun', 'ultramoon'],
  GG: ['letsgopikachu', 'letsgoeevee'],
  SWSH: ['sword', 'shield'],
  BDSP: ['brilliantdiamond', 'shiningpearl'],
  SV: ['scarlet', 'violet']
}

/** The games a PKHeX version can mean: one for a single game, several for a pair, none when the app has no such game. */
export function gamesOfVersion(version: Pick<PkhexVersion, 'name'> | null | undefined): GameDef[] {
  const name = version?.name
  if (typeof name !== 'string') return []
  const single = GAME_BY_PKHEX.get(name)
  if (single) return [single]
  return Object.hasOwn(VERSION_GROUPS, name) ? VERSION_GROUPS[name]!.flatMap((id) => GAME_BY_ID.get(id) ?? []) : []
}

/**
 * The games a Pokémon can originate from, narrowest answer first: its own origin game, else the
 * game of the encounter PKHeX matched (the Game Boy formats only say "RBY" / "GSC"), else the
 * save's own game. A pair that the save itself belongs to is narrowed to the save's side.
 */
export function originGames(pokemon: Pick<GameSavePokemon, 'version' | 'encounter'>, saveVersion: PkhexVersion | null | undefined): GameDef[] {
  const own = gamesOfVersion(pokemon.version)
  if (own.length === 1) return own
  const met = gamesOfVersion(pokemon.encounter?.version)
  if (met.length === 1) return met
  const here = gamesOfVersion(saveVersion)
  const wide = met.length > 0 ? met : own.length > 0 ? own : here
  const narrowed = wide.filter((g) => here.includes(g))
  return narrowed.length > 0 ? narrowed : wide
}

/** "Pokémon Red", "Pokémon Red / Green / Blue", or what PKHeX calls the save when the app has no such game. */
export function saveGameName(contents: Pick<GameSaveContents, 'save'>): string {
  const games = gamesOfVersion(contents.save.version)
  if (games.length === 0) return t('gamesave.source.save.unknownGame', { generation: String(contents.save.generation) })
  return games.length === 1 ? gameName(games[0]!.id) : t('gamesave.source.save.games', { names: games.map((g) => gameShortName(g.id)).join(' / ') })
}

// ---------------------------------------------------------------- entries

/** Written into the entry, so it stays English like every stored method; shown through `methodLabel()`. */
const BRED_METHOD = 'Hatched from an Egg'

/**
 * A location name worth keeping, written the way the datasets write it. Empty for no name and for
 * PKHeX's placeholders ("(None)", "(Can't Tell)"). Colosseum and XD share one list of places, which
 * PKHeX prints as "Mt. Battle (C) / Citadark Isle (XD) [074]": only the side of `gameId` is kept.
 */
function place(location: { name: string } | null | undefined, gameId: string): string {
  let name = typeof location?.name === 'string' ? location.name.trim() : ''
  if (name === '' || /^\(.*\)$/.test(name)) return ''
  name = name.replace(/\s*\[\d+\]$/, '')
  const sides = /^(.+) \(C\) \/ (.+) \(XD\)$/.exec(name)
  if (sides) name = (gameId === 'xd' ? sides[2] : sides[1])!
  else name = name.replace(/ \((?:C|XD)\)$/, '')
  return name.slice(0, TEXT_LIMITS.location)
}

/**
 * The entry a user would have logged by hand for this Pokémon, without id and timestamps.
 *
 * - The game is the one it originates from, not the save it sits in.
 * - How it was obtained comes from the encounter PKHeX matched; without one the kind is "other".
 * - A Pokémon that has since evolved is recorded like the editor's "evolved from" source: kind
 *   "evolved", `origin` the species it was obtained as, and the original way as the method.
 * - Whatever the reader could not tell (no ball, no met level, no date ...) is left out.
 */
export function entryFromPokemon(dex: Dex, pokemon: GameSavePokemon, gameId: string, today: string): EntryInput {
  const met = pokemon.encounter
  const first: EntryKind = met ? met.kind : 'other'
  const evolved = met !== null && met.species !== pokemon.species
  const origin: [number, number] | null = evolved && dex.species(met.species) ? [met.species, dex.form(met.species, met.form) ? met.form : 0] : null
  const hatched = first === 'bred'
  const location = hatched ? place(pokemon.metLocation, gameId) || place(pokemon.eggLocation, gameId) : place(met?.location, gameId) || place(pokemon.metLocation, gameId)

  const draft: Draft = {
    species: pokemon.species,
    form: pokemon.form,
    variant: pokemon.formArgument,
    game: gameId,
    kind: evolved ? 'evolved' : first,
    method: evolved ? (hatched ? BRED_METHOD : englishKindLabel(first)) : hatched ? BRED_METHOD : '',
    location,
    origin,
    ball: BALL_BY_ID.has(pokemon.ball) ? pokemon.ball : null,
    gender: pokemon.gender,
    shiny: pokemon.shiny,
    gmax: pokemon.gmax,
    alpha: pokemon.alpha,
    level: Number.isInteger(pokemon.metLevel) && pokemon.metLevel >= 1 && pokemon.metLevel <= 100 ? pokemon.metLevel : null,
    date: isIsoDate(pokemon.metDate) && pokemon.metDate <= today ? pokemon.metDate : '',
    nickname: (pokemon.nickname ?? '').trim().slice(0, TEXT_LIMITS.nickname),
    ot: pokemon.ot.trim().slice(0, TEXT_LIMITS.ot),
    notes: '',
    // A value the reader left open, or one that is not what it should be, is left out by the draft's own rules.
    ability: typeof pokemon.ability === 'number' ? pokemon.ability : null,
    abilityHidden: pokemon.abilityHidden === true,
    pid: typeof pokemon.pid === 'string' ? pokemon.pid : '',
    ivs: Array.isArray(pokemon.ivs) ? pokemon.ivs : [],
    evs: Array.isArray(pokemon.evs) ? pokemon.evs : [],
    inHome: false
  }
  return { ...draftToInput(settleDraft(dex, draft)), fingerprint: pokemon.fingerprint }
}

type Value = 'ability' | 'abilityHidden' | 'pid' | 'ivs' | 'evs'

/**
 * The ability, PID, IVs and EVs that `entry` (a Pokémon as it would be imported now) has and `existing`
 * (the entry made from it earlier) lacks. Nothing `existing` already has is touched. Null when
 * there is nothing to add.
 */
export function missingValues(entry: Pick<EntryInput, Value>, existing: Pick<CatchEntry, Value>): EntryPatch | null {
  const patch: EntryPatch = {}
  // The Hidden mark belongs to the ability it came with: it is only added together with it.
  if (existing.ability === undefined && entry.ability !== undefined) {
    patch.ability = entry.ability
    if (entry.abilityHidden === true) patch.abilityHidden = true
  }
  if (existing.pid === undefined && entry.pid !== undefined) patch.pid = entry.pid
  if (existing.ivs === undefined && entry.ivs !== undefined) patch.ivs = entry.ivs
  if (existing.evs === undefined && entry.evs !== undefined) patch.evs = entry.evs
  return Object.keys(patch).length > 0 ? patch : null
}

/** The first entry made from each fingerprint. */
export function byFingerprint(existing: readonly CatchEntry[]): Map<string, CatchEntry> {
  const known = new Map<string, CatchEntry>()
  for (const e of existing) if (e.fingerprint !== undefined && !known.has(e.fingerprint)) known.set(e.fingerprint, e)
  return known
}

// ---------------------------------------------------------------- preview

export type RowStatus = 'new' | 'imported' | 'egg' | 'unsupported'

const STATUSES: readonly RowStatus[] = ['new', 'imported', 'egg', 'unsupported']

/** Name of each status, read in the active language whenever it is asked for. */
export const STATUS_LABELS: Readonly<Record<RowStatus, string>> = labelTable(STATUSES, (status) => t(`gamesave.status.${status}` as MessageKey))

/** What a preview row shows and compares of the Pokémon behind it, whatever it was read from. */
export type PreviewPokemon = Pick<GameSavePokemon, 'species' | 'form' | 'shiny' | 'gender' | 'fingerprint'>

export interface PreviewRow {
  /** Position in what was read; the row's identity within one preview. */
  index: number
  pokemon: PreviewPokemon
  status: RowStatus
  /** Why an `unsupported` row cannot be imported. */
  reason?: string
  /** Display name: "Alolan Raichu", or "Pokémon #1234" when the datasets do not know it. */
  name: string
  /** The game it originates from, when that is settled. */
  game?: GameDef
  /** The entry it becomes. Present on `new` and `imported` rows. */
  entry?: EntryInput
  /** Living Dex slot the entry lands in. */
  slotKey?: string
  /** A `new` row that is the first in this save to fill a slot that is still empty. */
  fills: boolean
  /** An `imported` row whose earlier entry lacks an ability, PID, IVs or EVs that this save has: confirming adds them to it. */
  completes?: boolean
}

export interface Preview {
  rows: PreviewRow[]
  counts: Record<RowStatus, number> & { fills: number; completes: number }
  /**
   * Games to ask the user about: some Pokémon only say which pair of games they are from (the
   * Game Boy saves do not record more). Empty when nothing needs asking.
   */
  askGames: GameDef[]
}

export interface PreviewOptions {
  /** Today as yyyy-mm-dd; a met date after it is left out. */
  today: string
  /** The user's answer to `askGames`: used for every Pokémon that could be from that game. */
  game?: string | null
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

/**
 * Sorts every Pokémon of the save into one status and builds the entry of each importable one.
 * A row that cannot be made sense of becomes `unsupported`; nothing in here throws.
 */
export function buildPreview(dex: Dex, contents: GameSaveContents, existing: readonly CatchEntry[], rules: DexRules, options: PreviewOptions): Preview {
  const known = byFingerprint(existing)
  /** Earlier entries a row of this preview already completes: one entry is completed once. */
  const completed = new Set<string>()
  const collection = collectionFor(dex, existing, rules)
  const claimed = new Set<string>()
  const asked = new Set<GameDef>()
  const counts = { new: 0, imported: 0, egg: 0, unsupported: 0, fills: 0, completes: 0 }
  const list: readonly unknown[] = Array.isArray(contents?.pokemon) ? contents.pokemon : []

  const rows = list.map((raw, index): PreviewRow => {
    const pokemon = raw as GameSavePokemon
    const cannot = (name: string, reason: string, game?: GameDef): PreviewRow => ({ index, pokemon, status: 'unsupported', reason, name, game, fills: false })
    try {
      if (!isRecord(raw) || typeof pokemon.fingerprint !== 'string' || pokemon.fingerprint === '') return cannot(t('gamesave.row.unknownPokemon'), t('gamesave.reason.unreadable'))
      const species = dex.species(pokemon.species)
      const form = species ? dex.form(pokemon.species, pokemon.form) : undefined
      const name = species && form ? formFullName(species, form) : species ? speciesName(species) : t('lib.entry.unknownPokemon', { number: String(pokemon.species) })
      if (pokemon.egg === true) return { index, pokemon, status: 'egg', name: species ? t('gamesave.row.eggOf', { species: speciesName(species) }) : t('gamesave.row.egg'), fills: false }
      if (!species) return cannot(name, t('gamesave.reason.unknownPokemon'))
      if (!form) return cannot(name, t('gamesave.reason.unknownForm'))

      const games = originGames(pokemon, contents.save?.version)
      if (games.length === 0) return cannot(name, t('gamesave.reason.untrackedGame'))
      let game = games.length === 1 ? games[0] : undefined
      if (!game) {
        for (const g of games) asked.add(g)
        game = games.find((g) => g.id === options.game)
        if (!game) return cannot(name, options.game ? t('gamesave.reason.wrongGame') : t('gamesave.reason.askGame'))
      }

      const entry = entryFromPokemon(dex, pokemon, game.id, options.today)
      const slotKey = slotKeyFor(entry, dex, rules) ?? undefined
      const earlier = known.get(pokemon.fingerprint)
      if (earlier) {
        const completes = !completed.has(earlier.id) && missingValues(entry, earlier) !== null
        if (completes) completed.add(earlier.id)
        return { index, pokemon, status: 'imported', name, game, entry, slotKey, fills: false, ...(completes && { completes }) }
      }
      const fills = slotKey !== undefined && !collection.caught.has(slotKey) && !claimed.has(slotKey)
      if (fills) claimed.add(slotKey)
      return { index, pokemon, status: 'new', name, game, entry, slotKey, fills }
    } catch {
      return cannot(t('gamesave.row.unknownPokemon'), t('gamesave.reason.unreadable'))
    }
  })

  for (const row of rows) {
    counts[row.status]++
    if (row.fills) counts.fills++
    if (row.completes === true) counts.completes++
  }
  return { rows, counts, askGames: GAMES.filter((g) => asked.has(g)) }
}

/**
 * Something the preview window can show: what was read from one picked file, and the words that are
 * true for it. One object per picked file; the window tells files apart by it.
 */
export interface ImportSource {
  /** Name of the picked file, without its folder. */
  fileName: string
  icon: IconName
  /** What the file is, under the window's title. */
  description: string
  /** A warning above the list, when something of the file was left out. */
  note?: string
  /** Shown when the file holds nothing at all. */
  empty: string
  /** Accessible name of the list. */
  listLabel: string
  /** What a row shows next to the game: where and at which level it was met, or how and when it was obtained. */
  columns: 'met' | 'hunt'
  preview(dex: Dex, existing: readonly CatchEntry[], rules: DexRules, options: PreviewOptions): Preview
}

/** A game save as the preview window shows it. */
export function gameSaveSource(contents: GameSaveContents): ImportSource {
  const trainer = contents.save.trainer
  return {
    fileName: contents.fileName,
    icon: 'gamepad',
    description:
      trainer !== ''
        ? t('gamesave.source.save.descriptionTrainer', { file: contents.fileName, game: saveGameName(contents), trainer })
        : t('gamesave.source.save.description', { file: contents.fileName, game: saveGameName(contents) }),
    ...(contents.dropped > 0 && { note: t('gamesave.source.save.dropped', { count: contents.dropped }) }),
    empty: t('gamesave.source.save.empty'),
    listLabel: t('gamesave.source.save.list'),
    columns: 'met',
    preview: (dex, existing, rules, options) => buildPreview(dex, contents, existing, rules, options)
  }
}

/** The default choice: every Pokémon that is new. */
export function selectAllNew(rows: readonly PreviewRow[]): Set<number> {
  return new Set(rows.filter((r) => r.status === 'new').map((r) => r.index))
}

/** Only the Pokémon that fill a Living Dex slot which is still empty. */
export function selectFilling(rows: readonly PreviewRow[]): Set<number> {
  return new Set(rows.filter((r) => r.status === 'new' && r.fills).map((r) => r.index))
}

/** How many of the chosen rows would really be added. */
export function countChosen(rows: readonly PreviewRow[], selected: ReadonlySet<number>): number {
  return rows.reduce((n, r) => n + (r.status === 'new' && selected.has(r.index) ? 1 : 0), 0)
}

/**
 * The chosen rows as entries ready for `mergeEntries`, in save order. Only `new` rows are taken,
 * and never one whose fingerprint an entry in `existing` already carries, so confirming against a
 * preview that has gone stale adds nothing twice.
 */
export function entriesToImport(rows: readonly PreviewRow[], selected: ReadonlySet<number>, existing: readonly CatchEntry[], now: string, makeId: () => string): CatchEntry[] {
  const known = new Set(existing.flatMap((e) => (e.fingerprint === undefined ? [] : [e.fingerprint])))
  const out: CatchEntry[] = []
  for (const row of rows) {
    if (row.status !== 'new' || !row.entry || !selected.has(row.index) || known.has(row.pokemon.fingerprint)) continue
    out.push({ ...row.entry, id: makeId(), createdAt: now, updatedAt: now })
  }
  return out
}

/**
 * What confirming adds to earlier entries: for every `imported` row, the ability, PID, IVs and EVs its
 * entry in `existing` lacks. Worked out against `existing` as it is now, so a stale preview
 * overwrites nothing; each entry is completed at most once.
 */
export function entriesToComplete(rows: readonly PreviewRow[], existing: readonly CatchEntry[]): EntryCompletion[] {
  const known = byFingerprint(existing)
  const seen = new Set<string>()
  const out: EntryCompletion[] = []
  for (const row of rows) {
    if (row.status !== 'imported' || !row.entry) continue
    const earlier = known.get(row.pokemon.fingerprint)
    if (!earlier || seen.has(earlier.id)) continue
    const patch = missingValues(row.entry, earlier)
    if (patch === null) continue
    seen.add(earlier.id)
    out.push({ id: earlier.id, patch })
  }
  return out
}
