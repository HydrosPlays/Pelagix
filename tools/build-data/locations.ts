/**
 * Turns PKHeX location names into display names: strips PKHeX's disambiguation suffixes and
 * game tags, resolves the two-game Colosseum / XD names, and recognises pseudo-locations
 * (placeholders such as "a Link Trade (NPC)" that are not places).
 */
import { GAMES } from '../../src/shared/games.ts'
import type { PkLocations } from './pkhex-types.ts'
import { fail } from './util.ts'

/** Placeholder names that never describe where a Pokémon is found. */
export const PSEUDO_NAME = new RegExp(
  [
    '^\\(.*\\)$', // (Can't Tell), (Event), (Gift Egg), (In-game Trade), (Fateful Encounter)
    'Link [Tt]rade',
    '^Pokémon Den$',
    '^a crystal cavern$',
    '^Pokéwalker$',
    '^Pokémon Dream Radar$',
    '^Poké Pelago$',
    '^Hidden Grotto$',
    '^(a )?[Ll]ovely place$',
    '^(a )?[Ff]araway place$',
    '^Pokémon HOME'
  ].join('|')
)

/** Real places among the high "special" location ids (Legends: Z-A gift locations). */
const REAL_SPECIAL: ReadonlySet<string> = new Set([
  'Gen9a:30026', 'Gen9a:30027', 'Gen9a:30028', 'Gen9a:30029', 'Gen9a:30030', 'Gen9a:30031', 'Gen9a:30033', 'Gen9a:30034', 'Gen9a:30035'
])

/** Proper labels for a few names that are a mode rather than a place. */
export const RELABEL: Readonly<Record<string, string>> = {
  'Gen6:Friend Safari': 'Kiloude City'
}

/** Game tags PKHeX appends to tell same-named places of different games apart. */
export const GAME_TAG = / \((Kanto|RSE|FRLG|E|RS|D\/P\/Pt|HG\/SS|B\/W|B2\/W2|X\/Y|OR\/AS)\)$/

function resolveSlashName(name: string, gameId: string): string {
  // "Battle Tower (RS) / Battle Frontier (E)", "Cold Storage/PWT"
  if (name === 'Battle Tower (RS) / Battle Frontier (E)') return gameId === 'emerald' ? 'Battle Frontier' : 'Battle Tower'
  if (name === 'Cold Storage/PWT') return gameId === 'black2' || gameId === 'white2' ? 'Pokémon World Tournament' : 'Cold Storage'
  return name
}

/** XD's three Poké Spots, which PKHeX's location table only calls "Rock", "Oasis" and "Cave". */
export const XD_POKE_SPOT: Readonly<Record<string, string>> = { Rock: 'Rock Poké Spot', Oasis: 'Oasis Poké Spot', Cave: 'Cave Poké Spot' }

function resolveCxd(name: string, gameId: string): string | undefined {
  const withoutId = name.replace(/ \[\d+\]$/, '')
  if (/^\(.*\)$/.test(withoutId)) return undefined
  const tag = gameId === 'colosseum' ? '(C)' : gameId === 'xd' ? '(XD)' : fail(`Colosseum / XD location used by ${gameId}: ${name}`)
  for (const part of withoutId.split(' / ')) {
    if (part.endsWith(` ${tag}`)) {
      const own = part.slice(0, -tag.length - 1)
      return gameId === 'xd' ? (XD_POKE_SPOT[own] ?? own) : own
    }
  }
  return fail(`Location "${name}" has no name for ${gameId}`)
}

function polish(name: string): string {
  return name
    .replace(/ \(-\)$/, '')
    .replace(/ \(\d+\)$/, '')
    .replace(GAME_TAG, '')
    .replace(/\b(DIGLETT|SLOWPOKE)\b/g, (word) => word[0] + word.slice(1).toLowerCase())
    .replace(/^(the|a|an) (?=[A-ZÀ-Ý])/, '')
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export class LocationNames {
  private readonly sets: PkLocations
  private readonly cache = new Map<string, string | undefined>()

  constructor(sets: PkLocations) {
    this.sets = sets
  }

  raw(set: string, id: number): string {
    const name = this.sets[set]?.[String(id)]
    if (name === undefined) fail(`locations.json has no name for ${set} #${id}`)
    return name
  }

  /** Display name of a location for one game, or undefined when the id is a placeholder. */
  name(set: string, id: number, gameIdx: number): string | undefined {
    const key = `${set}:${id}:${gameIdx}`
    if (this.cache.has(key)) return this.cache.get(key)
    const result = this.compute(set, id, GAMES[gameIdx].id)
    this.cache.set(key, result)
    return result
  }

  private compute(set: string, id: number, gameId: string): string | undefined {
    const raw = this.raw(set, id)
    if (set === 'CXD') {
      const resolved = resolveCxd(raw, gameId)
      return resolved === undefined ? undefined : polish(resolved)
    }
    const special = set === 'Gen4' ? id >= 2000 : id >= 30000
    if (special && !REAL_SPECIAL.has(`${set}:${id}`)) return undefined
    if (PSEUDO_NAME.test(raw)) return undefined
    const relabel = RELABEL[`${set}:${raw}`]
    if (relabel) return relabel
    const name = polish(resolveSlashName(raw, gameId))
    if (name === '') fail(`Location ${set} #${id} "${raw}" cleans to an empty name`)
    return name
  }
}

/** Legends: Arceus sub-areas are shown with their region, like Sword / Shield's Wild Area names. */
export function subAreaName(subArea: string, region: string): string {
  return `${subArea} (${region})`
}
