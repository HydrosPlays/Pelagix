/** Keeps the hand-made development fixture honest: it must satisfy every invariant dex-types.ts states. */

import { describe, expect, it } from 'vitest'
import { BALL_BY_ID } from '@shared/balls'
import type { EncounterKind, FormCategory, TypeId } from '@shared/dex-types'
import { GAME_BY_ID } from '@shared/games'
import { POKEAPI_COMMIT, SPRITES_COMMIT } from '@shared/sprites'
import { fixtureDetails, fixtureDex as dex, fixtureIndex } from './test-fixture'

const TYPES: ReadonlySet<TypeId> = new Set([
  'normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel', 'fire', 'water', 'grass', 'electric', 'psychic', 'ice',
  'dragon', 'dark', 'fairy', 'stellar'
])
const CATEGORIES: ReadonlySet<FormCategory> = new Set(['base', 'regional', 'gender', 'cosmetic', 'changeable', 'fusion', 'event', 'partner', 'mega', 'battle', 'hidden'])
const KINDS: ReadonlySet<EncounterKind> = new Set(['wild', 'static', 'gift', 'egg', 'trade', 'raid', 'tera', 'outbreak', 'shadow', 'walker', 'dream', 'event'])
const SPRITE_KEY = /^[a-z0-9-]+$/

const gameCount = fixtureIndex.games.length
const validGames = (list: number[]): boolean => list.every((g) => Number.isInteger(g) && g >= 0 && g < gameCount) && new Set(list).size === list.length
const allForms = dex.speciesList.flatMap((s) => s.forms.map((f) => ({ s, f })))

describe('fixture index', () => {
  it('pins the same commits as the app and counts itself correctly', () => {
    expect(fixtureIndex.meta.spritesCommit).toBe(SPRITES_COMMIT)
    expect(fixtureIndex.meta.pokeapiCommit).toBe(POKEAPI_COMMIT)
    expect(fixtureIndex.meta.counts.species).toBe(fixtureIndex.species.length)
    expect(fixtureIndex.meta.counts.forms).toBe(allForms.length)
    const rows = [...fixtureDetails.values()].reduce((n, d) => n + Object.values(d.forms).reduce((m, f) => m + f.rows.length, 0), 0)
    expect(fixtureIndex.meta.counts.rows).toBe(rows)
    expect(Number.isNaN(Date.parse(fixtureIndex.meta.builtAt))).toBe(false)
  })

  it('lists only known games, each with a list of real balls', () => {
    expect(fixtureIndex.games.every((id) => GAME_BY_ID.has(id))).toBe(true)
    expect(new Set(fixtureIndex.games).size).toBe(gameCount)
    expect(fixtureIndex.gameBalls).toHaveLength(gameCount)
    expect(fixtureIndex.gameBalls.flat().every((b) => BALL_BY_ID.has(b))).toBe(true)
  })

  it('keeps species in national dex order with unique ids and slugs', () => {
    const ids = fixtureIndex.species.map((s) => s.id)
    expect(ids).toEqual([...ids].sort((a, b) => a - b))
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(fixtureIndex.species.map((s) => s.slug)).size).toBe(ids.length)
    for (const s of fixtureIndex.species) {
      expect(s.gen >= 1 && s.gen <= 9, s.name).toBe(true)
      expect(s.genderRate >= -1 && s.genderRate <= 8, s.name).toBe(true)
      expect(s.genus).toMatch(/ Pokémon$/)
    }
  })

  it('gives every species a base form at index 0 and forms in index order', () => {
    for (const s of fixtureIndex.species) {
      expect(s.forms[0], s.name).toMatchObject({ f: 0, cat: 'base' })
      expect(s.forms.map((f) => f.f), s.name).toEqual(s.forms.map((_, i) => i))
      expect(s.forms.slice(1).every((f) => f.cat !== 'base'), s.name).toBe(true)
    }
  })

  it('keeps every form well-formed', () => {
    for (const { s, f } of allForms) {
      const where = `${s.name} form ${f.f}`
      expect(CATEGORIES.has(f.cat), where).toBe(true)
      expect(f.types.length >= 1 && f.types.length <= 2 && f.types.every((t) => TYPES.has(t)), where).toBe(true)
      expect(f.sprite, where).toMatch(SPRITE_KEY)
      expect(f.full, where).not.toBe('')
      expect(typeof f.shiny === 'boolean' && typeof f.female === 'boolean', where).toBe(true)
      if (f.gmax !== undefined) expect(f.gmax, where).toMatch(SPRITE_KEY)
      if (f.gender !== undefined) expect(['m', 'f'], where).toContain(f.gender)
      if (f.region !== undefined) expect(f.cat, where).toBe('regional')
      if (f.female) expect(s.genderDiff, where).toBe(true)
      for (const v of f.variants ?? []) expect(v.sprite, where).toMatch(SPRITE_KEY)
      if (f.variants) expect(new Set(f.variants.map((v) => v.id)).size, where).toBe(f.variants.length)
    }
  })

  it('keeps obtain and event disjoint and inside present', () => {
    for (const { s, f } of allForms) {
      const where = `${s.name} form ${f.f}`
      expect(validGames(f.present) && validGames(f.obtain) && validGames(f.event), where).toBe(true)
      expect(f.obtain.every((g) => f.present.includes(g)), where).toBe(true)
      expect(f.event.every((g) => f.present.includes(g)), where).toBe(true)
      expect(f.obtain.some((g) => f.event.includes(g)), where).toBe(false)
      expect(f.present.length, where).toBeGreaterThan(0)
    }
  })

  it('exercises every form category and special case the app handles', () => {
    const cats = new Set(allForms.map((x) => x.f.cat))
    expect([...cats].sort()).toEqual([...CATEGORIES].sort())
    expect(allForms.some((x) => x.f.approx)).toBe(true)
    expect(allForms.some((x) => !x.f.shiny)).toBe(true)
    expect(allForms.some((x) => x.f.female)).toBe(true)
    expect(allForms.some((x) => x.f.gmax)).toBe(true)
    expect(allForms.some((x) => x.f.variants)).toBe(true)
    expect(allForms.some((x) => x.f.gender === 'f')).toBe(true)
    expect(allForms.some((x) => x.f.event.length > 0 && x.f.cat === 'base')).toBe(true)
    expect(allForms.some((x) => x.f.go === 1) && allForms.some((x) => x.f.go === 2) && allForms.some((x) => x.f.go === undefined)).toBe(true)
    expect(allForms.some((x) => x.f.sprite !== String(x.s.id) && x.f.f === 0)).toBe(true) // Vivillon: base form is not the species tile
    expect(dex.speciesList.some((s) => s.genderRate === -1) && dex.speciesList.some((s) => s.genderRate === 8)).toBe(true)
  })
})

describe('fixture species details', () => {
  it('has one file per species, with one entry per form', () => {
    expect([...fixtureDetails.keys()].sort((a, b) => a - b)).toEqual(dex.speciesList.map((s) => s.id))
    for (const s of dex.speciesList) {
      const d = fixtureDetails.get(s.id)!
      expect(Object.keys(d.forms).map(Number).sort((a, b) => a - b), s.name).toEqual(s.forms.map((f) => f.f))
      expect(d.flavor.length, s.name).toBeGreaterThan(20)
      expect(d.height > 0 && d.weight > 0, s.name).toBe(true)
      expect(d.dex.national, s.name).toBe(s.id)
    }
  })

  it('keeps every encounter row valid and inside the games the form is present in', () => {
    const kinds = new Set<string>()
    for (const s of dex.speciesList) {
      const d = fixtureDetails.get(s.id)!
      for (const f of s.forms) {
        const detail = d.forms[String(f.f)]!
        for (const row of detail.rows) {
          const where = `${s.name} form ${f.f} ${row.k} ${row.m ?? ''}`
          kinds.add(row.k)
          expect(KINDS.has(row.k), where).toBe(true)
          expect(row.g.length > 0 && validGames(row.g), where).toBe(true)
          expect(row.g.every((g) => f.present.includes(g)), where).toBe(true)
          expect(row.g.every((g) => f.obtain.includes(g) || f.event.includes(g)), where).toBe(true)
          expect(row.lv).toHaveLength(2)
          expect(row.lv[0] <= row.lv[1] && row.lv[0] >= 0 && row.lv[1] <= 100, where).toBe(true)
          if (row.l !== undefined) expect(typeof d.strings[row.l], where).toBe('string')
          if (row.b !== undefined) expect(BALL_BY_ID.has(row.b), where).toBe(true)
          if (row.d !== undefined) expect([0, 1, 2], where).toContain(row.d)
          if (row.s !== undefined) expect(['locked', 'forced'], where).toContain(row.s)
          if (row.k !== 'event') expect(row.g.every((g) => f.obtain.includes(g)), where).toBe(true)
        }
        expect(validGames(detail.breed) && detail.breed.every((g) => f.obtain.includes(g)), s.name).toBe(true)
        for (const e of detail.evolve) {
          expect(dex.form(e.from[0], e.from[1]), `${s.name} evolves from ${e.from.join(':')}`).toBeDefined()
          expect(e.g.length > 0 && validGames(e.g), s.name).toBe(true)
          expect(e.g.every((g) => f.obtain.includes(g) || f.event.includes(g)), `${s.name} form ${f.f} evolve games`).toBe(true)
          expect(e.how, s.name).not.toBe('')
        }
      }
      expect(new Set(d.strings).size, s.name).toBe(d.strings.length)
    }
    // Enough variety to build the encounter UI against.
    for (const kind of ['wild', 'static', 'gift', 'egg', 'trade', 'raid', 'tera', 'walker', 'event']) expect(kinds.has(kind), kind).toBe(true)
  })

  it('only references species and forms that exist in the fixture', () => {
    for (const s of dex.speciesList) {
      const d = fixtureDetails.get(s.id)!
      expect(d.family.some((n) => n.s === s.id), s.name).toBe(true)
      expect(d.family[0]?.from, s.name).toBeUndefined()
      for (const node of d.family) {
        expect(dex.form(node.s, node.f), `${s.name} family ${node.s}:${node.f}`).toBeDefined()
        if (node.from) expect(dex.form(node.from[0], node.from[1]), s.name).toBeDefined()
      }
    }
  })

  it('gives every event-only game of a catchable form an event row', () => {
    for (const s of dex.speciesList) {
      const d = fixtureDetails.get(s.id)!
      for (const f of s.forms) {
        if (f.cat === 'changeable' || f.cat === 'battle') continue // reached by changing the form of an event Pokémon
        const eventRowGames = new Set(d.forms[String(f.f)]!.rows.filter((r) => r.k === 'event').flatMap((r) => r.g))
        expect(f.event.every((g) => eventRowGames.has(g)), `${s.name} form ${f.f}`).toBe(true)
      }
    }
  })
})
