/**
 * Corrections to what PKHeX's encounter tables imply, where PKHeX is deliberately generous.
 *
 * PKHeX answers "could this Pokémon legally come from this game?", so it lists a fossil revival for
 * both versions of a pair (the fossil item can be traded over), keeps slot tables no map uses, and
 * shares record-mixed swarms between games. Pelagix asks "can I get it in this game on its own?".
 * The tables below hold the per-version facts PKHeX has no data for. Every entry is checked
 * against the extract by the build (an entry that matches nothing fails it).
 *
 * Sources: Serebii and Bulbapedia location pages, dittobase.com version-exclusive lists, and the
 * comments in PKHeX's own encounter sources (Encounters7SM.cs, Encounters7USUM.cs, Encounters2.cs).
 * Species are national numbers, games and groups are Pelagix ids (shared/games.ts).
 */
import { GAMES } from '../../src/shared/games.ts'

// --- fossils ---------------------------------------------------------------------------------------

/**
 * `${group}:${species}` -> the games of that group whose own fossils revive into the species.
 * Groups and species not listed keep PKHeX's game list (the fossil is found in every version).
 */
const FOSSIL_GAMES: Readonly<Record<string, readonly string[]>> = {
  // Underground: the Skull Fossil is Diamond's, the Armor Fossil Pearl's (Platinum has either, by Trainer ID).
  'dp:408': ['diamond'],
  'dp:410': ['pearl'],
  // Rock Smash at the Ruins of Alph and Cliff Cave; the Sinnoh fossils cannot be found at all.
  'hgss:138': ['heartgold'],
  'hgss:347': ['heartgold'],
  'hgss:140': ['soulsilver'],
  'hgss:345': ['soulsilver'],
  'hgss:408': [],
  'hgss:410': [],
  // Rock Smash in Glittering Cave after the Hall of Fame.
  'xy:345': ['x'],
  'xy:347': ['x'],
  'xy:138': ['y'],
  'xy:140': ['y'],
  // Rock Smash at Mirage spots; the Jaw and Sail Fossils cannot be found at all.
  'oras:140': ['omegaruby'],
  'oras:410': ['omegaruby'],
  'oras:566': ['omegaruby'],
  'oras:138': ['alphasapphire'],
  'oras:408': ['alphasapphire'],
  'oras:564': ['alphasapphire'],
  'oras:696': [],
  'oras:698': [],
  // Olivia's shop in Konikoni City sells two fossils per version and nothing else exists.
  // (Ultra Sun / Ultra Moon add Isle Aphun, where every fossil turns up in both versions.)
  'sm:408': ['sun'],
  'sm:564': ['sun'],
  'sm:410': ['moon'],
  'sm:566': ['moon'],
  'sm:138': [],
  'sm:140': [],
  'sm:345': [],
  'sm:347': [],
  'sm:696': [],
  'sm:698': [],
  // Grand Underground: same split as the originals.
  'bdsp:408': ['brilliantdiamond'],
  'bdsp:410': ['shiningpearl']
}

/** Aerodactyl is simply handed over in Seafolk Village in Alola; it is not revived there. */
const NOT_A_REVIVAL: ReadonlySet<string> = new Set(['sm:142', 'usum:142'])

export type FossilRule = 'revived' | 'gift' | 'absent'

/** What a PKHeX gift row of a fossil species is in one game. */
export function fossilRule(gameIdx: number, species: number): FossilRule {
  const game = GAMES[gameIdx]
  const key = `${game.group}:${species}`
  if (NOT_A_REVIVAL.has(key)) return 'gift'
  const games = FOSSIL_GAMES[key]
  return games === undefined || games.includes(game.id) ? 'revived' : 'absent'
}

export const FOSSIL_RULE_KEYS: readonly string[] = [...Object.keys(FOSSIL_GAMES), ...NOT_A_REVIVAL]

// --- legendary Pokémon of one version ----------------------------------------------------------------

const bound = (prefix: string, game: string, species: readonly number[]): [string, string][] => species.map((s) => [`${prefix}:${s}`, game])

/**
 * Encounters PKHeX lists for both versions of a pair although each version only offers its own:
 * `${group}:${extractor kind}:${species}` -> the game that has it. (The other version can only
 * join a session hosted from it, which is trading in all but name.)
 */
const VERSION_BOUND: ReadonlyMap<string, string> = new Map([
  // Dynamax Adventures: eight of the Max Lair's legendary Pokémon are found in one version each.
  ...bound('swsh:max-lair', 'sword', [250, 381, 383, 483, 641, 643, 716, 791]),
  ...bound('swsh:max-lair', 'shield', [249, 380, 382, 484, 642, 644, 717, 792]),
  // The Indigo Disk: Snacksworth's treats from group Blueberry Quests differ by version.
  ...bound('sv:static', 'scarlet', [243, 244, 245, 250, 381, 383, 643, 791, 896]),
  ...bound('sv:static', 'violet', [249, 380, 382, 638, 639, 640, 644, 792, 897])
])

/** The one game of its pair that has this encounter, or undefined when both do. */
export function versionBound(gameIdx: number, kind: string, species: number): string | undefined {
  return VERSION_BOUND.get(`${GAMES[gameIdx].group}:${kind}:${species}`)
}

export const VERSION_BOUND_KEYS: readonly string[] = [...VERSION_BOUND.keys()]

// --- Game Corner prizes ----------------------------------------------------------------------------

export interface PrizeEntry {
  games: readonly string[]
  species: number
  level: number
  city: 'Goldenrod City' | 'Celadon City'
}

const prize = (games: readonly string[], city: PrizeEntry['city'], list: readonly [number, number][]): PrizeEntry[] =>
  list.map(([species, level]) => ({ games, species, level, city }))

/** Generation 2-4 Game Corner prize Pokémon (Generation 1's are in gen1-locations.ts). */
export const PRIZES: readonly PrizeEntry[] = [
  ...prize(['gold', 'silver'], 'Goldenrod City', [[63, 10], [147, 10]]),
  ...prize(['gold'], 'Goldenrod City', [[23, 10]]),
  ...prize(['silver'], 'Goldenrod City', [[27, 10]]),
  ...prize(['gold', 'silver'], 'Celadon City', [[122, 15], [133, 15], [137, 15]]),
  ...prize(['crystal'], 'Goldenrod City', [[63, 5], [104, 15], [202, 15]]),
  ...prize(['crystal'], 'Celadon City', [[25, 25], [137, 15], [246, 40]]),
  ...prize(['firered'], 'Celadon City', [[63, 9], [35, 8], [147, 18], [123, 25], [137, 26]]),
  ...prize(['leafgreen'], 'Celadon City', [[63, 7], [35, 12], [127, 18], [147, 24], [137, 18]]),
  ...prize(['heartgold', 'soulsilver'], 'Goldenrod City', [[63, 15], [147, 15]]),
  ...prize(['heartgold'], 'Goldenrod City', [[23, 15]]),
  ...prize(['soulsilver'], 'Goldenrod City', [[27, 15]]),
  ...prize(['heartgold', 'soulsilver'], 'Celadon City', [[122, 15], [133, 15], [137, 15]])
]

export const PRIZE_METHOD = 'Game Corner prize'
export const prizeLocation = (city: string): string => `${city} (Game Corner)`

const PRIZE_INDEX = new Map<string, PrizeEntry>()
/** `${group}:${species}:${level}:${city}` of every prize, to spot the version PKHeX lumps in. */
const PRIZE_SHAPES = new Set<string>()
for (const entry of PRIZES) {
  for (const id of entry.games) {
    const key = `${id}:${entry.species}:${entry.level}:${entry.city}`
    if (PRIZE_INDEX.has(key)) throw new Error(`curated.ts lists the prize ${key} twice`)
    PRIZE_INDEX.set(key, entry)
    const game = GAMES.find((g) => g.id === id)
    if (!game) throw new Error(`curated.ts: unknown game ${id}`)
    PRIZE_SHAPES.add(`${game.group}:${entry.species}:${entry.level}:${entry.city}`)
  }
}

/**
 * A PKHeX gift row at a Game Corner city: the prize it is, 'absent' when that prize belongs to the
 * other version of the pair only (Ekans is Gold's and HeartGold's, Sandshrew Silver's and
 * SoulSilver's), or undefined when it is no prize.
 */
export function prizeFor(gameIdx: number, species: number, level: number, location: string | undefined): PrizeEntry | 'absent' | undefined {
  if (location !== 'Goldenrod City' && location !== 'Celadon City') return undefined
  const game = GAMES[gameIdx]
  const entry = PRIZE_INDEX.get(`${game.id}:${species}:${level}:${location}`)
  if (entry) return entry
  return PRIZE_SHAPES.has(`${game.group}:${species}:${level}:${location}`) ? 'absent' : undefined
}

// --- Island Scan -----------------------------------------------------------------------------------

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

/** [species, level] per island, Sunday to Saturday, in the order of PKHeX's "QR Scan" blocks. */
const ISLAND_SCAN: Readonly<Record<string, readonly (readonly [number, number][])[]>> = {
  sm: [
    [[155, 12], [158, 12], [633, 13], [116, 18], [599, 8], [152, 10], [607, 10]], // Melemele
    [[574, 17], [363, 19], [404, 20], [679, 23], [543, 14], [69, 16], [183, 17]], // Akala
    [[111, 30], [220, 31], [578, 33], [315, 34], [397, 27], [288, 27], [610, 28]], // Ula'ula
    [[604, 55], [534, 57], [468, 59], [542, 57], [497, 43], [503, 43], [500, 43]] // Poni
  ],
  usum: [
    [[4, 12], [7, 12], [95, 14], [116, 18], [664, 9], [1, 10], [607, 9]],
    [[280, 17], [363, 19], [256, 20], [679, 24], [15, 14], [253, 16], [259, 17]],
    [[111, 32], [220, 33], [394, 35], [388, 36], [18, 29], [391, 29], [610, 30]],
    [[604, 55], [306, 57], [479, 61], [542, 57], [652, 45], [658, 44], [655, 44]]
  ]
}

export const ISLAND_SCAN_METHOD = 'Island Scan'

const SCAN_INDEX = new Map<string, string>()
for (const [group, islands] of Object.entries(ISLAND_SCAN)) {
  for (const island of islands) {
    if (island.length !== DAYS.length) throw new Error('curated.ts: an Island Scan island needs seven entries')
    island.forEach(([species, level], day) => {
      const key = `${group}:${species}:${level}`
      if (SCAN_INDEX.has(key)) throw new Error(`curated.ts lists the Island Scan ${key} twice`)
      SCAN_INDEX.set(key, DAYS[day])
    })
  }
}

/** The weekday an Alolan static encounter is an Island Scan find on, or undefined when it is none. */
export function islandScanDay(gameIdx: number, species: number, level: number): string | undefined {
  return SCAN_INDEX.get(`${GAMES[gameIdx].group}:${species}:${level}`)
}

export const ISLAND_SCAN_KEYS: readonly string[] = [...SCAN_INDEX.keys()]

// --- Hoenn mass outbreaks --------------------------------------------------------------------------

/**
 * Ruby / Sapphire / Emerald each generate their own outbreaks (pokeruby / pokeemerald
 * sPokeOutbreakSpeciesList); PKHeX shares one table between the three because the TV show that
 * announces an outbreak spreads by mixing records. species -> games that generate it themselves,
 * with the level it has there.
 */
const HOENN_SWARMS: Readonly<Record<number, Readonly<Record<string, number | 'any'>>>> = {
  283: { ruby: 'any', sapphire: 'any' }, // Surskit
  273: { emerald: 'any' }, // Seedot
  274: { emerald: 'any' }, // Nuzleaf
  300: { ruby: 15, sapphire: 15, emerald: 8 } // Skitty
}

/** Level of a Hoenn outbreak slot in one game ('any' = PKHeX's own), or undefined when that game never generates it. */
export function hoennSwarm(gameIdx: number, species: number): number | 'any' | undefined {
  const rule = HOENN_SWARMS[species]
  if (!rule) throw new Error(`curated.ts: Hoenn outbreak of species ${species} is not listed`)
  return rule[GAMES[gameIdx].id]
}

// --- slots a game's maps never use -----------------------------------------------------------------

/**
 * Wild slots PKHeX keeps although the game cannot reach them: `${game}:${species}:${location}`.
 * Crystal still holds Gold / Silver's Route 44 fishing group with Remoraid, but no map uses it:
 * Remoraid and Octillery are missing from Crystal.
 */
const UNREACHABLE_SLOTS: ReadonlySet<string> = new Set(['crystal:223:Route 44'])

export function isUnreachableSlot(gameIdx: number, species: number, location: string | undefined): boolean {
  return location !== undefined && UNREACHABLE_SLOTS.has(`${GAMES[gameIdx].id}:${species}:${location}`)
}

export const UNREACHABLE_SLOT_KEYS: readonly string[] = [...UNREACHABLE_SLOTS]
