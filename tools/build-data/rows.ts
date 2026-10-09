/**
 * Converts the extractor's encounter rows into drafts of EncounterRow: one game, one location and
 * one method per draft. merge.ts then collapses conditions, merges levels and games, and sorts.
 * Real-world distributions (kinds event / event-egg) are handled by events.ts.
 */
import type { EncounterKind, EventInfo, SourceVia } from '../../src/shared/dex-types.ts'
import {
  FOSSIL_RULE_KEYS, fossilRule, hoennSwarm, ISLAND_SCAN_KEYS, ISLAND_SCAN_METHOD, islandScanDay, isUnreachableSlot, PRIZE_METHOD,
  PRIZES, prizeFor, prizeLocation, UNREACHABLE_SLOT_KEYS, VERSION_BOUND_KEYS, versionBound
} from './curated.ts'
import { applyEventItems } from './event-items.ts'
import { GAMES } from '../../src/shared/games.ts'
import { gameIdx, idxOfCode } from './game-map.ts'
import { GEN1_ENTRIES } from './gen1-locations.ts'
import type { LocationNames } from './locations.ts'
import { subAreaName } from './locations.ts'
import { kindOf, wildMethods } from './methods.ts'
import type { PkConditions, PkEncounter, PkEvolution } from './pkhex-types.ts'
import type { PlaceFamily, PokeapiPlaces } from './pokeapi-places.ts'
import {
  CRYSTAL_MAX_RAID, EVENT_MAX_RAID, EVENT_OUTBREAK, EVENT_TERA_RAID, GLOBAL_LINK_PROMOTION, MIGHTIEST_TERA_RAID, POKEWALKER_EVENT_COURSES,
  pokewalkerMethod
} from './row-order.ts'
import type { PkhexData } from './sources.ts'
import { FOSSIL_REVIVED_SPECIES, GENERATION_REGION, STARTER_BASE_SPECIES } from './tags.ts'
import { lookupTrade } from './trades.ts'
import { HIDDEN_PATTERN_SPECIES, HIDDEN_ROW_NOTE, VISIBLE_FORM } from './taxonomy.ts'
import type { FormClass } from './taxonomy.ts'
import { article, assert, fail, groupBy, sf, sfForm } from './util.ts'

export interface RowDraft {
  s: number
  f: number
  game: number
  k: EncounterKind
  m?: string
  loc?: string
  lv: [number, number]
  /** Conditions that always apply (Alpha, Feebas tiles ...). */
  c: string[]
  /** Raw time / weather sets; undefined = unrestricted. Collapsed per location by merge.ts. */
  time?: string[]
  weather?: string[]
  stars?: [number, number]
  sh?: 'locked' | 'forced'
  b?: number
  d?: 0 | 1 | 2
  notes: string[]
  via?: SourceVia
  rf?: 1
  x?: EventInfo
  /** The location is one the Pokémon only wanders into; kept only when it adds a place. */
  cross?: boolean
  /** Scarlet / Violet row PKHeX does not split by version. */
  svShared?: boolean
  /** Shown on a visible form on behalf of a hidden one (taxonomy.ts VISIBLE_FORM); not a source of its own. */
  copy?: boolean
}

export interface RowContext {
  pk: PkhexData
  locations: LocationNames
  places: PokeapiPlaces
  /** Per game index: keys of the forms present. */
  presence: Set<number>[]
  classes: Map<number, FormClass>
  speciesName: (species: number) => string
  generationOf: (species: number) => number
  /** The form has no gender, so a fixed gender on it can only mean "genderless". */
  genderless: (species: number, form: number) => boolean
  /** Evolution edges per game index, already filtered for that version. */
  evolutions: PkEvolution[][]
}

export interface RowStats {
  extractorRows: number
  ignoredGameRows: number
  gen1: { curated: number; pokeapiAgree: number; pokeapiDisagree: string[]; pokeapiSilent: number }
  cosplayFolded: number
  eventItemRows: number
  hiddenPatternCopies: number
  /** Extractor rows dropped because the game cannot produce them on its own (see curated.ts). */
  dropped: { headbuttNoTree: number; fossil: number; prize: number; swarm: number; unreachable: number; otherVersion: number }
  relabelled: { prize: number; islandScan: number; swarmFishing: number }
  /** Hidden Grotto rows given their route by PokeAPI, and the ones it does not know. */
  grottoes: { placed: number; unplaced: number }
}

/** Legends: Arceus regions (the first met location of every area). */
const PLA_REGIONS: ReadonlySet<number> = new Set([7, 8, 9, 10, 11])
/** Gold / Silver / Crystal fishing swarms, which PKHeX keeps as three fixed-level statics (Old, Good, Super Rod). */
const GEN2_FISHING_SWARMS: ReadonlySet<number> = new Set([211, 223])
const RODS = ['Old Rod', 'Good Rod', 'Super Rod'] as const
/** Above this many sub-areas a Legends: Arceus slot is simply "anywhere in the region". */
const PLA_MAX_SUBAREAS = 6

const TERA_MAP_PLACE: Readonly<Record<string, string>> = { Paldea: 'Paldea', Kitakami: 'Kitakami', Blueberry: 'Blueberry Academy (Terarium)' }

/** Givers of gift eggs whose name PKHeX stores as the egg's "met location". */
const EGG_GIVER: Readonly<Record<string, string>> = {
  'Traveling Man': 'the Traveling Man',
  Riley: 'Riley',
  Cynthia: 'Cynthia',
  'Mr. Pokémon': 'Mr. Pokémon',
  Primo: 'Primo',
  'PKMN Breeder (Egg)': 'a Pokémon Breeder',
  'an old hot-springs visitor': 'the old lady at the hot springs',
  'Nursery helpers': 'the Pokémon Nursery',
  Jacq: 'Jacq'
}

function shinyOf(h: PkEncounter['h']): RowDraft['sh'] {
  if (h === undefined) return undefined
  return h === 'Always' ? 'forced' : 'locked'
}

function teraNote(c: PkConditions): string | undefined {
  return c.teraType && c.teraType !== 'Random' ? `${c.teraType} Tera Type` : undefined
}

function isStarterGift(r: PkEncounter, game: number, ctx: RowContext): boolean {
  if (r.c?.starterPikachu || r.k === 'starter') return true
  const id = GAMES[game].id
  if ((id === 'letsgopikachu' && r.s === 25 && r.f === 8) || (id === 'letsgoeevee' && r.s === 133 && r.f === 1)) return true
  if (id === 'xd' && r.s === 133) return true
  // Legends games hand out first partners that are not native to their region.
  if (id === 'legendsarceus' && [722, 155, 501].includes(r.s) && r.l[1] <= 5) return true
  if (id === 'legendsza' && [152, 498, 158].includes(r.s) && r.l[1] <= 5) return true
  return STARTER_BASE_SPECIES.has(r.s) && r.l[1] <= 5 && GENERATION_REGION[ctx.generationOf(r.s)] === GAMES[game].region
}

export class RowBuilder {
  readonly drafts: RowDraft[] = []
  readonly stats: RowStats = {
    extractorRows: 0,
    ignoredGameRows: 0,
    gen1: { curated: 0, pokeapiAgree: 0, pokeapiDisagree: [], pokeapiSilent: 0 },
    cosplayFolded: 0,
    eventItemRows: 0,
    hiddenPatternCopies: 0,
    dropped: { headbuttNoTree: 0, fossil: 0, prize: 0, swarm: 0, unreachable: 0, otherVersion: 0 },
    relabelled: { prize: 0, islandScan: 0, swarmFishing: 0 },
    grottoes: { placed: 0, unplaced: 0 }
  }
  private readonly ctx: RowContext
  private readonly gen1Rows: PkEncounter[] = []
  private readonly cosplay: { r: PkEncounter; game: number }[] = []
  /** Legends: Arceus sub-area id -> region id, as the wild areas group them. */
  private readonly plaRegion = new Map<number, number>()
  /** Curated entries (curated.ts) that matched an extractor row, to catch stale ones. */
  private readonly curatedHits = new Map<string, number>()

  constructor(ctx: RowContext) {
    this.ctx = ctx
    for (const r of ctx.pk.encounters.rows) {
      if (r.t !== 'EncounterSlot8a' || !r.L || !PLA_REGIONS.has(r.L[0])) continue
      for (const id of r.L.slice(1)) {
        const known = this.plaRegion.get(id)
        if (known !== undefined && known !== r.L[0]) fail(`Legends: Arceus location ${id} is listed under two regions (${known} and ${r.L[0]})`)
        this.plaRegion.set(id, r.L[0])
      }
    }
  }

  private hit(key: string): void {
    this.curatedHits.set(key, (this.curatedHits.get(key) ?? 0) + 1)
  }

  /** Every curated correction must still correct something: PKHeX's tables change between versions. */
  private checkCurated(): void {
    const stale: string[] = []
    const expect = (key: string, times?: number): void => {
      const n = this.curatedHits.get(key) ?? 0
      if (times === undefined ? n === 0 : n !== times) stale.push(`${key} matched ${n} rows${times === undefined ? '' : `, expected ${times}`}`)
    }
    for (const key of FOSSIL_RULE_KEYS) expect(`fossil:${key}`)
    for (const key of UNREACHABLE_SLOT_KEYS) expect(`unreachable:${key}`)
    // Each version-bound encounter is seen once per game of its pair: kept in one, dropped in the other.
    for (const key of VERSION_BOUND_KEYS) expect(`bound:${key}`, 2)
    for (const entry of PRIZES) for (const game of entry.games) expect(`prize:${game}:${entry.species}:${entry.level}:${entry.city}`, 1)
    for (const key of ISLAND_SCAN_KEYS) {
      const group = key.split(':')[0]
      for (const game of GAMES) if (game.group === group) expect(`scan:${game.id}:${key}`, 1)
    }
    if (stale.length > 0) fail(`curated.ts entries that no longer match the PKHeX extract:\n  ${stale.join('\n  ')}`)
  }

  build(): RowDraft[] {
    const { encounters } = this.ctx.pk
    const codeIdx = encounters.games.map((code) => idxOfCode(code))
    for (const r of encounters.rows) {
      if (r.k === 'event' || r.k === 'event-egg') continue
      this.stats.extractorRows++
      const games = [...new Set(r.g.flatMap((i) => codeIdx[i]))].sort((a, b) => a - b)
      if (games.length === 0) {
        this.stats.ignoredGameRows++
        continue
      }
      if (r.x === 'Gen1' && r.k !== 'wild') {
        this.gen1Rows.push(r)
        continue
      }
      for (const game of games) this.convert(r, game)
    }
    this.foldCosplay()
    this.addGen1()
    this.checkCurated()
    this.stats.eventItemRows = applyEventItems(this.drafts)
    return this.showHiddenForms(this.expandSentinels(this.drafts))
  }

  // --- locations ---------------------------------------------------------------------------

  private placeNames(r: PkEncounter, ids: number[] | undefined, game: number): string[] {
    const out: string[] = []
    for (const id of ids ?? []) {
      let name = this.ctx.locations.name(r.x, id, game)
      // Legends: Arceus statics and gifts carry a bare sub-area; wild slots are shown as "Sub-area (Region)".
      const region = r.x === 'Gen8a' && r.t !== 'EncounterSlot8a' ? this.plaRegion.get(id) : undefined
      if (name !== undefined && region !== undefined) name = subAreaName(name, this.ctx.locations.name(r.x, region, game)!)
      if (name !== undefined && !out.includes(name)) out.push(name)
    }
    return out
  }

  /** Where a Legends: Arceus slot is found: its sub-areas, or the region when they cover most of it. */
  private plaPlaces(r: PkEncounter, game: number): string[] {
    const ids = r.L ?? []
    assert(ids.length > 0, `Legends: Arceus slot for species ${r.s} has no location`)
    // A few caves are areas of their own and carry no region.
    if (!PLA_REGIONS.has(ids[0])) return this.placeNames(r, ids, game)
    const region = this.ctx.locations.name(r.x, ids[0], game)!
    const subs = this.placeNames(r, ids.slice(1), game)
    // Space-time distortions and massive mass outbreaks are announced per region.
    const regionWide = r.m === 'Distortion' || r.m === 'MassOutbreakMassive'
    if (subs.length === 0 || subs.length > PLA_MAX_SUBAREAS || regionWide) return [region]
    return subs.map((sub) => subAreaName(sub, region))
  }

  private findPlace(r: PkEncounter, game: number, family: PlaceFamily): string | undefined {
    return this.ctx.places.find(game, r.s, r.f, family, r.l)
  }

  // --- conversion --------------------------------------------------------------------------

  private base(r: PkEncounter, game: number, k: EncounterKind): RowDraft {
    const classic = r.x === 'Gen1' || r.x === 'Gen2' // these games do not record a ball
    const d: RowDraft = { s: r.s, f: r.f, game, k, lv: [r.l[0], r.l[1]], c: [], notes: [] }
    const sh = shinyOf(r.h)
    if (sh) d.sh = sh
    if (r.b !== undefined && !classic) d.b = r.b
    // A few templates of genderless species carry a leftover "male".
    if (r.d !== undefined) d.d = this.ctx.genderless(r.s, r.f) ? 2 : r.d
    return d
  }

  private push(d: RowDraft): void {
    this.drafts.push(d)
  }

  /** True when PKHeX lists the encounter for this game only because it lumps a version pair. */
  private isOtherVersions(r: PkEncounter, game: number): boolean {
    const only = versionBound(game, r.k, r.s)
    if (only === undefined) return false
    this.hit(`bound:${GAMES[game].group}:${r.k}:${r.s}`)
    if (only === GAMES[game].id) return false
    this.stats.dropped.otherVersion++
    return true
  }

  private convert(r: PkEncounter, game: number): void {
    if (this.isOtherVersions(r, game)) return
    // ORAS cosplay Pikachu shares form indices 1-6 with the cap Pikachu; folded into one base-form row.
    if (r.s === 25 && r.f >= 1 && r.f <= 6 && r.x === 'Gen6') {
      this.cosplay.push({ r, game })
      return
    }
    // Generation 4 numbers Arceus's plates differently from index 9 on; no encounter uses them today.
    if (r.s === 493 && r.x === 'Gen4' && r.f >= 9) fail(`A Generation 4 encounter gives Arceus form ${r.f}; its index must be remapped`)
    const k = kindOf(r.k)
    switch (r.k) {
      case 'wild': return this.wild(r, game)
      case 'static':
      case 'static-fixed':
      case 'n-pokemon': return this.fixed(r, game)
      case 'gift':
      case 'starter':
      case 'ranch-gift': return this.gift(r, game)
      case 'gift-egg': return this.egg(r, game)
      case 'trade': return this.trade(r, game)
      case 'shadow': return this.simple(r, game, k, 'Shadow Pokémon', true)
      case 'pokewalker': {
        const course = r.c?.course ?? fail('Pokéwalker row without a course')
        return this.simple(r, game, k, pokewalkerMethod(course), false, POKEWALKER_EVENT_COURSES[course])
      }
      case 'dream-world': return this.simple(r, game, k, r.c?.promotion ? GLOBAL_LINK_PROMOTION : 'Dream World', true)
      case 'dream-radar': return this.simple(r, game, k, 'Dream Radar', false)
      case 'raid':
      case 'raid-event':
      case 'raid-crystal':
      case 'max-lair': return this.raid(r, game)
      case 'tera':
      case 'tera-event':
      case 'tera-7star': return this.tera(r, game)
      case 'outbreak-event': return this.outbreak(r, game)
      default: return fail(`Unhandled extractor kind "${r.k}"`)
    }
  }

  private wild(r: PkEncounter, game: number): void {
    const c = r.c ?? {}
    if (c.noTree) {
      this.stats.dropped.headbuttNoTree++
      return
    }
    let level: [number, number] | undefined
    if (r.t === 'EncounterSlot3Swarm') {
      const own = hoennSwarm(game, r.s)
      if (own === undefined) {
        this.stats.dropped.swarm++
        return
      }
      if (own !== 'any') {
        assert(r.l[0] <= own && own <= r.l[1], `Hoenn outbreak of species ${r.s}: level ${own} is outside PKHeX's ${r.l.join('-')}`)
        level = [own, own]
      }
    }
    const sv = r.t === 'EncounterSlot9'
    const make = (loc: string | undefined, cross: boolean, levels: [number, number] | undefined = level): void => {
      if (isUnreachableSlot(game, r.s, loc)) {
        this.hit(`unreachable:${GAMES[game].id}:${r.s}:${loc}`)
        this.stats.dropped.unreachable++
        return
      }
      for (const label of wildMethods(r, loc)) {
        const d = this.base(r, game, 'wild')
        if (levels) d.lv = [levels[0], levels[1]]
        if (label.m) d.m = label.m
        if (loc !== undefined) d.loc = loc
        else if (!label.noPlace) fail(`Wild ${r.t} row for species ${r.s} in ${GAMES[game].id} has no usable location (${JSON.stringify(r.L)})`)
        if (label.c) d.c.push(...label.c)
        if (c.alpha) d.c.push('Alpha')
        if (c.time) d.time = c.time
        // SwSh fishing and berry-tree slots ignore the weather the same table's grass slots need.
        if (c.weather && label.m !== 'Fishing' && label.m !== 'Berry tree') d.weather = c.weather
        if (cross) {
          d.cross = true
          d.notes.push('Wanders in from a neighbouring area')
        }
        if (sv) d.svShared = true
        this.push(d)
      }
    }
    let places: string[]
    if (r.t === 'EncounterSlot8a') places = this.plaPlaces(r, game)
    else if (c.pokeSpot) places = [`${c.pokeSpot} Poké Spot`]
    else places = this.placeNames(r, r.L, game)
    if (places.length === 0 && c.hiddenGrotto) {
      // PKHeX has one "Hidden Grotto" location for all twenty grottoes; PokeAPI knows which route each Pokémon's is on.
      const grottoes = this.ctx.places.all(game, r.s, r.f, 'grotto')
      for (const hit of grottoes) {
        // One grotto: PKHeX's range is exact. Several: each has its own band inside PKHeX's envelope
        // (PokeAPI's upper bounds run one level short of PKHeX's).
        const band: [number, number] = grottoes.length === 1 ? [r.l[0], r.l[1]] : [Math.max(hit.min, r.l[0]), Math.min(hit.max + 1, r.l[1])]
        make(hit.location, false, band[0] <= band[1] ? band : [r.l[0], r.l[1]])
        this.ctx.places.usedNames.add(hit.location)
        this.stats.grottoes.placed++
      }
      if (grottoes.length > 0) return
      this.stats.grottoes.unplaced++
    }
    if (places.length === 0) make(undefined, false)
    for (const loc of places) make(loc, false)
    for (const loc of this.placeNames(r, r.A, game)) if (!places.includes(loc)) make(loc, true)
  }

  /** A Gold / Silver / Crystal fishing swarm: one wild row per rod, at the rod's level. */
  private swarmFishing(r: PkEncounter, game: number): void {
    assert(r.ls?.length === RODS.length, `Generation 2 fishing swarm of species ${r.s} no longer has one level per rod`)
    const places = this.placeNames(r, r.L, game)
    assert(places.length === 1, `Generation 2 fishing swarm of species ${r.s} has ${places.length} locations`)
    RODS.forEach((rod, i) => {
      const d = this.base(r, game, 'wild')
      d.m = rod
      d.lv = [r.ls![i][0], r.ls![i][1]]
      d.loc = places[0]
      d.c.push('Swarm')
      this.push(d)
      this.stats.relabelled.swarmFishing++
    })
  }

  private fixed(r: PkEncounter, game: number): void {
    const c = r.c ?? {}
    if (r.x === 'Gen2' && r.k === 'static' && GEN2_FISHING_SWARMS.has(r.s)) return this.swarmFishing(r, game)
    const scanDay = r.t === 'EncounterStatic7' && r.k === 'static' ? islandScanDay(game, r.s, r.l[0]) : undefined
    if (scanDay) this.hit(`scan:${GAMES[game].id}:${GAMES[game].group}:${r.s}:${r.l[0]}`)
    const template = (loc: string | undefined, cross: boolean): void => {
      const d = this.base(r, game, 'static')
      if (c.roaming) d.m = 'Roaming'
      else if (c.titan) d.m = 'Titan Pokémon'
      else if (c.hyperspace) d.m = 'Hyperspace'
      else if (c.totem) d.m = 'Totem'
      else if (scanDay) {
        d.m = ISLAND_SCAN_METHOD
        d.c.push(scanDay)
        this.stats.relabelled.islandScan++
      } else if (r.k === 'n-pokemon' && r.b !== undefined) {
        // The only one of N's Pokémon that is not a wild battle: Rood hands Zorua over, already in its ball.
        assert(r.s === 570, `N's Pokémon ${r.s} now comes in a fixed ball; only Zorua was a gift`)
        d.k = 'gift'
        d.m = 'Gift'
        d.notes.push("N's Pokémon")
      } else if (r.k === 'n-pokemon') d.m = "N's Pokémon"
      else if (r.k === 'static-fixed') d.m = c.teraType ? 'Wild Tera Pokémon' : 'Fixed spawn'
      // A roamer's stored location is only where its route starts.
      if (loc !== undefined && !c.roaming) d.loc = loc
      if (c.alpha) d.c.push('Alpha')
      if (c.weather) d.weather = c.weather
      if (c.gmax) d.notes.push('Gigantamax')
      const tera = teraNote(c)
      if (tera) d.notes.push(tera)
      if (cross) {
        d.cross = true
        d.notes.push('Wanders in from a neighbouring area')
      }
      if (r.k === 'static-fixed') d.svShared = true
      this.push(d)
    }
    const places = this.placeNames(r, r.L, game)
    if (places.length === 0) {
      template(c.roaming ? undefined : this.findPlace(r, game, 'static'), false)
    }
    for (const loc of places) template(loc, false)
    for (const loc of this.placeNames(r, r.A, game)) if (!places.includes(loc)) template(loc, true)
  }

  private gift(r: PkEncounter, game: number): void {
    const c = r.c ?? {}
    const places = this.placeNames(r, r.L, game)
    const d = this.base(r, game, 'gift')
    const starter = isStarterGift(r, game, this.ctx)
    let revived = false
    if (FOSSIL_REVIVED_SPECIES.has(r.s) && !starter && r.k === 'gift') {
      const rule = fossilRule(game, r.s)
      this.hit(`fossil:${GAMES[game].group}:${r.s}`)
      if (rule === 'absent') {
        // PKHeX lists the revival for every version because the fossil itself can be traded over.
        this.stats.dropped.fossil++
        return
      }
      revived = rule === 'revived'
    }
    d.m = starter ? 'Starter' : revived ? 'Fossil' : c.totem ? 'Totem' : 'Gift'
    if (r.k === 'ranch-gift') {
      d.m = 'My Pokémon Ranch'
      d.via = 'ranch'
    }
    if (places.length > 1) fail(`Gift of species ${r.s} in ${GAMES[game].id} has ${places.length} locations`)
    const loc = places[0] ?? this.findPlace(r, game, 'gift')
    if (loc !== undefined) d.loc = loc
    const won = r.k === 'gift' ? prizeFor(game, r.s, r.l[0], loc) : undefined
    if (won === 'absent') {
      this.stats.dropped.prize++
      return
    }
    if (won) {
      this.hit(`prize:${GAMES[game].id}:${won.species}:${won.level}:${won.city}`)
      d.m = PRIZE_METHOD
      d.loc = prizeLocation(won.city)
      this.stats.relabelled.prize++
    }
    if (c.alpha) d.c.push('Alpha')
    if (c.gmax) d.notes.push('Gigantamax')
    if (c.bonusDisc) {
      // Sent over from a promotional disc that was only given away in Japan: a distribution.
      d.k = 'event'
      d.m = 'Bonus Disc'
      d.via = 'colosseum'
      d.notes.push('Japanese Bonus Disc')
    }
    if (c.rideLegend) d.notes.push('Your ride Pokémon')
    if (r.nick) d.notes.push(`Nicknamed ${r.nick}`)
    if (r.ot) d.notes.push(`OT ${r.ot}`)
    const tera = teraNote(c)
    if (tera) d.notes.push(tera)
    this.push(d)
    // My Pokémon Ranch trades with Diamond and Pearl; PKHeX files Hayley's Pokémon under Diamond.
    if (r.k === 'ranch-gift' && GAMES[game].id === 'diamond') this.push({ ...d, game: gameIdx('pearl'), c: [...d.c], notes: [...d.notes] })
  }

  private egg(r: PkEncounter, game: number): void {
    const c = r.c ?? {}
    const d = this.base(r, game, 'egg')
    if (c.oddEgg) {
      // PKHeX has one template per shiny state; in game it is one egg with a raised shiny chance.
      delete d.sh
      d.notes.push('Odd Egg')
    }
    if (r.e) {
      for (const id of r.L ?? []) {
        const giver = EGG_GIVER[this.ctx.locations.raw(r.x, id)]
        if (!giver) fail(`Unknown gift-egg giver "${this.ctx.locations.raw(r.x, id)}" (${r.x} #${id})`)
        d.notes.push(`Egg from ${giver}`)
      }
    }
    const real = r.e ? [] : this.placeNames(r, r.L, game)
    const loc = real[0] ?? this.findPlace(r, game, 'egg')
    if (loc !== undefined) d.loc = loc
    this.push(d)
  }

  /** The Pokémon a trade that evolves on arrival actually yields. */
  private tradeTarget(r: PkEncounter, game: number): [number, number] {
    if (!r.c?.evolveOnTrade) return [r.s, r.f]
    const edge = this.ctx.evolutions[game].find((e) => e.from[0] === r.s && e.from[1] === r.f && e.m.startsWith('Trade'))
    if (!edge) fail(`Trade of species ${r.s} in ${GAMES[game].id} evolves on arrival, but no trade evolution is known`)
    return edge.to
  }

  private trade(r: PkEncounter, game: number, curatedLocation?: string, request?: number): void {
    const d = this.base(r, game, 'trade')
    d.m = 'In-game trade'
    let location = curatedLocation
    let requested = request
    if (r.x !== 'Gen1') {
      const info = lookupTrade(game, r.s)
      if (info.kind === 'absent') return // PKHeX lumps versions; this trade is not in this one
      if (info.kind === 'entry') {
        location = info.entry.location
        requested = info.entry.request
        if (info.entry.gift) {
          d.k = 'gift'
          d.m = 'Gift'
          d.lv = [r.l[0], r.l[0]] // PKHeX's upper bound of 100 is a legality margin for trades
        }
      } else if (GAMES[game].group === 'lgpe') {
        requested = r.s // Let's Go trades swap a Kantonian Pokémon for its Alolan form
      }
    }
    const places = this.placeNames(r, r.L, game)
    const loc = location ?? places[0] ?? this.findPlace(r, game, 'trade')
    if (loc !== undefined) d.loc = loc
    if (r.nick) d.notes.push(r.nick)
    if (requested !== undefined && d.k === 'trade') {
      if (requested === 0) d.notes.push('For any Pokémon')
      else {
        const name = this.ctx.speciesName(requested)
        d.notes.push(`For ${article(name)} ${name}`)
      }
    }
    const [ts, tf] = this.tradeTarget(r, game)
    if (ts !== r.s || tf !== r.f) {
      d.notes.push(`Evolves from ${this.ctx.speciesName(r.s)} during the trade`)
      d.s = ts
      d.f = tf
    }
    const tera = teraNote(r.c ?? {})
    if (tera) d.notes.push(tera)
    this.push(d)
  }

  private simple(r: PkEncounter, game: number, k: EncounterKind, m: string, withPlace: boolean, note?: string): void {
    const c = r.c ?? {}
    const places = withPlace ? this.placeNames(r, r.L, game) : []
    const add = (loc: string | undefined): void => {
      const d = this.base(r, game, k)
      d.m = m
      if (loc !== undefined) d.loc = loc
      if (c.eReader) {
        d.via = 'ereader'
        d.notes.push('e-Reader card (Japan)')
      }
      if (note) d.notes.push(note)
      this.push(d)
    }
    if (places.length === 0) add(undefined)
    for (const loc of places) add(loc)
  }

  private raid(r: PkEncounter, game: number): void {
    const c = r.c ?? {}
    const places = r.k === 'raid-event' ? [] : this.placeNames(r, r.L, game)
    const add = (loc: string | undefined): void => {
      const d = this.base(r, game, 'raid')
      d.m = r.k === 'raid-event' ? EVENT_MAX_RAID : r.k === 'max-lair' ? 'Dynamax Adventure' : r.k === 'raid-crystal' ? CRYSTAL_MAX_RAID : 'Max Raid Den'
      if (loc !== undefined) d.loc = loc
      if (c.rank) d.stars = [c.rank[0], c.rank[1]]
      if (r.k === 'raid-crystal') d.notes.push('Needs a Dynamax Crystal (serial-code gift)')
      if (c.gmax) d.notes.push('Gigantamax')
      this.push(d)
    }
    if (places.length === 0) add(undefined)
    for (const loc of places) add(loc)
  }

  private tera(r: PkEncounter, game: number): void {
    const c = r.c ?? {}
    assert(c.stars !== undefined, `Tera raid row for species ${r.s} has no star count`)
    const d = this.base(r, game, 'tera')
    if (r.k === 'tera') {
      d.m = `${c.stars}★ Tera Raid`
      const place = TERA_MAP_PLACE[c.map ?? '']
      if (!place) fail(`Tera raid row for species ${r.s} has unknown map ${c.map}`)
      d.loc = place
    } else if (r.k === 'tera-7star') {
      d.m = MIGHTIEST_TERA_RAID
      d.notes.push('Mightiest Mark')
    } else {
      d.m = EVENT_TERA_RAID
      d.stars = [c.stars, c.stars]
    }
    const tera = teraNote(c)
    if (tera) d.notes.push(tera)
    this.push(d)
  }

  private outbreak(r: PkEncounter, game: number): void {
    const places = this.placeNames(r, r.L, game)
    assert(places.length > 0, `Outbreak row for species ${r.s} has no location`)
    for (const loc of places) {
      const d = this.base(r, game, 'outbreak')
      d.m = EVENT_OUTBREAK
      d.loc = loc
      d.svShared = true
      this.push(d)
    }
  }

  // --- special cases -----------------------------------------------------------------------

  private foldCosplay(): void {
    if (this.cosplay.length === 0) return
    for (const [game, list] of groupBy(this.cosplay, (x) => x.game)) {
      const id = GAMES[game].id
      assert(id === 'omegaruby' || id === 'alphasapphire', `Cosplay Pikachu row outside Omega Ruby / Alpha Sapphire (${id})`)
      assert(list.every((x) => x.r.k === 'gift'), 'Cosplay Pikachu rows are no longer all gifts')
      const first = list[0].r
      const d = this.base(first, game, 'gift')
      d.f = 0
      d.m = 'Gift'
      d.lv = [Math.min(...list.map((x) => x.r.l[0])), Math.max(...list.map((x) => x.r.l[1]))]
      if (!list.every((x) => x.r.h === first.h)) delete d.sh
      if (!list.every((x) => x.r.d === first.d)) delete d.d
      if (!list.every((x) => x.r.b === first.b)) delete d.b
      const loc = this.placeNames(first, first.L, game)[0]
      if (loc !== undefined) d.loc = loc
      d.notes.push('Cosplay Pikachu (cannot leave Omega Ruby / Alpha Sapphire)')
      this.push(d)
      this.stats.cosplayFolded += list.length
    }
  }

  /** Generation 1 gifts, scripted battles and trades come from the curated table, checked against PKHeX. */
  private addGen1(): void {
    const { ctx } = this
    const codeOf = (gameId: string): string => {
      const g = GAMES[gameIdx(gameId)]
      return g.pkhex ?? GAMES[gameIdx(g.dataFrom!)].pkhex!
    }
    const rowsFor = (k: string, species: number, gameId: string): PkEncounter[] =>
      this.gen1Rows.filter((r) => kindOf(r.k) === k && r.s === species && r.g.some((i) => ctx.pk.encounters.games[i] === codeOf(gameId)))

    const curatedPairs = new Set(GEN1_ENTRIES.map((e) => `${e.kind}:${e.species}`))
    const extractorPairs = new Set(this.gen1Rows.map((r) => `${kindOf(r.k)}:${r.s}`))
    for (const pair of extractorPairs) assert(curatedPairs.has(pair), `PKHeX has a Generation 1 ${pair} encounter that gen1-locations.ts does not place`)
    for (const pair of curatedPairs) assert(extractorPairs.has(pair), `gen1-locations.ts places ${pair}, which PKHeX does not have`)

    // The lowest curated level of each gift / battle must be PKHeX's legality minimum.
    for (const [pair, entries] of groupBy(GEN1_ENTRIES.filter((e) => e.kind !== 'trade'), (e) => `${e.kind}:${e.species}`)) {
      const curatedMin = Math.min(...entries.map((e) => e.level!))
      const pkMin = Math.min(...this.gen1Rows.filter((r) => `${kindOf(r.k)}:${r.s}` === pair).map((r) => r.l[0]))
      assert(curatedMin === pkMin, `Generation 1 ${pair}: curated minimum level ${curatedMin}, PKHeX says ${pkMin}`)
    }

    for (const entry of GEN1_ENTRIES) {
      for (const gameId of entry.games) {
        const game = gameIdx(gameId)
        const source = rowsFor(entry.kind, entry.species, gameId)
        if (entry.kind === 'trade') {
          assert(source.length === 1, `Generation 1 trade of species ${entry.species} in ${gameId}: expected one PKHeX template, found ${source.length}`)
          this.trade(source[0], game, entry.location, entry.request)
        } else {
          const d: RowDraft = { s: entry.species, f: 0, game, k: entry.kind, lv: [entry.level!, entry.level!], c: [], notes: [], loc: entry.location }
          if (entry.method) d.m = entry.method
          if (entry.note) d.notes.push(entry.note)
          this.push(d)
        }
        this.stats.gen1.curated++
        this.compareGen1(entry.kind, entry.species, game, entry.location)
      }
    }
  }

  /** Cross-checks one curated Generation 1 place against PokeAPI (report only). */
  private compareGen1(kind: string, species: number, game: number, location: string): void {
    // Green has no PokeAPI version of its own; compare it through Blue.
    const g = GAMES[game].dataFrom ? gameIdx(GAMES[game].dataFrom!) : game
    const family: PlaceFamily = kind === 'trade' ? 'trade' : kind === 'gift' ? 'gift' : 'static'
    const hits = this.ctx.places.all(g, species, 0, family)
    const stats = this.stats.gen1
    if (hits.length === 0) {
      stats.pokeapiSilent++
      return
    }
    const agrees = hits.some((h) => location.includes(h.location) || h.location.includes(location.replace(/ \(.*$/, '')))
    if (agrees) stats.pokeapiAgree++
    else stats.pokeapiDisagree.push(`${GAMES[game].id} ${this.ctx.speciesName(species)} ${kind}: curated "${location}", PokeAPI "${hits.map((h) => h.location).join('" / "')}"`)
  }

  /**
   * Rows of a hidden form that looks like another one (Scatterbug's and Spewpa's patterns, Power
   * Construct Zygarde) are also shown on that visible form. The copies are marked: they are what
   * the player sees, not a second source.
   */
  private showHiddenForms(drafts: RowDraft[]): RowDraft[] {
    const out = [...drafts]
    for (const d of drafts) {
      const visible = VISIBLE_FORM.get(sf(d.s, d.f))
      if (visible === undefined) continue
      const copy: RowDraft = { ...d, f: sfForm(visible), c: [...d.c], notes: d.notes.filter((n) => !n.startsWith('Pattern ')), copy: true }
      const note = HIDDEN_ROW_NOTE.get(sf(d.s, d.f))
      if (note) copy.notes.push(note)
      delete copy.rf
      out.push(copy)
      this.stats.hiddenPatternCopies++
    }
    return out
  }

  /**
   * Sentinel forms. 31 = the game picks the form at random (Unown letter, Minior core): a row on
   * every ownable form present in that game. 30 = the Vivillon line's pattern is decided outside
   * the encounter: a row on every pattern that can be met in the wild.
   */
  private expandSentinels(drafts: RowDraft[]): RowDraft[] {
    const out: RowDraft[] = []
    for (const d of drafts) {
      if (d.f !== 30 && d.f !== 31) {
        out.push(d)
        continue
      }
      const present = this.ctx.presence[d.game]
      const targets: number[] = []
      for (let f = 0; f < 30; f++) {
        if (!present.has(sf(d.s, f))) continue
        const cat = this.ctx.classes.get(sf(d.s, f))?.cat
        if (d.f === 31) {
          if (cat === 'base' || cat === 'cosmetic') targets.push(f)
        } else if (f <= 18) targets.push(f) // 0-17 regional patterns, 18 Fancy; 19 (Poké Ball) is distribution only
      }
      assert(d.f === 31 ? [201, 774].includes(d.s) : [664, 665, 666].includes(d.s), `Unexpected sentinel form ${d.f} on species ${d.s}`)
      assert(targets.length > 0, `Sentinel form ${d.f} of species ${d.s} has no target form in ${GAMES[d.game].id}`)
      const sv = GAMES[d.game].group === 'sv'
      for (const f of targets) {
        const copy: RowDraft = { ...d, f, c: [...d.c], notes: [...d.notes] }
        if (d.f === 31) copy.rf = 1
        else if (f === 0 && HIDDEN_PATTERN_SPECIES.has(d.s)) {
          // Scatterbug and Spewpa look the same whatever the pattern: the base entry is always met.
        } else if (sv) {
          // In Scarlet / Violet every wild one is Fancy until Pokémon GO postcards switch the pattern.
          if (f !== 18) {
            copy.rf = 1
            copy.notes.push('Pattern set by Pokémon GO postcards')
          }
        } else if (f !== 18) {
          copy.rf = 1
          copy.notes.push("Pattern depends on the save's region")
        } else continue // Fancy is not a regional pattern outside Scarlet / Violet
        out.push(copy)
      }
    }
    return out
  }
}

