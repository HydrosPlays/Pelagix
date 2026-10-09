/**
 * Every achievement, generated from small tables: thresholds, regions, types, version pairs, balls,
 * form sets, curated groups and ways of obtaining a Pokémon. `ACHIEVEMENTS` is static (it does not
 * depend on the loaded dataset); the dataset only decides targets when an achievement is evaluated.
 *
 * Ids are saved in the user's file. Never rename one; retire it and add a new id instead.
 */

import { BALLS, type BallFamily } from '@shared/balls'
import type { RegionalVariant, SpeciesTag, TypeId } from '@shared/dex-types'
import { GAMES, SYSTEM_BY_ID, type GameDef, type SystemId } from '@shared/games'
import type { EntryKind } from '@shared/save-types'
import { formatCount, listText } from '@renderer/lib/format'
import { formKey, variantKey } from './entry-index'
import type { DexFacts } from './facts'
import {
  AURA_TRIO, BOX_LEGENDARIES, CLEFAIRY_LINE, CREATION_TRIO, EARLY_ROUTE_COMMONS, EON_DUO, FORCES_OF_NATURE, GENERATION_REGIONS, GUARDIAN_DEITIES,
  HERO_DUO, LAKE_GUARDIANS, LEGENDARY_BEASTS, LEGENDARY_BIRDS, LEGENDARY_TITANS, LIGHT_TRIO, LOYAL_THREE, MAGIKARP, MEW, PARADOX_ANCIENT,
  PARADOX_FUTURE, PIKACHU, SAFARI_ZONE_RARITIES, SNORLAX_LINE, SWORDS_OF_JUSTICE, TAO_TRIO, TOWER_DUO, TREASURES_OF_RUIN, WEATHER_TRIO
} from './groups'
import {
  TIER_POINTS, type AchievementCategory, type AchievementCategoryId, type AchievementContext, type AchievementDef, type AchievementGlyph,
  type AchievementProgress, type AchievementTier, type SetItem, type SetTest
} from './types'

// ---------------------------------------------------------------- categories

export const ACHIEVEMENT_CATEGORIES: readonly AchievementCategory[] = [
  { id: 'milestones', name: "Collector's Road", description: 'How far your Living Dex has come.', glyph: 'pokeball' },
  { id: 'regions', name: 'World Tour', description: "Every region's Pokémon, from Kanto to Paldea.", glyph: 'compass' },
  { id: 'types', name: 'Elemental Mastery', description: 'Collect every Pokémon of a type.', glyph: 'gem' },
  { id: 'shiny', name: 'Starlight', description: 'Rewards for shiny hunting.', glyph: 'sparkle' },
  { id: 'games', name: 'Cartridge Shelf', description: 'The games and systems your Pokémon come from.', glyph: 'cartridge' },
  { id: 'balls', name: 'Ball Capsule', description: 'The balls you catch them in.', glyph: 'balls' },
  { id: 'forms', name: 'Shapeshifters', description: 'Forms, patterns, genders and giant sizes.', glyph: 'shapes' },
  { id: 'legends', name: 'Hall of Legends', description: 'Famous groups: first partners, legends, fossils and more.', glyph: 'crown' },
  { id: 'journey', name: 'Field Notes', description: 'The ways you get your Pokémon.', glyph: 'grass' },
  { id: 'dedication', name: 'Long Haul', description: 'Streaks, big days, families and old friends.', glyph: 'flame' },
  { id: 'secrets', name: 'Hidden Grotto', description: 'Secret achievements. Play around and they turn up.', glyph: 'question' }
]

export const CATEGORY_BY_ID: ReadonlyMap<AchievementCategoryId, AchievementCategory> = new Map(ACHIEVEMENT_CATEGORIES.map((c) => [c.id, c]))

// ---------------------------------------------------------------- set helpers

/** Whether the entries satisfy one item of a set. */
export function ownsItem(ctx: AchievementContext, test: SetTest, item: SetItem): boolean {
  const { index } = ctx
  switch (test) {
    case 'species':
      return index.species.has(item.species)
    case 'shiny':
      return index.shinySpecies.has(item.species)
    case 'form':
      return index.forms.has(formKey(item.species, item.form ?? 0))
    case 'variant':
      return index.variants.has(variantKey(item.species, item.form ?? 0, item.variant ?? 0))
    case 'gmax': {
      const key = ctx.dex.form(item.species, item.form ?? 0)?.gmax
      return key !== undefined && index.gmax.has(key)
    }
    case 'genders':
      return index.males.has(item.species) && index.females.has(item.species)
  }
}

function countOwned(ctx: AchievementContext, pool: readonly SetItem[], test: SetTest): number {
  let n = 0
  for (const item of pool) if (ownsItem(ctx, test, item)) n++
  return n
}

/**
 * The members of a set achievement that are still missing: the first `limit` of them in dex order,
 * and how many there are in total. Empty for achievements that are not about a set.
 */
export function missingItems(ctx: AchievementContext, def: AchievementDef, limit = 12): { items: SetItem[]; total: number } {
  const pool = def.pool?.(ctx.facts)
  const test = def.test
  if (!pool || !test) return { items: [], total: 0 }
  const items: SetItem[] = []
  let total = 0
  for (const item of pool) {
    if (ownsItem(ctx, test, item)) continue
    total++
    if (items.length < limit) items.push(item)
  }
  return { items, total }
}

// ---------------------------------------------------------------- builders

type Draft = Omit<AchievementDef, 'points'>
interface Common {
  id: string
  title: string
  description: string
  category: AchievementCategoryId
  tier: AchievementTier
  glyph: AchievementGlyph
  accent?: string
  secret?: boolean
  hint?: string
}

const defs: AchievementDef[] = []

function add(draft: Draft): void {
  defs.push({ ...draft, points: TIER_POINTS[draft.tier] })
}

/** Reaches `target` of a plain number. */
function counted(common: Common, target: number, value: (ctx: AchievementContext) => number): void {
  add({ ...common, evaluate: (ctx) => ({ current: value(ctx), target }) })
}

/**
 * Reaches `target` different Pokémon out of the whole dex. Unavailable when the dataset holds
 * fewer species than that (the development fixture).
 */
function milestone(common: Common, target: number, value: (ctx: AchievementContext) => number): void {
  add({ ...common, evaluate: (ctx) => ({ current: value(ctx), target: ctx.facts.all.length >= target ? target : 0 }) })
}

/** One yes / no condition. */
function flag(common: Common, test: (ctx: AchievementContext) => boolean): void {
  add({ ...common, evaluate: (ctx) => ({ current: test(ctx) ? 1 : 0, target: 1 }) })
}

/**
 * Collects members of a set. `want` is how many: all of them (default), half (rounded up) or a
 * fixed number; a set smaller than a fixed number makes the achievement unavailable.
 */
function collects(common: Common, pool: (facts: DexFacts) => readonly SetItem[], options: { test?: SetTest; want?: number | 'half' } = {}): void {
  const test = options.test ?? 'species'
  const want = options.want
  const targetOf = (size: number): number => (want === undefined ? size : want === 'half' ? Math.ceil(size / 2) : size >= want ? want : 0)
  add({
    ...common,
    pool,
    test,
    whole: want === undefined,
    evaluate(ctx): AchievementProgress {
      const items = pool(ctx.facts)
      return { current: countOwned(ctx, items, test), target: targetOf(items.length) }
    }
  })
}

const NONE: readonly SetItem[] = Object.freeze([])
const tagged = (tag: SpeciesTag) => (facts: DexFacts): readonly SetItem[] => facts.byTag.get(tag) ?? NONE
const picked = (ids: readonly number[]) => (facts: DexFacts): readonly SetItem[] => facts.pick(ids)
const formSet = (key: string) => (facts: DexFacts): readonly SetItem[] => facts.formSets.get(key) ?? NONE
const kindCount = (ctx: AchievementContext, ...kinds: EntryKind[]): number => kinds.reduce((n, kind) => n + (ctx.index.byKind.get(kind) ?? 0), 0)

// ---------------------------------------------------------------- Collector's Road

const SPECIES_MILESTONES: ReadonlyArray<[number, AchievementTier, string, string]> = [
  [1, 'bronze', 'First Catch', 'Log your first Pokémon.'],
  [10, 'bronze', 'Getting Started', 'Collect 10 different Pokémon.'],
  [50, 'bronze', 'Budding Collector', 'Collect 50 different Pokémon.'],
  [100, 'silver', 'Century Club', 'Collect 100 different Pokémon.'],
  [151, 'silver', 'The Original Count', 'Collect 151 different Pokémon, as many as the very first Pokédex held.'],
  [250, 'silver', 'Well Travelled', 'Collect 250 different Pokémon.'],
  [386, 'gold', 'Three Regions Deep', 'Collect 386 different Pokémon.'],
  [500, 'gold', 'Five Hundred Strong', 'Collect 500 different Pokémon.'],
  [750, 'gold', 'Seasoned Curator', 'Collect 750 different Pokémon.'],
  [1000, 'platinum', 'The Thousand', 'Collect 1,000 different Pokémon.']
]

for (const [n, tier, title, description] of SPECIES_MILESTONES) {
  milestone({ id: `species-${n}`, title, description, category: 'milestones', tier, glyph: 'pokeball' }, n, (ctx) => ctx.index.species.size)
}
collects(
  { id: 'species-all', title: "Gotta Catch 'Em All", description: 'Collect every Pokémon species there is.', category: 'milestones', tier: 'platinum', glyph: 'pokeball' },
  (facts) => facts.all
)

add({
  id: 'living-dex-half',
  title: 'Half the Boxes',
  description: 'Fill half of your Living Dex under your current rules.',
  category: 'milestones',
  tier: 'gold',
  glyph: 'boxes',
  evaluate: (ctx) => ({ current: ctx.collection.totals.caught, target: Math.ceil(ctx.collection.totals.slots / 2) })
})
add({
  id: 'living-dex-complete',
  title: 'Living Dex Complete',
  description: 'Fill every slot of your Living Dex under your current rules.',
  category: 'milestones',
  tier: 'platinum',
  glyph: 'boxes',
  evaluate: (ctx) => ({ current: ctx.collection.totals.caught, target: ctx.collection.totals.slots })
})

const ENTRY_MILESTONES: ReadonlyArray<[number, AchievementTier, string]> = [
  [100, 'bronze', 'Busy Journal'],
  [500, 'silver', 'Well-Kept Records'],
  [1000, 'gold', 'Archivist'],
  [2500, 'platinum', 'Grand Archive']
]
for (const [n, tier, title] of ENTRY_MILESTONES) {
  counted({ id: `entries-${n}`, title, description: `Log ${formatCount(n)} entries.`, category: 'milestones', tier, glyph: 'journal' }, n, (ctx) => ctx.index.total)
}

// ---------------------------------------------------------------- World Tour

for (const [gen, region] of Object.entries(GENERATION_REGIONS)) {
  const pool = (facts: DexFacts): readonly SetItem[] => facts.byGeneration.get(Number(gen)) ?? NONE
  collects(
    { id: `region-${region.key}-half`, title: `${region.name} Explorer`, description: `Collect half of the Pokémon first discovered in ${region.where}.`, category: 'regions', tier: 'silver', glyph: 'compass' },
    pool,
    { want: 'half' }
  )
  collects(
    { id: `region-${region.key}-all`, title: `${region.name} Champion`, description: `Collect every Pokémon first discovered in ${region.where}.`, category: 'regions', tier: 'gold', glyph: 'compass' },
    pool
  )
}

// ---------------------------------------------------------------- Elemental Mastery

const TYPE_TITLES: ReadonlyArray<[TypeId, string, string]> = [
  ['normal', 'Normal', 'Everyday Heroes'],
  ['fire', 'Fire', 'Playing with Fire'],
  ['water', 'Water', 'Deep Blue'],
  ['electric', 'Electric', 'High Voltage'],
  ['grass', 'Grass', 'Green Thumb'],
  ['ice', 'Ice', 'Cold Snap'],
  ['fighting', 'Fighting', 'Black Belt'],
  ['poison', 'Poison', 'Pick Your Poison'],
  ['ground', 'Ground', 'Down to Earth'],
  ['flying', 'Flying', 'Head in the Clouds'],
  ['psychic', 'Psychic', 'Mind over Matter'],
  ['bug', 'Bug', 'Bug Catcher'],
  ['rock', 'Rock', 'Rock Solid'],
  ['ghost', 'Ghost', 'Ghost Stories'],
  ['dragon', 'Dragon', 'Dragon Tamer'],
  ['dark', 'Dark', 'After Dark'],
  ['steel', 'Steel', 'Nerves of Steel'],
  ['fairy', 'Fairy', 'Fairy Tale']
]

for (const [type, name, title] of TYPE_TITLES) {
  collects(
    { id: `type-${type}-all`, title, description: `Collect every ${name}-type Pokémon.`, category: 'types', tier: 'gold', glyph: 'gem', accent: `var(--type-${type})` },
    (facts) => facts.byType.get(type) ?? NONE
  )
}

// ---------------------------------------------------------------- Starlight

const SHINY_MILESTONES: ReadonlyArray<[number, AchievementTier, string, string]> = [
  [1, 'bronze', 'A Different Colour', 'Log your first shiny Pokémon.'],
  [10, 'silver', 'Sparkle Seeker', 'Collect 10 different shiny Pokémon.'],
  [25, 'silver', 'Shiny Hunter', 'Collect 25 different shiny Pokémon.'],
  [50, 'gold', 'Star Chaser', 'Collect 50 different shiny Pokémon.'],
  [100, 'gold', 'A Hundred Stars', 'Collect 100 different shiny Pokémon.'],
  [250, 'platinum', 'Constellation', 'Collect 250 different shiny Pokémon.']
]
for (const [n, tier, title, description] of SHINY_MILESTONES) {
  milestone({ id: `shiny-${n}`, title, description, category: 'shiny', tier, glyph: 'sparkle' }, n, (ctx) => ctx.index.shinySpecies.size)
}
collects(
  { id: 'shiny-starter', title: 'Rare Beginnings', description: 'Log a shiny first partner Pokémon or one of its evolutions.', category: 'shiny', tier: 'silver', glyph: 'sparkle' },
  tagged('starter'),
  { test: 'shiny', want: 1 }
)
collects(
  { id: 'shiny-legendary', title: 'Legend in a New Light', description: 'Log a shiny Legendary Pokémon.', category: 'shiny', tier: 'gold', glyph: 'sparkle' },
  tagged('legendary'),
  { test: 'shiny', want: 1 }
)
collects(
  { id: 'shiny-mythical', title: 'Myth, Reimagined', description: 'Log a shiny Mythical Pokémon.', category: 'shiny', tier: 'gold', glyph: 'sparkle' },
  tagged('mythical'),
  { test: 'shiny', want: 1 }
)
counted(
  { id: 'shiny-games-5', title: 'Sparkles Everywhere', description: 'Log shiny Pokémon from 5 different games.', category: 'shiny', tier: 'silver', glyph: 'sparkle' },
  5,
  (ctx) => ctx.index.shinyGames.size
)
flag(
  { id: 'shiny-family', title: 'Matching Set', description: 'Log every member of one evolution family as a shiny.', category: 'shiny', tier: 'gold', glyph: 'sparkle' },
  (ctx) => ctx.index.shinyFamilies > 0
)
collects(
  { id: 'shiny-all', title: 'Shiny Living Dex', description: 'Collect every Pokémon species as a shiny.', category: 'shiny', tier: 'platinum', glyph: 'sparkle' },
  (facts) => facts.all,
  { test: 'shiny' }
)

// ---------------------------------------------------------------- Cartridge Shelf

const MAIN_GAMES: readonly GameDef[] = GAMES.filter((game) => game.kind === 'main')
const MAIN_SYSTEMS: readonly SystemId[] = [...new Set(MAIN_GAMES.map((game) => game.system))]
const MAIN_GENERATIONS: readonly number[] = [...new Set(MAIN_GAMES.map((game) => game.generation))]

const GAME_MILESTONES: ReadonlyArray<[number, AchievementTier, string]> = [
  [3, 'bronze', 'Three Journeys'],
  [10, 'silver', 'Seasoned Traveller'],
  [20, 'gold', 'Globetrotter']
]
for (const [n, tier, title] of GAME_MILESTONES) {
  counted({ id: `games-${n}`, title, description: `Log catches from ${n} different main-series games.`, category: 'games', tier, glyph: 'cartridge' }, n, (ctx) => ctx.index.mainGames.size)
}
counted(
  { id: 'games-all', title: 'Every Adventure', description: `Log a catch from all ${MAIN_GAMES.length} main-series games.`, category: 'games', tier: 'platinum', glyph: 'cartridge' },
  MAIN_GAMES.length,
  (ctx) => ctx.index.mainGames.size
)
counted(
  {
    id: 'systems-all',
    title: 'Hardware Collector',
    description: `Log a catch from a game on each of these systems: ${listText(MAIN_SYSTEMS.map((id) => SYSTEM_BY_ID.get(id)?.name ?? id))}.`,
    category: 'games',
    tier: 'gold',
    glyph: 'console'
  },
  MAIN_SYSTEMS.length,
  (ctx) => ctx.index.mainSystems.size
)
counted(
  { id: 'generations-all', title: 'Nine Generations', description: 'Log a catch from the games of every generation.', category: 'games', tier: 'gold', glyph: 'console' },
  MAIN_GENERATIONS.length,
  (ctx) => ctx.index.mainGenerations.size
)

/** Paired versions: main-series games that share a group. */
const VERSION_SETS: ReadonlyArray<readonly GameDef[]> = (() => {
  const groups = new Map<string, GameDef[]>()
  for (const game of MAIN_GAMES) {
    const list = groups.get(game.group)
    if (list) list.push(game)
    else groups.set(game.group, [game])
  }
  return [...groups.values()].filter((games) => games.length > 1)
})()

const ownedOf = (ctx: AchievementContext, games: readonly GameDef[]): number => games.filter((game) => ctx.index.byGame.has(game.id)).length

for (const games of VERSION_SETS) {
  const first = games[0]!
  counted(
    {
      id: `pair-${first.group}`,
      title: `${first.groupName} ${games.length > 2 ? 'Trio' : 'Duo'}`,
      description: `Log a catch from ${games.length > 2 ? '' : 'both '}${listText(games.map((game) => game.short))}.`,
      category: 'games',
      tier: 'bronze',
      glyph: 'cartridge',
      accent: first.color
    },
    games.length,
    (ctx) => ownedOf(ctx, games)
  )
}
counted(
  { id: 'pairs-all', title: 'Both Sides of Every Story', description: 'Log a catch from every version of every paired release.', category: 'games', tier: 'gold', glyph: 'cartridge' },
  VERSION_SETS.length,
  (ctx) => VERSION_SETS.filter((games) => ownedOf(ctx, games) === games.length).length
)
counted({ id: 'game-50', title: 'Home Turf', description: 'Log 50 entries from a single game.', category: 'games', tier: 'silver', glyph: 'cartridge' }, 50, (ctx) => ctx.index.maxPerGame)
counted({ id: 'game-150', title: 'Regional Expert', description: 'Log 150 entries from a single game.', category: 'games', tier: 'gold', glyph: 'cartridge' }, 150, (ctx) => ctx.index.maxPerGame)
flag({ id: 'game-go', title: 'Out for a Walk', description: 'Log a catch from Pokémon GO.', category: 'games', tier: 'bronze', glyph: 'steps' }, (ctx) => ctx.index.byGame.has('go'))
counted(
  { id: 'games-orre', title: 'Orre Regular', description: 'Log a catch from both Pokémon Colosseum and Pokémon XD.', category: 'games', tier: 'silver', glyph: 'moon' },
  2,
  (ctx) => (ctx.index.byGame.has('colosseum') ? 1 : 0) + (ctx.index.byGame.has('xd') ? 1 : 0)
)

// ---------------------------------------------------------------- Ball Capsule

const BALL_MILESTONES: ReadonlyArray<[number, AchievementTier, string]> = [
  [5, 'bronze', 'Ball Sampler'],
  [10, 'silver', 'Ball Enthusiast'],
  [20, 'gold', 'Ball Connoisseur']
]
for (const [n, tier, title] of BALL_MILESTONES) {
  counted({ id: `balls-${n}`, title, description: `Use ${n} different kinds of ball.`, category: 'balls', tier, glyph: 'balls' }, n, (ctx) => ctx.index.byBall.size)
}
counted(
  { id: 'balls-all', title: 'One of Everything', description: `Use all ${BALLS.length} kinds of ball at least once.`, category: 'balls', tier: 'platinum', glyph: 'balls' },
  BALLS.length,
  (ctx) => ctx.index.byBall.size
)

const BALL_FAMILIES: ReadonlyArray<[BallFamily, string, string, string]> = [
  ['apricorn', 'balls-apricorn', "Kurt's Finest", 'Use all seven Apricorn balls: Fast, Level, Lure, Heavy, Love, Friend and Moon.'],
  ['hisui', 'balls-hisui', 'Hisuian Craftwork', 'Use every kind of ball crafted in Hisui.']
]
for (const [family, id, title, description] of BALL_FAMILIES) {
  const balls = BALLS.filter((ball) => ball.family === family)
  counted({ id, title, description, category: 'balls', tier: 'gold', glyph: 'balls' }, balls.length, (ctx) => balls.filter((ball) => ctx.index.byBall.has(ball.id)).length)
}

const SINGLE_BALLS: ReadonlyArray<[string, AchievementTier, string]> = [
  ['safari', 'bronze', 'Safari Souvenir'],
  ['sport', 'silver', 'Contest Entry'],
  ['dream', 'bronze', 'Sweet Dreams'],
  ['beast', 'bronze', 'Beast Wrangler'],
  ['master', 'bronze', 'No Chances Taken'],
  ['cherish', 'bronze', 'Cherished Gift']
]
for (const [slug, tier, title] of SINGLE_BALLS) {
  const ball = BALLS.find((b) => b.slug === slug)
  if (!ball) continue
  flag({ id: `ball-${slug}`, title, description: `Log a Pokémon in a ${ball.name}.`, category: 'balls', tier, glyph: 'pokeball' }, (ctx) => ctx.index.byBall.has(ball.id))
}

// ---------------------------------------------------------------- Shapeshifters

const FORM_SET_COPY: ReadonlyArray<[string, AchievementTier, string, string]> = [
  ['unown', 'gold', 'The Whole Alphabet', 'Collect every Unown shape, from A to Z plus ! and ?.'],
  ['vivillon', 'gold', 'Wings of the World', 'Collect every regional Vivillon pattern.'],
  ['alcremie-creams', 'silver', 'Nine Creams', 'Collect Alcremie in every cream.'],
  ['arceus', 'gold', 'Plates of Creation', 'Collect Arceus as every type.'],
  ['silvally', 'gold', 'Memory Bank', 'Collect Silvally as every type.'],
  ['rotom', 'silver', 'Appliance Department', 'Collect all five Rotom appliances.'],
  ['deoxys', 'silver', 'Shape of Space', 'Collect all four Deoxys Formes.'],
  ['furfrou', 'silver', 'Grooming Salon', 'Collect Furfrou in every trim.'],
  ['flabebe', 'gold', 'Flower Garden', 'Collect Flabébé, Floette and Florges with every flower colour.'],
  ['minior', 'silver', 'Meteor Shower', 'Collect Minior with every core colour.'],
  ['oricorio', 'silver', 'Dance Card', 'Collect all four Oricorio styles.'],
  ['seasons', 'silver', 'Four Seasons', 'Collect Deerling and Sawsbuck in every season.'],
  ['cloaks', 'silver', 'Wardrobe Change', 'Collect Burmy and Wormadam in every cloak.'],
  ['sizes', 'silver', 'Pumpkin Patch', 'Collect Pumpkaboo and Gourgeist in every size.'],
  ['seas', 'bronze', 'East and West', 'Collect Shellos and Gastrodon from both seas.'],
  ['lycanroc', 'bronze', 'Day and Night', 'Collect the Midday, Midnight and Dusk forms of Lycanroc.'],
  ['squawkabilly', 'bronze', 'Birds of a Feather', 'Collect Squawkabilly in every plumage.'],
  ['tatsugiri', 'bronze', 'Sushi Platter', 'Collect all three Tatsugiri forms.'],
  ['ogerpon', 'silver', 'Masquerade', 'Collect Ogerpon wearing every mask.'],
  ['genesect', 'silver', 'Drive Collection', 'Collect Genesect holding each of its four Drives.'],
  ['therian', 'silver', 'Two Faces', 'Collect the Therian Formes of Tornadus, Thundurus, Landorus and Enamorus.'],
  ['pikachu-caps', 'gold', 'Hat Collection', 'Collect every Pikachu wearing a cap.'],
  ['fusions', 'gold', 'Better Together', 'Collect every fusion of Kyurem, Necrozma and Calyrex.']
]
for (const [key, tier, title, description] of FORM_SET_COPY) {
  collects({ id: `forms-${key}`, title, description, category: 'forms', tier, glyph: 'shapes' }, formSet(key), { test: 'form' })
  if (key !== 'alcremie-creams') continue
  collects(
    { id: 'forms-alcremie-all', title: 'The Whole Patisserie', description: 'Collect Alcremie in every combination of cream and sweet.', category: 'forms', tier: 'platinum', glyph: 'shapes' },
    (facts) => facts.alcremie,
    { test: 'variant' }
  )
}

const REGIONAL_COPY: ReadonlyArray<[RegionalVariant, string, AchievementTier, string, string]> = [
  ['alola', 'alolan', 'gold', 'Island Variants', 'Collect every Alolan form.'],
  ['galar', 'galarian', 'gold', 'Galarian Lineup', 'Collect every Galarian form.'],
  ['hisui', 'hisuian', 'gold', 'Echoes of Hisui', 'Collect every Hisuian form.'],
  ['paldea', 'paldean', 'silver', 'Paldean Breeds', 'Collect every Paldean form.']
]
for (const [region, key, tier, title, description] of REGIONAL_COPY) {
  collects({ id: `forms-${key}`, title, description, category: 'forms', tier, glyph: 'shapes' }, (facts) => facts.regional.get(region) ?? NONE, { test: 'form' })
}

collects(
  { id: 'genders-10', title: 'His and Hers', description: 'Collect both a male and a female of 10 Pokémon whose genders look different.', category: 'forms', tier: 'silver', glyph: 'gender' },
  (facts) => facts.genderPairs,
  { test: 'genders', want: 10 }
)
collects(
  { id: 'genders-all', title: 'Spot the Difference', description: 'Collect both a male and a female of every Pokémon whose genders look different.', category: 'forms', tier: 'platinum', glyph: 'gender' },
  (facts) => facts.genderPairs,
  { test: 'genders' }
)

collects({ id: 'gmax-1', title: 'Going Big', description: 'Log a Gigantamax Pokémon.', category: 'forms', tier: 'bronze', glyph: 'gmax' }, (facts) => facts.gmax, { test: 'gmax', want: 1 })
collects({ id: 'gmax-10', title: 'Max Power', description: 'Collect 10 different Gigantamax Pokémon.', category: 'forms', tier: 'silver', glyph: 'gmax' }, (facts) => facts.gmax, { test: 'gmax', want: 10 })
collects({ id: 'gmax-all', title: 'Gallery of Giants', description: 'Collect every Gigantamax Pokémon.', category: 'forms', tier: 'gold', glyph: 'gmax' }, (facts) => facts.gmax, { test: 'gmax' })

collects({ id: 'mega-1', title: 'Beyond Evolution', description: 'Log a Mega Evolution.', category: 'forms', tier: 'bronze', glyph: 'mega' }, (facts) => facts.megas, { test: 'form', want: 1 })
collects({ id: 'mega-10', title: 'Stone Collector', description: 'Log 10 different Mega Evolutions.', category: 'forms', tier: 'silver', glyph: 'mega' }, (facts) => facts.megas, { test: 'form', want: 10 })
collects(
  { id: 'mega-all', title: 'Mega Marathon', description: 'Log every Mega Evolution and Primal Reversion.', category: 'forms', tier: 'platinum', glyph: 'mega' },
  (facts) => facts.megas,
  { test: 'form' }
)

// ---------------------------------------------------------------- Hall of Legends

for (const [gen, region] of Object.entries(GENERATION_REGIONS)) {
  collects(
    {
      id: `starters-${region.key}`,
      title: `${region.name} First Partners`,
      description: `Collect all three first partner Pokémon of ${region.name}.`,
      category: 'legends',
      tier: 'bronze',
      glyph: 'sprout'
    },
    (facts) => facts.startersByGeneration.get(Number(gen)) ?? NONE
  )
}
collects(
  { id: 'starters-all', title: 'A Partner for Every Journey', description: 'Collect every first partner Pokémon.', category: 'legends', tier: 'silver', glyph: 'sprout' },
  (facts) => facts.starters
)
collects(
  { id: 'starter-lines-all', title: 'All Grown Up', description: 'Collect every first partner Pokémon and all of their evolutions.', category: 'legends', tier: 'gold', glyph: 'sprout' },
  tagged('starter')
)
collects(
  { id: 'eeveelutions', title: 'Eevee and Friends', description: 'Collect Eevee and every one of its evolutions.', category: 'legends', tier: 'silver', glyph: 'tree' },
  (facts) => facts.eeveelutions
)

const LEGEND_GROUPS: ReadonlyArray<[string, readonly number[], AchievementTier, string, string]> = [
  ['legend-birds', LEGENDARY_BIRDS, 'silver', 'Winged Mirages', 'Collect Articuno, Zapdos and Moltres.'],
  ['legend-beasts', LEGENDARY_BEASTS, 'silver', 'Beasts of Johto', 'Collect Raikou, Entei and Suicune.'],
  ['legend-tower-duo', TOWER_DUO, 'silver', 'Sea and Sky', 'Collect Lugia and Ho-Oh.'],
  ['legend-titans', LEGENDARY_TITANS, 'gold', 'Ancient Titans', 'Collect Regirock, Regice, Registeel, Regigigas, Regieleki and Regidrago.'],
  ['legend-eon-duo', EON_DUO, 'silver', 'Eon Flight', 'Collect Latias and Latios.'],
  ['legend-weather-trio', WEATHER_TRIO, 'silver', 'Land, Sea and Sky', 'Collect Kyogre, Groudon and Rayquaza.'],
  ['legend-lake-guardians', LAKE_GUARDIANS, 'silver', 'Lake Guardians', 'Collect Uxie, Mesprit and Azelf.'],
  ['legend-creation-trio', CREATION_TRIO, 'silver', 'Time, Space and Beyond', 'Collect Dialga, Palkia and Giratina.'],
  ['legend-swords-of-justice', SWORDS_OF_JUSTICE, 'silver', 'Swords of Justice', 'Collect Cobalion, Terrakion, Virizion and Keldeo.'],
  ['legend-forces-of-nature', FORCES_OF_NATURE, 'silver', 'Forces of Nature', 'Collect Tornadus, Thundurus, Landorus and Enamorus.'],
  ['legend-tao-trio', TAO_TRIO, 'silver', 'Truth and Ideals', 'Collect Reshiram, Zekrom and Kyurem.'],
  ['legend-aura-trio', AURA_TRIO, 'silver', 'Life, Destruction and Order', 'Collect Xerneas, Yveltal and Zygarde.'],
  ['legend-guardian-deities', GUARDIAN_DEITIES, 'silver', 'Island Guardians', 'Collect Tapu Koko, Tapu Lele, Tapu Bulu and Tapu Fini.'],
  ['legend-light-trio', LIGHT_TRIO, 'silver', 'Sun, Moon and Prism', 'Collect Solgaleo, Lunala and Necrozma.'],
  ['legend-hero-duo', HERO_DUO, 'silver', 'Heroes of Many Battles', 'Collect Zacian and Zamazenta.'],
  ['legend-treasures-of-ruin', TREASURES_OF_RUIN, 'silver', 'Treasures of Ruin', 'Collect Wo-Chien, Chien-Pao, Ting-Lu and Chi-Yu.'],
  ['legend-loyal-three', LOYAL_THREE, 'silver', 'The Loyal Three', 'Collect Okidogi, Munkidori and Fezandipiti.'],
  ['legend-box-art', BOX_LEGENDARIES, 'gold', 'Cover Stars', 'Collect every Legendary Pokémon that has starred on a game box.']
]
for (const [id, ids, tier, title, description] of LEGEND_GROUPS) {
  collects({ id, title, description, category: 'legends', tier, glyph: 'crown' }, picked(ids))
}

collects({ id: 'legendary-1', title: 'Brush with Legend', description: 'Log your first Legendary Pokémon.', category: 'legends', tier: 'bronze', glyph: 'crown' }, tagged('legendary'), { want: 1 })
collects({ id: 'legendary-10', title: 'Legend Seeker', description: 'Collect 10 different Legendary Pokémon.', category: 'legends', tier: 'silver', glyph: 'crown' }, tagged('legendary'), { want: 10 })
collects({ id: 'legendary-all', title: 'Every Legend', description: 'Collect every Legendary Pokémon.', category: 'legends', tier: 'platinum', glyph: 'crown' }, tagged('legendary'))
collects({ id: 'mythical-1', title: 'Once Upon a Myth', description: 'Log your first Mythical Pokémon.', category: 'legends', tier: 'silver', glyph: 'star' }, tagged('mythical'), { want: 1 })
collects({ id: 'mythical-all', title: 'Myths Made Real', description: 'Collect every Mythical Pokémon.', category: 'legends', tier: 'platinum', glyph: 'star' }, tagged('mythical'))
collects(
  { id: 'pseudo-legendary-all', title: 'Six Hundred Club', description: 'Collect every pseudo-legendary Pokémon, from Dragonite to Baxcalibur.', category: 'legends', tier: 'gold', glyph: 'trophy' },
  tagged('pseudo-legendary')
)
collects({ id: 'fossils-all', title: 'Museum Wing', description: 'Collect every Pokémon revived from a fossil.', category: 'legends', tier: 'gold', glyph: 'fossil' }, tagged('fossil'))
collects({ id: 'babies-all', title: 'Nursery', description: 'Collect every baby Pokémon.', category: 'legends', tier: 'silver', glyph: 'egg' }, tagged('baby'))
collects({ id: 'ultra-beasts-all', title: 'Beyond the Wormhole', description: 'Collect every Ultra Beast.', category: 'legends', tier: 'gold', glyph: 'portal' }, tagged('ultra-beast'))
collects(
  { id: 'paradox-ancient', title: 'Echoes of the Past', description: 'Collect every ancient Paradox Pokémon.', category: 'legends', tier: 'gold', glyph: 'hourglass' },
  picked(PARADOX_ANCIENT)
)
collects(
  { id: 'paradox-future', title: 'Signals from the Future', description: 'Collect every future Paradox Pokémon.', category: 'legends', tier: 'gold', glyph: 'hourglass' },
  picked(PARADOX_FUTURE)
)

// ---------------------------------------------------------------- Field Notes

interface WayStep {
  n: number
  tier: AchievementTier
  title: string
  description: string
}
interface Way {
  /** Id prefix; the threshold is appended. */
  key: string
  glyph: AchievementGlyph
  value: (ctx: AchievementContext) => number
  steps: readonly WayStep[]
}

const WAYS: readonly Way[] = [
  {
    key: 'wild',
    glyph: 'grass',
    value: (ctx) => kindCount(ctx, 'wild'),
    steps: [
      { n: 10, tier: 'bronze', title: 'Into the Tall Grass', description: 'Log 10 Pokémon caught in the wild.' },
      { n: 100, tier: 'silver', title: 'Route Regular', description: 'Log 100 Pokémon caught in the wild.' },
      { n: 500, tier: 'gold', title: 'Wild at Heart', description: 'Log 500 Pokémon caught in the wild.' }
    ]
  },
  {
    key: 'evolved',
    glyph: 'evolve',
    value: (ctx) => kindCount(ctx, 'evolved'),
    steps: [
      { n: 1, tier: 'bronze', title: "What? It's Evolving!", description: 'Log a Pokémon you evolved.' },
      { n: 25, tier: 'silver', title: 'Growing Up Fast', description: 'Log 25 Pokémon you evolved.' },
      { n: 100, tier: 'gold', title: 'Evolution Expert', description: 'Log 100 Pokémon you evolved.' }
    ]
  },
  {
    key: 'bred',
    glyph: 'egg',
    value: (ctx) => kindCount(ctx, 'bred'),
    steps: [
      { n: 1, tier: 'bronze', title: 'Fresh from the Egg', description: 'Log a Pokémon you hatched from an Egg.' },
      { n: 25, tier: 'silver', title: 'Day Care Regular', description: 'Log 25 Pokémon you hatched from Eggs.' },
      { n: 100, tier: 'gold', title: 'Master Breeder', description: 'Log 100 Pokémon you hatched from Eggs.' }
    ]
  },
  {
    key: 'trade',
    glyph: 'swap',
    value: (ctx) => kindCount(ctx, 'trade'),
    steps: [
      { n: 1, tier: 'bronze', title: 'Fair Trade', description: 'Log a Pokémon from an in-game trade.' },
      { n: 10, tier: 'silver', title: 'Trading Post', description: 'Log 10 Pokémon from in-game trades.' }
    ]
  },
  {
    key: 'gift',
    glyph: 'gift',
    value: (ctx) => kindCount(ctx, 'gift', 'egg'),
    steps: [
      { n: 1, tier: 'bronze', title: 'A Gift for You', description: 'Log a Pokémon you were given in a game.' },
      { n: 10, tier: 'silver', title: 'Well Looked After', description: 'Log 10 Pokémon you were given in a game.' }
    ]
  },
  {
    key: 'static',
    glyph: 'duel',
    value: (ctx) => kindCount(ctx, 'static'),
    steps: [
      { n: 1, tier: 'bronze', title: 'Face to Face', description: 'Log a Pokémon from a static encounter.' },
      { n: 25, tier: 'silver', title: 'Showdown Specialist', description: 'Log 25 Pokémon from static encounters.' }
    ]
  },
  {
    key: 'raid',
    glyph: 'den',
    value: (ctx) => kindCount(ctx, 'raid'),
    steps: [
      { n: 1, tier: 'bronze', title: 'Den Diver', description: 'Log a Pokémon from a Max Raid Battle.' },
      { n: 25, tier: 'silver', title: 'Raid Regular', description: 'Log 25 Pokémon from Max Raid Battles.' }
    ]
  },
  {
    key: 'tera',
    glyph: 'crystal',
    value: (ctx) => kindCount(ctx, 'tera'),
    steps: [
      { n: 1, tier: 'bronze', title: 'Crystal Clear', description: 'Log a Pokémon from a Tera Raid Battle.' },
      { n: 25, tier: 'silver', title: 'Tera Raider', description: 'Log 25 Pokémon from Tera Raid Battles.' }
    ]
  },
  {
    key: 'outbreak',
    glyph: 'swarm',
    value: (ctx) => kindCount(ctx, 'outbreak'),
    steps: [
      { n: 1, tier: 'bronze', title: 'Swarm Chaser', description: 'Log a Pokémon from a mass outbreak.' },
      { n: 25, tier: 'silver', title: 'Outbreak Expert', description: 'Log 25 Pokémon from mass outbreaks.' }
    ]
  },
  {
    key: 'shadow',
    glyph: 'moon',
    value: (ctx) => kindCount(ctx, 'shadow'),
    steps: [
      { n: 1, tier: 'bronze', title: 'Open Heart', description: 'Log a Shadow Pokémon from Colosseum or XD.' },
      { n: 10, tier: 'silver', title: 'Snag Specialist', description: 'Log 10 Shadow Pokémon.' }
    ]
  },
  {
    key: 'walker',
    glyph: 'steps',
    value: (ctx) => kindCount(ctx, 'walker'),
    steps: [
      { n: 1, tier: 'bronze', title: 'Step Counter', description: 'Log a Pokémon from the Pokéwalker.' },
      { n: 10, tier: 'silver', title: 'Long Stroll', description: 'Log 10 Pokémon from the Pokéwalker.' }
    ]
  },
  {
    key: 'dream',
    glyph: 'cloud',
    value: (ctx) => kindCount(ctx, 'dream'),
    steps: [{ n: 1, tier: 'bronze', title: 'Dream Catcher', description: 'Log a Pokémon from the Dream World.' }]
  },
  {
    key: 'event',
    glyph: 'ticket',
    value: (ctx) => kindCount(ctx, 'event'),
    steps: [
      { n: 1, tier: 'bronze', title: 'Special Delivery', description: 'Log a Pokémon from an event.' },
      { n: 10, tier: 'silver', title: 'Mystery Gift Regular', description: 'Log 10 Pokémon from events.' },
      { n: 50, tier: 'gold', title: 'Event Historian', description: 'Log 50 Pokémon from events.' }
    ]
  },
  {
    key: 'transfer',
    glyph: 'transfer',
    value: (ctx) => kindCount(ctx, 'transfer'),
    steps: [
      { n: 1, tier: 'bronze', title: 'Moving Day', description: 'Log a Pokémon you transferred from another game.' },
      { n: 25, tier: 'silver', title: 'Frequent Mover', description: 'Log 25 Pokémon you transferred from other games.' }
    ]
  },
  {
    key: 'alpha',
    glyph: 'alpha',
    value: (ctx) => ctx.index.alpha,
    steps: [
      { n: 1, tier: 'bronze', title: 'Seeing Red', description: 'Log an alpha Pokémon.' },
      { n: 25, tier: 'silver', title: 'Alpha Tracker', description: 'Log 25 alpha Pokémon.' },
      { n: 100, tier: 'gold', title: 'Leader of the Pack', description: 'Log 100 alpha Pokémon.' }
    ]
  },
  {
    key: 'kinds',
    glyph: 'paths',
    value: (ctx) => ctx.index.byKind.size,
    steps: [
      { n: 5, tier: 'silver', title: 'Many Roads', description: 'Get Pokémon in 5 different ways.' },
      { n: 10, tier: 'gold', title: 'Every Trick in the Book', description: 'Get Pokémon in 10 different ways.' }
    ]
  },
  {
    key: 'nicknamed',
    glyph: 'tag',
    value: (ctx) => ctx.index.nicknamed,
    steps: [{ n: 10, tier: 'bronze', title: 'Name Rater', description: 'Give nicknames to 10 of your entries.' }]
  },
  {
    key: 'level-100',
    glyph: 'peak',
    value: (ctx) => ctx.index.level100,
    steps: [
      { n: 1, tier: 'bronze', title: 'Peak Condition', description: 'Log a Pokémon at level 100.' },
      { n: 10, tier: 'silver', title: 'Elite Squad', description: 'Log 10 Pokémon at level 100.' }
    ]
  }
]

for (const way of WAYS) {
  for (const step of way.steps) {
    counted({ id: `${way.key}-${step.n}`, title: step.title, description: step.description, category: 'journey', tier: step.tier, glyph: way.glyph }, step.n, way.value)
  }
}

// ---------------------------------------------------------------- Long Haul

const DEDICATION: ReadonlyArray<[string, number, AchievementTier, AchievementGlyph, string, string, (ctx: AchievementContext) => number]> = [
  ['same-species-3-games', 3, 'bronze', 'stack', 'Familiar Face', 'Log the same Pokémon from 3 different games.', (ctx) => ctx.index.maxGamesPerSpecies],
  ['same-species-5-games', 5, 'silver', 'stack', 'Old Friend', 'Log the same Pokémon from 5 different games.', (ctx) => ctx.index.maxGamesPerSpecies],
  ['same-species-10-games', 10, 'gold', 'stack', 'Constant Companion', 'Log the same Pokémon from 10 different games.', (ctx) => ctx.index.maxGamesPerSpecies],
  ['families-5', 5, 'bronze', 'tree', 'Family Album', 'Complete 5 evolution families.', (ctx) => ctx.index.completeFamilies],
  ['families-25', 25, 'silver', 'tree', 'Family Reunion', 'Complete 25 evolution families.', (ctx) => ctx.index.completeFamilies],
  ['families-100', 100, 'gold', 'tree', 'Genealogist', 'Complete 100 evolution families.', (ctx) => ctx.index.completeFamilies],
  ['streak-3', 3, 'bronze', 'flame', 'Three in a Row', 'Log a catch on 3 days in a row.', (ctx) => ctx.progress.streaks.longest],
  ['streak-7', 7, 'silver', 'flame', 'Full Week', 'Log a catch on 7 days in a row.', (ctx) => ctx.progress.streaks.longest],
  ['streak-14', 14, 'gold', 'flame', 'Fortnight', 'Log a catch on 14 days in a row.', (ctx) => ctx.progress.streaks.longest],
  ['streak-30', 30, 'platinum', 'flame', 'Daily Ritual', 'Log a catch on 30 days in a row.', (ctx) => ctx.progress.streaks.longest],
  ['day-10', 10, 'bronze', 'bolt', 'Productive Day', 'Log 10 catches dated the same day.', (ctx) => ctx.index.maxPerDay],
  ['day-25', 25, 'silver', 'bolt', 'Catching Spree', 'Log 25 catches dated the same day.', (ctx) => ctx.index.maxPerDay],
  ['day-50', 50, 'gold', 'bolt', 'Marathon Session', 'Log 50 catches dated the same day.', (ctx) => ctx.index.maxPerDay],
  ['days-30', 30, 'silver', 'calendar', 'Regular Visitor', 'Log catches on 30 different days.', (ctx) => ctx.index.byDay.size],
  ['days-100', 100, 'gold', 'calendar', 'Part of the Routine', 'Log catches on 100 different days.', (ctx) => ctx.index.byDay.size]
]
for (const [id, n, tier, glyph, title, description, value] of DEDICATION) {
  counted({ id, title, description, category: 'dedication', tier, glyph }, n, value)
  if (id !== 'families-100') continue
  add({
    id: 'families-all',
    title: 'Every Branch',
    description: 'Complete every evolution family.',
    category: 'dedication',
    tier: 'platinum',
    glyph: 'tree',
    evaluate: (ctx) => ({ current: ctx.index.completeFamilies, target: ctx.facts.families.size })
  })
}

// ---------------------------------------------------------------- Hidden Grotto

const MASTER_BALL = 1
const SAFARI_BALL = 5
const MOON_BALL = 23
const HEAVY_BALLS: readonly number[] = [20, 34]
const GENERATION_ONE_GAMES: readonly string[] = ['red', 'green', 'blue', 'yellow']
const POKEMON_DAY = '-02-27'

/** Any entry of the listed species passes `test`; false when the dataset has none of them. */
function anyEntry(ctx: AchievementContext, species: readonly number[], test: (entry: { ball?: number; game: string }) => boolean): boolean {
  return species.some((id) => ctx.index.bySpecies.get(id)?.some(test) === true)
}

function secret(common: Omit<Common, 'category' | 'secret'> & { hint: string }, species: readonly number[], evaluate: (ctx: AchievementContext) => AchievementProgress): void {
  add({
    ...common,
    category: 'secrets',
    secret: true,
    // A secret about particular Pokémon is unavailable when the dataset has none of them.
    evaluate: (ctx) => (species.length > 0 && ctx.facts.pick(species).length === 0 ? { current: 0, target: 0 } : evaluate(ctx))
  })
}

const yes = (value: boolean): AchievementProgress => ({ current: value ? 1 : 0, target: 1 })

secret(
  { id: 'secret-golden-magikarp', title: 'Solid Gold', description: 'Log a shiny Magikarp.', hint: 'Something fishy is worth its weight in gold.', tier: 'gold', glyph: 'sparkle' },
  [MAGIKARP],
  (ctx) => yes(ctx.index.shinySpecies.has(MAGIKARP))
)
secret(
  { id: 'secret-pikachu-ten-games', title: 'Partner in Every World', description: 'Log a Pikachu from 10 different games.', hint: 'One famous mouse, many journeys.', tier: 'gold', glyph: 'bolt' },
  [PIKACHU],
  (ctx) => ({ current: ctx.index.gamesBySpecies.get(PIKACHU)?.size ?? 0, target: 10 })
)
secret(
  { id: 'secret-master-ball-common', title: 'Overkill', description: 'Use a Master Ball on a Pokémon from the very first route.', hint: 'Not every catch deserves the best ball.', tier: 'silver', glyph: 'pokeball' },
  EARLY_ROUTE_COMMONS,
  (ctx) => yes(anyEntry(ctx, EARLY_ROUTE_COMMONS, (entry) => entry.ball === MASTER_BALL))
)
secret(
  { id: 'secret-moon-ball-clefairy', title: 'Fell from the Moon', description: 'Log a Cleffa, Clefairy or Clefable in a Moon Ball.', hint: 'Some Pokémon belong in one particular ball.', tier: 'silver', glyph: 'moon' },
  CLEFAIRY_LINE,
  (ctx) => yes(anyEntry(ctx, CLEFAIRY_LINE, (entry) => entry.ball === MOON_BALL))
)
secret(
  { id: 'secret-heavy-sleeper', title: 'Heavy Sleeper', description: 'Log a Munchlax or Snorlax in a Heavy Ball.', hint: 'A big sleeper needs a sturdy ball.', tier: 'silver', glyph: 'balls' },
  SNORLAX_LINE,
  (ctx) => yes(anyEntry(ctx, SNORLAX_LINE, (entry) => entry.ball !== undefined && HEAVY_BALLS.includes(entry.ball)))
)
secret(
  { id: 'secret-safari-rarity', title: 'Worth the Wait', description: 'Log a Chansey, Kangaskhan, Scyther, Pinsir, Tauros or Dratini in a Safari Ball.', hint: "The Safari Zone's rarest sights take patience.", tier: 'silver', glyph: 'grass' },
  SAFARI_ZONE_RARITIES,
  (ctx) => yes(anyEntry(ctx, SAFARI_ZONE_RARITIES, (entry) => entry.ball === SAFARI_BALL))
)
secret(
  { id: 'secret-under-the-truck', title: 'Under the Truck', description: 'Log a Mew from Red, Green, Blue or Yellow.', hint: 'They said it was hiding next to the S.S. Anne.', tier: 'gold', glyph: 'star' },
  [MEW],
  (ctx) => yes(anyEntry(ctx, [MEW], (entry) => GENERATION_ONE_GAMES.includes(entry.game)))
)
secret(
  { id: 'secret-pokemon-day', title: 'Pokémon Day', description: 'Log a catch dated 27 February.', hint: 'Celebrate the day it all began.', tier: 'silver', glyph: 'calendar' },
  [],
  (ctx) => {
    for (const day of ctx.index.byDay.keys()) if (day.endsWith(POKEMON_DAY)) return yes(true)
    return yes(false)
  }
)
secret(
  { id: 'secret-identity-crisis', title: 'Identity Crisis', description: 'Nickname a Pokémon after a different Pokémon.', hint: 'Call it something it is not.', tier: 'silver', glyph: 'tag' },
  [],
  (ctx) => yes(ctx.index.misnamed > 0)
)
secret(
  { id: 'secret-shiny-alpha', title: 'One in a Million', description: 'Log a Pokémon that is both shiny and an alpha.', hint: 'Big, red-eyed and sparkling.', tier: 'gold', glyph: 'alpha' },
  [],
  (ctx) => yes(ctx.index.shinyAlpha > 0)
)

// ---------------------------------------------------------------- exports

/** Every achievement, grouped by category in `ACHIEVEMENT_CATEGORIES` order. */
export const ACHIEVEMENTS: readonly AchievementDef[] = ACHIEVEMENT_CATEGORIES.flatMap((category) => defs.filter((def) => def.category === category.id))

export const ACHIEVEMENT_BY_ID: ReadonlyMap<string, AchievementDef> = new Map(ACHIEVEMENTS.map((def) => [def.id, def]))
