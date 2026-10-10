import { describe, expect, it } from 'vitest'
import type { DexRules } from '@shared/save-types'
import { fixtureDex as dex, ID, makeEntry } from '@renderer/lib/test-fixture'
import { boxMarkTargets, computeHomeDex, fillingEntries, filterCount, HOME_FILTERS, homeState, homeStatus, shownEntry, slotPress } from './home'
import { collectionFor, RULE_KEYS } from './slots'

const NONE = Object.fromEntries(RULE_KEYS.map((key) => [key, false])) as unknown as DexRules
const GENDERS: DexRules = { ...NONE, genderDiffs: true }

describe('HOME Dex states and totals', () => {
  it('tells in HOME, caught but not sent, and not caught apart', () => {
    const collection = collectionFor(dex, [makeEntry(ID.bulbasaur, 0, { inHome: true }), makeEntry(ID.ivysaur)], NONE)
    const home = computeHomeDex(collection, false)
    expect(home.states.get('1')).toBe('home')
    expect(home.states.get('2')).toBe('pending')
    expect(home.states.get('3')).toBe('missing')
    expect([...home.inHome]).toEqual(['1'])
    expect(home.states.size).toBe(collection.slots.length)
    expect(home.totals).toEqual({ slots: collection.slots.length, inHome: 1, pending: 1, missing: collection.slots.length - 2 })
  })

  it('has every slot missing in an empty collection', () => {
    const collection = collectionFor(dex, [], NONE)
    expect(computeHomeDex(collection, false).totals).toEqual({ slots: collection.slots.length, inHome: 0, pending: 0, missing: collection.slots.length })
  })

  it('follows the rules: the slots are the Living Dex slots', () => {
    const entries = [makeEntry(ID.pikachu, 0, { gender: 'm', inHome: true }), makeEntry(ID.pikachu, 0, { gender: 'f' })]
    const one = computeHomeDex(collectionFor(dex, entries, NONE), false)
    expect(one.states.get('25')).toBe('home')
    expect(one.totals).toMatchObject({ inHome: 1, pending: 0 })

    const split = computeHomeDex(collectionFor(dex, entries, GENDERS), false)
    expect(split.states.get('25:m')).toBe('home')
    expect(split.states.get('25:f')).toBe('pending')
    expect(split.totals).toMatchObject({ inHome: 1, pending: 1 })
    expect(split.totals.slots).toBeGreaterThan(one.totals.slots)
  })

  it('counts only shiny entries in shiny mode', () => {
    const entries = [makeEntry(ID.bulbasaur, 0, { inHome: true }), makeEntry(ID.bulbasaur, 0, { shiny: true }), makeEntry(ID.ivysaur, 0, { inHome: true }), makeEntry(ID.venusaur, 0, { shiny: true, inHome: true })]
    const collection = collectionFor(dex, entries, NONE)
    const regular = computeHomeDex(collection, false)
    expect(['1', '2', '3'].map((key) => regular.states.get(key))).toEqual(['home', 'home', 'home'])
    const shiny = computeHomeDex(collection, true)
    expect(shiny.shiny).toBe(true)
    expect(['1', '2', '3'].map((key) => shiny.states.get(key))).toEqual(['pending', 'missing', 'home'])
    expect(shiny.totals).toMatchObject({ inHome: 1, pending: 1, missing: collection.slots.length - 2 })
  })

  it('is in HOME as soon as one of several entries is', () => {
    const collection = collectionFor(dex, [makeEntry(ID.eevee), makeEntry(ID.eevee, 0, { inHome: true }), makeEntry(ID.eevee)], NONE)
    expect(fillingEntries(collection, '133', false)).toHaveLength(3)
    expect(homeState(collection, '133', false)).toBe('home')
    expect(homeState(collection, '133', true)).toBe('missing')
  })
})

describe('pressing a slot', () => {
  it('toggles the flag when exactly one entry fills the slot', () => {
    const off = makeEntry(ID.bulbasaur)
    const on = makeEntry(ID.ivysaur, 0, { inHome: true })
    const collection = collectionFor(dex, [off, on], NONE)
    expect(slotPress(collection, '1', false)).toEqual({ kind: 'toggle', entry: off, on: true })
    expect(slotPress(collection, '2', false)).toEqual({ kind: 'toggle', entry: on, on: false })
  })

  it('opens the drawer for several entries and for a slot that is not caught', () => {
    const collection = collectionFor(dex, [makeEntry(ID.eevee), makeEntry(ID.eevee)], NONE)
    expect(slotPress(collection, '133', false)).toEqual({ kind: 'open' })
    expect(slotPress(collection, '150', false)).toEqual({ kind: 'open' })
  })

  it('looks at the shiny entries only in shiny mode', () => {
    const regular = makeEntry(ID.eevee)
    const shiny = makeEntry(ID.eevee, 0, { shiny: true })
    const collection = collectionFor(dex, [regular, shiny, makeEntry(ID.mewtwo)], NONE)
    expect(slotPress(collection, '133', false)).toEqual({ kind: 'open' })
    expect(slotPress(collection, '133', true)).toEqual({ kind: 'toggle', entry: shiny, on: true })
    expect(slotPress(collection, '150', true)).toEqual({ kind: 'open' })
  })
})

describe('Mark box as in HOME', () => {
  it('picks the entry the Living Dex shows: the newest that fills the slot', () => {
    const old = makeEntry(ID.bulbasaur)
    const recent = makeEntry(ID.bulbasaur)
    const collection = collectionFor(dex, [recent, old], NONE)
    expect(shownEntry(collection, '1', false)).toBe(recent)
    expect(boxMarkTargets(collection, collection.slots.slice(0, 30), false)).toEqual([recent])
  })

  it('takes the later entry of the save when two were logged at the same moment', () => {
    const a = makeEntry(ID.bulbasaur)
    const b = { ...makeEntry(ID.bulbasaur), createdAt: a.createdAt }
    expect(shownEntry(collectionFor(dex, [a, b], NONE), '1', false)).toBe(b)
  })

  it('marks one entry per pending slot of that box and leaves the rest alone', () => {
    const bulbasaur = makeEntry(ID.bulbasaur)
    const ivysaurSent = makeEntry(ID.ivysaur, 0, { inHome: true })
    const ivysaurKept = makeEntry(ID.ivysaur)
    const pikachu = makeEntry(ID.pikachu)
    const mewtwo = makeEntry(ID.mewtwo)
    const collection = collectionFor(dex, [bulbasaur, ivysaurSent, ivysaurKept, pikachu, mewtwo], NONE)
    const first = collection.slots.slice(0, 5)
    expect(first.some((slot) => slot.key === '25')).toBe(true)
    expect(first.some((slot) => slot.key === '150')).toBe(false)
    // Ivysaur is in HOME already (through its other entry), Venusaur is not caught, Mewtwo is in another box.
    expect(boxMarkTargets(collection, first, false)).toEqual([bulbasaur, pikachu])
    expect(boxMarkTargets(collection, [], false)).toEqual([])
  })

  it('picks a shiny entry in shiny mode, even when a regular one is newer', () => {
    const shiny = makeEntry(ID.bulbasaur, 0, { shiny: true })
    const regular = makeEntry(ID.bulbasaur)
    const collection = collectionFor(dex, [shiny, regular, makeEntry(ID.ivysaur)], NONE)
    const first = collection.slots.slice(0, 5)
    expect(boxMarkTargets(collection, first, true)).toEqual([shiny])
    expect(boxMarkTargets(collection, first, false).map((entry) => entry.species)).toEqual([ID.bulbasaur, ID.ivysaur])
    expect(boxMarkTargets(collection, first, false)[0]).toBe(regular)
  })
})

describe('wording and filters', () => {
  it('describes a slot', () => {
    expect(homeStatus('home', false)).toBe('In Pokémon HOME')
    expect(homeStatus('pending', false)).toBe('Caught · not sent to HOME yet')
    expect(homeStatus('missing', false)).toBe('Not caught yet')
    expect(homeStatus('missing', true)).toBe('No shiny yet')
  })

  it('offers All, In HOME, Not sent yet and Not caught, with their counts', () => {
    expect(HOME_FILTERS.map((f) => f.label)).toEqual(['All', 'In HOME', 'Not sent yet', 'Not caught'])
    const totals = { slots: 10, inHome: 3, pending: 2, missing: 5 }
    expect(HOME_FILTERS.map((f) => filterCount(totals, f.id))).toEqual([10, 3, 2, 5])
  })
})
