/**
 * Encounter kinds and method labels: collapses the extractor's fine-grained kinds onto the
 * contract's twelve and builds the human label of a row's method / sub-type.
 */
import type { EncounterKind } from '../../src/shared/dex-types.ts'
import type { PkEncounter } from './pkhex-types.ts'
import { fail } from './util.ts'

const KIND: Readonly<Record<string, EncounterKind>> = {
  wild: 'wild',
  static: 'static',
  'static-fixed': 'static',
  gift: 'gift',
  starter: 'gift',
  'ranch-gift': 'gift',
  'gift-egg': 'egg',
  trade: 'trade',
  shadow: 'shadow',
  pokewalker: 'walker',
  'dream-world': 'dream',
  'dream-radar': 'dream',
  'n-pokemon': 'static',
  raid: 'raid',
  'raid-event': 'raid',
  'raid-crystal': 'raid',
  'max-lair': 'raid',
  tera: 'tera',
  'tera-event': 'tera',
  'tera-7star': 'tera',
  'outbreak-event': 'outbreak',
  event: 'event',
  'event-egg': 'event'
}

export function kindOf(extractorKind: string): EncounterKind {
  const k = KIND[extractorKind]
  if (!k) fail(`Extractor kind "${extractorKind}" has no EncounterKind`)
  return k
}

/** Display order of the kinds within a form's rows. */
export const KIND_ORDER: readonly EncounterKind[] = [
  'wild', 'static', 'gift', 'egg', 'trade', 'raid', 'tera', 'outbreak', 'shadow', 'walker', 'dream', 'event'
]

/** Place names that are caves or interiors, where a "Grass" slot is a walking encounter without grass. */
const CAVE =
  /(^|[^A-Za-z])(Cave|Caves|Cavern|Tunnel|Mt\.|Mount|Mountain|Tower|Mansion|Well|Chamber|Victory Road|Den|Hideout|Pillar|Tomb|Mine|Sewers|Chasm|Power Plant|Abandoned Ship|Cellar|Passage|Seafoam Islands|Whirl Islands|Ice Path|Fiery Path|Underpass|Hollow|Temple|Château|Chateau|Ironworks|Castle|Ruins|Strange House|Laboratory|Cold Storage|Labyrinth|Mauville|Slab|HQ|Distortion World|Oreburgh Gate)($|[^A-Za-z])/
/** Caves whose name does not say so. */
const CAVE_NAMES: ReadonlySet<string> = new Set(['Meteor Falls', 'Tohjo Falls', 'Ravaged Path', 'Iron Island'])
/** Mountains whose wild Pokémon are met outdoors in the grass. */
const OUTDOOR: ReadonlySet<string> = new Set(['Mt. Silver', 'Mt. Ember'])

/** Heuristic: PKHeX's "Grass" slot type covers both tall grass and cave floors. */
function landLabel(location: string | undefined): string {
  if (location === undefined || OUTDOOR.has(location)) return 'Tall grass'
  return CAVE_NAMES.has(location) || CAVE.test(location) ? 'Cave' : 'Tall grass'
}

/** X / Y encounters that jump the player: ceiling and flying shadows, rustling bushes, berry trees. */
export const AMBUSH = 'Ambush encounter'

const ROD: Readonly<Record<string, string>> = { Old_Rod: 'Old Rod', Good_Rod: 'Good Rod', Super_Rod: 'Super Rod' }

/** Suffix "Safari Zone" / "Great Marsh" with the way the Pokémon is found, when it is not in the grass. */
function safariLabel(base: string, inner: string): string {
  return inner === 'Tall grass' || inner === 'Cave' ? base : `${base} (${inner})`
}

export interface MethodLabel {
  m?: string
  /** Extra conditions the method implies. */
  c?: string[]
  /** The location is implied by the method; drop a placeholder location without complaint. */
  noPlace?: boolean
}

/** Labels for a wild row; a row found in two ways (grass and fishing) yields two labels. */
export function wildMethods(r: PkEncounter, location: string | undefined): MethodLabel[] {
  const c = r.c ?? {}
  const m = r.m
  switch (r.t) {
    case 'EncounterSlot1':
    case 'EncounterSlot2':
    case 'EncounterSlot3':
    case 'EncounterSlot3Swarm':
    case 'EncounterSlot4':
    case 'EncounterSlot5':
    case 'EncounterSlot8b': {
      if (m === undefined) fail(`${r.t} row without a slot type (species ${r.s})`)
      let inner: string
      if (m === 'Grass' || m === 'Safari_Grass') inner = landLabel(location)
      else if (m === 'Surf' || m === 'Safari_Surf') inner = 'Surfing'
      else if (m.replace(/^Safari_/, '') in ROD) inner = ROD[m.replace(/^Safari_/, '')]
      else if (m === 'Rock_Smash') inner = 'Rock Smash'
      else if (m === 'Headbutt') return [{ m: 'Headbutt' }]
      else if (m === 'HeadbuttSpecial') return [{ m: 'Headbutt (special tree)' }]
      else if (m === 'BugContest') return [{ m: 'Bug-Catching Contest' }]
      else if (m === 'HoneyTree') return [{ m: 'Honey Tree' }]
      else if (m === 'SwarmGrass50' || m === 'Swarm') return [{ m: 'Swarm' }]
      else if (m === 'SwarmFish50') return [{ m: 'Fishing', c: ['Feebas tiles'] }]
      else if (m === 'HiddenGrotto') return [{ m: 'Hidden Grotto', noPlace: true }]
      else return fail(`Unknown slot type ${m} on ${r.t}`)
      if (c.underground) return [{ m: 'Grand Underground' }]
      if (c.marsh) return [{ m: safariLabel('Great Marsh', inner) }]
      if (c.safari) return [{ m: safariLabel('Safari Zone', inner) }]
      if (c.feebasTiles) return [{ m: inner, c: ['Feebas tiles'] }]
      return [{ m: inner }]
    }
    case 'EncounterSlot3XD':
      return [{ m: 'Poké Spot' }]
    case 'EncounterSlot6XY':
    case 'EncounterSlot6AO':
      if (m === 'Horde') return [{ m: 'Horde' }]
      if (m === 'FriendSafari') return [{ m: 'Friend Safari' }]
      if (m === 'Rock_Smash') return [{ m: 'Rock Smash' }]
      // The only X / Y areas PKHeX types "Grass" are the ambush tables (Glittering Cave's ceiling, Route 7's
      // berry trees, Victory Road's flying shadows ...); ordinary grass and cave slots are "Standard".
      if (m === 'Grass') return [{ m: AMBUSH }]
      if (m === 'Standard') return [{}]
      return fail(`Unknown slot type ${m} on ${r.t}`)
    case 'EncounterSlot7':
      if (m === 'SOS') return [{ m: 'SOS call' }]
      if (c.pelago) return [{ m: 'Poké Pelago', noPlace: true }]
      if (m === 'Standard') return [{}]
      return fail(`Unknown slot type ${m} on ${r.t}`)
    case 'EncounterSlot7b':
    case 'EncounterSlot9':
      return [{}]
    case 'EncounterSlot8': {
      if (m === undefined) fail('EncounterSlot8 row without a slot type')
      if (m.startsWith('Symbol') || m.startsWith('Ground')) return [{ m: 'Overworld' }]
      if (m.startsWith('Surfing') || m === 'Sharpedo') return [{ m: 'Overworld (water)' }]
      if (m.startsWith('Sky')) return [{ m: 'Overworld (flying)' }]
      if (m === 'OnlyFishing') return [{ m: 'Fishing' }]
      if (m.startsWith('Hidden')) {
        // Hidden tables hold the "!" grass encounters plus the area's fishing and berry-tree slots.
        const out: MethodLabel[] = []
        if (c.weather) out.push({ m: 'Tall grass' })
        if (c.fishing) out.push({ m: 'Fishing' })
        if (c.shakingTrees) out.push({ m: 'Berry tree' })
        if (out.length === 0) fail(`SwSh hidden slot for species ${r.s} has neither weather, fishing nor berry trees`)
        return out
      }
      return fail(`Unknown slot type ${m} on EncounterSlot8`)
    }
    case 'EncounterSlot8a':
      if (m === 'Standard') return [{}]
      if (m === 'Landmark') return [{ m: 'Shaking tree or ore deposit' }]
      if (m === 'MassOutbreakRegular') return [{ m: 'Mass Outbreak' }]
      if (m === 'MassOutbreakMassive') return [{ m: 'Massive Mass Outbreak' }]
      if (m === 'Distortion') return [{ m: 'Space-time Distortion' }]
      return fail(`Unknown slot type ${m} on EncounterSlot8a`)
    case 'EncounterSlot9a':
      if (m === 'Hyperspace') return [{ m: 'Hyperspace' }]
      if (m === 'Standard') return [location !== undefined && /^Wild Zone/.test(location) ? { m: 'Wild Zone' } : {}]
      return fail(`Unknown slot type ${m} on EncounterSlot9a`)
    default:
      return fail(`Unknown wild template type ${r.t}`)
  }
}

const WEATHER: Readonly<Record<string, string>> = {
  Normal: 'Clear',
  Overcast: 'Overcast',
  Raining: 'Rain',
  Thunderstorm: 'Thunderstorm',
  Intense_Sun: 'Harsh sunlight',
  Snowing: 'Snow',
  Snowstorm: 'Snowstorm',
  Sandstorm: 'Sandstorm',
  Heavy_Fog: 'Fog',
  Mist: 'Mist'
}
export const WEATHER_ORDER: readonly string[] = Object.keys(WEATHER)

export function weatherLabel(weather: string): string {
  const label = WEATHER[weather]
  if (!label) fail(`Unknown weather "${weather}"`)
  return label
}

export const TIME_ORDER: readonly string[] = ['Morning', 'Day', 'Evening', 'Night']

/** "3★", "3–5★" */
export function starRange(min: number, max: number): string {
  return min === max ? `${min}★` : `${min}–${max}★`
}
