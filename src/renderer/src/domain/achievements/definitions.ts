/**
 * Every achievement, generated from small tables: thresholds, regions, types, version pairs, balls,
 * form sets, curated groups and ways of obtaining a Pokémon. `ACHIEVEMENTS` is static (it does not
 * depend on the loaded dataset); the dataset only decides targets when an achievement is evaluated.
 *
 * Ids are saved in the user's file. Never rename one; retire it and add a new id instead.
 *
 * The words are not here: the name and description of the achievement `id` are the messages
 * "achievements.<id>.name" and "achievements.<id>.description" (and ".hint" for a secret one) of
 * i18n/en/achievements.ts, read whenever `title`, `description` or `hint` is asked for.
 */

import { BALLS, type BallFamily } from '@shared/balls'
import type { RegionalVariant, SpeciesTag, TypeId } from '@shared/dex-types'
import { GAMES, SYSTEM_BY_ID, type GameDef, type SystemId } from '@shared/games'
import type { EntryKind } from '@shared/save-types'
import { t, type MessageKey, type MessageParams } from '@renderer/i18n/runtime'
import { ballName, gameGroupName, gameShortName } from '@renderer/i18n/terms'
import { listText } from '@renderer/lib/format'
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

/** A category; its name and description are "achievements.category.<id>.name" and ".description". */
function category(id: AchievementCategoryId, glyph: AchievementGlyph): AchievementCategory {
  return {
    id,
    glyph,
    get name() {
      return t(`achievements.category.${id}.name`)
    },
    get description() {
      return t(`achievements.category.${id}.description`)
    }
  }
}

export const ACHIEVEMENT_CATEGORIES: readonly AchievementCategory[] = [
  category('milestones', 'pokeball'),
  category('regions', 'compass'),
  category('types', 'gem'),
  category('shiny', 'sparkle'),
  category('games', 'cartridge'),
  category('balls', 'balls'),
  category('forms', 'shapes'),
  category('legends', 'crown'),
  category('journey', 'grass'),
  category('dedication', 'flame'),
  category('secrets', 'question')
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

interface Common {
  id: string
  category: AchievementCategoryId
  tier: AchievementTier
  glyph: AchievementGlyph
  accent?: string
  secret?: boolean
  /** Where its messages are when that is not "<id>": the version pairs share "pair.duo" and "pair.trio". */
  text?: string
  /** Values for the placeholders of its name and description, worked out when the text is read. */
  params?: () => MessageParams
}
type Draft = Common & Pick<AchievementDef, 'evaluate' | 'pool' | 'test' | 'whole'>

const defs: AchievementDef[] = []

function add(draft: Draft): void {
  const { text, params, ...rest } = draft
  const stem = `achievements.${text ?? draft.id}`
  const def: AchievementDef = {
    ...rest,
    points: TIER_POINTS[draft.tier],
    get title() {
      return t(`${stem}.name` as MessageKey, params?.())
    },
    get description() {
      return t(`${stem}.description` as MessageKey, params?.())
    }
  }
  // Only a secret has a hint; for the others the property does not exist at all.
  if (draft.secret) Object.defineProperty(def, 'hint', { enumerable: true, get: () => t(`${stem}.hint` as MessageKey) })
  defs.push(def)
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

const SPECIES_MILESTONES: ReadonlyArray<[number, AchievementTier]> = [
  [1, 'bronze'],
  [10, 'bronze'],
  [50, 'bronze'],
  [100, 'silver'],
  [151, 'silver'],
  [250, 'silver'],
  [386, 'gold'],
  [500, 'gold'],
  [750, 'gold'],
  [1000, 'platinum']
]

for (const [n, tier] of SPECIES_MILESTONES) {
  milestone({ id: `species-${n}`, category: 'milestones', tier, glyph: 'pokeball' }, n, (ctx) => ctx.index.species.size)
}
collects(
  { id: 'species-all', category: 'milestones', tier: 'platinum', glyph: 'pokeball' },
  (facts) => facts.all
)

add({
  id: 'living-dex-half',
  category: 'milestones',
  tier: 'gold',
  glyph: 'boxes',
  evaluate: (ctx) => ({ current: ctx.collection.totals.caught, target: Math.ceil(ctx.collection.totals.slots / 2) })
})
add({
  id: 'living-dex-complete',
  category: 'milestones',
  tier: 'platinum',
  glyph: 'boxes',
  evaluate: (ctx) => ({ current: ctx.collection.totals.caught, target: ctx.collection.totals.slots })
})

const ENTRY_MILESTONES: ReadonlyArray<[number, AchievementTier]> = [
  [100, 'bronze'],
  [500, 'silver'],
  [1000, 'gold'],
  [2500, 'platinum']
]
for (const [n, tier] of ENTRY_MILESTONES) {
  counted({ id: `entries-${n}`, category: 'milestones', tier, glyph: 'journal' }, n, (ctx) => ctx.index.total)
}

// ---------------------------------------------------------------- World Tour

for (const [gen, region] of Object.entries(GENERATION_REGIONS)) {
  const pool = (facts: DexFacts): readonly SetItem[] => facts.byGeneration.get(Number(gen)) ?? NONE
  collects(
    { id: `region-${region.key}-half`, category: 'regions', tier: 'silver', glyph: 'compass' },
    pool,
    { want: 'half' }
  )
  collects(
    { id: `region-${region.key}-all`, category: 'regions', tier: 'gold', glyph: 'compass' },
    pool
  )
}

// ---------------------------------------------------------------- Elemental Mastery

const TYPES: readonly TypeId[] = ['normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy']

for (const type of TYPES) {
  collects(
    { id: `type-${type}-all`, category: 'types', tier: 'gold', glyph: 'gem', accent: `var(--type-${type})` },
    (facts) => facts.byType.get(type) ?? NONE
  )
}

// ---------------------------------------------------------------- Starlight

const SHINY_MILESTONES: ReadonlyArray<[number, AchievementTier]> = [
  [1, 'bronze'],
  [10, 'silver'],
  [25, 'silver'],
  [50, 'gold'],
  [100, 'gold'],
  [250, 'platinum']
]
for (const [n, tier] of SHINY_MILESTONES) {
  milestone({ id: `shiny-${n}`, category: 'shiny', tier, glyph: 'sparkle' }, n, (ctx) => ctx.index.shinySpecies.size)
}
collects(
  { id: 'shiny-starter', category: 'shiny', tier: 'silver', glyph: 'sparkle' },
  tagged('starter'),
  { test: 'shiny', want: 1 }
)
collects(
  { id: 'shiny-legendary', category: 'shiny', tier: 'gold', glyph: 'sparkle' },
  tagged('legendary'),
  { test: 'shiny', want: 1 }
)
collects(
  { id: 'shiny-mythical', category: 'shiny', tier: 'gold', glyph: 'sparkle' },
  tagged('mythical'),
  { test: 'shiny', want: 1 }
)
counted(
  { id: 'shiny-games-5', category: 'shiny', tier: 'silver', glyph: 'sparkle' },
  5,
  (ctx) => ctx.index.shinyGames.size
)
flag(
  { id: 'shiny-family', category: 'shiny', tier: 'gold', glyph: 'sparkle' },
  (ctx) => ctx.index.shinyFamilies > 0
)
collects(
  { id: 'shiny-all', category: 'shiny', tier: 'platinum', glyph: 'sparkle' },
  (facts) => facts.all,
  { test: 'shiny' }
)

// ---------------------------------------------------------------- Cartridge Shelf

const MAIN_GAMES: readonly GameDef[] = GAMES.filter((game) => game.kind === 'main')
const MAIN_SYSTEMS: readonly SystemId[] = [...new Set(MAIN_GAMES.map((game) => game.system))]
const MAIN_GENERATIONS: readonly number[] = [...new Set(MAIN_GAMES.map((game) => game.generation))]

const GAME_MILESTONES: ReadonlyArray<[number, AchievementTier]> = [
  [3, 'bronze'],
  [10, 'silver'],
  [20, 'gold']
]
for (const [n, tier] of GAME_MILESTONES) {
  counted({ id: `games-${n}`, category: 'games', tier, glyph: 'cartridge' }, n, (ctx) => ctx.index.mainGames.size)
}
counted(
  { id: 'games-all', category: 'games', tier: 'platinum', glyph: 'cartridge', params: () => ({ count: MAIN_GAMES.length }) },
  MAIN_GAMES.length,
  (ctx) => ctx.index.mainGames.size
)
counted(
  {
    id: 'systems-all',
    category: 'games',
    tier: 'gold',
    glyph: 'console',
    // Console names are the same in every language.
    params: () => ({ systems: listText(MAIN_SYSTEMS.map((id) => SYSTEM_BY_ID.get(id)?.name ?? id)) })
  },
  MAIN_SYSTEMS.length,
  (ctx) => ctx.index.mainSystems.size
)
counted(
  { id: 'generations-all', category: 'games', tier: 'gold', glyph: 'console' },
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
      category: 'games',
      tier: 'bronze',
      glyph: 'cartridge',
      accent: first.color,
      text: games.length > 2 ? 'pair.trio' : 'pair.duo',
      params: () => ({ group: gameGroupName(first.group), games: listText(games.map((game) => gameShortName(game.id))) })
    },
    games.length,
    (ctx) => ownedOf(ctx, games)
  )
}
counted(
  { id: 'pairs-all', category: 'games', tier: 'gold', glyph: 'cartridge' },
  VERSION_SETS.length,
  (ctx) => VERSION_SETS.filter((games) => ownedOf(ctx, games) === games.length).length
)
counted({ id: 'game-50', category: 'games', tier: 'silver', glyph: 'cartridge' }, 50, (ctx) => ctx.index.maxPerGame)
counted({ id: 'game-150', category: 'games', tier: 'gold', glyph: 'cartridge' }, 150, (ctx) => ctx.index.maxPerGame)
flag({ id: 'game-go', category: 'games', tier: 'bronze', glyph: 'steps' }, (ctx) => ctx.index.byGame.has('go'))
counted(
  { id: 'games-orre', category: 'games', tier: 'silver', glyph: 'moon' },
  2,
  (ctx) => (ctx.index.byGame.has('colosseum') ? 1 : 0) + (ctx.index.byGame.has('xd') ? 1 : 0)
)

// ---------------------------------------------------------------- Ball Capsule

const BALL_MILESTONES: ReadonlyArray<[number, AchievementTier]> = [
  [5, 'bronze'],
  [10, 'silver'],
  [20, 'gold']
]
for (const [n, tier] of BALL_MILESTONES) {
  counted({ id: `balls-${n}`, category: 'balls', tier, glyph: 'balls' }, n, (ctx) => ctx.index.byBall.size)
}
counted(
  { id: 'balls-all', category: 'balls', tier: 'platinum', glyph: 'balls', params: () => ({ count: BALLS.length }) },
  BALLS.length,
  (ctx) => ctx.index.byBall.size
)

const BALL_FAMILIES: ReadonlyArray<[BallFamily, string]> = [
  ['apricorn', 'balls-apricorn'],
  ['hisui', 'balls-hisui']
]
for (const [family, id] of BALL_FAMILIES) {
  const balls = BALLS.filter((ball) => ball.family === family)
  counted({ id, category: 'balls', tier: 'gold', glyph: 'balls' }, balls.length, (ctx) => balls.filter((ball) => ctx.index.byBall.has(ball.id)).length)
}

const SINGLE_BALLS: ReadonlyArray<[string, AchievementTier]> = [
  ['safari', 'bronze'],
  ['sport', 'silver'],
  ['dream', 'bronze'],
  ['beast', 'bronze'],
  ['master', 'bronze'],
  ['cherish', 'bronze']
]
for (const [slug, tier] of SINGLE_BALLS) {
  const ball = BALLS.find((b) => b.slug === slug)
  if (!ball) continue
  flag({ id: `ball-${slug}`, category: 'balls', tier, glyph: 'pokeball', params: () => ({ ball: ballName(ball.id) ?? ball.name }) }, (ctx) => ctx.index.byBall.has(ball.id))
}

// ---------------------------------------------------------------- Shapeshifters

const FORM_SET_COPY: ReadonlyArray<[string, AchievementTier]> = [
  ['unown', 'gold'],
  ['vivillon', 'gold'],
  ['alcremie-creams', 'silver'],
  ['arceus', 'gold'],
  ['silvally', 'gold'],
  ['rotom', 'silver'],
  ['deoxys', 'silver'],
  ['furfrou', 'silver'],
  ['flabebe', 'gold'],
  ['minior', 'silver'],
  ['oricorio', 'silver'],
  ['seasons', 'silver'],
  ['cloaks', 'silver'],
  ['sizes', 'silver'],
  ['seas', 'bronze'],
  ['lycanroc', 'bronze'],
  ['squawkabilly', 'bronze'],
  ['tatsugiri', 'bronze'],
  ['ogerpon', 'silver'],
  ['genesect', 'silver'],
  ['therian', 'silver'],
  ['pikachu-caps', 'gold'],
  ['fusions', 'gold']
]
for (const [key, tier] of FORM_SET_COPY) {
  collects({ id: `forms-${key}`, category: 'forms', tier, glyph: 'shapes' }, formSet(key), { test: 'form' })
  if (key !== 'alcremie-creams') continue
  collects(
    { id: 'forms-alcremie-all', category: 'forms', tier: 'platinum', glyph: 'shapes' },
    (facts) => facts.alcremie,
    { test: 'variant' }
  )
}

const REGIONAL_COPY: ReadonlyArray<[RegionalVariant, string, AchievementTier]> = [
  ['alola', 'alolan', 'gold'],
  ['galar', 'galarian', 'gold'],
  ['hisui', 'hisuian', 'gold'],
  ['paldea', 'paldean', 'silver']
]
for (const [region, key, tier] of REGIONAL_COPY) {
  collects({ id: `forms-${key}`, category: 'forms', tier, glyph: 'shapes' }, (facts) => facts.regional.get(region) ?? NONE, { test: 'form' })
}

collects(
  { id: 'genders-10', category: 'forms', tier: 'silver', glyph: 'gender' },
  (facts) => facts.genderPairs,
  { test: 'genders', want: 10 }
)
collects(
  { id: 'genders-all', category: 'forms', tier: 'platinum', glyph: 'gender' },
  (facts) => facts.genderPairs,
  { test: 'genders' }
)

collects({ id: 'gmax-1', category: 'forms', tier: 'bronze', glyph: 'gmax' }, (facts) => facts.gmax, { test: 'gmax', want: 1 })
collects({ id: 'gmax-10', category: 'forms', tier: 'silver', glyph: 'gmax' }, (facts) => facts.gmax, { test: 'gmax', want: 10 })
collects({ id: 'gmax-all', category: 'forms', tier: 'gold', glyph: 'gmax' }, (facts) => facts.gmax, { test: 'gmax' })

collects({ id: 'mega-1', category: 'forms', tier: 'bronze', glyph: 'mega' }, (facts) => facts.megas, { test: 'form', want: 1 })
collects({ id: 'mega-10', category: 'forms', tier: 'silver', glyph: 'mega' }, (facts) => facts.megas, { test: 'form', want: 10 })
collects(
  { id: 'mega-all', category: 'forms', tier: 'platinum', glyph: 'mega' },
  (facts) => facts.megas,
  { test: 'form' }
)

// ---------------------------------------------------------------- Hall of Legends

for (const [gen, region] of Object.entries(GENERATION_REGIONS)) {
  collects(
    {
      id: `starters-${region.key}`,
      category: 'legends',
      tier: 'bronze',
      glyph: 'sprout'
    },
    (facts) => facts.startersByGeneration.get(Number(gen)) ?? NONE
  )
}
collects(
  { id: 'starters-all', category: 'legends', tier: 'silver', glyph: 'sprout' },
  (facts) => facts.starters
)
collects(
  { id: 'starter-lines-all', category: 'legends', tier: 'gold', glyph: 'sprout' },
  tagged('starter')
)
collects(
  { id: 'eeveelutions', category: 'legends', tier: 'silver', glyph: 'tree' },
  (facts) => facts.eeveelutions
)

const LEGEND_GROUPS: ReadonlyArray<[string, readonly number[], AchievementTier]> = [
  ['legend-birds', LEGENDARY_BIRDS, 'silver'],
  ['legend-beasts', LEGENDARY_BEASTS, 'silver'],
  ['legend-tower-duo', TOWER_DUO, 'silver'],
  ['legend-titans', LEGENDARY_TITANS, 'gold'],
  ['legend-eon-duo', EON_DUO, 'silver'],
  ['legend-weather-trio', WEATHER_TRIO, 'silver'],
  ['legend-lake-guardians', LAKE_GUARDIANS, 'silver'],
  ['legend-creation-trio', CREATION_TRIO, 'silver'],
  ['legend-swords-of-justice', SWORDS_OF_JUSTICE, 'silver'],
  ['legend-forces-of-nature', FORCES_OF_NATURE, 'silver'],
  ['legend-tao-trio', TAO_TRIO, 'silver'],
  ['legend-aura-trio', AURA_TRIO, 'silver'],
  ['legend-guardian-deities', GUARDIAN_DEITIES, 'silver'],
  ['legend-light-trio', LIGHT_TRIO, 'silver'],
  ['legend-hero-duo', HERO_DUO, 'silver'],
  ['legend-treasures-of-ruin', TREASURES_OF_RUIN, 'silver'],
  ['legend-loyal-three', LOYAL_THREE, 'silver'],
  ['legend-box-art', BOX_LEGENDARIES, 'gold']
]
for (const [id, ids, tier] of LEGEND_GROUPS) {
  collects({ id, category: 'legends', tier, glyph: 'crown' }, picked(ids))
}

collects({ id: 'legendary-1', category: 'legends', tier: 'bronze', glyph: 'crown' }, tagged('legendary'), { want: 1 })
collects({ id: 'legendary-10', category: 'legends', tier: 'silver', glyph: 'crown' }, tagged('legendary'), { want: 10 })
collects({ id: 'legendary-all', category: 'legends', tier: 'platinum', glyph: 'crown' }, tagged('legendary'))
collects({ id: 'mythical-1', category: 'legends', tier: 'silver', glyph: 'star' }, tagged('mythical'), { want: 1 })
collects({ id: 'mythical-all', category: 'legends', tier: 'platinum', glyph: 'star' }, tagged('mythical'))
collects(
  { id: 'pseudo-legendary-all', category: 'legends', tier: 'gold', glyph: 'trophy' },
  tagged('pseudo-legendary')
)
collects({ id: 'fossils-all', category: 'legends', tier: 'gold', glyph: 'fossil' }, tagged('fossil'))
collects({ id: 'babies-all', category: 'legends', tier: 'silver', glyph: 'egg' }, tagged('baby'))
collects({ id: 'ultra-beasts-all', category: 'legends', tier: 'gold', glyph: 'portal' }, tagged('ultra-beast'))
collects(
  { id: 'paradox-ancient', category: 'legends', tier: 'gold', glyph: 'hourglass' },
  picked(PARADOX_ANCIENT)
)
collects(
  { id: 'paradox-future', category: 'legends', tier: 'gold', glyph: 'hourglass' },
  picked(PARADOX_FUTURE)
)

// ---------------------------------------------------------------- Field Notes

interface WayStep {
  n: number
  tier: AchievementTier
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
      { n: 10, tier: 'bronze' },
      { n: 100, tier: 'silver' },
      { n: 500, tier: 'gold' }
    ]
  },
  {
    key: 'evolved',
    glyph: 'evolve',
    value: (ctx) => kindCount(ctx, 'evolved'),
    steps: [
      { n: 1, tier: 'bronze' },
      { n: 25, tier: 'silver' },
      { n: 100, tier: 'gold' }
    ]
  },
  {
    key: 'bred',
    glyph: 'egg',
    value: (ctx) => kindCount(ctx, 'bred'),
    steps: [
      { n: 1, tier: 'bronze' },
      { n: 25, tier: 'silver' },
      { n: 100, tier: 'gold' }
    ]
  },
  {
    key: 'trade',
    glyph: 'swap',
    value: (ctx) => kindCount(ctx, 'trade'),
    steps: [
      { n: 1, tier: 'bronze' },
      { n: 10, tier: 'silver' }
    ]
  },
  {
    key: 'gift',
    glyph: 'gift',
    value: (ctx) => kindCount(ctx, 'gift', 'egg'),
    steps: [
      { n: 1, tier: 'bronze' },
      { n: 10, tier: 'silver' }
    ]
  },
  {
    key: 'static',
    glyph: 'duel',
    value: (ctx) => kindCount(ctx, 'static'),
    steps: [
      { n: 1, tier: 'bronze' },
      { n: 25, tier: 'silver' }
    ]
  },
  {
    key: 'raid',
    glyph: 'den',
    value: (ctx) => kindCount(ctx, 'raid'),
    steps: [
      { n: 1, tier: 'bronze' },
      { n: 25, tier: 'silver' }
    ]
  },
  {
    key: 'tera',
    glyph: 'crystal',
    value: (ctx) => kindCount(ctx, 'tera'),
    steps: [
      { n: 1, tier: 'bronze' },
      { n: 25, tier: 'silver' }
    ]
  },
  {
    key: 'outbreak',
    glyph: 'swarm',
    value: (ctx) => kindCount(ctx, 'outbreak'),
    steps: [
      { n: 1, tier: 'bronze' },
      { n: 25, tier: 'silver' }
    ]
  },
  {
    key: 'shadow',
    glyph: 'moon',
    value: (ctx) => kindCount(ctx, 'shadow'),
    steps: [
      { n: 1, tier: 'bronze' },
      { n: 10, tier: 'silver' }
    ]
  },
  {
    key: 'walker',
    glyph: 'steps',
    value: (ctx) => kindCount(ctx, 'walker'),
    steps: [
      { n: 1, tier: 'bronze' },
      { n: 10, tier: 'silver' }
    ]
  },
  {
    key: 'dream',
    glyph: 'cloud',
    value: (ctx) => kindCount(ctx, 'dream'),
    steps: [{ n: 1, tier: 'bronze' }]
  },
  {
    key: 'event',
    glyph: 'ticket',
    value: (ctx) => kindCount(ctx, 'event'),
    steps: [
      { n: 1, tier: 'bronze' },
      { n: 10, tier: 'silver' },
      { n: 50, tier: 'gold' }
    ]
  },
  {
    key: 'transfer',
    glyph: 'transfer',
    value: (ctx) => kindCount(ctx, 'transfer'),
    steps: [
      { n: 1, tier: 'bronze' },
      { n: 25, tier: 'silver' }
    ]
  },
  {
    key: 'alpha',
    glyph: 'alpha',
    value: (ctx) => ctx.index.alpha,
    steps: [
      { n: 1, tier: 'bronze' },
      { n: 25, tier: 'silver' },
      { n: 100, tier: 'gold' }
    ]
  },
  {
    key: 'kinds',
    glyph: 'paths',
    value: (ctx) => ctx.index.byKind.size,
    steps: [
      { n: 5, tier: 'silver' },
      { n: 10, tier: 'gold' }
    ]
  },
  {
    key: 'nicknamed',
    glyph: 'tag',
    value: (ctx) => ctx.index.nicknamed,
    steps: [{ n: 10, tier: 'bronze' }]
  },
  {
    key: 'level-100',
    glyph: 'peak',
    value: (ctx) => ctx.index.level100,
    steps: [
      { n: 1, tier: 'bronze' },
      { n: 10, tier: 'silver' }
    ]
  }
]

for (const way of WAYS) {
  for (const step of way.steps) {
    counted({ id: `${way.key}-${step.n}`, category: 'journey', tier: step.tier, glyph: way.glyph }, step.n, way.value)
  }
}

// ---------------------------------------------------------------- Long Haul

const DEDICATION: ReadonlyArray<[string, number, AchievementTier, AchievementGlyph, (ctx: AchievementContext) => number]> = [
  ['same-species-3-games', 3, 'bronze', 'stack', (ctx) => ctx.index.maxGamesPerSpecies],
  ['same-species-5-games', 5, 'silver', 'stack', (ctx) => ctx.index.maxGamesPerSpecies],
  ['same-species-10-games', 10, 'gold', 'stack', (ctx) => ctx.index.maxGamesPerSpecies],
  ['families-5', 5, 'bronze', 'tree', (ctx) => ctx.index.completeFamilies],
  ['families-25', 25, 'silver', 'tree', (ctx) => ctx.index.completeFamilies],
  ['families-100', 100, 'gold', 'tree', (ctx) => ctx.index.completeFamilies],
  ['streak-3', 3, 'bronze', 'flame', (ctx) => ctx.progress.streaks.longest],
  ['streak-7', 7, 'silver', 'flame', (ctx) => ctx.progress.streaks.longest],
  ['streak-14', 14, 'gold', 'flame', (ctx) => ctx.progress.streaks.longest],
  ['streak-30', 30, 'platinum', 'flame', (ctx) => ctx.progress.streaks.longest],
  ['day-10', 10, 'bronze', 'bolt', (ctx) => ctx.index.maxPerDay],
  ['day-25', 25, 'silver', 'bolt', (ctx) => ctx.index.maxPerDay],
  ['day-50', 50, 'gold', 'bolt', (ctx) => ctx.index.maxPerDay],
  ['days-30', 30, 'silver', 'calendar', (ctx) => ctx.index.byDay.size],
  ['days-100', 100, 'gold', 'calendar', (ctx) => ctx.index.byDay.size]
]
for (const [id, n, tier, glyph, value] of DEDICATION) {
  counted({ id, category: 'dedication', tier, glyph }, n, value)
  if (id !== 'families-100') continue
  add({
    id: 'families-all',
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

function secret(common: Omit<Common, 'category' | 'secret'>, species: readonly number[], evaluate: (ctx: AchievementContext) => AchievementProgress): void {
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
  { id: 'secret-golden-magikarp', tier: 'gold', glyph: 'sparkle' },
  [MAGIKARP],
  (ctx) => yes(ctx.index.shinySpecies.has(MAGIKARP))
)
secret(
  { id: 'secret-pikachu-ten-games', tier: 'gold', glyph: 'bolt' },
  [PIKACHU],
  (ctx) => ({ current: ctx.index.gamesBySpecies.get(PIKACHU)?.size ?? 0, target: 10 })
)
secret(
  { id: 'secret-master-ball-common', tier: 'silver', glyph: 'pokeball' },
  EARLY_ROUTE_COMMONS,
  (ctx) => yes(anyEntry(ctx, EARLY_ROUTE_COMMONS, (entry) => entry.ball === MASTER_BALL))
)
secret(
  { id: 'secret-moon-ball-clefairy', tier: 'silver', glyph: 'moon' },
  CLEFAIRY_LINE,
  (ctx) => yes(anyEntry(ctx, CLEFAIRY_LINE, (entry) => entry.ball === MOON_BALL))
)
secret(
  { id: 'secret-heavy-sleeper', tier: 'silver', glyph: 'balls' },
  SNORLAX_LINE,
  (ctx) => yes(anyEntry(ctx, SNORLAX_LINE, (entry) => entry.ball !== undefined && HEAVY_BALLS.includes(entry.ball)))
)
secret(
  { id: 'secret-safari-rarity', tier: 'silver', glyph: 'grass' },
  SAFARI_ZONE_RARITIES,
  (ctx) => yes(anyEntry(ctx, SAFARI_ZONE_RARITIES, (entry) => entry.ball === SAFARI_BALL))
)
secret(
  { id: 'secret-under-the-truck', tier: 'gold', glyph: 'star' },
  [MEW],
  (ctx) => yes(anyEntry(ctx, [MEW], (entry) => GENERATION_ONE_GAMES.includes(entry.game)))
)
secret(
  { id: 'secret-pokemon-day', tier: 'silver', glyph: 'calendar' },
  [],
  (ctx) => {
    for (const day of ctx.index.byDay.keys()) if (day.endsWith(POKEMON_DAY)) return yes(true)
    return yes(false)
  }
)
secret(
  { id: 'secret-identity-crisis', tier: 'silver', glyph: 'tag' },
  [],
  (ctx) => yes(ctx.index.misnamed > 0)
)
secret(
  { id: 'secret-shiny-alpha', tier: 'gold', glyph: 'alpha' },
  [],
  (ctx) => yes(ctx.index.shinyAlpha > 0)
)

// ---------------------------------------------------------------- exports

/** Every achievement, grouped by category in `ACHIEVEMENT_CATEGORIES` order. */
export const ACHIEVEMENTS: readonly AchievementDef[] = ACHIEVEMENT_CATEGORIES.flatMap((category) => defs.filter((def) => def.category === category.id))

export const ACHIEVEMENT_BY_ID: ReadonlyMap<string, AchievementDef> = new Map(ACHIEVEMENTS.map((def) => [def.id, def]))
