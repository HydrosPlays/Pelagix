/**
 * Everything the "Where to find it" section needs to know, as pure functions: how a game relates
 * to a form, the order and wording of the source sections, grouping rows by place, filtering,
 * and building the entry preset a "Log" button opens the editor with.
 */

import type { EncounterKind, EncounterRow, EvolveSource, FamilyNode, FormSummary, SourceVia, SpeciesDetail, SpeciesSummary } from '@shared/dex-types'
import { GAMES, GENERATION_NAMES, type GameDef } from '@shared/games'
import type { CatchEntry } from '@shared/save-types'
import { presetFromBreed, presetFromEvolve, presetFromRow, rowLocation, type GameSources, type SourcePreset } from '@renderer/domain/encounters'
import type { Dex } from '@renderer/lib/data'
import { formatDate, kindLabel } from '@renderer/lib/format'
import { normalizeText } from '@renderer/lib/search'

// ---------------------------------------------------------------- a game's relation to a form

/**
 * obtainable  it can be caught, gifted, traded in-game, raided, evolved or bred there
 * event       every source there is time-limited
 * transfer    the form exists in the game but has to be brought in
 * absent      the form is not in the game at all
 */
export type GameState = 'obtainable' | 'event' | 'transfer' | 'absent'

export function gameState(dex: Dex, form: FormSummary, gameId: string): GameState {
  if (dex.isObtainable(form, gameId)) return 'obtainable'
  if (dex.isEventOnly(form, gameId)) return 'event'
  if (dex.isPresent(form, gameId)) return 'transfer'
  return 'absent'
}

export interface GameGroup {
  /** "Generation I" ... or "Other" for Pokémon GO and HOME. */
  label: string
  games: Array<{ game: GameDef; state: GameState }>
}

export interface GameOverview {
  /** Every game, canonical order, grouped by generation. */
  groups: GameGroup[]
  counts: Record<GameState, number>
}

export function gameOverview(dex: Dex, form: FormSummary): GameOverview {
  const groups: GameGroup[] = []
  const counts: Record<GameState, number> = { obtainable: 0, event: 0, transfer: 0, absent: 0 }
  for (const game of GAMES) {
    const label = GENERATION_NAMES[game.generation] ?? 'Other'
    const state = gameState(dex, form, game.id)
    counts[state]++
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.games.push({ game, state })
    else groups.push({ label, games: [{ game, state }] })
  }
  return { groups, counts }
}

/** Mega Evolutions and other battle-only forms: in the games, but never something you obtain or keep. */
export function isBattleOnly(form: Pick<FormSummary, 'cat'>): boolean {
  return form.cat === 'mega' || form.cat === 'battle'
}

/** "Obtainable in 23 games", with the event-only and transfer-only counts when there are any. */
export function overviewSummary(counts: Record<GameState, number>, battleOnly = false): string {
  const games = (n: number): string => `${n} ${n === 1 ? 'game' : 'games'}`
  if (battleOnly && counts.obtainable === 0 && counts.event === 0) return counts.transfer > 0 ? `Seen in battle in ${games(counts.transfer)}` : 'Not in any game'
  const parts: string[] = []
  if (counts.obtainable > 0) parts.push(`Obtainable in ${games(counts.obtainable)}`)
  if (counts.event > 0) parts.push(`${parts.length === 0 ? 'Event only' : 'event only'} in ${counts.event}`)
  if (counts.transfer > 0) parts.push(`${parts.length === 0 ? 'Transfer only' : 'transfer only'} in ${counts.transfer}`)
  return parts.length === 0 ? 'Not obtainable in any game' : parts.join(' · ')
}

/**
 * The game to show first: the one picked earlier this session when the form can be had there,
 * else an obtainable game the user already logs in (the most recently used), else the first
 * obtainable game, then the first event game, then the first game the form exists in.
 */
export function defaultGameId(dex: Dex, form: FormSummary, remembered: string | null, entries: readonly Pick<CatchEntry, 'game' | 'createdAt'>[]): string | null {
  if (remembered !== null) {
    const state = gameState(dex, form, remembered)
    if (state === 'obtainable' || state === 'event') return remembered
  }
  const obtainable = dex.obtainableGames(form)
  if (obtainable.length > 0) {
    const ids = new Set(obtainable.map((g) => g.id))
    let latest: Pick<CatchEntry, 'game' | 'createdAt'> | undefined
    for (const entry of entries) {
      if (ids.has(entry.game) && (!latest || entry.createdAt > latest.createdAt)) latest = entry
    }
    return latest?.game ?? obtainable[0]!.id
  }
  return dex.eventGames(form)[0]?.id ?? dex.presentGames(form)[0]?.id ?? null
}

// ---------------------------------------------------------------- sections

export type SectionId = 'wild' | 'static' | 'gift' | 'trade' | 'raid' | 'shadow' | 'walker' | 'dream' | 'evolve' | 'change' | 'breed' | 'event'

/** The order a player thinks in: catch it, be given it, make it, and last the time-limited ways. */
export const SECTION_ORDER: readonly SectionId[] = ['wild', 'static', 'gift', 'trade', 'raid', 'shadow', 'walker', 'dream', 'evolve', 'change', 'breed', 'event']

export type SectionIcon = 'map-pin' | 'target' | 'gift' | 'swap' | 'bolt' | 'moon' | 'gamepad' | 'globe' | 'evolve' | 'refresh' | 'egg' | 'star'

export const SECTION_INFO: Readonly<Record<SectionId, { title: string; chip: string; icon: SectionIcon; one: string; many: string }>> = {
  wild: { title: 'Catch in the wild', chip: 'Wild', icon: 'map-pin', one: 'place', many: 'places' },
  static: { title: 'Static encounters', chip: 'Static', icon: 'target', one: 'encounter', many: 'encounters' },
  gift: { title: 'Gifts and eggs', chip: 'Gifts', icon: 'gift', one: 'gift', many: 'gifts' },
  trade: { title: 'In-game trades', chip: 'Trades', icon: 'swap', one: 'trade', many: 'trades' },
  raid: { title: 'Raids and outbreaks', chip: 'Raids', icon: 'bolt', one: 'source', many: 'sources' },
  shadow: { title: 'Shadow Pokémon', chip: 'Shadow', icon: 'moon', one: 'encounter', many: 'encounters' },
  walker: { title: 'Pokéwalker', chip: 'Pokéwalker', icon: 'gamepad', one: 'course', many: 'courses' },
  dream: { title: 'Dream World', chip: 'Dream World', icon: 'globe', one: 'source', many: 'sources' },
  evolve: { title: 'Evolve', chip: 'Evolve', icon: 'evolve', one: 'way', many: 'ways' },
  change: { title: 'Change form', chip: 'Change form', icon: 'refresh', one: 'way', many: 'ways' },
  breed: { title: 'Breed', chip: 'Breed', icon: 'egg', one: 'way', many: 'ways' },
  event: { title: 'Events', chip: 'Events', icon: 'star', one: 'event', many: 'events' }
}

const KIND_SECTION: Readonly<Record<EncounterKind, SectionId>> = {
  wild: 'wild',
  static: 'static',
  gift: 'gift',
  egg: 'gift',
  trade: 'trade',
  raid: 'raid',
  tera: 'raid',
  outbreak: 'raid',
  shadow: 'shadow',
  walker: 'walker',
  dream: 'dream',
  event: 'event'
}

const VIA_LABELS: Readonly<Record<SourceVia, string>> = {
  stadium: 'Pokémon Stadium',
  stadium2: 'Pokémon Stadium 2',
  boxrubysapphire: 'Pokémon Box',
  colosseum: 'Colosseum Bonus Disc',
  xd: 'Pokémon XD',
  ranch: 'My Pokémon Ranch',
  ereader: 'e-Reader',
  ranger: 'Pokémon Ranger',
  home: 'Pokémon HOME',
  go: 'Pokémon GO'
}

/** Game whose icon stands for a side product, when the app has one. */
const VIA_GAME: Readonly<Partial<Record<SourceVia, string>>> = { stadium: 'stadium', stadium2: 'stadium2', boxrubysapphire: 'boxrubysapphire', colosseum: 'colosseum', xd: 'xd', home: 'home', go: 'go' }

export function viaLabel(via: SourceVia): string {
  return VIA_LABELS[via] ?? 'Another game'
}

export function viaGameId(via: SourceVia): string | undefined {
  return VIA_GAME[via]
}

/** One encounter row, ready to print. */
export interface SourceRow {
  /** Stable within a game's list. */
  key: string
  row: EncounterRow
  location: string | undefined
  /** Headline: the method, or the event's own title, else the kind. */
  title: string
  /** Secondary line: the method under an event title, the note under a method. */
  detail: string | undefined
  /** Conditions without "Alpha", which gets its own badge. */
  conditions: string[]
  alpha: boolean
  /** Normalised text the filter box matches against. */
  search: string
}

/** Rows that share a place; rows without one stand alone. */
export interface SourceBlock {
  key: string
  location: string | undefined
  rows: SourceRow[]
}

export interface RowSection {
  id: SectionId
  blocks: SourceBlock[]
  /** Number of rows. */
  count: number
}

export interface SourceView {
  /** Sections that have direct sources, in display order. */
  sections: RowSection[]
  /** Evolutions from another species. */
  evolve: EvolveSource[]
  /** Form changes and fusions from the same species. */
  change: EvolveSource[]
  breed: boolean
  /** Rows + evolutions + form changes + breeding. */
  total: number
  /** Ids of every section with something in it, display order. */
  present: SectionId[]
}

export function eventDates(row: EncounterRow): string | undefined {
  const from = row.x?.from
  const to = row.x?.to
  if (from !== undefined && to !== undefined) return from === to ? formatDate(from) : `${formatDate(from)} – ${formatDate(to)}`
  if (from !== undefined) return `From ${formatDate(from)}`
  if (to !== undefined) return `Until ${formatDate(to)}`
  return undefined
}

function describeRow(detail: SpeciesDetail, row: EncounterRow, key: string): SourceRow {
  const location = rowLocation(detail, row)
  const conditions = (row.c ?? []).filter((c) => c !== 'Alpha')
  const method = row.m ?? kindLabel(row.k)
  // An event is known by its distribution title; everything else by how you run into it.
  const eventTitled = row.k === 'event' && row.n !== undefined
  const title = eventTitled ? row.n! : method
  const detailText = eventTitled ? method : row.n
  return {
    key,
    row,
    location,
    title,
    detail: detailText,
    conditions,
    alpha: row.c?.includes('Alpha') === true,
    search: normalizeText([location, title, detailText, ...conditions, row.x?.ot].filter(Boolean).join(' '))
  }
}

/** Sorts one game's sources into the sections of the page, rows grouped by place in dataset order. */
export function buildSourceView(detail: SpeciesDetail, sources: Pick<GameSources, 'rows' | 'evolve' | 'breed'>, speciesId: number): SourceView {
  const bySection = new Map<SectionId, { blocks: SourceBlock[]; byPlace: Map<string, SourceBlock>; count: number }>()
  sources.rows.forEach((row, index) => {
    const id = KIND_SECTION[row.k] ?? 'event'
    let section = bySection.get(id)
    if (!section) bySection.set(id, (section = { blocks: [], byPlace: new Map(), count: 0 }))
    const described = describeRow(detail, row, `r${index}`)
    section.count++
    if (described.location === undefined) {
      section.blocks.push({ key: described.key, location: undefined, rows: [described] })
      return
    }
    const existing = section.byPlace.get(described.location)
    if (existing) existing.rows.push(described)
    else {
      const block: SourceBlock = { key: `p${index}`, location: described.location, rows: [described] }
      section.byPlace.set(described.location, block)
      section.blocks.push(block)
    }
  })

  const evolve = sources.evolve.filter((e) => e.from[0] !== speciesId)
  const change = sources.evolve.filter((e) => e.from[0] === speciesId)
  const sections: RowSection[] = []
  const present: SectionId[] = []
  for (const id of SECTION_ORDER) {
    const section = bySection.get(id)
    if (section) sections.push({ id, blocks: section.blocks, count: section.count })
    if (section || (id === 'evolve' && evolve.length > 0) || (id === 'change' && change.length > 0) || (id === 'breed' && sources.breed)) present.push(id)
  }
  return { sections, evolve, change, breed: sources.breed, total: sources.rows.length + evolve.length + change.length + (sources.breed ? 1 : 0), present }
}

/** The blocks of a section that match the filter text; a block whose place matches keeps all its rows. */
export function filterBlocks(blocks: readonly SourceBlock[], query: string): SourceBlock[] {
  const needle = normalizeText(query)
  if (needle === '') return blocks as SourceBlock[]
  const out: SourceBlock[] = []
  for (const block of blocks) {
    if (block.location !== undefined && normalizeText(block.location).includes(needle)) {
      out.push(block)
      continue
    }
    const rows = block.rows.filter((r) => r.search.includes(needle))
    if (rows.length > 0) out.push(rows.length === block.rows.length ? block : { ...block, rows })
  }
  return out
}

/** How many blocks to show before "Show all": whole blocks until about `rowBudget` rows are on screen. */
export function initialBlockCount(blocks: readonly SourceBlock[], rowBudget: number): number {
  let rows = 0
  for (let i = 0; i < blocks.length; i++) {
    rows += blocks[i]!.rows.length
    if (rows >= rowBudget) return i + 1
  }
  return blocks.length
}

/** "Change form: examine a meteorite" -> "Examine a meteorite"; fusion texts are kept as they are. */
export function changeText(how: string): string {
  const stripped = how.replace(/^Change form:\s*/i, '')
  return stripped.charAt(0).toUpperCase() + stripped.slice(1)
}

// ---------------------------------------------------------------- breeding

/**
 * Family members that can lay the egg this form hatches from: the form itself and everything it
 * evolves into, minus baby Pokémon (which cannot breed) and forms that are not in the game.
 */
export function breedParents(dex: Dex, family: readonly FamilyNode[], speciesId: number, formIndex: number, gameId: string): FamilyNode[] {
  const key = (s: number, f: number): string => `${s}-${f}`
  const line = new Set<string>([key(speciesId, formIndex)])
  // Family lists are tiny; a few passes reach every descendant whatever the order of the nodes.
  for (let pass = 0; pass < family.length; pass++) {
    let grew = false
    for (const node of family) {
      if (node.from && line.has(key(node.from[0], node.from[1])) && !line.has(key(node.s, node.f))) {
        line.add(key(node.s, node.f))
        grew = true
      }
    }
    if (!grew) break
  }
  const out: FamilyNode[] = []
  const seen = new Set<string>()
  const consider = (s: number, f: number): void => {
    const k = key(s, f)
    if (!line.has(k) || seen.has(k)) return
    seen.add(k)
    const species = dex.species(s)
    const form = dex.form(s, f)
    if (!species || !form || species.tags.includes('baby') || form.cat === 'hidden') return
    if (!dex.isPresent(form, gameId)) return
    out.push({ s, f })
  }
  consider(speciesId, formIndex)
  for (const node of family) consider(node.s, node.f)
  return out
}

// ---------------------------------------------------------------- evolution family

export interface FamilyBranch {
  /** The node shown; for a group of sibling forms, the representative one. */
  node: FamilyNode
  /** Other forms of the same species reached the same way (Vivillon patterns, Alcremie creams). */
  alsoForms: number[]
  children: FamilyBranch[]
}

/**
 * Turns the flat family list into trees, one per base stage. Sibling forms of one species that
 * evolve the same way are folded into a single branch; `prefer` picks which of them is shown.
 */
export function buildFamilyTree(family: readonly FamilyNode[], prefer?: { species: number; form: number }): FamilyBranch[] {
  const key = (s: number, f: number): string => `${s}-${f}`
  const known = new Set(family.map((n) => key(n.s, n.f)))
  const kids = new Map<string, FamilyNode[]>()
  const roots: FamilyNode[] = []
  for (const node of family) {
    if (node.from && known.has(key(node.from[0], node.from[1])) && key(node.from[0], node.from[1]) !== key(node.s, node.f)) {
      const parent = key(node.from[0], node.from[1])
      const list = kids.get(parent)
      if (list) list.push(node)
      else kids.set(parent, [node])
    } else roots.push(node)
  }

  const build = (node: FamilyNode, trail: ReadonlySet<string>): FamilyBranch => {
    const self = key(node.s, node.f)
    const next = new Set(trail).add(self)
    const children: FamilyBranch[] = []
    const folded = new Map<string, FamilyNode[]>()
    for (const child of kids.get(self) ?? []) {
      if (next.has(key(child.s, child.f))) continue // a malformed loop must not hang the page
      const fold = `${child.s}|${child.how ?? ''}`
      const group = folded.get(fold)
      if (group) group.push(child)
      else folded.set(fold, [child])
    }
    for (const group of folded.values()) {
      // Forms that go on to evolve differently stay separate; only leaf siblings are folded.
      const leaves = group.filter((n) => !kids.has(key(n.s, n.f)))
      const others = group.filter((n) => kids.has(key(n.s, n.f)))
      for (const n of others) children.push(build(n, next))
      if (leaves.length > 0) {
        const shown = leaves.find((n) => prefer && n.s === prefer.species && n.f === prefer.form) ?? leaves[0]!
        children.push({ node: shown, alsoForms: leaves.filter((n) => n !== shown).map((n) => n.f), children: [] })
      }
    }
    return { node, alsoForms: [], children }
  }
  return roots.map((root) => build(root, new Set()))
}

/** True when any branch of the tree has more than one node. */
export function familyHasEvolutions(tree: readonly FamilyBranch[]): boolean {
  return tree.length > 1 || tree.some((b) => b.children.length > 0)
}

// ---------------------------------------------------------------- presets

/** What the hero is showing; carried into a new entry so "what you see is what you log". */
export interface ViewChoices {
  variant?: number
  female?: boolean
  gmax?: boolean
}

const GMAX_GAMES: ReadonlySet<string> = new Set(['sword', 'shield'])

/** Whether a Pokémon of this species can be female at all. */
export function canBeFemale(species: Pick<SpeciesSummary, 'genderRate'>, form: Pick<FormSummary, 'gender'>): boolean {
  if (form.gender !== undefined) return form.gender === 'f'
  return species.genderRate > 0
}

function withView(preset: SourcePreset, species: SpeciesSummary, form: FormSummary, view: ViewChoices | undefined): SourcePreset {
  if (!view) return preset
  const out: SourcePreset = { ...preset }
  if (view.variant !== undefined && form.variants?.some((v) => v.id === view.variant)) out.variant = view.variant
  if (view.female && out.gender === undefined && canBeFemale(species, form)) out.gender = 'f'
  if (view.gmax && form.gmax !== undefined && out.game !== undefined && GMAX_GAMES.has(out.game)) out.gmax = true
  return out
}

/** The Pokémon a "Log" button logs, and (inside an expanded pre-evolution) what it was caught as. */
export interface LogTarget {
  species: SpeciesSummary
  form: FormSummary
  view?: ViewChoices
  /** Set when the listed sources belong to an earlier stage: the entry records it as the origin. */
  origin?: [number, number]
}

export function rowPreset(target: LogTarget, game: Pick<GameDef, 'id'>, detail: SpeciesDetail, row: EncounterRow): SourcePreset {
  const preset = presetFromRow(target.species.id, target.form, game, detail, row)
  if (target.origin) {
    // The level and gender lock belong to what was caught; the level has certainly changed since.
    delete preset.level
    preset.origin = [target.origin[0], target.origin[1]]
  }
  return withView(preset, target.species, target.form, target.view)
}

export function evolvePreset(target: LogTarget, game: Pick<GameDef, 'id'>, source: EvolveSource): SourcePreset {
  return withView(presetFromEvolve(target.species.id, target.form, game, source), target.species, target.form, target.view)
}

export function breedPreset(target: LogTarget, game: Pick<GameDef, 'id'>): SourcePreset {
  const preset = presetFromBreed(target.species.id, target.form, game)
  if (target.origin) preset.origin = [target.origin[0], target.origin[1]]
  return withView(preset, target.species, target.form, target.view)
}

/** Logging by hand: only what is certain (the Pokémon, and the game when it makes sense there). */
export function manualPreset(target: LogTarget, game: Pick<GameDef, 'id'> | null, state: GameState | null): SourcePreset {
  const preset: SourcePreset = { species: target.species.id, form: target.form.f }
  if (game && state !== null && state !== 'absent') preset.game = game.id
  if (target.form.gender !== undefined) preset.gender = target.form.gender
  return withView(preset, target.species, target.form, target.view)
}

// ---------------------------------------------------------------- about

const REGIONAL_DEX: ReadonlyArray<[key: string, label: string]> = [
  ['kanto', 'Kanto'],
  ['original-johto', 'Johto'],
  ['updated-johto', 'Johto (HGSS)'],
  ['hoenn', 'Hoenn'],
  ['updated-hoenn', 'Hoenn (ORAS)'],
  ['original-sinnoh', 'Sinnoh'],
  ['extended-sinnoh', 'Sinnoh (Platinum)'],
  ['original-unova', 'Unova'],
  ['updated-unova', 'Unova (B2W2)'],
  ['kalos-central', 'Central Kalos'],
  ['kalos-coastal', 'Coastal Kalos'],
  ['kalos-mountain', 'Mountain Kalos'],
  ['original-alola', 'Alola'],
  ['updated-alola', 'Alola (USUM)'],
  ['letsgo-kanto', "Kanto (Let's Go)"],
  ['galar', 'Galar'],
  ['isle-of-armor', 'Isle of Armor'],
  ['crown-tundra', 'Crown Tundra'],
  ['hisui', 'Hisui'],
  ['paldea', 'Paldea'],
  ['kitakami', 'Kitakami'],
  ['blueberry', 'Blueberry'],
  ['lumiose-city', 'Lumiose'],
  ['hyperspace', 'Hyperspace']
]

/** The island sub-lists of Alola repeat the Alola dex and are left out. */
const SKIPPED_DEX = /^(original|updated)-(melemele|akala|ulaula|poni)$/

export interface RegionalNumber {
  key: string
  label: string
  number: number
}

/** Regional Pokédex numbers in release order; lists the app has no name for come last under a tidy label. */
export function regionalNumbers(dexNumbers: Readonly<Record<string, number>>): RegionalNumber[] {
  const out: RegionalNumber[] = []
  const used = new Set<string>()
  for (const [key, label] of REGIONAL_DEX) {
    const number = dexNumbers[key]
    if (typeof number !== 'number') continue
    used.add(key)
    // A remake's list that gives the same number as the original adds nothing: "Johto 76" says it all.
    const region = label.split(' (')[0]
    if (region !== label && out.some((n) => n.label === region && n.number === number)) continue
    out.push({ key, label, number })
  }
  for (const [key, number] of Object.entries(dexNumbers)) {
    if (used.has(key) || SKIPPED_DEX.test(key) || typeof number !== 'number') continue
    const label = key.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    out.push({ key, label, number })
  }
  return out
}

export function formatHeight(metres: number): string {
  const inches = Math.round(metres * 39.3701)
  return `${metres.toFixed(1)} m · ${Math.floor(inches / 12)}′${String(inches % 12).padStart(2, '0')}″`
}

export function formatWeight(kg: number): string {
  return `${kg.toFixed(1)} kg · ${(kg * 2.20462).toFixed(1)} lb`
}

export interface GenderSplit {
  /** Percentages, 0-100. */
  male: number
  female: number
}

/** Null for a genderless species. */
export function genderSplit(genderRate: number): GenderSplit | null {
  if (genderRate < 0) return null
  const female = Math.min(8, genderRate) * 12.5
  return { male: 100 - female, female }
}

const TAG_LABELS: Readonly<Record<string, string>> = {
  legendary: 'Legendary',
  mythical: 'Mythical',
  baby: 'Baby',
  starter: 'Starter',
  fossil: 'Fossil',
  'pseudo-legendary': 'Pseudo-legendary',
  'ultra-beast': 'Ultra Beast',
  paradox: 'Paradox'
}

export function tagLabel(tag: string): string {
  return TAG_LABELS[tag] ?? tag
}
