import { describe, expect, it } from 'vitest'
import { BALLS } from '@shared/balls'
import type { DexIndex } from '@shared/dex-types'
import { GAMES } from '@shared/games'
import { DEFAULT_RULES, type CatchEntry, type DexRules, type EntryKind } from '@shared/save-types'
import { Dex, validateDexIndex } from '@renderer/lib/data'
import { addDays, ENTRY_KINDS } from '@renderer/lib/format'
import { fixtureDex, ID, makeEntry } from '@renderer/lib/test-fixture'
import { buildSlots, RULE_PRESETS, slotTarget } from '../slots'
import { ACHIEVEMENT_BY_ID, ACHIEVEMENTS, missingItems } from './definitions'
import { buildContext, categoryStats, evaluateAll, evaluateFor, nearestLocked, newlyDone, rankFor, rankProgress, RANKS, summarize } from './engine'
import { dexFacts } from './facts'
import type { AchievementState } from './types'

const indexModules = import.meta.glob<DexIndex>('../../../public/data/dex.json', { eager: true, import: 'default' })
const raw = Object.values(indexModules)[0]
const NOW = new Date(2026, 9, 9, 12)
const MAIN_GAME_IDS = GAMES.filter((game) => game.kind === 'main').map((game) => game.id)

function evaluate(dex: Dex, entries: CatchEntry[], rules: DexRules = DEFAULT_RULES): Map<string, AchievementState> {
  return new Map(evaluateAll(buildContext(dex, entries, rules, NOW)).map((state) => [state.id, state]))
}

/**
 * A save that should satisfy every achievement: one shiny entry for every slot of the
 * completionist Living Dex, spread over all games, balls, kinds and 130 consecutive days, plus the
 * handful of special catches the secret achievements ask for.
 */
function perfectEntries(dex: Dex): CatchEntry[] {
  // Three "evolved" and three "bred" per cycle, so both pass 100 alongside every other kind.
  const cycle: EntryKind[] = [...ENTRY_KINDS.filter((kind) => kind !== 'wild'), 'evolved', 'evolved', 'bred', 'bred']
  const entries = buildSlots(dex, RULE_PRESETS.completionist.rules).map((slot, n) =>
    makeEntry(slot.species, slot.form, {
      ...slotTarget(slot),
      shiny: true,
      game: n < 160 ? 'scarlet' : MAIN_GAME_IDS[n % MAIN_GAME_IDS.length]!,
      kind: n < 520 ? 'wild' : cycle[n % cycle.length]!,
      ball: BALLS[n % BALLS.length]!.id,
      date: n < 60 ? '2021-01-01' : addDays('2021-03-01', n % 130),
      alpha: n % 3 === 0,
      level: n % 5 === 0 ? 100 : 50,
      ...(n % 7 === 0 && { nickname: 'Buddy' })
    })
  )
  for (const game of MAIN_GAME_IDS.slice(0, 10)) entries.push(makeEntry(25, 0, { game }))
  for (const game of ['colosseum', 'xd', 'go']) entries.push(makeEntry(133, 0, { game }))
  entries.push(
    makeEntry(10, 0, { ball: 1 }),
    makeEntry(35, 0, { ball: 23 }),
    makeEntry(143, 0, { ball: 20 }),
    makeEntry(113, 0, { ball: 5 }),
    makeEntry(151, 0, { game: 'red', kind: 'event' }),
    makeEntry(1, 0, { date: '2022-02-27' }),
    makeEntry(133, 0, { nickname: 'Pikachu' })
  )
  while (entries.length < 2500) entries.push(makeEntry(1, 0, { date: '2021-01-02' }))
  return entries
}

/** 2,000 varied entries, the same on every run. */
function manyEntries(dex: Dex, count: number): CatchEntry[] {
  let seed = 12345
  const next = (bound: number): number => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed % bound
  }
  const games = GAMES.map((game) => game.id)
  return Array.from({ length: count }, () => {
    const species = dex.speciesList[next(dex.speciesList.length)]!
    const form = species.forms[next(species.forms.length)]!
    return makeEntry(species.id, form.f, {
      shiny: next(8) === 0,
      game: games[next(games.length)]!,
      kind: ENTRY_KINDS[next(ENTRY_KINDS.length)]!,
      ball: BALLS[next(BALLS.length)]!.id,
      gender: (['m', 'f', 'n'] as const)[next(3)],
      date: addDays('2022-01-01', next(900)),
      alpha: next(20) === 0,
      gmax: next(30) === 0,
      ...(form.variants && { variant: form.variants[next(form.variants.length)]!.id }),
      ...(next(10) === 0 && { nickname: 'Nick' })
    })
  })
}

describe.skipIf(!raw)('achievements against the real dataset', () => {
  const dex = raw ? new Dex(validateDexIndex(raw)) : (undefined as never)

  it('supports every achievement: each target is above zero, and nothing is done on an empty save', () => {
    const states = evaluateAll(buildContext(dex, [], DEFAULT_RULES, NOW))
    expect(states).toHaveLength(ACHIEVEMENTS.length)
    for (const state of states) {
      expect(state.available, state.id).toBe(true)
      expect(state.target, state.id).toBeGreaterThan(0)
      expect(Number.isInteger(state.target), state.id).toBe(true)
      expect(state.current, state.id).toBe(0)
      expect(state.done, state.id).toBe(false)
      expect(state.ratio, state.id).toBe(0)
    }
  })

  it('asks for sets that exist: a pool is never empty, and a whole-set target is the size of its set', () => {
    const facts = dexFacts(dex)
    const states = evaluate(dex, [])
    for (const def of ACHIEVEMENTS) {
      if (!def.pool) continue
      const pool = def.pool(facts)
      const target = states.get(def.id)!.target
      expect(pool.length, def.id).toBeGreaterThan(0)
      if (def.whole) expect(target, def.id).toBe(pool.length)
      else expect(target, def.id).toBeLessThanOrEqual(pool.length)
      for (const item of pool) {
        expect(dex.species(item.species), `${def.id}: ${item.label}`).toBeDefined()
        if (item.form !== undefined) expect(dex.form(item.species, item.form), `${def.id}: ${item.label}`).toBeDefined()
        expect(item.label.trim(), def.id).not.toBe('')
      }
    }
  })

  it('keeps the numeric targets within what the games offer', () => {
    const states = evaluate(dex, [])
    const target = (id: string): number => states.get(id)!.target
    expect(target('species-all')).toBe(dex.speciesList.length)
    expect(target('species-1000')).toBeLessThanOrEqual(dex.speciesList.length)
    expect(target('games-all')).toBe(MAIN_GAME_IDS.length)
    expect(target('games-20')).toBeLessThanOrEqual(MAIN_GAME_IDS.length)
    expect(target('systems-all')).toBe(6)
    expect(target('generations-all')).toBe(9)
    expect(target('balls-all')).toBe(BALLS.length)
    expect(target('balls-apricorn')).toBe(7)
    expect(target('balls-hisui')).toBe(10)
    expect(target('kinds-10')).toBeLessThanOrEqual(ENTRY_KINDS.length)
    expect(target('region-kanto-all')).toBe(151)
    expect(target('region-kanto-half')).toBe(76)
    expect(target('living-dex-complete')).toBe(buildSlots(dex, DEFAULT_RULES).length)
    expect(target('families-all')).toBe(dexFacts(dex).families.size)
    expect(target('forms-alcremie-all')).toBe(63)
    expect(target('genders-all')).toBe(102)
  })

  it('can all be earned: a complete collection unlocks every achievement', () => {
    const states = evaluate(dex, perfectEntries(dex))
    const open = [...states.values()].filter((state) => !state.done).map((state) => `${state.id} ${state.current}/${state.target}`)
    expect(open).toEqual([])
  })

  it('evaluates 2,000 entries well under 50 ms', () => {
    const entries = manyEntries(dex, 2000)
    buildContext(dex, entries.slice(0, 50), DEFAULT_RULES, NOW) // warms the per-Dex caches
    const times: number[] = []
    for (let run = 0; run < 7; run++) {
      const fresh = entries.slice() // a new array identity, so nothing comes from a cache
      const start = performance.now()
      const states = evaluateAll(buildContext(dex, fresh, DEFAULT_RULES, NOW))
      times.push(performance.now() - start)
      expect(states).toHaveLength(ACHIEVEMENTS.length)
    }
    times.sort((a, b) => a - b)
    expect(times[3]!, `median of ${times.map((t) => t.toFixed(1)).join(', ')} ms`).toBeLessThan(50)
  })

  it('counts species, regions, types and shinies', () => {
    const kanto = Array.from({ length: 76 }, (_, i) => makeEntry(i + 1, 0, { shiny: i < 10 }))
    const states = evaluate(dex, kanto)
    expect(states.get('species-1')).toMatchObject({ current: 76, target: 1, done: true, ratio: 1 })
    expect(states.get('species-50')?.done).toBe(true)
    expect(states.get('species-100')).toMatchObject({ current: 76, target: 100, done: false, ratio: 0.76 })
    expect(states.get('region-kanto-half')?.done).toBe(true)
    expect(states.get('region-kanto-all')).toMatchObject({ current: 76, target: 151, done: false })
    expect(states.get('region-johto-half')?.current).toBe(0)
    expect(states.get('shiny-1')?.done).toBe(true)
    expect(states.get('shiny-10')?.done).toBe(true)
    expect(states.get('shiny-25')).toMatchObject({ current: 10, done: false })
    expect(states.get('shiny-starter')?.done).toBe(true)
    expect(states.get('shiny-legendary')?.done).toBe(false)
    expect(states.get('starters-kanto')?.done).toBe(true)
    expect(states.get('starters-johto')?.done).toBe(false)
    // Bulbasaur to Venusaur: three shiny members of one family.
    expect(states.get('shiny-family')?.done).toBe(true)
    expect(states.get('families-5')?.done).toBe(true)
    expect(states.get('type-fire-all')!.current).toBeGreaterThan(0)
    expect(states.get('type-fire-all')!.done).toBe(false)
  })

  it('counts a species once however many entries or forms it has', () => {
    const states = evaluate(dex, [makeEntry(26, 0), makeEntry(26, 1), makeEntry(26, 0, { shiny: true }), makeEntry(26, 1, { shiny: true })])
    expect(states.get('species-10')?.current).toBe(1)
    expect(states.get('shiny-10')?.current).toBe(1)
    expect(states.get('forms-alolan')?.current).toBe(1)
    expect(states.get('entries-100')?.current).toBe(4)
  })

  it('judges form sets on the logged form, whatever the rules say', () => {
    const letters = Array.from({ length: 28 }, (_, form) => makeEntry(201, form))
    const speciesOnly = RULE_PRESETS.species.rules
    expect(evaluate(dex, letters, speciesOnly).get('forms-unown')).toMatchObject({ current: 28, target: 28, done: true })
    expect(evaluate(dex, letters.slice(0, 27), speciesOnly).get('forms-unown')).toMatchObject({ current: 27, done: false })
    expect(evaluate(dex, letters, speciesOnly).get('species-10')?.current).toBe(1)

    const rotom = [1, 2, 3, 4, 5].map((form) => makeEntry(479, form))
    expect(evaluate(dex, rotom).get('forms-rotom')?.done).toBe(true)
    // The base form is not an appliance.
    expect(evaluate(dex, [makeEntry(479, 0), ...rotom.slice(1)]).get('forms-rotom')).toMatchObject({ current: 4, done: false })
    // Hidden and battle-only forms never count: Arceus needs its 18 types, not the "Legend" form.
    expect(evaluate(dex, Array.from({ length: 18 }, (_, form) => makeEntry(493, form + 1))).get('forms-arceus')).toMatchObject({ current: 17, target: 18 })
  })

  it('tracks Alcremie by cream and by cream-and-sweet combination', () => {
    const creams = Array.from({ length: 9 }, (_, form) => makeEntry(869, form, { variant: 0 }))
    const states = evaluate(dex, creams)
    expect(states.get('forms-alcremie-creams')?.done).toBe(true)
    expect(states.get('forms-alcremie-all')).toMatchObject({ current: 9, target: 63, done: false })
    // An entry without a sweet, or with one the data does not know, is a cream but not a combination.
    expect(evaluate(dex, [makeEntry(869, 0), makeEntry(869, 1, { variant: 99 })]).get('forms-alcremie-all')?.current).toBe(0)
  })

  it('needs both genders for a gender pair, and takes the gender from the form when the form is the gender', () => {
    expect(evaluate(dex, [makeEntry(25, 0, { gender: 'm' })]).get('genders-10')?.current).toBe(0)
    expect(evaluate(dex, [makeEntry(25, 0, { gender: 'm' }), makeEntry(25, 0, { gender: 'f' })]).get('genders-10')?.current).toBe(1)
    expect(evaluate(dex, [makeEntry(678, 0), makeEntry(678, 1)]).get('genders-10')?.current).toBe(1)
    // Rattata's genders differ; Bulbasaur's do not.
    expect(evaluate(dex, [makeEntry(1, 0, { gender: 'm' }), makeEntry(1, 0, { gender: 'f' })]).get('genders-10')?.current).toBe(0)
  })

  it('counts Gigantamax looks and Mega Evolutions only when they are logged as such', () => {
    const states = evaluate(dex, [makeEntry(6, 0, { gmax: true }), makeEntry(869, 0, { gmax: true }), makeEntry(869, 3, { gmax: true }), makeEntry(25, 0), makeEntry(1, 0, { gmax: true }), makeEntry(6, 1)])
    expect(states.get('gmax-1')?.done).toBe(true)
    // Charizard and Alcremie (every cream shares one look); Bulbasaur cannot Gigantamax.
    expect(states.get('gmax-10')?.current).toBe(2)
    expect(states.get('mega-1')?.done).toBe(true)
    expect(states.get('mega-10')?.current).toBe(1)
  })

  it('counts games, version pairs, systems and generations from main-series games only', () => {
    const states = evaluate(dex, [
      makeEntry(1, 0, { game: 'red' }),
      makeEntry(4, 0, { game: 'blue' }),
      makeEntry(7, 0, { game: 'sword' }),
      makeEntry(10, 0, { game: 'shield' }),
      makeEntry(13, 0, { game: 'go' }),
      makeEntry(16, 0, { game: 'colosseum' }),
      makeEntry(19, 0, { game: 'a-game-from-the-future' })
    ])
    expect(states.get('games-3')).toMatchObject({ current: 4, done: true })
    expect(states.get('pair-swsh')).toMatchObject({ current: 2, target: 2, done: true })
    expect(states.get('pair-rgb')).toMatchObject({ current: 2, target: 3, done: false })
    expect(states.get('pairs-all')?.current).toBe(1)
    expect(states.get('systems-all')?.current).toBe(2)
    expect(states.get('generations-all')?.current).toBe(2)
    expect(states.get('game-go')?.done).toBe(true)
    expect(states.get('games-orre')).toMatchObject({ current: 1, done: false })
    expect(states.get('entries-100')?.current).toBe(7)
  })

  it('counts balls, including the Apricorn and Hisuian sets, and ignores unknown ball ids', () => {
    const apricorn = BALLS.filter((ball) => ball.family === 'apricorn')
    const states = evaluate(dex, [...apricorn.map((ball) => makeEntry(1, 0, { ball: ball.id })), makeEntry(1, 0, { ball: 1 }), makeEntry(1, 0, { ball: 999 }), makeEntry(1, 0)])
    expect(states.get('balls-apricorn')?.done).toBe(true)
    expect(states.get('balls-5')).toMatchObject({ current: 8, done: true })
    expect(states.get('balls-10')?.done).toBe(false)
    expect(states.get('ball-master')?.done).toBe(true)
    expect(states.get('ball-safari')?.done).toBe(false)
    expect(states.get('balls-hisui')?.current).toBe(0)
  })

  it('counts the ways of getting Pokémon, alphas, nicknames and level 100s', () => {
    const states = evaluate(dex, [
      makeEntry(2, 0, { kind: 'evolved', origin: [1, 0] }),
      makeEntry(172, 0, { kind: 'bred' }),
      makeEntry(133, 0, { kind: 'gift' }),
      makeEntry(175, 0, { kind: 'egg' }),
      makeEntry(197, 0, { kind: 'shadow', game: 'colosseum' }),
      makeEntry(25, 0, { kind: 'walker', game: 'heartgold', alpha: true, level: 100, nickname: 'Sparky' })
    ])
    for (const id of ['evolved-1', 'bred-1', 'gift-1', 'shadow-1', 'walker-1', 'alpha-1', 'level-100-1', 'kinds-5']) expect(states.get(id)?.done, id).toBe(true)
    expect(states.get('gift-10')?.current).toBe(2)
    expect(states.get('kinds-10')?.current).toBe(6)
    expect(states.get('nicknamed-10')?.current).toBe(1)
    expect(states.get('trade-1')?.done).toBe(false)
    expect(states.get('wild-10')?.current).toBe(0)
  })

  it('rewards the same Pokémon from many games, complete families, streaks and big days', () => {
    const pikachu = MAIN_GAME_IDS.slice(0, 5).map((game, i) => makeEntry(25, 0, { game, date: addDays('2025-05-01', i) }))
    const states = evaluate(dex, [...pikachu, makeEntry(25, 0, { game: 'not-a-game', date: '2025-05-01' }), makeEntry(172, 0, { date: '2025-05-01' }), makeEntry(26, 0, { date: '2025-05-01' })])
    expect(states.get('same-species-5-games')).toMatchObject({ current: 5, done: true })
    expect(states.get('same-species-10-games')?.done).toBe(false)
    expect(states.get('secret-pikachu-ten-games')).toMatchObject({ current: 5, target: 10, done: false })
    expect(states.get('families-5')?.current).toBe(1)
    expect(states.get('streak-3')?.done).toBe(true)
    expect(states.get('streak-7')).toMatchObject({ current: 5, done: false })
    expect(states.get('day-10')?.current).toBe(4)
    expect(states.get('days-30')?.current).toBe(5)
  })

  it('unlocks the secret achievements on exactly their conditions', () => {
    const done = (entries: CatchEntry[], id: string): boolean => evaluate(dex, entries).get(id)!.done
    expect(done([makeEntry(129, 0, { shiny: true })], 'secret-golden-magikarp')).toBe(true)
    expect(done([makeEntry(129, 0), makeEntry(130, 0, { shiny: true })], 'secret-golden-magikarp')).toBe(false)
    expect(done([makeEntry(16, 0, { ball: 1 })], 'secret-master-ball-common')).toBe(true)
    expect(done([makeEntry(150, 0, { ball: 1 }), makeEntry(16, 0, { ball: 2 })], 'secret-master-ball-common')).toBe(false)
    expect(done([makeEntry(36, 0, { ball: 23 })], 'secret-moon-ball-clefairy')).toBe(true)
    expect(done([makeEntry(36, 0, { ball: 4 })], 'secret-moon-ball-clefairy')).toBe(false)
    expect(done([makeEntry(446, 0, { ball: 34 })], 'secret-heavy-sleeper')).toBe(true)
    expect(done([makeEntry(143, 0, { ball: 19 })], 'secret-heavy-sleeper')).toBe(false)
    expect(done([makeEntry(128, 0, { ball: 5 })], 'secret-safari-rarity')).toBe(true)
    expect(done([makeEntry(151, 0, { game: 'yellow' })], 'secret-under-the-truck')).toBe(true)
    expect(done([makeEntry(151, 0, { game: 'emerald' })], 'secret-under-the-truck')).toBe(false)
    expect(done([makeEntry(1, 0, { date: '2026-02-27' })], 'secret-pokemon-day')).toBe(true)
    expect(done([makeEntry(1, 0, { date: '2026-02-28' })], 'secret-pokemon-day')).toBe(false)
    expect(done([makeEntry(132, 0, { nickname: ' pikachu ' })], 'secret-identity-crisis')).toBe(true)
    expect(done([makeEntry(25, 0, { nickname: 'Pikachu' }), makeEntry(1, 0, { nickname: 'Leafy' })], 'secret-identity-crisis')).toBe(false)
    expect(done([makeEntry(59, 1, { shiny: true, alpha: true })], 'secret-shiny-alpha')).toBe(true)
    expect(done([makeEntry(59, 1, { shiny: true }), makeEntry(58, 1, { alpha: true })], 'secret-shiny-alpha')).toBe(false)
  })

  it('follows the rules only where it says so: the Living Dex achievements', () => {
    const everySpecies = dex.speciesList.map((species) => makeEntry(species.id, 0))
    const bySpecies = evaluate(dex, everySpecies, RULE_PRESETS.species.rules)
    const byForms = evaluate(dex, everySpecies, RULE_PRESETS.forms.rules)
    expect(bySpecies.get('living-dex-complete')).toMatchObject({ current: dex.speciesList.length, target: dex.speciesList.length, done: true })
    expect(byForms.get('living-dex-complete')?.done).toBe(false)
    expect(byForms.get('living-dex-half')?.done).toBe(true)
    expect(byForms.get('species-all')?.done).toBe(true)
    expect(bySpecies.get('species-all')?.done).toBe(true)
    expect(byForms.get('families-all')?.done).toBe(true)
    expect(byForms.get('legendary-all')?.done).toBe(true)
    expect(byForms.get('paradox-ancient')?.done).toBe(true)
    expect(byForms.get('eeveelutions')?.done).toBe(true)
  })

  it('tolerates entries the dataset does not know', () => {
    const states = evaluate(dex, [makeEntry(1400, 0, { game: 'nowhere', ball: 999 }), makeEntry(25, 77), makeEntry(1, 0)])
    expect(states.get('species-10')?.current).toBe(2)
    expect(states.get('entries-100')?.current).toBe(3)
    expect(states.get('games-3')?.current).toBe(1)
  })

  it('lists what a set achievement is still missing, in dex order', () => {
    const ctx = buildContext(dex, [makeEntry(144, 0), makeEntry(201, 0), makeEntry(201, 2)], DEFAULT_RULES, NOW)
    expect(missingItems(ctx, ACHIEVEMENT_BY_ID.get('legend-birds')!)).toEqual({ items: [{ species: 145, label: 'Zapdos' }, { species: 146, label: 'Moltres' }], total: 2 })
    const unown = missingItems(ctx, ACHIEVEMENT_BY_ID.get('forms-unown')!, 3)
    expect(unown.total).toBe(26)
    expect(unown.items.map((item) => item.label)).toEqual(['Unown B', 'Unown D', 'Unown E'])
    expect(missingItems(ctx, ACHIEVEMENT_BY_ID.get('streak-7')!)).toEqual({ items: [], total: 0 })
    const all = missingItems(ctx, ACHIEVEMENT_BY_ID.get('species-all')!)
    expect(all.items).toHaveLength(12)
    expect(all.total).toBe(dex.speciesList.length - 2)
    // A plain count of different Pokémon is not about particular ones.
    expect(ACHIEVEMENT_BY_ID.get('species-100')!.pool).toBeUndefined()
    expect(missingItems(ctx, ACHIEVEMENT_BY_ID.get('species-100')!)).toEqual({ items: [], total: 0 })
  })

  it('summarises points, rank, recent unlocks and nearest goals', () => {
    const entries = Array.from({ length: 9 }, (_, i) => makeEntry(i + 1, 0))
    const states = evaluateAll(buildContext(dex, entries, DEFAULT_RULES, NOW))
    const unlocked = { 'species-1': '2026-10-01T10:00:00.000Z', 'starters-kanto': '2026-10-03T10:00:00.000Z', 'families-5': '2026-10-03T10:00:00.000Z', 'retired-id': '2026-01-01T00:00:00.000Z' }
    const summary = summarize(states, unlocked, { recent: 2, nearest: 4 })
    expect(summary.total).toBe(ACHIEVEMENTS.length)
    expect(summary.maxPoints).toBe(ACHIEVEMENTS.reduce((sum, def) => sum + def.points, 0))
    expect(summary.unlocked).toBe(3)
    expect(summary.points).toBe(30)
    expect(summary.rank).toMatchObject({ name: 'Novice Collector', index: 0, nextAt: RANKS[1]!.at, nextName: RANKS[1]!.name })
    // Newest first; a tie goes to the earlier definition when the tiers match.
    expect(summary.recent.map((r) => r.def.id)).toEqual(['starters-kanto', 'families-5'])
    expect(summary.recent[0]?.date).toBe('2026-10-03T10:00:00.000Z')
    expect(summary.nearest).toHaveLength(4)
    expect(summary.nearest[0]).toMatchObject({ def: { id: 'species-10' }, state: { current: 9, target: 10 } })
    for (const near of summary.nearest) {
      expect(near.def.secret, near.def.id).toBeFalsy()
      expect(Object.hasOwn(unlocked, near.def.id), near.def.id).toBe(false)
      expect(near.state.done, near.def.id).toBe(false)
    }
    for (let i = 1; i < summary.nearest.length; i++) expect(summary.nearest[i]!.state.ratio).toBeLessThanOrEqual(summary.nearest[i - 1]!.state.ratio)
  })

  it('offers varied first goals on an empty save', () => {
    const states = evaluateAll(buildContext(dex, [], DEFAULT_RULES, NOW))
    const nearest = nearestLocked(states, {}, 4)
    expect(nearest).toHaveLength(4)
    expect(nearest.map((near) => near.def.id)).toEqual(['species-1', 'shiny-1', 'games-3', 'balls-5'])
    expect(new Set(nearest.map((near) => near.def.category)).size).toBe(4)
    const summary = summarize(states, {})
    expect(summary).toMatchObject({ unlocked: 0, points: 0, recent: [] })
  })

  it('keeps an achievement unlocked after its entries are gone', () => {
    const states = evaluateAll(buildContext(dex, [], DEFAULT_RULES, NOW))
    const summary = summarize(states, { 'species-1': '2026-10-01T10:00:00.000Z' })
    expect(summary.unlocked).toBe(1)
    expect(summary.points).toBe(10)
    expect(newlyDone(states, {})).toEqual([])
    expect(summary.nearest.some((near) => near.def.id === 'species-1')).toBe(false)
  })

  it('reports what is newly done and never what the save already has', () => {
    const states = evaluateAll(buildContext(dex, [makeEntry(1, 0)], DEFAULT_RULES, NOW))
    expect(newlyDone(states, {})).toEqual(['species-1'])
    expect(newlyDone(states, { 'species-1': '2026-10-01T10:00:00.000Z' })).toEqual([])
  })

  it('reports completion per category', () => {
    const states = evaluateAll(buildContext(dex, [], DEFAULT_RULES, NOW))
    const stats = categoryStats(states, { 'species-1': '2026-10-01T10:00:00.000Z', 'shiny-1': '2026-10-01T10:00:00.000Z', 'shiny-10': '2026-10-01T10:00:00.000Z' })
    expect(stats.reduce((sum, s) => sum + s.total, 0)).toBe(ACHIEVEMENTS.length)
    expect(stats.find((s) => s.category.id === 'milestones')).toMatchObject({ unlocked: 1, points: 10 })
    expect(stats.find((s) => s.category.id === 'shiny')).toMatchObject({ unlocked: 2, points: 35 })
    expect(stats.find((s) => s.category.id === 'types')).toMatchObject({ unlocked: 0, total: 18 })
  })

  it('shares one evaluation per (dex, entries, rules)', () => {
    const entries = [makeEntry(1, 0)]
    const first = evaluateFor(dex, entries, DEFAULT_RULES)
    expect(evaluateFor(dex, entries, DEFAULT_RULES)).toBe(first)
    expect(evaluateFor(dex, [...entries], DEFAULT_RULES)).not.toBe(first)
    expect(first.byId.get('species-1')?.done).toBe(true)
    expect(first.states).toHaveLength(ACHIEVEMENTS.length)
  })
})

describe('achievements on the development fixture', () => {
  it('evaluates without throwing and hides what a small dataset cannot support', () => {
    const entries = [makeEntry(ID.pikachu, 0, { shiny: true }), makeEntry(ID.eevee, 0), makeEntry(1400, 0)]
    const states = evaluateAll(buildContext(fixtureDex, entries, DEFAULT_RULES, NOW))
    expect(states).toHaveLength(ACHIEVEMENTS.length)
    const byId = new Map(states.map((state) => [state.id, state]))
    expect(byId.get('species-1')).toMatchObject({ done: true, available: true })
    expect(byId.get('shiny-1')?.done).toBe(true)
    // 24 species: a thousand different Pokémon is not on offer, and there are no fossils.
    expect(byId.get('species-1000')).toMatchObject({ available: false, done: false, ratio: 0 })
    expect(byId.get('fossils-all')).toMatchObject({ available: false, done: false })
    expect(byId.get('secret-golden-magikarp')?.available).toBe(false)
    for (const state of states) {
      expect(Number.isFinite(state.ratio) && state.ratio >= 0 && state.ratio <= 1, state.id).toBe(true)
      if (!state.available) expect(state.done, state.id).toBe(false)
    }
    const summary = summarize(states, { 'species-1': '2026-10-01T10:00:00.000Z', 'species-1000': '2026-10-01T10:00:00.000Z' })
    expect(summary.total).toBeLessThan(ACHIEVEMENTS.length)
    expect(summary.unlocked).toBe(1)
    expect(summary.maxPoints).toBeLessThan(ACHIEVEMENTS.reduce((sum, def) => sum + def.points, 0))
  })

  it('survives a rule that throws', () => {
    const ctx = buildContext(fixtureDex, [], DEFAULT_RULES, NOW)
    const broken = { ...ACHIEVEMENT_BY_ID.get('species-1')!, id: 'broken', evaluate: () => { throw new Error('boom') } }
    expect(evaluateAll(ctx, [broken])).toEqual([{ id: 'broken', current: 0, target: 0, done: false, ratio: 0, available: false }])
  })
})

describe('rankFor', () => {
  it('moves up exactly at each threshold', () => {
    expect(rankFor(0)).toMatchObject({ index: 0, name: 'Novice Collector', at: 0 })
    for (let i = 1; i < RANKS.length; i++) {
      expect(rankFor(RANKS[i]!.at - 1).index, RANKS[i]!.name).toBe(i - 1)
      expect(rankFor(RANKS[i]!.at)).toMatchObject({ index: i, name: RANKS[i]!.name })
    }
    const top = rankFor(1_000_000)
    expect(top).toMatchObject({ index: RANKS.length - 1, name: 'Living Dex Master', nextAt: null, nextName: null })
  })

  it('measures progress toward the next rank', () => {
    const first = rankFor(0)
    expect(rankProgress(first, 0)).toBe(0)
    expect(rankProgress(first, RANKS[1]!.at / 2)).toBe(0.5)
    const second = rankFor(RANKS[1]!.at)
    expect(rankProgress(second, RANKS[1]!.at)).toBe(0)
    expect(rankProgress(rankFor(1_000_000), 1_000_000)).toBe(1)
  })
})
