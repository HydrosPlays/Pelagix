/**
 * Scarlet / Violet version exclusives.
 *
 * PKHeX stores every SV wild slot, fixed spawn and distributed outbreak as "both versions"; only the
 * two static tables and the Tera raid host flags are split. This module holds the explicit lists
 * (checked against Serebii's exclusives page and Bulbapedia, October 2026) and cross-checks them
 * against what the split data implies, so a wrong or missing entry is reported by the build.
 *
 * Entries are national numbers, or "species-form" where only one form is exclusive.
 */
import { GAME_IDS } from './game-map.ts'
import { fail } from './util.ts'

type Entry = number | `${number}-${number}`

const SCARLET: readonly Entry[] = [
  // Base game
  246, 247, 248, // Larvitar line
  425, 426, // Drifloon line
  434, 435, // Stunky line
  633, 634, 635, // Deino line
  690, 691, // Skrelp line
  765, // Oranguru
  874, // Stonjourner
  936, // Armarouge
  '128-2', // Paldean Tauros, Blaze Breed
  984, 985, 986, 987, 988, 989, 1005, // Great Tusk, Scream Tail, Brute Bonnet, Flutter Mane, Slither Wing, Sandy Shocks, Roaring Moon
  1007, // Koraidon
  // The Teal Mask
  207, 472, // Gligar line
  845, // Cramorant
  // The Indigo Disk
  '37-1', '38-1', // Alolan Vulpix line
  408, 409, // Cranidos line
  1020, 1021 // Gouging Fire, Raging Bolt
]

const VIOLET: readonly Entry[] = [
  // Base game
  371, 372, 373, // Bagon line
  200, 429, // Misdreavus line
  316, 317, // Gulpin line
  885, 886, 887, // Dreepy line
  692, 693, // Clauncher line
  766, // Passimian
  875, // Eiscue
  937, // Ceruledge
  '128-3', // Paldean Tauros, Aqua Breed
  990, 991, 992, 993, 994, 995, 1006, // Iron Treads, Bundle, Hands, Jugulis, Moth, Thorns, Valiant
  1008, // Miraidon
  // The Teal Mask
  190, 424, // Aipom line
  877, // Morpeko
  // The Indigo Disk
  '27-1', '28-1', // Alolan Sandshrew line
  410, 411, // Shieldon line
  1022, 1023 // Iron Boulder, Iron Crown
]

/**
 * Forms whose stock Tera raids are hosted by one version only although the Pokémon is found in the
 * wild in both: raid dens pick a form per version, which is not version exclusivity.
 */
const RAID_HOST_ONLY: ReadonlySet<string> = new Set([
  '313-0', '314-0', // Volbeat / Illumise
  '422-0', '422-1', '423-0', '423-1', // Shellos / Gastrodon seas
  '678-0', '678-1', // Meowstic
  '849-0', '849-1', // Toxtricity
  '902-0', '902-1' // Basculegion
])

/** Evolutions whose item exists in one version only: [from species, to species]. */
const SCARLET_EVOLUTIONS: readonly [number, number][] = [[935, 936]] // Auspicious Armor
const VIOLET_EVOLUTIONS: readonly [number, number][] = [[935, 937]] // Malicious Armor

export type SvVersion = 'scarlet' | 'violet'

function index(entries: readonly Entry[]): { species: Set<number>; forms: Set<string> } {
  const species = new Set<number>()
  const forms = new Set<string>()
  for (const e of entries) {
    if (typeof e === 'number') species.add(e)
    else forms.add(e)
  }
  return { species, forms }
}

const scarlet = index(SCARLET)
const violet = index(VIOLET)

export const SCARLET_IDX = GAME_IDS.indexOf('scarlet')
export const VIOLET_IDX = GAME_IDS.indexOf('violet')
if (SCARLET_IDX < 0 || VIOLET_IDX < 0) fail('games.ts no longer defines scarlet / violet')

/** The only version a form is found in, or undefined when it is in both. */
export function svExclusive(species: number, form: number): SvVersion | undefined {
  const key = `${species}-${form}`
  if (scarlet.species.has(species) || scarlet.forms.has(key)) return 'scarlet'
  if (violet.species.has(species) || violet.forms.has(key)) return 'violet'
  return undefined
}

/** The version an evolution is limited to by its item, or undefined. */
export function svEvolutionExclusive(from: number, to: number): SvVersion | undefined {
  if (SCARLET_EVOLUTIONS.some(([a, b]) => a === from && b === to)) return 'scarlet'
  if (VIOLET_EVOLUTIONS.some(([a, b]) => a === from && b === to)) return 'violet'
  return undefined
}

export interface SvSeed {
  /** "species-form" keys whose version-split data (static tables, stock Tera raid hosts) is Scarlet only. */
  scarlet: Set<string>
  violet: Set<string>
  /** Keys the split data offers in both versions. */
  both: Set<string>
}

export interface SvCheck {
  /** Listed as exclusive, but the split data offers it in the other version or in both. */
  conflicts: string[]
  /** Split by the data, not in the lists, and not a known raid-host split. */
  unlisted: string[]
  /** List entries the split data confirms. */
  confirmed: number
  /** List entries the split data says nothing about (no static row, no stock raid). */
  unseeded: number
}

/** Compares the curated lists with what the extractor's version-split data implies. */
export function checkSvExclusives(seed: SvSeed, describe: (key: string) => string): SvCheck {
  const out: SvCheck = { conflicts: [], unlisted: [], confirmed: 0, unseeded: 0 }
  const listed = new Set<string>()
  const check = (key: string): void => {
    const [s, f] = key.split('-').map(Number)
    const expected = svExclusive(s, f)
    const implied = seed.both.has(key) ? 'both' : seed.scarlet.has(key) ? 'scarlet' : seed.violet.has(key) ? 'violet' : undefined
    if (expected === undefined) {
      if ((implied === 'scarlet' || implied === 'violet') && !RAID_HOST_ONLY.has(key)) out.unlisted.push(`${describe(key)}: data says ${implied} only`)
      return
    }
    listed.add(key)
    if (implied === undefined) out.unseeded++
    else if (implied === expected) out.confirmed++
    else out.conflicts.push(`${describe(key)}: listed as ${expected} only, data says ${implied}`)
  }
  for (const key of new Set([...seed.scarlet, ...seed.violet, ...seed.both])) check(key)
  // Listed species the split data never mentions.
  for (const e of [...SCARLET, ...VIOLET]) {
    const key = typeof e === 'number' ? `${e}-0` : e
    if (!listed.has(key)) out.unseeded++
  }
  out.conflicts.sort()
  out.unlisted.sort()
  return out
}
