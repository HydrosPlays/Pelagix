/**
 * Red / Green / Blue / Yellow gifts, scripted battles and in-game trades.
 *
 * PKHeX has no met location in Generation 1 and keeps one legality-minimal template per species
 * for "RBY" or "RB" (lowest level, all versions lumped), so the real per-version data is curated
 * here: who hands the Pokémon over where, at which level, in which version. Levels and prize lists
 * agree with the comments in PKHeX's Encounters1.cs and with Bulbapedia's location pages.
 *
 * Games are Pelagix ids. "blue" is the international Blue; Japanese Green shares its data, except
 * for the Route 5 trade, which is reversed in the Japanese games.
 */
import type { EncounterKind } from '../../src/shared/dex-types.ts'

export interface Gen1Entry {
  species: number
  kind: Extract<EncounterKind, 'gift' | 'static' | 'trade'>
  games: readonly string[]
  /** Level, for gifts and battles. Trades keep the level of the Pokémon handed over. */
  level?: number
  location: string
  method?: string
  note?: string
  /** National number of the species the trader asks for. */
  request?: number
}

const RGB = ['red', 'green', 'blue'] as const
const RGBY = ['red', 'green', 'blue', 'yellow'] as const
const RED = ['red'] as const
const BLUE_GREEN = ['green', 'blue'] as const
const RED_BLUE = ['red', 'blue'] as const
const GREEN = ['green'] as const
const YELLOW = ['yellow'] as const

const OAK = "Pallet Town (Professor Oak's Lab)"
const CORNER = 'Celadon City (Game Corner)'
const PRIZE = 'Game Corner prize'
const LAB = 'Cinnabar Island (Pokémon Lab)'

const gift = (species: number, games: readonly string[], level: number, location: string, method = 'Gift', note?: string): Gen1Entry =>
  ({ species, kind: 'gift', games, level, location, method, ...(note ? { note } : {}) })
const battle = (species: number, level: number, location: string): Gen1Entry =>
  ({ species, kind: 'static', games: RGBY, level, location })
const trade = (species: number, games: readonly string[], request: number, location: string): Gen1Entry =>
  ({ species, kind: 'trade', games, location, request, method: 'In-game trade' })

export const GEN1_ENTRIES: readonly Gen1Entry[] = [
  // First partners
  gift(1, RGB, 5, OAK, 'Starter'),
  gift(4, RGB, 5, OAK, 'Starter'),
  gift(7, RGB, 5, OAK, 'Starter'),
  gift(25, YELLOW, 5, OAK, 'Starter'),
  // Yellow hands the three Kanto first partners out along the way
  gift(1, YELLOW, 10, 'Cerulean City'),
  gift(4, YELLOW, 10, 'Route 24'),
  gift(7, YELLOW, 10, 'Vermilion City'),

  // Celadon Game Corner prizes, per version
  gift(63, RED, 9, CORNER, PRIZE),
  gift(35, RED, 8, CORNER, PRIZE),
  gift(30, RED, 17, CORNER, PRIZE),
  gift(147, RED, 18, CORNER, PRIZE),
  gift(123, RED, 25, CORNER, PRIZE),
  gift(137, RED, 26, CORNER, PRIZE),
  gift(63, BLUE_GREEN, 6, CORNER, PRIZE),
  gift(35, BLUE_GREEN, 12, CORNER, PRIZE),
  gift(33, BLUE_GREEN, 17, CORNER, PRIZE),
  gift(127, BLUE_GREEN, 20, CORNER, PRIZE),
  gift(147, BLUE_GREEN, 24, CORNER, PRIZE),
  gift(137, BLUE_GREEN, 18, CORNER, PRIZE),
  gift(63, YELLOW, 15, CORNER, PRIZE),
  gift(37, YELLOW, 18, CORNER, PRIZE),
  gift(40, YELLOW, 22, CORNER, PRIZE),
  gift(123, YELLOW, 30, CORNER, PRIZE),
  gift(127, YELLOW, 30, CORNER, PRIZE),
  gift(137, YELLOW, 26, CORNER, PRIZE),

  // Other gifts
  gift(129, RGBY, 5, 'Route 4 (Pokémon Center)', 'Gift', 'Sold by the Magikarp salesman'),
  gift(133, RGBY, 25, 'Celadon City (Celadon Mansion)'),
  gift(131, RGBY, 15, 'Saffron City (Silph Co.)'),
  gift(106, RGBY, 30, 'Saffron City (Fighting Dojo)', 'Gift', 'Hitmonlee or Hitmonchan, not both'),
  gift(107, RGBY, 30, 'Saffron City (Fighting Dojo)', 'Gift', 'Hitmonlee or Hitmonchan, not both'),
  gift(138, RGBY, 30, LAB, 'Fossil', 'Revived from the Helix Fossil'),
  gift(140, RGBY, 30, LAB, 'Fossil', 'Revived from the Dome Fossil'),
  gift(142, RGBY, 30, LAB, 'Fossil', 'Revived from the Old Amber'),

  // Scripted battles
  battle(143, 30, 'Route 12'),
  battle(143, 30, 'Route 16'),
  battle(100, 40, 'Power Plant'),
  battle(101, 43, 'Power Plant'),
  battle(144, 50, 'Seafoam Islands'),
  battle(145, 50, 'Power Plant'),
  battle(146, 50, 'Victory Road'),
  battle(150, 70, 'Cerulean Cave'),

  // In-game trades: Red, Blue and Green
  trade(122, RGB, 63, 'Route 2'),
  trade(29, RED_BLUE, 32, 'Route 5 (Underground Path)'),
  trade(32, GREEN, 29, 'Route 5 (Underground Path)'),
  trade(30, RGB, 33, 'Route 11'),
  trade(108, RGB, 80, 'Route 18'),
  trade(124, RGB, 61, 'Cerulean City'),
  trade(83, RGB, 21, 'Vermilion City'),
  trade(101, RGB, 26, LAB),
  trade(114, RGB, 48, LAB),
  trade(86, RGB, 77, LAB),
  // In-game trades: Yellow
  trade(122, YELLOW, 35, 'Route 2'),
  trade(67, YELLOW, 104, 'Route 5 (Underground Path)'),
  trade(51, YELLOW, 108, 'Route 11'),
  trade(47, YELLOW, 114, 'Route 18'),
  trade(112, YELLOW, 55, LAB),
  trade(87, YELLOW, 58, LAB),
  trade(89, YELLOW, 115, LAB)
]
