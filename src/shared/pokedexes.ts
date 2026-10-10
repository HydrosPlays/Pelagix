/**
 * Which regional Pokédexes belong to which game. Hand-kept; shared by the data builder (Node) and
 * the app. The Pokédexes themselves (their species, in regional order) are in the dataset file
 * pokedexes.json, keyed by the PokeAPI identifiers used here.
 *
 * Keep this file dependency-free and free of non-erasable TypeScript syntax (see games.ts).
 */

/** pokedexes.json */
export interface PokedexFile {
  v: 1
  /** National dex numbers of each regional Pokédex's species, in regional order, by PokeAPI identifier. */
  pokedexes: Record<string, number[]>
}

const KANTO = ['kanto']
const JOHTO = ['original-johto']
const HOENN = ['hoenn']
const SINNOH = ['original-sinnoh']
const KALOS = ['kalos-central', 'kalos-coastal', 'kalos-mountain']
const GALAR = ['galar', 'isle-of-armor', 'crown-tundra']
const PALDEA = ['paldea', 'kitakami', 'blueberry']

/**
 * The Pokédexes of each game (`GameDef.id`), in the order the game shows them. A game that is not
 * listed has none: Colosseum, XD, the Stadium games, Box, GO and HOME. The island Pokédexes of
 * Alola are subsets of the Alola one and are not used.
 */
export const GAME_POKEDEXES: Readonly<Record<string, readonly string[]>> = {
  red: KANTO, green: KANTO, blue: KANTO, yellow: KANTO, firered: KANTO, leafgreen: KANTO,
  gold: JOHTO, silver: JOHTO, crystal: JOHTO,
  heartgold: ['updated-johto'], soulsilver: ['updated-johto'],
  ruby: HOENN, sapphire: HOENN, emerald: HOENN,
  omegaruby: ['updated-hoenn'], alphasapphire: ['updated-hoenn'],
  diamond: SINNOH, pearl: SINNOH, brilliantdiamond: SINNOH, shiningpearl: SINNOH,
  platinum: ['extended-sinnoh'],
  black: ['original-unova'], white: ['original-unova'],
  black2: ['updated-unova'], white2: ['updated-unova'],
  x: KALOS, y: KALOS,
  sun: ['original-alola'], moon: ['original-alola'],
  ultrasun: ['updated-alola'], ultramoon: ['updated-alola'],
  letsgopikachu: ['letsgo-kanto'], letsgoeevee: ['letsgo-kanto'],
  sword: GALAR, shield: GALAR,
  legendsarceus: ['hisui'],
  scarlet: PALDEA, violet: PALDEA,
  legendsza: ['lumiose-city', 'hyperspace']
}

/** Display name of every Pokédex a game uses, as a section heading. */
export const POKEDEX_NAMES: Readonly<Record<string, string>> = {
  kanto: 'Kanto Pokédex',
  'original-johto': 'Johto Pokédex',
  'updated-johto': 'Johto Pokédex',
  hoenn: 'Hoenn Pokédex',
  'updated-hoenn': 'Hoenn Pokédex',
  'original-sinnoh': 'Sinnoh Pokédex',
  'extended-sinnoh': 'Sinnoh Pokédex',
  'original-unova': 'Unova Pokédex',
  'updated-unova': 'Unova Pokédex',
  'kalos-central': 'Central Kalos Pokédex',
  'kalos-coastal': 'Coastal Kalos Pokédex',
  'kalos-mountain': 'Mountain Kalos Pokédex',
  'original-alola': 'Alola Pokédex',
  'updated-alola': 'Alola Pokédex',
  'letsgo-kanto': 'Kanto Pokédex',
  galar: 'Galar Pokédex',
  'isle-of-armor': 'Isle of Armor Pokédex',
  'crown-tundra': 'Crown Tundra Pokédex',
  hisui: 'Hisui Pokédex',
  paldea: 'Paldea Pokédex',
  kitakami: 'Kitakami Pokédex',
  blueberry: 'Blueberry Pokédex',
  'lumiose-city': 'Lumiose Pokédex',
  hyperspace: 'Hyperspace Pokédex'
}

const NONE: readonly string[] = Object.freeze([])

/** The Pokédexes of a game, in order; empty for a game without one. */
export function pokedexesOfGame(gameId: string): readonly string[] {
  return Object.hasOwn(GAME_POKEDEXES, gameId) ? (GAME_POKEDEXES[gameId] ?? NONE) : NONE
}
