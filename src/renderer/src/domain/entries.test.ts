import { describe, expect, it } from 'vitest'
import { gameIconUrl } from '@renderer/lib/assets'
import { fixtureDex as dex, ID, makeEntry } from '@renderer/lib/test-fixture'
import { describeEntry, sortEntries } from './entries'

describe('describeEntry', () => {
  it('resolves species, form, game, system, ball and render', () => {
    const entry = makeEntry(ID.raichu, 1, { game: 'sun', ball: 12, shiny: true, date: '2026-02-03' })
    const view = describeEntry(dex, entry)
    expect(view.entry).toBe(entry)
    expect(view.species?.name).toBe('Raichu')
    expect(view.form?.full).toBe('Alolan Raichu')
    expect(view.name).toBe('Alolan Raichu')
    expect(view.title).toBe('Alolan Raichu')
    expect(view.game?.name).toBe('Pokémon Sun')
    expect(view.system?.short).toBe('3DS')
    expect(view.ball?.name).toBe('Premier Ball')
    expect(view.sprite).toEqual({ path: 'shiny/10100.png', shinyApplied: true, femaleApplied: false, approx: false })
    expect(view.day).toBe('2026-02-03')
    expect(gameIconUrl(view.game!)).toBe('./games/pokemon-sun.png')
  })

  it('uses the nickname as the title', () => {
    const view = describeEntry(dex, makeEntry(ID.pikachu, 0, { nickname: 'Sparky', gender: 'f' }))
    expect(view.title).toBe('Sparky')
    expect(view.name).toBe('Pikachu')
    expect(view.sprite.path).toBe('female/25.png')
  })

  it('names variants and Gigantamax', () => {
    const alcremie = describeEntry(dex, makeEntry(ID.alcremie, 1, { variant: 3 }))
    expect(alcremie.name).toBe('Alcremie (Ruby Cream) · Star Sweet')
    expect(alcremie.variant?.name).toBe('Star Sweet')
    expect(alcremie.sprite.path).toBe('869-ruby-cream-star-sweet.png')

    expect(describeEntry(dex, makeEntry(ID.pikachu, 0, { gmax: true }))).toMatchObject({ name: 'Gigantamax Pikachu', sprite: { path: '10199.png' } })
    expect(describeEntry(dex, makeEntry(ID.raichu, 0, { gmax: true })).name).toBe('Raichu') // cannot Gigantamax
    expect(describeEntry(dex, makeEntry(ID.alcremie, 0, { variant: 42 })).variant).toBeUndefined()
  })

  it('degrades gracefully for anything it does not know', () => {
    const view = describeEntry(dex, makeEntry(9999, 3, { game: 'future-game', ball: undefined }))
    expect(view).toMatchObject({ species: undefined, form: undefined, game: undefined, system: undefined, ball: undefined, name: 'Pokémon #9999' })
    expect(view.sprite).toMatchObject({ path: '9999.png', approx: true })

    const oddForm = describeEntry(dex, makeEntry(ID.pikachu, 77))
    expect(oddForm.form?.f).toBe(0)
    expect(oddForm.name).toBe('Pikachu')
    expect(oddForm.sprite.approx).toBe(true)
  })

  it('falls back to the day the entry was logged', () => {
    const logged = new Date(2026, 5, 6, 22, 0).toISOString()
    expect(describeEntry(dex, makeEntry(ID.eevee, 0, { createdAt: logged })).day).toBe('2026-06-06')
  })
})

describe('sortEntries', () => {
  const at = (h: number) => new Date(Date.UTC(2026, 0, 1, h)).toISOString()
  const a = makeEntry(ID.raichu, 1, { createdAt: at(1), date: '2026-03-01' })
  const b = makeEntry(ID.bulbasaur, 0, { createdAt: at(2), date: '2026-01-15' })
  const c = makeEntry(ID.raichu, 0, { createdAt: at(3), date: '2026-03-01' })
  const d = makeEntry(ID.bulbasaur, 0, { createdAt: at(4) }) // no date: counts for 1 Jan 2026
  const list = [a, b, c, d]
  const ids = (order: Parameters<typeof sortEntries>[1]) => sortEntries(list, order).map((e) => e.id)

  it('orders by when entries were logged', () => {
    expect(ids('newest')).toEqual([d.id, c.id, b.id, a.id])
    expect(ids('oldest')).toEqual([a.id, b.id, c.id, d.id])
  })

  it('orders by the day entries were caught, breaking ties by logging time', () => {
    expect(ids('caught-newest')).toEqual([c.id, a.id, b.id, d.id])
    expect(ids('caught-oldest')).toEqual([d.id, b.id, a.id, c.id])
  })

  it('orders by dex number, then form, then age', () => {
    expect(ids('dex')).toEqual([b.id, d.id, c.id, a.id])
  })

  it('returns a copy', () => {
    const sorted = sortEntries(list, 'newest')
    expect(sorted).not.toBe(list)
    expect(list).toEqual([a, b, c, d])
  })
})
