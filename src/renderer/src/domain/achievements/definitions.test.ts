import { describe, expect, it } from 'vitest'
import { ACHIEVEMENT_BY_ID, ACHIEVEMENT_CATEGORIES, ACHIEVEMENTS, CATEGORY_BY_ID } from './definitions'
import { RANKS } from './engine'
import { TIER_ORDER, TIER_POINTS, type AchievementGlyph } from './types'

/** Words that belong to the code, not to the user. */
const INTERNAL_TERMS = /pkhex|form index|slot key|gameidx|\bslug\b|\bundefined\b|\bnull\b|\bNaN\b/i

describe('achievement definitions', () => {
  it('defines at least 150 achievements', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(150)
  })

  it('gives every achievement a unique, stable-looking id', () => {
    const ids = ACHIEVEMENTS.map((def) => def.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) {
      // Lower-case words and numbers joined by single hyphens: nothing generated from an index or a display name.
      expect(id, id).toMatch(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/)
      expect(id.length, id).toBeLessThanOrEqual(40)
      expect(ACHIEVEMENT_BY_ID.get(id)?.id).toBe(id)
    }
  })

  it('never renames an id: the list matches the recorded one', () => {
    // Ids are stored in save files. Adding achievements updates this snapshot; a changed or
    // missing line means an existing id was renamed or dropped, which loses users' unlocks.
    expect([...ACHIEVEMENTS.map((def) => def.id)].sort()).toMatchSnapshot()
  })

  it('awards points by tier and uses every tier', () => {
    for (const def of ACHIEVEMENTS) {
      expect(TIER_ORDER, def.id).toContain(def.tier)
      expect(def.points, def.id).toBe(TIER_POINTS[def.tier])
    }
    for (const tier of TIER_ORDER) expect(ACHIEVEMENTS.some((def) => def.tier === tier), tier).toBe(true)
    expect(TIER_ORDER.map((tier) => TIER_POINTS[tier])).toEqual([...TIER_ORDER.map((tier) => TIER_POINTS[tier])].sort((a, b) => a - b))
  })

  it('files every achievement under a known category, grouped in category order', () => {
    const order = ACHIEVEMENT_CATEGORIES.map((category) => category.id)
    expect(new Set(order).size).toBe(order.length)
    for (const category of ACHIEVEMENT_CATEGORIES) {
      expect(ACHIEVEMENTS.filter((def) => def.category === category.id).length, category.id).toBeGreaterThanOrEqual(8)
      expect(CATEGORY_BY_ID.get(category.id)).toBe(category)
      expect(category.name.trim()).not.toBe('')
      expect(category.description).toMatch(/\.$/)
    }
    const positions = ACHIEVEMENTS.map((def) => order.indexOf(def.category))
    expect(positions.every((p) => p >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })

  it('writes plain, complete copy with unique titles', () => {
    const titles = ACHIEVEMENTS.map((def) => def.title)
    expect(new Set(titles).size).toBe(titles.length)
    for (const def of ACHIEVEMENTS) {
      expect(def.title.trim(), def.id).toBe(def.title)
      expect(def.title.length, def.id).toBeGreaterThan(2)
      expect(def.title.length, def.id).toBeLessThanOrEqual(44)
      expect(def.description, def.id).toMatch(/^[A-Z].*\.$/)
      expect(def.description.length, def.id).toBeLessThanOrEqual(150)
      expect(`${def.title} ${def.description} ${def.hint ?? ''}`, def.id).not.toMatch(INTERNAL_TERMS)
    }
  })

  it('gives every secret achievement a hint that does not give the answer away, and only secrets have hints', () => {
    const secrets = ACHIEVEMENTS.filter((def) => def.secret)
    expect(secrets.length).toBeGreaterThanOrEqual(5)
    for (const def of ACHIEVEMENTS) {
      if (def.secret) {
        expect(def.category, def.id).toBe('secrets')
        expect(def.hint, def.id).toMatch(/^[A-Z].*\.$/)
        expect(def.hint, def.id).not.toBe(def.description)
      } else {
        expect(def.hint, def.id).toBeUndefined()
        expect(def.category, def.id).not.toBe('secrets')
      }
    }
  })

  it('pairs a pool with a test, and marks whole-set achievements', () => {
    for (const def of ACHIEVEMENTS) {
      expect(def.pool === undefined, def.id).toBe(def.test === undefined)
      if (def.whole !== undefined) expect(def.pool, def.id).toBeDefined()
    }
    expect(ACHIEVEMENTS.filter((def) => def.pool).length).toBeGreaterThan(80)
  })

  it('covers the brief: milestones, regions, types, version pairs, balls and ways to play', () => {
    const has = (id: string): boolean => ACHIEVEMENT_BY_ID.has(id)
    for (const n of [1, 10, 50, 100, 151, 250, 386, 500, 750, 1000]) expect(has(`species-${n}`), `species-${n}`).toBe(true)
    for (const id of ['species-all', 'living-dex-complete', 'shiny-1', 'shiny-10', 'shiny-25', 'shiny-50', 'shiny-100', 'shiny-starter', 'shiny-legendary', 'shiny-all']) expect(has(id), id).toBe(true)
    for (const region of ['kanto', 'johto', 'hoenn', 'sinnoh', 'unova', 'kalos', 'alola', 'galar', 'paldea']) {
      expect(has(`region-${region}-half`) && has(`region-${region}-all`) && has(`starters-${region}`), region).toBe(true)
    }
    expect(ACHIEVEMENTS.filter((def) => def.category === 'types')).toHaveLength(18)
    expect(ACHIEVEMENTS.filter((def) => def.id.startsWith('pair-'))).toHaveLength(16)
    for (const id of ['games-3', 'games-10', 'games-20', 'games-all', 'systems-all', 'generations-all', 'game-50', 'game-150']) expect(has(id), id).toBe(true)
    for (const id of ['balls-5', 'balls-10', 'balls-20', 'balls-apricorn', 'balls-hisui', 'ball-safari', 'ball-sport', 'ball-dream', 'ball-beast', 'ball-master', 'ball-cherish']) expect(has(id), id).toBe(true)
    for (const id of ['forms-unown', 'forms-vivillon', 'forms-alcremie-creams', 'forms-alcremie-all', 'forms-arceus', 'forms-silvally', 'forms-rotom', 'forms-deoxys', 'forms-furfrou', 'forms-flabebe', 'forms-minior', 'forms-oricorio']) expect(has(id), id).toBe(true)
    for (const id of ['forms-alolan', 'forms-galarian', 'forms-hisuian', 'forms-paldean', 'genders-all', 'gmax-all', 'mega-all']) expect(has(id), id).toBe(true)
    for (const id of ['starters-all', 'eeveelutions', 'legend-birds', 'legend-beasts', 'legend-titans', 'legend-lake-guardians', 'legend-creation-trio', 'legend-tao-trio', 'legend-swords-of-justice', 'legend-forces-of-nature', 'legend-guardian-deities', 'legend-box-art']) expect(has(id), id).toBe(true)
    for (const id of ['legendary-all', 'mythical-all', 'pseudo-legendary-all', 'fossils-all', 'babies-all', 'ultra-beasts-all', 'paradox-ancient', 'paradox-future']) expect(has(id), id).toBe(true)
    for (const id of ['evolved-1', 'bred-1', 'trade-1', 'raid-1', 'tera-1', 'shadow-1', 'walker-1', 'event-1', 'alpha-1']) expect(has(id), id).toBe(true)
    for (const id of ['same-species-3-games', 'same-species-5-games', 'same-species-10-games', 'families-5', 'families-25', 'families-100', 'families-all', 'streak-7', 'day-10']) expect(has(id), id).toBe(true)
    for (const id of ['secret-golden-magikarp', 'secret-pikachu-ten-games', 'secret-master-ball-common']) expect(has(id), id).toBe(true)
  })

  it('uses a known glyph on every achievement and category', () => {
    const glyphs = new Set<AchievementGlyph>([...ACHIEVEMENTS.map((def) => def.glyph), ...ACHIEVEMENT_CATEGORIES.map((category) => category.glyph)])
    expect(glyphs.size).toBeGreaterThan(20)
    for (const def of ACHIEVEMENTS) if (def.accent !== undefined) expect(def.accent, def.id).toMatch(/^(var\(--type-[a-z]+\)|#[0-9a-f]{6})$/)
  })
})

describe('ranks', () => {
  it('has about eight ranks, from Novice Collector to Living Dex Master, in rising order', () => {
    expect(RANKS.length).toBeGreaterThanOrEqual(7)
    expect(RANKS.length).toBeLessThanOrEqual(9)
    expect(RANKS[0]).toEqual({ name: 'Novice Collector', at: 0 })
    expect(RANKS[RANKS.length - 1]?.name).toBe('Living Dex Master')
    for (let i = 1; i < RANKS.length; i++) expect(RANKS[i]!.at).toBeGreaterThan(RANKS[i - 1]!.at)
    expect(new Set(RANKS.map((rank) => rank.name)).size).toBe(RANKS.length)
  })

  it('keeps the top rank a real challenge that is still within reach', () => {
    const max = ACHIEVEMENTS.reduce((sum, def) => sum + def.points, 0)
    const top = RANKS[RANKS.length - 1]!.at
    expect(top).toBeLessThanOrEqual(max * 0.9)
    expect(top).toBeGreaterThanOrEqual(max * 0.5)
  })
})
