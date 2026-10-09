/**
 * Places for gifts, gift eggs, scripted battles and in-game trades that PKHeX stores without a
 * real location, joined from PokeAPI's encounters table (pinned upstream copy) by game, species
 * and method family. A small curated table covers what PokeAPI lacks.
 */
import { GAMES } from '../../src/shared/games.ts'
import type { CsvStore } from './sources.ts'
import type { FormMapping } from './form-mapping.ts'
import { gameIdx } from './game-map.ts'
import { int } from './util.ts'

export type PlaceFamily = 'gift' | 'egg' | 'trade' | 'static' | 'grotto'

const METHOD_FAMILY: Readonly<Record<string, PlaceFamily>> = {
  gift: 'gift',
  'gift-egg': 'egg',
  'npc-trade': 'trade',
  static: 'static',
  pokeflute: 'static',
  'squirt-bottle': 'static',
  'wailmer-pail': 'static',
  'devon-scope': 'static',
  'hidden-grotto': 'grotto'
}

/** PokeAPI version identifier -> Pelagix game id (DLC "versions" fold into their base game). */
const VERSION_GAME: Readonly<Record<string, string>> = {
  red: 'red', blue: 'blue', yellow: 'yellow', gold: 'gold', silver: 'silver', crystal: 'crystal',
  ruby: 'ruby', sapphire: 'sapphire', emerald: 'emerald', firered: 'firered', leafgreen: 'leafgreen',
  colosseum: 'colosseum', xd: 'xd',
  diamond: 'diamond', pearl: 'pearl', platinum: 'platinum', heartgold: 'heartgold', soulsilver: 'soulsilver',
  black: 'black', white: 'white', 'black-2': 'black2', 'white-2': 'white2',
  x: 'x', y: 'y', 'omega-ruby': 'omegaruby', 'alpha-sapphire': 'alphasapphire',
  sun: 'sun', moon: 'moon', 'ultra-sun': 'ultrasun', 'ultra-moon': 'ultramoon',
  'lets-go-pikachu': 'letsgopikachu', 'lets-go-eevee': 'letsgoeevee',
  sword: 'sword', shield: 'shield',
  'the-isle-of-armor-sword': 'sword', 'the-isle-of-armor-shield': 'shield',
  'the-crown-tundra-sword': 'sword', 'the-crown-tundra-shield': 'shield',
  'brilliant-diamond': 'brilliantdiamond', 'shining-pearl': 'shiningpearl', 'legends-arceus': 'legendsarceus',
  scarlet: 'scarlet', violet: 'violet',
  'the-teal-mask-scarlet': 'scarlet', 'the-teal-mask-violet': 'violet',
  'the-indigo-disk-scarlet': 'scarlet', 'the-indigo-disk-violet': 'violet',
  'legends-za': 'legendsza', 'mega-dimension': 'legendsza'
}
/** Versions Pelagix has no game for (Japanese Red / Green / Blue, Champions). */
const IGNORED_VERSIONS: ReadonlySet<string> = new Set(['red-japan', 'green-japan', 'blue-japan', 'champions'])

export interface PlaceHit {
  location: string
  min: number
  max: number
}

/** PokeAPI location names that describe a pool of places rather than one place. */
const VAGUE = /^Random |across /

function cleanName(name: string): string {
  return name
    .replace(/^(Kanto|Johto|Hoenn|Sinnoh|Unova|Kalos|Alola|Galar|Paldea) (?=Route|Sea Route|Power Plant|Underground Path|Victory Road|Battle Frontier|Safari Zone)/, '')
    .replace(/^Sea Route/, 'Route')
    .replace(/\bPokemon\b/g, 'Pokémon')
    .replace(/\bHq\b/g, 'HQ')
    .replace(/[’‘]/g, "'")
    .trim()
}

/** Places PokeAPI does not have: "game:species:family" -> location. */
const CURATED: Readonly<Record<string, string>> = (() => {
  const out: Record<string, string> = {}
  const add = (games: string[], species: number, family: PlaceFamily, location: string): void => {
    for (const g of games) out[`${g}:${species}:${family}`] = location
  }
  add(['sun', 'moon', 'ultrasun', 'ultramoon'], 133, 'egg', 'Paniola Ranch') // Eevee Egg from the Pokémon Nursery
  add(['brilliantdiamond', 'shiningpearl'], 440, 'egg', 'Hearthome City') // Happiny Egg from the Traveling Man
  add(['brilliantdiamond', 'shiningpearl'], 447, 'egg', 'Iron Island') // Riolu Egg from Riley
  add(['colosseum'], 250, 'gift', 'Mt. Battle') // Ho-Oh for clearing Mt. Battle with every Shadow Pokémon purified
  return out
})()

export class PokeapiPlaces {
  private readonly hits = new Map<string, PlaceHit[]>()
  /** Every PokeAPI place name the build actually used. */
  readonly usedNames = new Set<string>()
  readonly stats = { joined: 0, curated: 0, ambiguous: 0, missing: 0 }

  constructor(csv: CsvStore, mapping: FormMapping) {
    const versionGame = new Map<number, number>()
    for (const v of csv.table('versions')) {
      const id = VERSION_GAME[v.identifier]
      if (id) versionGame.set(int(v.id, 'versions.id'), gameIdx(id))
      else if (!IGNORED_VERSIONS.has(v.identifier)) throw new Error(`PokeAPI version "${v.identifier}" is not mapped to a Pelagix game`)
    }
    const methodName = new Map(csv.table('encounter_methods').map((r) => [r.id, r.identifier]))
    const slotMethod = new Map(csv.table('encounter_slots').map((r) => [r.id, methodName.get(r.encounter_method_id) ?? '']))
    const areaLocation = new Map(csv.table('location_areas').map((r) => [r.id, r.location_id]))
    const locationName = new Map<string, string>()
    for (const r of csv.table('location_names')) if (r.local_language_id === '9' && r.name.trim() !== '') locationName.set(r.location_id, cleanName(r.name))

    for (const e of csv.table('encounters')) {
      const family = METHOD_FAMILY[slotMethod.get(e.encounter_slot_id) ?? '']
      if (!family) continue
      const game = versionGame.get(int(e.version_id, 'encounters.version_id'))
      if (game === undefined) continue
      const form = mapping.byPokemon.get(int(e.pokemon_id, 'encounters.pokemon_id'))
      if (!form) continue
      const name = locationName.get(areaLocation.get(e.location_area_id) ?? '')
      if (name === undefined || VAGUE.test(name)) continue
      const key = `${game}:${form[0]}:${form[1]}:${family}`
      const list = this.hits.get(key) ?? []
      const min = int(e.min_level, 'encounters.min_level')
      const max = int(e.max_level, 'encounters.max_level')
      const existing = list.find((h) => h.location === name)
      if (existing) {
        existing.min = Math.min(existing.min, min)
        existing.max = Math.max(existing.max, max)
      } else list.push({ location: name, min, max })
      this.hits.set(key, list)
    }
  }

  /** Every place PokeAPI lists for the form in that game and family. */
  all(game: number, species: number, form: number, family: PlaceFamily): PlaceHit[] {
    return this.hits.get(`${game}:${species}:${form}:${family}`) ?? []
  }

  /**
   * The one place a location-less row belongs to, or undefined when PokeAPI has none or cannot
   * decide (several candidates the level does not tell apart).
   */
  find(game: number, species: number, form: number, family: PlaceFamily, lv: [number, number]): string | undefined {
    const curated = CURATED[`${GAMES[game].id}:${species}:${family}`]
    if (curated) {
      this.stats.curated++
      return curated
    }
    const hits = this.all(game, species, form, family)
    if (hits.length === 0) {
      this.stats.missing++
      return undefined
    }
    let candidates = hits
    if (candidates.length > 1 && family !== 'trade') {
      const byLevel = candidates.filter((h) => h.min <= lv[1] && h.max >= lv[0])
      if (byLevel.length > 0) candidates = byLevel
    }
    if (candidates.length !== 1) {
      this.stats.ambiguous++
      return undefined
    }
    this.stats.joined++
    this.usedNames.add(candidates[0].location)
    return candidates[0].location
  }
}
