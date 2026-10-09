/**
 * Static game + system metadata. Hand-authored; shared by the data builder (Node) and the app.
 *
 * Keep this file dependency-free and free of non-erasable TypeScript syntax (no enums,
 * namespaces or parameter properties) so Node can run it directly via type stripping.
 */

export type SystemId = 'gb' | 'gbc' | 'n64' | 'gba' | 'gcn' | 'nds' | '3ds' | 'switch' | 'switch2' | 'mobile'

export interface SystemDef {
  id: SystemId
  name: string
  short: string
  year: number
}

export const SYSTEMS: readonly SystemDef[] = [
  { id: 'gb', name: 'Game Boy', short: 'GB', year: 1989 },
  { id: 'gbc', name: 'Game Boy Color', short: 'GBC', year: 1998 },
  { id: 'n64', name: 'Nintendo 64', short: 'N64', year: 1996 },
  { id: 'gba', name: 'Game Boy Advance', short: 'GBA', year: 2001 },
  { id: 'gcn', name: 'Nintendo GameCube', short: 'GCN', year: 2001 },
  { id: 'nds', name: 'Nintendo DS', short: 'DS', year: 2004 },
  { id: '3ds', name: 'Nintendo 3DS', short: '3DS', year: 2011 },
  { id: 'switch', name: 'Nintendo Switch', short: 'Switch', year: 2017 },
  { id: 'switch2', name: 'Nintendo Switch 2', short: 'Switch 2', year: 2025 },
  { id: 'mobile', name: 'Mobile', short: 'Mobile', year: 2016 }
]

export type RegionId =
  | 'kanto' | 'johto' | 'hoenn' | 'orre' | 'sinnoh' | 'unova' | 'kalos' | 'alola' | 'galar' | 'hisui' | 'paldea' | 'none'

/**
 * - `main`    core series game with its own encounter tables.
 * - `side`    side game that feeds Pokémon into the core series (Colosseum, XD) or only hands out
 *             gifts into other games (Stadium, Stadium 2, Box). Stadium/Box have no tables of their own.
 * - `service` Pokémon GO and Pokémon HOME.
 */
export type GameKind = 'main' | 'side' | 'service'

export interface GameDef {
  /** Stable slug; saved in the user's save file. Never rename. */
  id: string
  /** PKHeX `GameVersion` name the extractor reports for this game, or null when PKHeX has no tables for it. */
  pkhex: string | null
  /** Game whose encounter data this one mirrors (Japanese Green uses international Blue's tables). */
  dataFrom?: string
  name: string
  short: string
  /** File name inside the `games/` icon folder. */
  icon: string
  system: SystemId
  /** Additional systems the same game runs on. */
  alsoOn?: SystemId[]
  generation: number
  region: RegionId
  year: number
  /** Paired-version group id (games in a group share most encounters). */
  group: string
  groupName: string
  /** Accent colour used for badges and charts. */
  color: string
  kind: GameKind
}

const g = (
  id: string, pkhex: string | null, name: string, short: string, icon: string, system: SystemId,
  generation: number, region: RegionId, year: number, group: string, groupName: string, color: string,
  kind: GameKind = 'main', extra: Partial<GameDef> = {}
): GameDef => ({ id, pkhex, name, short, icon: `pokemon-${icon}.png`, system, generation, region, year, group, groupName, color, kind, ...extra })

/** Canonical order: generation, then release. `DexIndex.games` repeats these ids in the order the datasets use. */
export const GAMES: readonly GameDef[] = [
  // Generation 1
  g('red', 'RD', 'Pokémon Red', 'Red', 'red', 'gb', 1, 'kanto', 1996, 'rgb', 'Red, Green & Blue', '#e0433a'),
  g('green', null, 'Pokémon Green', 'Green', 'green', 'gb', 1, 'kanto', 1996, 'rgb', 'Red, Green & Blue', '#3fa654', 'main', { dataFrom: 'blue' }),
  g('blue', 'GN', 'Pokémon Blue', 'Blue', 'blue', 'gb', 1, 'kanto', 1996, 'rgb', 'Red, Green & Blue', '#3a72d8'),
  g('yellow', 'YW', 'Pokémon Yellow', 'Yellow', 'yellow', 'gb', 1, 'kanto', 1998, 'yellow', 'Yellow', '#f2c832'),
  g('stadium', null, 'Pokémon Stadium', 'Stadium', 'stadium', 'n64', 1, 'kanto', 1999, 'stadium', 'Stadium', '#c9503c', 'side'),
  // Generation 2
  g('gold', 'GD', 'Pokémon Gold', 'Gold', 'gold', 'gbc', 2, 'johto', 1999, 'gs', 'Gold & Silver', '#d6a419'),
  g('silver', 'SI', 'Pokémon Silver', 'Silver', 'silver', 'gbc', 2, 'johto', 1999, 'gs', 'Gold & Silver', '#a9b4c0'),
  g('crystal', 'C', 'Pokémon Crystal', 'Crystal', 'crystal', 'gbc', 2, 'johto', 2000, 'crystal', 'Crystal', '#58c4dc'),
  g('stadium2', null, 'Pokémon Stadium 2', 'Stadium 2', 'stadium2', 'n64', 2, 'johto', 2000, 'stadium2', 'Stadium 2', '#8b6ad1', 'side'),
  // Generation 3
  g('ruby', 'R', 'Pokémon Ruby', 'Ruby', 'ruby', 'gba', 3, 'hoenn', 2002, 'rs', 'Ruby & Sapphire', '#c9304a'),
  g('sapphire', 'S', 'Pokémon Sapphire', 'Sapphire', 'sapphire', 'gba', 3, 'hoenn', 2002, 'rs', 'Ruby & Sapphire', '#3157c4'),
  g('boxrubysapphire', null, 'Pokémon Box: Ruby & Sapphire', 'Box', 'boxrubysapphire', 'gcn', 3, 'hoenn', 2003, 'box', 'Box', '#4f8fd0', 'side'),
  g('colosseum', 'COLO', 'Pokémon Colosseum', 'Colosseum', 'colosseum', 'gcn', 3, 'orre', 2003, 'colosseum', 'Colosseum', '#8a63c9', 'side'),
  g('firered', 'FR', 'Pokémon FireRed', 'FireRed', 'firered', 'gba', 3, 'kanto', 2004, 'frlg', 'FireRed & LeafGreen', '#ea6a26'),
  g('leafgreen', 'LG', 'Pokémon LeafGreen', 'LeafGreen', 'leafgreen', 'gba', 3, 'kanto', 2004, 'frlg', 'FireRed & LeafGreen', '#6dbb3f'),
  g('emerald', 'E', 'Pokémon Emerald', 'Emerald', 'emerald', 'gba', 3, 'hoenn', 2004, 'emerald', 'Emerald', '#22a866'),
  g('xd', 'XD', 'Pokémon XD: Gale of Darkness', 'XD', 'xdgaleofdarkness', 'gcn', 3, 'orre', 2005, 'xd', 'XD: Gale of Darkness', '#5a48ad', 'side'),
  // Generation 4
  g('diamond', 'D', 'Pokémon Diamond', 'Diamond', 'diamond', 'nds', 4, 'sinnoh', 2006, 'dp', 'Diamond & Pearl', '#7fa8e6'),
  g('pearl', 'P', 'Pokémon Pearl', 'Pearl', 'pearl', 'nds', 4, 'sinnoh', 2006, 'dp', 'Diamond & Pearl', '#e59fbf'),
  g('platinum', 'Pt', 'Pokémon Platinum', 'Platinum', 'platinum', 'nds', 4, 'sinnoh', 2008, 'platinum', 'Platinum', '#9aa5b4'),
  g('heartgold', 'HG', 'Pokémon HeartGold', 'HeartGold', 'heartgold', 'nds', 4, 'johto', 2009, 'hgss', 'HeartGold & SoulSilver', '#dba628'),
  g('soulsilver', 'SS', 'Pokémon SoulSilver', 'SoulSilver', 'soulsilver', 'nds', 4, 'johto', 2009, 'hgss', 'HeartGold & SoulSilver', '#b3bfcc'),
  // Generation 5
  g('black', 'B', 'Pokémon Black', 'Black', 'black', 'nds', 5, 'unova', 2010, 'bw', 'Black & White', '#5a5f6b'),
  g('white', 'W', 'Pokémon White', 'White', 'white', 'nds', 5, 'unova', 2010, 'bw', 'Black & White', '#dfe5ee'),
  g('black2', 'B2', 'Pokémon Black 2', 'Black 2', 'black2', 'nds', 5, 'unova', 2012, 'b2w2', 'Black 2 & White 2', '#3f6db5'),
  g('white2', 'W2', 'Pokémon White 2', 'White 2', 'white2', 'nds', 5, 'unova', 2012, 'b2w2', 'Black 2 & White 2', '#e88aa0'),
  // Generation 6
  g('x', 'X', 'Pokémon X', 'X', 'x', '3ds', 6, 'kalos', 2013, 'xy', 'X & Y', '#2f7fcf'),
  g('y', 'Y', 'Pokémon Y', 'Y', 'y', '3ds', 6, 'kalos', 2013, 'xy', 'X & Y', '#d8334f'),
  g('omegaruby', 'OR', 'Pokémon Omega Ruby', 'Omega Ruby', 'omegaruby', '3ds', 6, 'hoenn', 2014, 'oras', 'Omega Ruby & Alpha Sapphire', '#cf3b32'),
  g('alphasapphire', 'AS', 'Pokémon Alpha Sapphire', 'Alpha Sapphire', 'alphasapphire', '3ds', 6, 'hoenn', 2014, 'oras', 'Omega Ruby & Alpha Sapphire', '#3468c9'),
  // Generation 7
  g('sun', 'SN', 'Pokémon Sun', 'Sun', 'sun', '3ds', 7, 'alola', 2016, 'sm', 'Sun & Moon', '#f29a2e'),
  g('moon', 'MN', 'Pokémon Moon', 'Moon', 'moon', '3ds', 7, 'alola', 2016, 'sm', 'Sun & Moon', '#5f6cc4'),
  g('ultrasun', 'US', 'Pokémon Ultra Sun', 'Ultra Sun', 'ultrasun', '3ds', 7, 'alola', 2017, 'usum', 'Ultra Sun & Ultra Moon', '#ee7a2b'),
  g('ultramoon', 'UM', 'Pokémon Ultra Moon', 'Ultra Moon', 'ultramoon', '3ds', 7, 'alola', 2017, 'usum', 'Ultra Sun & Ultra Moon', '#7353b3'),
  g('letsgopikachu', 'GP', "Pokémon: Let's Go, Pikachu!", "Let's Go Pikachu", 'letsgopikachu', 'switch', 7, 'kanto', 2018, 'lgpe', "Let's Go, Pikachu! & Eevee!", '#f3cf3a'),
  g('letsgoeevee', 'GE', "Pokémon: Let's Go, Eevee!", "Let's Go Eevee", 'letsgoeevee', 'switch', 7, 'kanto', 2018, 'lgpe', "Let's Go, Pikachu! & Eevee!", '#c48d4f'),
  // Generation 8
  g('sword', 'SW', 'Pokémon Sword', 'Sword', 'sword', 'switch', 8, 'galar', 2019, 'swsh', 'Sword & Shield', '#30a7df'),
  g('shield', 'SH', 'Pokémon Shield', 'Shield', 'shield', 'switch', 8, 'galar', 2019, 'swsh', 'Sword & Shield', '#dc3a63'),
  g('brilliantdiamond', 'BD', 'Pokémon Brilliant Diamond', 'Brilliant Diamond', 'brilliantdiamond', 'switch', 8, 'sinnoh', 2021, 'bdsp', 'Brilliant Diamond & Shining Pearl', '#5b95dc'),
  g('shiningpearl', 'SP', 'Pokémon Shining Pearl', 'Shining Pearl', 'shiningpearl', 'switch', 8, 'sinnoh', 2021, 'bdsp', 'Brilliant Diamond & Shining Pearl', '#e89cc0'),
  g('legendsarceus', 'PLA', 'Pokémon Legends: Arceus', 'Legends: Arceus', 'legendsarceus', 'switch', 8, 'hisui', 2022, 'pla', 'Legends: Arceus', '#4c7a9c'),
  // Generation 9
  g('scarlet', 'SL', 'Pokémon Scarlet', 'Scarlet', 'scarlet', 'switch', 9, 'paldea', 2022, 'sv', 'Scarlet & Violet', '#d94334'),
  g('violet', 'VL', 'Pokémon Violet', 'Violet', 'violet', 'switch', 9, 'paldea', 2022, 'sv', 'Scarlet & Violet', '#8348c2'),
  g('legendsza', 'ZA', 'Pokémon Legends: Z-A', 'Legends: Z-A', 'legendsza', 'switch', 9, 'kalos', 2025, 'za', 'Legends: Z-A', '#35b876', 'main', { alsoOn: ['switch2'] }),
  // Services
  g('go', 'GO', 'Pokémon GO', 'GO', 'go', 'mobile', 0, 'none', 2016, 'go', 'Pokémon GO', '#3b82e0', 'service'),
  g('home', null, 'Pokémon HOME', 'HOME', 'home', 'mobile', 0, 'none', 2020, 'home', 'Pokémon HOME', '#38c9a4', 'service', { alsoOn: ['switch'] })
]

export const GAME_BY_ID: ReadonlyMap<string, GameDef> = new Map(GAMES.map((d) => [d.id, d]))
export const SYSTEM_BY_ID: ReadonlyMap<SystemId, SystemDef> = new Map(SYSTEMS.map((d) => [d.id, d]))

export const GENERATION_NAMES: Readonly<Record<number, string>> = {
  1: 'Generation I', 2: 'Generation II', 3: 'Generation III', 4: 'Generation IV', 5: 'Generation V',
  6: 'Generation VI', 7: 'Generation VII', 8: 'Generation VIII', 9: 'Generation IX'
}

export const REGION_NAMES: Readonly<Record<RegionId, string>> = {
  kanto: 'Kanto', johto: 'Johto', hoenn: 'Hoenn', orre: 'Orre', sinnoh: 'Sinnoh', unova: 'Unova',
  kalos: 'Kalos', alola: 'Alola', galar: 'Galar', hisui: 'Hisui', paldea: 'Paldea', none: '—'
}
