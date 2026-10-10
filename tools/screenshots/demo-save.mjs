/**
 * Builds the demo save the README screenshots are taken with: trainer "Hydro", about a year into
 * a Living Dex. Deterministic: the same datasets always give the same collection. Its timestamps
 * are local wall-clock times, so every date and time the app shows is the same in any time zone.
 *
 *   node tools/screenshots/demo-save.mjs [out.json]      (prints a summary; writes the finished save when a path is given)
 *
 * Every entry is made from a record of the built datasets (src/renderer/public/data): an
 * encounter row, an evolution or a breeding record of exactly that species and form in exactly
 * that game. Game, how, method, location, level range, fixed ball, fixed gender and shiny lock
 * come from that record; a ball that is not fixed is one the dataset lists as usable in that game.
 * And the app itself calls the form obtainable in that game: nothing is evolved from, or bred in,
 * a game where the Pokémon would first have to be traded in or come from an event.
 * What is made up here: nicknames, notes, dates, the choice among the possible balls and genders,
 * the level within the record's range, and the level of evolved Pokémon.
 *
 * `buildDemoSave` gives the collection without achievements; `demoSave` adds when the collection
 * earned each of them (unlock-history.mjs) and is the save the pictures are taken with.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { BALL_BY_ID } from '../../src/shared/balls.ts'
import { GAME_BY_ID, GAMES, SYSTEMS } from '../../src/shared/games.ts'
import { DEFAULT_RULES, SAVE_VERSION } from '../../src/shared/save-types.ts'
import { isTimeLimited } from '../build-data/row-order.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = resolve(HERE, '../../src/renderer/public/data')

/** The day the demo collection is looked at. run.mjs pins the app's clock to this day. */
export const DEMO_TODAY = '2026-10-09'
export const DEMO_TRAINER = 'Hydro'
const FIRST_DAY = '2025-11-01'
const SEED = 0x9e1a61c5

// ---------------------------------------------------------------- deterministic helpers

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** FNV-1a, to give every decision its own stream of random numbers. */
function hashString(text) {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

const pad = (n, width = 2) => String(n).padStart(width, '0')
const dayNumber = (iso) => Math.round(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86_400_000)
const dayIso = (n) => {
  const d = new Date(n * 86_400_000)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}
/** 0 Sunday .. 6 Saturday. */
const weekday = (n) => new Date(n * 86_400_000).getUTCDay()
/** The ISO timestamp of a local time of day (minutes after midnight, before the evening the pictures are taken on). */
function localTime(iso, minutes, seconds = 0) {
  if (minutes >= 19 * 60) throw new Error(`${iso}: more catches than fit into the day before the pictures are taken`)
  return new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)), Math.floor(minutes / 60), minutes % 60, seconds).toISOString()
}

// ---------------------------------------------------------------- the trainer's year

/** How much of the collection comes from each game (relative weights for the automatic picks). */
const GAME_WEIGHT = {
  red: 2.5, blue: 2, yellow: 3, gold: 1.6, silver: 1.6, crystal: 3,
  ruby: 1.6, sapphire: 1.6, emerald: 4, firered: 6, leafgreen: 4, colosseum: 1.2, xd: 1.5,
  diamond: 1.6, pearl: 1.6, platinum: 4, heartgold: 5, soulsilver: 3,
  black: 2.2, white: 2.2, black2: 3, white2: 2.2,
  x: 3.2, y: 3, omegaruby: 3, alphasapphire: 3,
  sun: 2.2, moon: 2.2, ultrasun: 4, ultramoon: 2.4, letsgopikachu: 2.2, letsgoeevee: 5,
  sword: 7, shield: 5, brilliantdiamond: 3.5, shiningpearl: 2, legendsarceus: 6,
  scarlet: 9, violet: 6, legendsza: 10, go: 0.6
}

/** When each game was played. A game may come up more than once; `busy` days always have a catch. */
const CAMPAIGNS = [
  { from: '2025-11-01', to: '2025-11-30', games: ['scarlet', 'violet'] },
  { from: '2025-12-01', to: '2025-12-19', games: ['sword', 'shield'] },
  { from: '2025-12-20', to: '2026-01-04', games: ['letsgoeevee', 'letsgopikachu', 'go', 'home'], busy: ['2025-12-22', '2026-01-03'] },
  { from: '2026-01-05', to: '2026-01-31', games: ['legendsarceus', 'brilliantdiamond', 'shiningpearl'] },
  { from: '2026-02-01', to: '2026-02-28', games: ['ultrasun', 'ultramoon', 'sun', 'moon'] },
  { from: '2026-03-01', to: '2026-03-24', games: ['x', 'y', 'omegaruby', 'alphasapphire'] },
  { from: '2026-03-25', to: '2026-04-19', games: ['black', 'white', 'black2', 'white2'] },
  { from: '2026-04-20', to: '2026-05-20', games: ['heartgold', 'soulsilver', 'platinum', 'diamond', 'pearl'] },
  { from: '2026-05-21', to: '2026-06-21', games: ['firered', 'leafgreen', 'emerald', 'ruby', 'sapphire', 'colosseum', 'xd', 'boxrubysapphire'] },
  { from: '2026-06-22', to: '2026-07-19', games: ['red', 'green', 'blue', 'yellow', 'gold', 'silver', 'crystal', 'stadium', 'stadium2'], busy: ['2026-07-04', '2026-07-12'] },
  { from: '2026-07-20', to: '2026-08-23', games: ['scarlet', 'violet', 'sword', 'shield', 'legendsarceus', 'ultrasun', 'heartgold', 'firered', 'letsgoeevee', 'x'], weight: 0.3 },
  { from: '2026-08-24', to: DEMO_TODAY, games: ['legendsza', 'scarlet', 'violet', 'sword', 'legendsarceus'], weight: 0.7, busy: ['2026-10-01', DEMO_TODAY] }
]

/** Share of the Living Dex slots that are filled, by where the slot sits. */
function fillChance(slotIndex, species) {
  if (species.tags.includes('mythical')) return 0
  if (HAND_PICKED_ONLY.has(species.id)) return 0
  if (slotIndex < 120) return 0.9 // boxes 1-4
  if (slotIndex < 180) return 0.56 // boxes 5-6
  if (slotIndex < 210) return 0.3 // box 7
  const legendary = species.tags.includes('legendary') || species.tags.includes('ultra-beast') || species.tags.includes('paradox')
  if (legendary) return 0.05
  const byGen = { 1: 0.3, 2: 0.17, 3: 0.12, 4: 0.11, 5: 0.09, 6: 0.11, 7: 0.11, 8: 0.11, 9: 0.14 }
  return (byGen[species.gen] ?? 0.1) + (species.tags.includes('starter') ? 0.3 : 0)
}

/** Red, Green, Blue, Yellow and Stadium: Pokémon had no gender yet, so entries from them carry none. */
const NO_GENDER_GAMES = new Set(GAMES.filter((g) => g.generation === 1).map((g) => g.id))
/** Side games only hand out what their own records list; nobody evolves or breeds a Living Dex there. */
const ROWS_ONLY_GAMES = new Set(GAMES.filter((g) => g.kind === 'side').map((g) => g.id))
const generationOf = (game) => GAME_BY_ID.get(game)?.generation ?? 9

/** Species whose forms are all chosen by hand below (the form showcases). */
const HAND_PICKED_ONLY = new Set([201, 666, 869, 493])

/** How likely each way of getting a Pokémon is picked when a game offers several. */
const KIND_WEIGHT = { wild: 10, static: 6, gift: 7, egg: 2, trade: 1.2, raid: 1.2, tera: 1, shadow: 8, walker: 0.3, dream: 0.2, evolved: 5, bred: 0.4 }

/** Relative popularity of the balls for an ordinary capture. */
const BALL_WEIGHT = {
  4: 30, 3: 10, 2: 14, 1: 0, 12: 4, 11: 4, 6: 3, 7: 3, 8: 4, 9: 3, 10: 3, 13: 6, 14: 2, 15: 8,
  17: 1.5, 18: 1.5, 19: 1.5, 20: 1.5, 21: 2, 22: 2, 23: 2, 5: 0, 24: 0, 25: 1.2, 26: 0.8, 16: 0, 27: 0,
  28: 12, 29: 8, 30: 8, 31: 4, 32: 3, 33: 3, 34: 3, 35: 2, 36: 2, 37: 0
}

// ---------------------------------------------------------------- hand-picked entries

/**
 * The entries a person would point at: partners, favourites, shinies, forms and the same Pokémon
 * from several games. Each one names a game and narrows down which dataset record to use
 * (`k` kind, `m` method, `l` location pattern, `from` pre-evolution); `resolveSpec` throws when
 * the datasets have no such record, so none of this can drift away from the data.
 */
const N = undefined
const PICKS = [
  // --- Kanto partners and friends
  { s: 1, g: 'firered', k: 'gift', m: 'Starter', gender: 'm', nick: 'Sprout', notes: 'First partner of the FireRed run. Never left the party.' },
  { s: 2, g: 'green', k: 'evolved', ball: 4, level: 16, notes: 'From the imported Green cartridge, where the first 151 began.' },
  { s: 4, g: 'yellow', k: 'gift', gender: 'm' },
  { s: 6, g: 'sword', k: 'evolved', gender: 'm', gmax: true, nick: 'Ember', ball: 4, level: 62, notes: "Raised from Leon's Charmander. Gigantamax factor." },
  { s: 7, g: 'home', via: 'home', gender: 'm' },
  { s: 10, g: 'letsgoeevee', k: 'wild', l: /Viridian Forest/, shiny: true, gender: 'm', ball: 4 },
  { s: 12, g: 'sword', k: 'raid', l: /./, gmaxRow: true, gender: 'f', ball: 13 },
  { s: 16, g: 'go', k: 'wild', shiny: true, gender: 'm' },
  { s: 25, g: 'yellow', k: 'gift', m: 'Starter', gender: 'm', nick: 'Sparky', notes: 'Walked behind me all the way to the Indigo Plateau.' },
  { s: 25, g: 'firered', k: 'wild', l: /Viridian Forest/, gender: 'f', ball: 4 },
  { s: 25, g: 'heartgold', k: 'wild', l: /Viridian Forest/, gender: 'f', ball: 21 },
  { s: 25, g: 'sword', k: 'wild', l: /Route 4/, gender: 'm', ball: 15 },
  { s: 25, g: 'scarlet', k: 'wild', l: /South Province \(Area Two\)/, gender: 'f', shiny: true, ball: 11, nick: 'Goldie', notes: 'Full odds. It walked right up to the picnic table.' },
  { s: 25, g: 'legendsza', k: 'wild', l: /Wild Zone/, gender: 'm', ball: 3, date: DEMO_TODAY },
  { s: 26, g: 'heartgold', k: 'evolved', gender: 'f', ball: 21, level: 29 },
  { s: 26, f: 1, g: 'ultrasun', k: 'evolved', gender: 'm', ball: 26, level: 37 },
  { s: 41, g: 'heartgold', k: 'wild', l: /Dark Cave/, shiny: true, gender: 'f', ball: 13 },
  { s: 54, g: 'stadium', via: 'stadium', nick: 'Amnesia' },
  { s: 54, g: 'letsgopikachu', k: 'wild', shiny: true, gender: 'f', ball: 3 },
  { s: 77, g: 'legendsarceus', k: 'static', l: /Horseshoe Plains/, shiny: true, ball: 31 },
  { s: 129, g: 'heartgold', k: 'wild', m: 'Old Rod', l: /Lake of Rage/, shiny: true, gender: 'm', ball: 19, notes: 'A golden Magikarp at the Lake of Rage, of all places. 2,114 Old Rod casts.' },
  { s: 129, g: 'scarlet', k: 'wild', l: /South Paldean Sea/, gender: 'f', ball: 6 },
  { s: 130, g: 'heartgold', k: 'static', l: /Lake of Rage/, shiny: true, ball: 2, nick: 'Crimson' },
  { s: 130, g: 'red', k: 'evolved', ball: 4, level: 20 },
  { s: 131, g: 'blue', k: 'gift' },
  { s: 133, g: 'letsgoeevee', k: 'wild', gender: 'f', ball: 4 },
  { s: 133, g: 'firered', k: 'gift', l: /Celadon/, gender: 'm' },
  { s: 133, g: 'xd', k: 'gift', gender: 'm', nick: 'Orre' },
  { s: 133, g: 'sword', k: 'wild', l: /Route 4/, gender: 'f', shiny: true, ball: 14 },
  { s: 143, g: 'x', k: 'static', l: /Route 7/, gender: 'm', ball: 10 },
  { s: 144, g: 'firered', k: 'static', l: /Seafoam/, ball: 2 },
  { s: 145, g: 'yellow', k: 'static', l: /Power Plant/, ball: 4 },
  { s: 146, g: 'xd', k: 'shadow', ball: 2 },
  { s: 147, g: 'white2', k: 'gift', shiny: true },
  { s: 150, g: 'firered', k: 'static', l: /Cerulean Cave/, ball: 1, notes: 'Master Ball. No regrets.' },

  // --- Johto
  { s: 152, g: 'heartgold', k: 'gift', m: 'Starter', gender: 'm' },
  { s: 155, g: 'legendsarceus', k: 'gift', gender: 'm' },
  { s: 158, g: 'soulsilver', k: 'gift', m: 'Starter', gender: 'm', nick: 'Chomp' },
  { s: 175, g: 'crystal', k: 'egg' },
  { s: 179, g: 'legendsza', k: 'wild', l: /Wild Zone 1$/, shiny: true, gender: 'f', ball: 22, nick: 'Fleece', date: '2026-10-08' },
  { s: 196, g: 'colosseum', k: 'gift', gender: 'm' },
  { s: 197, g: 'colosseum', k: 'gift', gender: 'm' },
  { s: 207, g: 'stadium2', via: 'stadium2' },
  { s: 244, g: 'colosseum', k: 'shadow', ball: 2 },
  { s: 245, g: 'crystal', k: 'static', ball: 4 },
  { s: 249, g: 'soulsilver', k: 'static', l: /Whirl Islands/, ball: 2 },
  { s: 249, g: 'xd', k: 'shadow', ball: 1, notes: 'Shadow Lugia. It took all nine Purify Chamber sets to open its heart.' },
  { s: 250, g: 'heartgold', k: 'static', l: /Bell Tower/, ball: 2 },
  ...[['A', 0, 'crystal'], ['B', 1, 'crystal'], ['C', 2, 'crystal'], ['D', 3, 'heartgold'], ['H', 7, 'heartgold'], ['O', 14, 'heartgold'], ['R', 17, 'heartgold'], ['Y', 24, 'heartgold'], ['!', 26, 'platinum'], ['?', 27, 'platinum']].map(([, f, g]) => ({ s: 201, f, g, k: 'wild' })),

  // --- Hoenn
  { s: 252, g: 'emerald', k: 'gift', m: 'Starter', gender: 'm' },
  { s: 255, g: 'omegaruby', k: 'gift', m: 'Starter', gender: 'f' },
  { s: 258, g: 'sapphire', k: 'gift', m: 'Starter', gender: 'm' },
  { s: 280, g: 'sapphire', k: 'wild', l: /Route 102/, shiny: true, gender: 'f', ball: 8, notes: 'Third encounter of the run.' },
  { s: 350, g: 'emerald', k: 'evolved', gender: 'f', ball: 7, level: 31, nick: 'Serenade' },
  { s: 376, g: 'emerald', k: 'evolved', ball: 4, level: 45 },
  { s: 382, g: 'alphasapphire', k: 'static', ball: 7 },
  { s: 383, g: 'omegaruby', k: 'static', ball: 2 },
  { s: 384, g: 'emerald', k: 'static', l: /Sky Pillar/, ball: 2 },

  // --- Sinnoh
  { s: 387, g: 'platinum', k: 'gift', m: 'Starter', gender: 'm' },
  { s: 390, g: 'brilliantdiamond', k: 'gift', m: 'Starter', gender: 'm' },
  { s: 393, g: 'diamond', k: 'gift', m: 'Starter', gender: 'm' },
  { s: 403, g: 'brilliantdiamond', k: 'wild', l: /Route 202/, shiny: true, gender: 'm', ball: 15 },
  { s: 443, g: 'black2', k: 'gift', shiny: true },
  { s: 448, g: 'platinum', k: 'evolved', gender: 'm', ball: 4, level: 34 },
  { s: 479, g: 'platinum', k: 'static', ball: 13 },
  // The appliances need an event item in Platinum; Brilliant Diamond has them in the game itself.
  { s: 479, f: 1, g: 'brilliantdiamond', k: 'evolved', ball: 13 },
  { s: 479, f: 2, g: 'brilliantdiamond', k: 'evolved', ball: 13 },
  { s: 483, g: 'legendsarceus', k: 'static', ball: 37 },
  { s: 487, g: 'platinum', k: 'static', ball: 13 },
  { s: 487, f: 1, g: 'platinum', k: 'evolved', ball: 13, level: 47 },
  { s: 493, g: 'legendsarceus', k: 'static', notes: 'Completed the Hisui Pokédex for this one.' },
  ...[9, 10, 11, 12].map((f) => ({ s: 493, f, g: 'brilliantdiamond', k: 'evolved', ball: 2, level: 80 })),

  // --- Unova
  { s: 495, g: 'black', k: 'gift', m: 'Starter', gender: 'm' },
  { s: 501, g: 'white', k: 'gift', m: 'Starter', gender: 'm' },
  { s: 570, g: 'black2', k: 'gift', gender: 'm' },
  { s: 612, g: 'black2', k: 'static', l: /Nature Preserve/, shiny: true },
  { s: 637, g: 'black', k: 'static', ball: 13 },
  { s: 643, g: 'black', k: 'static', ball: 2 },

  // --- Kalos
  { s: 650, g: 'x', k: 'gift', m: 'Starter', gender: 'm' },
  { s: 653, g: 'y', k: 'trade', nick: 'Kinniekins' },
  { s: 656, g: 'y', k: 'gift', m: 'Starter', gender: 'm' },
  { s: 666, f: 6, g: 'x', k: 'evolved', gender: 'f', ball: 6, level: 12 },
  { s: 666, f: 5, g: 'y', k: 'evolved', gender: 'm', ball: 6, level: 12 },
  { s: 666, f: 7, g: 'x', k: 'wild', m: 'Friend Safari', gender: 'f', ball: 9 },
  { s: 666, f: 8, g: 'scarlet', k: 'wild', gender: 'f', ball: 6 },
  { s: 666, f: 4, g: 'violet', k: 'wild', gender: 'm', ball: 8 },
  { s: 666, f: 16, g: 'scarlet', k: 'wild', gender: 'f', ball: 7 },
  { s: 666, f: 15, g: 'violet', k: 'wild', gender: 'm', ball: 15 },
  { s: 666, f: 0, g: 'scarlet', k: 'wild', gender: 'f', ball: 3 },
  { s: 666, f: 17, g: 'scarlet', k: 'wild', gender: 'm', ball: 22 },
  { s: 678, f: 0, g: 'x', k: 'evolved', ball: 9 },
  { s: 678, f: 1, g: 'y', k: 'evolved', ball: 11 },
  { s: 700, g: 'x', k: 'evolved', gender: 'f', ball: 11, level: 28, nick: 'Ribbon' },
  { s: 716, g: 'x', k: 'static', ball: 2 },

  // --- Alola
  { s: 722, g: 'sun', k: 'gift', m: 'Starter', gender: 'm' },
  { s: 725, g: 'moon', k: 'gift', m: 'Starter', gender: 'f' },
  { s: 728, g: 'ultrasun', k: 'gift', m: 'Starter', gender: 'f' },
  { s: 778, g: 'ultrasun', k: 'wild', m: 'SOS call', shiny: true, gender: 'f', ball: 13, notes: '312 calls into the chain.' },
  { s: 785, g: 'sun', k: 'static', ball: 2 },
  { s: 793, g: 'ultrasun', k: 'static', ball: 26 },

  // --- Galar and Hisui
  { s: 810, g: 'sword', k: 'gift', m: 'Starter', gender: 'm' },
  { s: 813, g: 'shield', k: 'gift', m: 'Starter', gender: 'f' },
  { s: 816, g: 'sword', k: 'bred', gender: 'm', ball: 4 },
  { s: 831, g: 'sword', k: 'wild', l: /Route 1$/, shiny: true, gender: 'f', ball: 22, nick: 'Marshmallow' },
  ...[[0, 0, false], [1, 3, false], [2, 5, false], [4, 6, true], [8, 1, false]].map(([f, variant, shiny]) => ({ s: 869, f, variant, g: 'shield', k: 'evolved', shiny, ball: 25, level: 30 })),
  { s: 888, g: 'sword', k: 'static', ball: 2 },
  { s: 889, g: 'shield', k: 'static', ball: 2 },
  { s: 899, g: 'legendsarceus', k: 'evolved', gender: 'm', ball: 34 },
  { s: 900, g: 'legendsarceus', k: 'evolved', gender: 'f', ball: 31 },

  // --- Paldea
  { s: 906, g: 'scarlet', k: 'gift', m: 'Starter', gender: 'm', nick: 'Clover', notes: 'Day one of the Living Dex.', date: FIRST_DAY },
  { s: 909, g: 'violet', k: 'gift', m: 'Starter', gender: 'm' },
  { s: 912, g: 'scarlet', k: 'bred', gender: 'm', ball: 4 },
  { s: 915, g: 'scarlet', k: 'wild', l: /South Province \(Area One\)/, shiny: true, gender: 'f', ball: 4, notes: 'Full odds, ten minutes after leaving Mesagoza.' },
  { s: 446, g: 'scarlet', k: 'gift', l: /Kitakami Hall/, shiny: true },
  { s: 1000, g: 'violet', k: 'evolved', ball: 11, level: 60 },
  { s: 1007, g: 'scarlet', k: 'static', ball: N }
]

// ---------------------------------------------------------------- the generator

export function buildDemoSave({ dataDir = DATA_DIR, theme = 'dark' } = {}) {
  // Every hand-picked entry, every slot and every stretch of the year draws from a stream of its
  // own, named after it. Adding or changing one entry therefore leaves all the others as they were.
  let rand = mulberry32(SEED)
  const stream = (label) => {
    rand = mulberry32(hashString(label) ^ SEED)
  }
  const int = (min, max) => min + Math.floor(rand() * (max - min + 1))
  const pickWeighted = (items, weightOf) => {
    let total = 0
    for (const item of items) total += Math.max(0, weightOf(item))
    if (total <= 0) return undefined
    let roll = rand() * total
    for (const item of items) {
      roll -= Math.max(0, weightOf(item))
      if (roll < 0) return item
    }
    return items[items.length - 1]
  }

  const dex = JSON.parse(readFileSync(join(dataDir, 'dex.json'), 'utf8'))
  const details = new Map()
  const detailOf = (id) => {
    if (!details.has(id)) details.set(id, JSON.parse(readFileSync(join(dataDir, 'species', `${id}.json`), 'utf8')))
    return details.get(id)
  }
  const gameIdx = (id) => dex.games.indexOf(id)
  const speciesOf = (id) => dex.species[id - 1]
  const formOf = (species, f) => species.forms.find((form) => form.f === f)

  // ---- the Living Dex under the default rules (mirrors src/renderer/src/domain/slots.ts)
  const CATEGORY_RULE = { regional: 'regional', gender: 'genderForms', cosmetic: 'cosmetic', changeable: 'changeable', fusion: 'fusion', event: 'event', partner: 'partner', mega: 'mega', battle: 'battle' }
  const isSlotted = (species, form) => form === species.forms[0] || (form.present.length > 0 && DEFAULT_RULES[CATEGORY_RULE[form.cat]] === true)
  const splitsByGender = (species, form) => species.genderDiff && form.female && form.cat !== 'gender' && !species.forms.some((f) => f.cat === 'gender')
  const slots = []
  for (const species of dex.species) {
    for (const form of species.forms) {
      if (!isSlotted(species, form)) continue
      const key = form === species.forms[0] ? String(species.id) : `${species.id}-${form.f}`
      if (splitsByGender(species, form)) for (const gender of ['m', 'f']) slots.push({ key: `${key}:${gender}`, species, form, gender })
      else slots.push({ key, species, form })
    }
  }
  const slotKeyOf = (entry) => {
    const species = speciesOf(entry.species)
    const own = formOf(species, entry.form)
    const form = own && isSlotted(species, own) ? own : species.forms[0]
    const key = form === species.forms[0] ? String(species.id) : `${species.id}-${form.f}`
    return splitsByGender(species, form) ? `${key}:${own?.gender ?? (entry.gender === 'f' ? 'f' : 'm')}` : key
  }

  // ---- sources of a form, per game
  const timeLimited = (row) => isTimeLimited(row)
  const rowGender = (row) => (row.d === 0 ? 'm' : row.d === 1 ? 'f' : row.d === 2 ? 'n' : undefined)

  /** What the app's "Where to find it" says of a form in a game: is it obtainable there (not event only, not transfer only)? */
  const obtainableIn = (form, g) => form.obtain.includes(g)
  /**
   * An evolution or form change is a source in a game only when what it starts from can be had
   * there; the record alone merely says that the game knows both Pokémon.
   */
  const evolvableIn = (form, evolve, g) => {
    const from = formOf(speciesOf(evolve.from[0]), evolve.from[1])
    return obtainableIn(form, g) && from !== undefined && obtainableIn(from, g)
  }

  /** Every (game, kind, record) a form can be logged from without an event or a transfer. */
  function sourcesOf(species, form, wantGender) {
    const fd = detailOf(species.id).forms[String(form.f)] ?? { rows: [], evolve: [], breed: [] }
    const out = []
    for (const row of fd.rows) {
      if (timeLimited(row) || row.s === 'forced' || (row.via !== undefined && row.via !== 'go')) continue
      const fixed = rowGender(row)
      if (wantGender && fixed && fixed !== wantGender) continue
      for (const g of row.g) out.push({ game: dex.games[g], kind: row.k, row })
    }
    for (const evolve of fd.evolve) for (const g of evolve.g) if (evolvableIn(form, evolve, g)) out.push({ game: dex.games[g], kind: 'evolved', evolve })
    for (const g of fd.breed) if (obtainableIn(form, g)) out.push({ game: dex.games[g], kind: 'bred' })
    return out.filter((s) => (s.row !== undefined || !ROWS_ONLY_GAMES.has(s.game)) && !(wantGender === 'f' && NO_GENDER_GAMES.has(s.game)))
  }

  function pickBall(game, source, species) {
    const fixed = source.row?.b
    if (fixed !== undefined) return fixed
    const allowed = dex.gameBalls[gameIdx(game)] ?? []
    // Gifts arrive in a plain Poké Ball; so does anything hatched before balls were inherited (Generation VI).
    if (allowed.length === 0) return source.kind === 'gift' ? 4 : undefined
    if (['gift', 'egg', 'trade', 'dream', 'walker'].includes(source.kind) || (source.kind === 'bred' && generationOf(game) < 6)) return allowed.includes(4) ? 4 : allowed[0]
    const method = source.row?.m ?? ''
    if (/Safari/.test(method) && allowed.includes(5)) return 5
    if (/Bug-Catching/.test(method) && allowed.includes(24)) return 24
    const legendary = species.tags.includes('legendary')
    return pickWeighted(allowed, (ball) => {
      let w = BALL_WEIGHT[ball] ?? 0
      if (legendary && (ball === 2 || ball === 13 || ball === 10 || ball === 30)) w *= 4
      if (/Rod|Fishing|Surfing|water/i.test(method) && (ball === 6 || ball === 7 || ball === 19)) w *= 5
      if (/Cave/.test(method) && ball === 13) w *= 3
      return w
    })
  }

  function pickLevel(source, game) {
    if (source.row) {
      const [min, max] = source.row.lv
      return max > 0 ? int(Math.max(1, min), Math.max(min, max)) : undefined
    }
    if (source.evolve) {
      const at = /Level (\d+)/.exec(source.evolve.how)
      return at ? Math.min(100, Number(at[1]) + int(0, 4)) : int(24, 46)
    }
    return generationOf(game) <= 3 ? 5 : 1 // hatched
  }

  function pickGender(species, form, source, want) {
    if (want) return want
    const fixed = (source.row && rowGender(source.row)) ?? form.gender
    if (fixed) return fixed
    if (species.genderRate < 0) return 'n'
    return rand() * 8 < species.genderRate ? 'f' : 'm'
  }

  let serial = 0
  const entries = []
  const filled = new Set()

  /** Turns a source into an entry, the way the app's "Log" button pre-fills the editor. */
  function log(key, species, form, game, source, extra = {}) {
    const gender = NO_GENDER_GAMES.has(game) ? undefined : pickGender(species, form, source, extra.gender)
    const row = source.row
    const location = row?.l === undefined ? undefined : detailOf(species.id).strings[row.l]
    const entry = {
      key,
      id: `demo-${pad(++serial, 4)}`,
      species: species.id,
      form: form.f,
      variant: extra.variant,
      gender,
      shiny: extra.shiny === true || row?.s === 'forced',
      gmax: extra.gmax === true ? true : undefined,
      alpha: row?.c?.includes('Alpha') ? true : undefined,
      game,
      kind: source.kind,
      method: source.kind === 'evolved' ? source.evolve.how : source.kind === 'bred' ? 'Hatched from an Egg' : row?.m,
      location,
      origin: source.evolve ? [source.evolve.from[0], source.evolve.from[1]] : undefined,
      ball: extra.ball ?? pickBall(game, source, species),
      level: extra.level ?? pickLevel(source, game),
      nickname: extra.nick,
      ot: row?.x?.ot ?? DEMO_TRAINER,
      notes: extra.notes,
      fixedDate: extra.date
    }
    // A gift from a side game is logged under that side game, which has no Pokémon of its own; everything else is checked.
    if (extra.via === undefined && !obtainableIn(form, gameIdx(game))) throw new Error(`${form.full ?? species.name} is not obtainable in ${game} according to the datasets`)
    if (entry.ball !== undefined && !BALL_BY_ID.has(entry.ball)) throw new Error(`Unknown ball ${entry.ball}`)
    if (extra.ball !== undefined) {
      // A hand-picked ball has to be possible: the record's own when it fixes one, else one the game sells.
      const usable = dex.gameBalls[gameIdx(game)] ?? []
      const possible = row?.b !== undefined ? extra.ball === row.b : usable.length === 0 || usable.includes(extra.ball)
      if (!possible) throw new Error(`${species.name} in ${game}: ball ${extra.ball} (${BALL_BY_ID.get(extra.ball)?.name}) is not possible for that record`)
    }
    if (extra.level !== undefined && row && row.lv[1] > 0 && (extra.level < row.lv[0] || extra.level > row.lv[1])) {
      throw new Error(`${species.name} in ${game}: level ${extra.level} is outside the record's ${row.lv[0]}-${row.lv[1]}`)
    }
    entries.push(entry)
    filled.add(slotKeyOf(entry))
    return entry
  }

  /** Finds the dataset record a hand-picked entry stands on. */
  function resolveSpec(spec) {
    const species = speciesOf(spec.s)
    const form = formOf(species, spec.f ?? 0)
    if (!species || !form) throw new Error(`No such form: ${spec.s}-${spec.f ?? 0}`)
    const fd = detailOf(species.id).forms[String(form.f)]
    const where = `${species.name} (form ${form.f}) in ${spec.g}`
    const strings = detailOf(species.id).strings

    if (spec.via !== undefined) {
      // A gift handed out by a side game (Stadium, HOME): logged under that game, as a gift.
      const row = fd.rows.find((r) => r.via === spec.via)
      if (!row) throw new Error(`${where}: no record delivered through ${spec.via}`)
      return { species, form, source: { kind: 'gift', row: { g: row.g, k: 'gift', lv: row.lv, b: row.b, d: row.d } } }
    }
    const g = gameIdx(spec.g)
    if (spec.k === 'evolved') {
      const known = fd.evolve.filter((e) => e.g.includes(g) && (spec.from === undefined || e.from[0] === spec.from))
      if (known.length === 0) throw new Error(`${where}: no evolution or form change there`)
      const evolve = known.find((e) => evolvableIn(form, e, g))
      const why = obtainableIn(form, g) ? 'what it evolves or changes from cannot be obtained there' : 'the datasets call it event only or transfer only there'
      if (!evolve) throw new Error(`${where}: ${why} ("${known[0].how}")`)
      return { species, form, source: { kind: 'evolved', evolve } }
    }
    if (spec.k === 'bred') {
      if (!fd.breed.includes(g)) throw new Error(`${where}: cannot be hatched there`)
      if (!obtainableIn(form, g)) throw new Error(`${where}: the datasets call it event only or transfer only there, so there is no parent to hatch it from`)
      return { species, form, source: { kind: 'bred' } }
    }
    const rows = fd.rows.filter(
      (r) =>
        r.g.includes(g) &&
        r.k === spec.k &&
        !timeLimited(r) &&
        (spec.m === undefined || r.m === spec.m) &&
        (spec.l === undefined || (r.l !== undefined && spec.l.test(strings[r.l]))) &&
        (!spec.gmaxRow || r.n === 'Gigantamax') &&
        (!spec.shiny || r.s !== 'locked') &&
        (spec.shiny || r.s !== 'forced') &&
        (spec.gender === undefined || rowGender(r) === undefined || rowGender(r) === spec.gender)
    )
    if (rows.length === 0) {
      const have = fd.rows.filter((r) => r.g.includes(g)).map((r) => `${r.k}/${r.m ?? ''}/${r.l === undefined ? '' : strings[r.l]}${r.s ? '/' + r.s : ''}`)
      throw new Error(`${where}: no matching ${spec.k} record. That game has: ${[...new Set(have)].slice(0, 40).join(' | ') || 'nothing'}`)
    }
    // Prefer a shiny-forced record when a shiny was asked for and one exists (Red Gyarados), and
    // the record that fixes the asked-for ball when there is one (Dialga's Origin Ball).
    const row = (spec.shiny && rows.find((r) => r.s === 'forced')) || (spec.ball !== undefined && rows.find((r) => r.b === spec.ball)) || rows[0]
    return { species, form, source: { kind: row.k, row } }
  }

  // ---- 1. the hand-picked entries
  const unresolved = []
  const seen = new Map()
  for (const spec of PICKS) {
    const name = `${spec.s}-${spec.f ?? 0}@${spec.g}`
    seen.set(name, (seen.get(name) ?? 0) + 1)
    const key = `pick:${name}#${seen.get(name)}`
    stream(key)
    try {
      const { species, form, source } = resolveSpec(spec)
      log(key, species, form, spec.g, source, { ...spec, gmax: spec.gmax || spec.gmaxRow })
    } catch (err) {
      unresolved.push(err.message)
    }
  }
  if (unresolved.length > 0) throw new Error(`The datasets no longer match ${unresolved.length} hand-picked entries:\n\n${unresolved.join('\n\n')}`)

  // ---- 2. everything else: fill slots at random, heavier at the start of the dex
  slots.forEach((slot, index) => {
    stream(`slot:${slot.key}`)
    if (filled.has(slot.key) || rand() >= fillChance(index, slot.species)) return
    const sources = sourcesOf(slot.species, slot.form, slot.gender).filter((s) => GAME_WEIGHT[s.game] !== undefined)
    if (sources.length === 0) return
    const games = [...new Set(sources.map((s) => s.game))]
    const game = pickWeighted(games, (g) => GAME_WEIGHT[g])
    const here = sources.filter((s) => s.game === game)
    const starterRow = here.find((s) => s.row?.m === 'Starter')
    let source
    if (starterRow && rand() < 0.85) source = starterRow
    else {
      const kind = pickWeighted([...new Set(here.map((s) => s.kind))], (k) => KIND_WEIGHT[k] ?? 0.5)
      const ofKind = here.filter((s) => s.kind === kind)
      source = ofKind[int(0, ofKind.length - 1)]
    }
    log(`slot:${slot.key}`, slot.species, slot.form, game, source, { gender: slot.gender })
  })

  // ---- 3. dates: each game is played in one or more stretches of the year
  const familyOrder = (entry) => hashString(`family:${speciesOf(entry.species).family}`)
  const stageOf = (entry) => {
    const family = detailOf(entry.species).family
    const index = family.findIndex((n) => n.s === entry.species)
    return index < 0 ? 0 : index
  }
  const campaignDays = CAMPAIGNS.map((c) => ({ ...c, start: dayNumber(c.from), end: dayNumber(c.to), entries: [] }))
  for (const entry of entries) {
    if (entry.fixedDate) continue
    const options = campaignDays.filter((c) => c.games.includes(entry.game))
    if (options.length === 0) throw new Error(`No campaign plays ${entry.game}`)
    stream(`when:${entry.key}`)
    pickWeighted(options, (c) => (c.end - c.start + 1) * (c.weight ?? 1)).entries.push(entry)
  }
  for (const campaign of campaignDays) {
    const list = campaign.entries
    if (list.length === 0) continue
    // Members of one evolution family are logged together, earlier stages first.
    list.sort((a, b) => familyOrder(a) - familyOrder(b) || stageOf(a) - stageOf(b) || a.species - b.species || a.form - b.form || a.id.localeCompare(b.id))
    stream(`campaign:${campaign.from}`)

    const busyFrom = campaign.busy ? dayNumber(campaign.busy[0]) : Infinity
    const busyTo = campaign.busy ? dayNumber(campaign.busy[1]) : -Infinity
    let days = []
    for (let day = campaign.start; day <= campaign.end; day++) {
      const busy = day >= busyFrom && day <= busyTo
      const weekend = weekday(day) === 0 || weekday(day) === 6
      if (busy || rand() < (weekend ? 0.8 : 0.42)) days.push({ day, weight: (weekend ? 1.8 : 1) * (0.5 + rand() * 1.5), busy })
    }
    // Never more play days than catches; the days that must have a catch are kept.
    while (days.length > list.length) {
      const optional = days.filter((d) => !d.busy)
      if (optional.length === 0) break
      days.splice(days.indexOf(optional[int(0, optional.length - 1)]), 1)
    }
    if (days.length === 0) days = [{ day: campaign.start, weight: 1 }]
    const totalWeight = days.reduce((n, d) => n + d.weight, 0)
    let given = 0
    days.forEach((d, i) => {
      const left = days.length - i - 1
      const share = i === days.length - 1 ? list.length - given : Math.max(1, Math.min(list.length - given - left, Math.round((d.weight / totalWeight) * list.length)))
      for (const entry of list.slice(given, given + share)) entry.fixedDate = dayIso(d.day)
      given += share
    })
  }

  // ---- 4. timestamps, order, cleanup
  entries.sort((a, b) => a.fixedDate.localeCompare(b.fixedDate) || a.id.localeCompare(b.id))
  const perDay = new Map()
  const out = entries.map((e) => {
    const nth = perDay.get(e.fixedDate) ?? 0
    perDay.set(e.fixedDate, nth + 1)
    // From late morning on, a few minutes apart, on the entry's own day.
    const stamp = localTime(e.fixedDate, 11 * 60 + 5 + (dayNumber(e.fixedDate) % 7) * 13 + nth * 9, (nth * 17) % 60)
    const { fixedDate, nickname, key: _key, ...rest } = e
    const entry = { ...rest, date: fixedDate, nickname, createdAt: stamp, updatedAt: stamp }
    // Key order of CatchEntry; absent fields are left out.
    const ordered = {}
    for (const key of ['id', 'species', 'form', 'variant', 'gender', 'shiny', 'gmax', 'alpha', 'game', 'kind', 'method', 'location', 'origin', 'ball', 'level', 'date', 'nickname', 'ot', 'notes', 'createdAt', 'updatedAt']) {
      if (entry[key] !== undefined) ordered[key] = entry[key]
    }
    return ordered
  })

  const last = out[out.length - 1]
  return {
    version: SAVE_VERSION,
    entries: out,
    // PELAGIX_SHOT_LANGUAGE captures another language (for example ja); shots that click by an English label are skipped by hand with --only.
    settings: { rules: { ...DEFAULT_RULES }, theme, language: process.env.PELAGIX_SHOT_LANGUAGE || 'en', reduceMotion: false, trainerName: DEMO_TRAINER },
    achievements: {},
    createdAt: localTime(FIRST_DAY, 10 * 60 + 40),
    updatedAt: last.updatedAt
  }
}

/** The finished demo save: the collection, and the history of its achievements as the app would have recorded it. */
export async function demoSave(options) {
  const { unlockHistory } = await import('./unlock-history.mjs')
  const save = buildDemoSave(options)
  return { ...save, achievements: await unlockHistory(save, options) }
}

/** Facts about a demo save, for the console and for tools/screenshots/README.md. */
export function describeDemoSave(save, { dataDir = DATA_DIR } = {}) {
  const dex = JSON.parse(readFileSync(join(dataDir, 'dex.json'), 'utf8'))
  const entries = save.entries
  const count = (pick) => {
    const map = new Map()
    for (const e of entries) {
      const key = pick(e)
      if (key !== undefined) map.set(key, (map.get(key) ?? 0) + 1)
    }
    return map
  }
  const games = count((e) => e.game)
  const systems = count((e) => GAME_BY_ID.get(e.game)?.system)
  const balls = count((e) => e.ball)
  const kinds = count((e) => e.kind)
  const gens = count((e) => dex.species[e.species - 1].gen)
  const months = count((e) => e.date.slice(0, 7))
  const days = [...new Set(entries.map((e) => e.date))].sort()
  let streak = 0
  for (let day = dayNumber(DEMO_TODAY); days.includes(dayIso(day)); day--) streak++
  let longest = 0
  let run = 0
  days.forEach((day, i) => {
    run = i > 0 && dayNumber(day) - dayNumber(days[i - 1]) === 1 ? run + 1 : 1
    longest = Math.max(longest, run)
  })
  const perSpecies = count((e) => e.species)
  const formCat = (e) => dex.species[e.species - 1].forms.find((f) => f.f === e.form)?.cat
  return {
    entries: entries.length,
    species: perSpecies.size,
    games: games.size,
    systems: [...systems.keys()].sort((a, b) => SYSTEMS.findIndex((s) => s.id === a) - SYSTEMS.findIndex((s) => s.id === b)),
    balls: balls.size,
    shiny: entries.filter((e) => e.shiny).length,
    female: entries.filter((e) => e.gender === 'f').length,
    regionalForms: entries.filter((e) => formCat(e) === 'regional').length,
    unownLetters: new Set(entries.filter((e) => e.species === 201).map((e) => e.form)).size,
    vivillonPatterns: new Set(entries.filter((e) => e.species === 666).map((e) => e.form)).size,
    alcremie: entries.filter((e) => e.species === 869).length,
    gigantamax: entries.filter((e) => e.gmax).length,
    alpha: entries.filter((e) => e.alpha).length,
    nicknames: entries.filter((e) => e.nickname).length,
    notes: entries.filter((e) => e.notes).length,
    multiGameSpecies: [...perSpecies].filter(([id]) => new Set(entries.filter((e) => e.species === id).map((e) => e.game)).size >= 3).map(([id]) => dex.species[id - 1].name),
    firstDay: days[0],
    lastDay: days[days.length - 1],
    activeDays: days.length,
    currentStreak: streak,
    longestStreak: longest,
    byGeneration: Object.fromEntries([...gens].sort((a, b) => a[0] - b[0])),
    byMonth: Object.fromEntries([...months].sort()),
    byKind: Object.fromEntries([...kinds].sort((a, b) => b[1] - a[1])),
    byGame: Object.fromEntries(GAMES.filter((g) => games.has(g.id)).map((g) => [g.id, games.get(g.id)])),
    achievements: Object.keys(save.achievements).length
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const save = await demoSave()
  const target = process.argv[2]
  if (target) writeFileSync(resolve(target), JSON.stringify(save, null, 1))
  console.log(JSON.stringify(describeDemoSave(save), null, 1))
  if (target) console.log(`Written to ${resolve(target)}`)
}
