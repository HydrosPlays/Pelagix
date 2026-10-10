import { describe, expect, it } from 'vitest'
import { fixtureDex as dex, ID } from '@renderer/lib/test-fixture'
import { buildPalette, matchesWords, MAX_POKEMON_RESULTS, type ActionItem, type PaletteInput, type PalettePage, type PaletteSection, type PokemonItem } from './palette-model'
import { MAX_RECENT, parseRecent, pushRecent, recentFromLocation } from './recent'

const PAGES: readonly PalettePage[] = [
  { id: 'page-home', label: 'Home', icon: 'home', href: '/', keywords: 'dashboard' },
  { id: 'page-dex', label: 'Pokédex', icon: 'dex', href: '/dex', keywords: 'pokemon browse' },
  { id: 'page-living', label: 'Living Dex', icon: 'grid', href: '/living' },
  { id: 'page-homedex', label: 'HOME Dex', icon: 'box', href: '/home-dex', keywords: 'pokemon home sent' },
  { id: 'page-journal', label: 'Journal', icon: 'journal', href: '/journal', keywords: 'entries history' },
  { id: 'page-settings', label: 'Settings', icon: 'settings', href: '/settings', keywords: 'theme' }
]

const input = (patch: Partial<PaletteInput> = {}): PaletteInput => ({ dex, query: '', recent: [], pages: PAGES, shinyView: false, theme: 'dark', reduceMotion: false, editorOpen: false, ...patch })
const section = (sections: PaletteSection[], id: PaletteSection['id']): PaletteSection | undefined => sections.find((s) => s.id === id)
const actions = (sections: PaletteSection[]): ActionItem[] => (section(sections, 'actions')?.items ?? []) as ActionItem[]
const pokemon = (sections: PaletteSection[], id: PaletteSection['id'] = 'pokemon'): PokemonItem[] => (section(sections, id)?.items ?? []) as PokemonItem[]

describe('buildPalette without a query', () => {
  it('shows every page and the toggles', () => {
    const sections = buildPalette(input())
    expect(sections.map((s) => s.id)).toEqual(['pages', 'actions'])
    expect(section(sections, 'pages')!.items.map((i) => i.id)).toEqual(PAGES.map((p) => p.id))
    expect(actions(sections).map((a) => a.action)).toEqual(['shiny', 'theme', 'motion'])
  })

  it('lists recently opened Pokémon first and offers to log a catch for the latest', () => {
    const sections = buildPalette(input({ recent: [{ species: ID.raichu, form: 1 }, { species: ID.pikachu, form: 0 }, { species: 99999, form: 0 }] }))
    expect(sections.map((s) => s.id)).toEqual(['recent', 'pages', 'actions'])
    expect(pokemon(sections, 'recent').map((p) => p.label)).toEqual(['Alolan Raichu', 'Pikachu'])
    const [log] = actions(sections)
    expect(log).toMatchObject({ action: 'log', label: 'Log a catch for Alolan Raichu' })
    expect(log!.target).toMatchObject({ species: { id: ID.raichu }, form: { f: 1 } })
  })

  it('falls back to the base form for a form the dataset no longer has', () => {
    const [item] = pokemon(buildPalette(input({ recent: [{ species: ID.pikachu, form: 987 }] })), 'recent')
    expect(item).toMatchObject({ label: 'Pikachu', form: { f: 0 } })
  })

  it('words each toggle by what it will do and shows the current state', () => {
    const off = actions(buildPalette(input()))
    expect(off.map((a) => [a.label, a.hint])).toEqual([
      ['Turn shiny view on', 'Off'],
      ['Switch to the light theme', 'Dark'],
      ['Turn reduced motion on', 'Off']
    ])
    const on = actions(buildPalette(input({ shinyView: true, theme: 'light', reduceMotion: true })))
    expect(on.map((a) => [a.label, a.hint])).toEqual([
      ['Turn shiny view off', 'On'],
      ['Switch to the dark theme', 'Light'],
      ['Turn reduced motion off', 'On']
    ])
  })

  it('works without a dataset', () => {
    const sections = buildPalette(input({ dex: null, recent: [{ species: ID.pikachu, form: 0 }] }))
    expect(sections.map((s) => s.id)).toEqual(['pages', 'actions'])
  })
})

describe('buildPalette with a query', () => {
  it('lists Pokémon first, then offers to log a catch for the top one', () => {
    const sections = buildPalette(input({ query: 'pika' }))
    expect(sections.map((s) => s.id)).toEqual(['pokemon', 'actions'])
    expect(pokemon(sections)[0]).toMatchObject({ label: 'Pikachu', species: { id: ID.pikachu } })
    expect(actions(sections).map((a) => a.label)).toEqual(['Log a catch for Pikachu'])
  })

  it('finds forms by their own name and by dex number', () => {
    const alolan = pokemon(buildPalette(input({ query: 'alolan rai' })))
    expect(alolan[0]).toMatchObject({ label: 'Alolan Raichu', form: { f: 1 } })
    expect(pokemon(buildPalette(input({ query: '25' })))[0]).toMatchObject({ species: { id: ID.pikachu } })
    expect(pokemon(buildPalette(input({ query: 'a' }))).length).toBeLessThanOrEqual(MAX_POKEMON_RESULTS)
  })

  it('gives every result a distinct id', () => {
    const items = buildPalette(input({ query: 'a' })).flatMap((s) => s.items)
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length)
  })

  it('finds pages by name and by keyword', () => {
    expect(section(buildPalette(input({ query: 'sett' })), 'pages')!.items.map((i) => i.id)).toEqual(['page-settings'])
    expect(section(buildPalette(input({ query: 'history' })), 'pages')!.items.map((i) => i.id)).toEqual(['page-journal'])
    expect(section(buildPalette(input({ query: 'living dex' })), 'pages')!.items.map((i) => i.id)).toEqual(['page-living'])
    expect(section(buildPalette(input({ query: 'home dex' })), 'pages')!.items.map((i) => i.id)).toEqual(['page-homedex'])
    expect(section(buildPalette(input({ query: 'sent' })), 'pages')!.items.map((i) => i.id)).toEqual(['page-homedex'])
  })

  it('finds the toggles by what they are about', () => {
    expect(actions(buildPalette(input({ query: 'shiny' }))).map((a) => a.action)).toContain('shiny')
    expect(actions(buildPalette(input({ query: 'dark' }))).map((a) => a.action)).toContain('theme')
    expect(actions(buildPalette(input({ query: 'animation' }))).map((a) => a.action)).toEqual(['motion'])
    expect(actions(buildPalette(input({ query: 'toggle' }))).map((a) => a.action)).toEqual(['shiny', 'theme', 'motion'])
  })

  it('logs for the Pokémon opened last when "log" is typed on its own', () => {
    const recent = [{ species: ID.eevee, form: 0 }]
    expect(actions(buildPalette(input({ query: 'log', recent }))).map((a) => a.label)).toEqual(['Log a catch for Eevee'])
    expect(actions(buildPalette(input({ query: 'log' })))).toEqual([])
  })

  it('does not offer to log a catch while the editor is open', () => {
    expect(actions(buildPalette(input({ query: 'pika', editorOpen: true })))).toEqual([])
    expect(actions(buildPalette(input({ recent: [{ species: ID.pikachu, form: 0 }], editorOpen: true }))).map((a) => a.action)).toEqual(['shiny', 'theme', 'motion'])
  })

  it('logs a battle-only form as the base form', () => {
    const species = dex.speciesList.find((s) => s.forms.some((f) => f.cat === 'mega' || f.cat === 'battle'))
    if (!species) return
    const form = species.forms.find((f) => f.cat === 'mega' || f.cat === 'battle')!
    const sections = buildPalette(input({ query: form.full }))
    const top = pokemon(sections)[0]!
    expect(top.form).toBe(form)
    const [log] = actions(sections)
    expect(log!.target!.form).toBe(species.forms[0])
    expect(log!.label).toBe(`Log a catch for ${species.name}`)
  })

  it('puts a mere near-miss on a Pokémon name below pages and actions that match exactly', () => {
    // Find a query that only fuzzy-matches a Pokémon and also names a page.
    const near = buildPalette(input({ query: 'pikachx' }))
    expect(pokemon(near)[0]).toMatchObject({ species: { id: ID.pikachu } })
    expect(near.map((s) => s.id)).toEqual(['pokemon', 'actions'])

    const pages: PalettePage[] = [...PAGES, { id: 'page-x', label: 'Pikachx notes', icon: 'note', href: '/x' }]
    const sections = buildPalette(input({ query: 'pikachx', pages }))
    expect(sections.map((s) => s.id)).toEqual(['pages', 'pokemon'])
    expect(actions(sections)).toEqual([])
  })

  it('puts letters from the middle of a name below a page or action the words match', () => {
    // "chu" only sits inside Pikachu, Raichu and Pichu.
    const plain = buildPalette(input({ query: 'chu' }))
    expect(plain.map((s) => s.id)).toEqual(['pokemon', 'actions'])

    const pages: PalettePage[] = [...PAGES, { id: 'page-x', label: 'Chu notes', icon: 'note', href: '/x' }]
    const sections = buildPalette(input({ query: 'chu', pages }))
    expect(sections.map((s) => s.id)).toEqual(['pages', 'pokemon'])
    expect(pokemon(sections).length).toBeGreaterThan(0)
    expect(actions(sections)).toEqual([])
  })

  it('returns nothing for gibberish', () => {
    expect(buildPalette(input({ query: 'qqqqzzzz' }))).toEqual([])
  })
})

describe('matchesWords', () => {
  it('matches word prefixes in any order, ignoring accents and case', () => {
    expect(matchesWords('poke', 'Pokédex')).toBe(true)
    expect(matchesWords('dex liv', 'Living Dex')).toBe(true)
    expect(matchesWords('livingdex', 'Living Dex')).toBe(true)
    expect(matchesWords('dex', 'Pokédex')).toBe(true)
    expect(matchesWords('ex', 'Pokédex')).toBe(false)
    expect(matchesWords('on', 'Turn reduced motion on')).toBe(true)
    expect(matchesWords('ti', 'Turn reduced motion on')).toBe(false)
    expect(matchesWords('', 'anything')).toBe(true)
  })
})

describe('recent Pokémon', () => {
  it('reads a species page location', () => {
    expect(recentFromLocation('/dex/26', 'form=1')).toEqual({ species: 26, form: 1 })
    expect(recentFromLocation('/dex/25', '')).toEqual({ species: 25, form: 0 })
    expect(recentFromLocation('/dex/25/', 'form=abc')).toEqual({ species: 25, form: 0 })
    expect(recentFromLocation('/dex', '')).toBeNull()
    expect(recentFromLocation('/dex/pikachu', '')).toBeNull()
    expect(recentFromLocation('/dex/0', '')).toBeNull()
    expect(recentFromLocation('/living', 'form=1')).toBeNull()
  })

  it('moves a Pokémon to the front, once per species, capped', () => {
    let list = pushRecent([], { species: 1, form: 0 })
    list = pushRecent(list, { species: 2, form: 0 })
    list = pushRecent(list, { species: 1, form: 3 })
    expect(list).toEqual([{ species: 1, form: 3 }, { species: 2, form: 0 }])
    for (let s = 10; s < 30; s++) list = pushRecent(list, { species: s, form: 0 })
    expect(list).toHaveLength(MAX_RECENT)
    expect(list[0]).toEqual({ species: 29, form: 0 })
  })

  it('cleans whatever was stored', () => {
    expect(parseRecent(null)).toEqual([])
    expect(parseRecent('nope')).toEqual([])
    expect(parseRecent([{ species: 25, form: 1 }, { species: 25, form: 0 }, { species: -1 }, { species: 'x' }, null, 7, { species: 6 }, { species: 7, form: -2 }])).toEqual([
      { species: 25, form: 1 },
      { species: 6, form: 0 },
      { species: 7, form: 0 }
    ])
    expect(parseRecent(Array.from({ length: 40 }, (_, i) => ({ species: i + 1, form: 0 })))).toHaveLength(MAX_RECENT)
  })
})
