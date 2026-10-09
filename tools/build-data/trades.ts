/**
 * In-game trades of Generations 2-4 (and their remakes): the species the trader asks for, the
 * town, and the version split PKHeX does not make. PKHeX records only the received Pokémon and a
 * "Link trade (NPC)" placeholder; the requested species exist only as comments in its source
 * (Encounters2.cs, Encounters3RSE.cs, Encounters3FRLG.cs, Encounters4DPPt.cs, Encounters4HGSS.cs),
 * which this table was taken from and checked against Bulbapedia's "In-game trade" lists.
 *
 * Generation 1 is in gen1-locations.ts. Later generations are not curated: their towns come from
 * PokeAPI where it has them (pokeapi-places.ts) and their requested species are left out.
 */
import { GAMES } from '../../src/shared/games.ts'

export interface TradeEntry {
  /** Received species. */
  species: number
  games: readonly string[]
  /** National number of the requested species, 0 for "any Pokémon". Absent for gifts. */
  request?: number
  location?: string
  /** PKHeX lists it with the trades, but the Pokémon is simply handed over. */
  gift?: true
}

const GS = ['gold', 'silver'] as const
const CRYSTAL = ['crystal'] as const
const GSC = ['gold', 'silver', 'crystal'] as const
const RS = ['ruby', 'sapphire'] as const
const EMERALD = ['emerald'] as const
const FRLG = ['firered', 'leafgreen'] as const
const DPPT = ['diamond', 'pearl', 'platinum'] as const
const BDSP = ['brilliantdiamond', 'shiningpearl'] as const
const HGSS = ['heartgold', 'soulsilver'] as const

const t = (species: number, games: readonly string[], request: number, location?: string): TradeEntry =>
  ({ species, games, request, ...(location ? { location } : {}) })

export const TRADE_ENTRIES: readonly TradeEntry[] = [
  // Gold / Silver / Crystal. Crystal replaced three of the trades.
  t(95, GSC, 69, 'Violet City'),
  t(66, GS, 96, 'Goldenrod City'),
  t(66, CRYSTAL, 63, 'Goldenrod City'),
  t(100, GSC, 98, 'Olivine City'),
  t(112, GS, 148, 'Blackthorn City'),
  t(85, CRYSTAL, 148, 'Blackthorn City'),
  t(142, GSC, 113, 'Route 14'),
  t(78, GS, 44, 'Pewter City'),
  t(178, CRYSTAL, 93, 'Pewter City'),
  t(82, GSC, 51, 'Power Plant'),
  { species: 21, games: GSC, gift: true, location: 'Route 35' }, // Kenya, carrying mail
  { species: 213, games: GSC, gift: true, location: 'Cianwood City' }, // Shuckie

  // Ruby / Sapphire
  t(296, RS, 287),
  t(300, RS, 25),
  t(222, RS, 182),
  // Emerald
  t(273, EMERALD, 280),
  t(311, EMERALD, 313),
  t(116, EMERALD, 371),
  t(52, EMERALD, 300),
  // FireRed / LeafGreen
  t(122, FRLG, 63),
  t(124, FRLG, 61),
  t(83, FRLG, 21),
  t(101, FRLG, 26),
  t(114, FRLG, 48),
  t(86, FRLG, 77),
  t(29, ['firered'], 32),
  t(30, ['firered'], 33),
  t(108, ['firered'], 55),
  t(32, ['leafgreen'], 29),
  t(33, ['leafgreen'], 30),
  t(108, ['leafgreen'], 80),

  // Diamond / Pearl / Platinum and their remakes
  t(63, DPPT, 66, 'Oreburgh City'),
  t(441, DPPT, 418, 'Eterna City'),
  t(93, DPPT, 308, 'Snowpoint City'),
  t(129, DPPT, 456, 'Route 226'),
  t(63, BDSP, 66, 'Oreburgh City'),
  t(441, BDSP, 418, 'Eterna City'),
  t(93, BDSP, 308, 'Snowpoint City'),
  t(129, BDSP, 456, 'Route 226'),

  // HeartGold / SoulSilver
  t(95, HGSS, 69, 'Violet City'),
  t(66, HGSS, 96, 'Goldenrod City'),
  t(100, HGSS, 98, 'Olivine City'),
  t(85, HGSS, 148, 'Blackthorn City'),
  t(82, HGSS, 51, 'Power Plant'),
  t(178, HGSS, 93, 'Pewter City'),
  t(25, HGSS, 25, 'Saffron City'),
  t(374, HGSS, 205, 'Saffron City'),
  t(111, HGSS, 438, "Diglett's Cave"),
  t(208, HGSS, 0, 'Olivine City'),
  { species: 21, games: HGSS, gift: true, location: 'Route 35' }, // Kenya
  { species: 213, games: HGSS, gift: true, location: 'Cianwood City' } // Shuckie
]

/** Games whose in-game trades are fully listed above: a trade row with no entry is not in that version. */
const COMPLETE: ReadonlySet<string> = new Set<string>([...GSC, ...RS, ...EMERALD, ...FRLG, ...DPPT, ...BDSP, ...HGSS])

const INDEX = new Map<string, TradeEntry>()
for (const entry of TRADE_ENTRIES) {
  for (const game of entry.games) {
    const key = `${game}:${entry.species}`
    if (INDEX.has(key)) throw new Error(`trades.ts lists ${key} twice`)
    INDEX.set(key, entry)
  }
}

export type TradeLookup = { kind: 'entry'; entry: TradeEntry } | { kind: 'absent' } | { kind: 'uncurated' }

/** What the curated table says about a PKHeX trade row of one species in one game. */
export function lookupTrade(gameIdx: number, species: number): TradeLookup {
  const game = GAMES[gameIdx].id
  const entry = INDEX.get(`${game}:${species}`)
  if (entry) return { kind: 'entry', entry }
  return COMPLETE.has(game) ? { kind: 'absent' } : { kind: 'uncurated' }
}
