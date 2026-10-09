import { afterEach, describe, expect, it, vi } from 'vitest'
import { SPRITE_CDN_FALLBACK, SPRITE_CDN_PRIMARY, SPRITES_COMMIT } from '@shared/sprites'
import { buildSlots, RULE_PRESETS } from '@renderer/domain/slots'
import {
  cdnSpriteUrl, electronSpriteUrl, resolveEntrySprite, resolveFormSprite, speciesSpritePath, SPRITE_SIZES, spriteFallbackUrl, spriteSizeFor, spriteUrl
} from './sprites'
import { fixtureDex as dex, ID } from './test-fixture'

// The main process' own URL validator, so the URLs built here are checked against the real thing.
// Pulled in through a Vite glob because src/main belongs to a different TypeScript project.
type ParseSpriteRequest = (url: string) => { path: string; width: number | null; bucket: string } | null
const mainModules = import.meta.glob<{ parseSpriteRequest: ParseSpriteRequest }>('../../../main/sprite-request.ts', { eager: true })
const parseSpriteRequest = Object.values(mainModules)[0]!.parseSpriteRequest

const species = (id: number) => dex.species(id)!
const form = (id: number, f = 0) => dex.form(id, f)!
const resolve = (id: number, f: number, opts: Parameters<typeof resolveFormSprite>[2] = {}) => resolveFormSprite(species(id), form(id, f), opts)

describe('sprite URLs', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('builds sprite:// URLs the main process accepts, for every size', () => {
    expect(electronSpriteUrl('25.png')).toBe('sprite://home/25.png')
    expect(electronSpriteUrl('shiny/female/25.png', 128)).toBe('sprite://home/shiny/female/25.png?w=128')
    expect(electronSpriteUrl('25.png', 'full')).toBe('sprite://home/25.png')
    for (const size of [...SPRITE_SIZES, 'full'] as const) {
      const parsed = parseSpriteRequest(electronSpriteUrl('shiny/201-b.png', size))
      expect(parsed).toEqual({ path: 'shiny/201-b.png', width: size === 'full' ? null : size, bucket: size === 'full' ? 'full' : `w${size}` })
    }
  })

  it('builds pinned CDN URLs', () => {
    expect(cdnSpriteUrl('25.png')).toBe(`https://cdn.jsdelivr.net/gh/PokeAPI/sprites@${SPRITES_COMMIT}/sprites/pokemon/other/home/25.png`)
    expect(cdnSpriteUrl('shiny/25.png')).toBe(`${SPRITE_CDN_PRIMARY}shiny/25.png`)
    expect(spriteFallbackUrl('female/25.png')).toBe(`https://raw.githubusercontent.com/PokeAPI/sprites/${SPRITES_COMMIT}/sprites/pokemon/other/home/female/25.png`)
    expect(spriteFallbackUrl('25.png')).toBe(`${SPRITE_CDN_FALLBACK}25.png`)
  })

  it('uses the CDN outside Electron and ignores the size there', () => {
    expect(spriteUrl('25.png')).toBe(`${SPRITE_CDN_PRIMARY}25.png`)
    expect(spriteUrl('25.png', 96)).toBe(`${SPRITE_CDN_PRIMARY}25.png`)
  })

  it('uses the sprite:// protocol inside Electron', async () => {
    vi.stubGlobal('window', { api: {} })
    vi.resetModules()
    const electron = await import('./sprites')
    expect(electron.spriteUrl('25.png')).toBe('sprite://home/25.png')
    expect(electron.spriteUrl('shiny/25.png', 256)).toBe('sprite://home/shiny/25.png?w=256')
  })

  it('picks the smallest thumbnail that stays sharp', () => {
    expect(spriteSizeFor(96, 1)).toBe(96)
    expect(spriteSizeFor(96, 1.5)).toBe(160)
    expect(spriteSizeFor(97, 1)).toBe(128)
    expect(spriteSizeFor(128, 2)).toBe(256)
    expect(spriteSizeFor(200, 1.5)).toBe(384)
    expect(spriteSizeFor(300, 2)).toBe('full')
    expect(spriteSizeFor(64, 0.5)).toBe(96) // never below 1x
    expect(spriteSizeFor(64)).toBe(96) // no devicePixelRatio in this environment
  })
})

describe('speciesSpritePath', () => {
  it('is always the national dex number', () => {
    expect(speciesSpritePath(species(ID.vivillon))).toBe('666.png')
    expect(speciesSpritePath(25)).toBe('25.png')
    expect(speciesSpritePath(25, true)).toBe('shiny/25.png')
    expect(speciesSpritePath({ id: 1007 }, true)).toBe('shiny/1007.png')
  })
})

describe('resolveFormSprite', () => {
  it('returns the plain render by default', () => {
    expect(resolve(ID.pikachu, 0)).toEqual({ path: '25.png', shinyApplied: false, femaleApplied: false, approx: false })
    expect(resolve(ID.raichu, 1).path).toBe('10100.png')
    expect(resolve(ID.unown, 1).path).toBe('201-b.png')
    expect(resolve(ID.arceus, 6).path).toBe('493-bug.png')
    expect(resolve(ID.vivillon, 0).path).toBe('666-icy-snow.png')
  })

  it('applies shiny and female when the form has those renders', () => {
    expect(resolve(ID.pikachu, 0, { shiny: true })).toMatchObject({ path: 'shiny/25.png', shinyApplied: true, femaleApplied: false })
    expect(resolve(ID.pikachu, 0, { female: true })).toMatchObject({ path: 'female/25.png', shinyApplied: false, femaleApplied: true })
    expect(resolve(ID.pikachu, 0, { shiny: true, female: true })).toMatchObject({ path: 'shiny/female/25.png', shinyApplied: true, femaleApplied: true })
    expect(resolve(ID.unown, 26, { shiny: true }).path).toBe('shiny/201-exclamation.png')
  })

  it('drops a shiny request when no shiny render exists', () => {
    expect(resolve(ID.pikachu, 1, { shiny: true })).toEqual({ path: '10094.png', shinyApplied: false, femaleApplied: false, approx: false })
    expect(resolve(ID.pikachu, 9, { shiny: true }).path).toBe('10160.png')
    expect(resolve(ID.pikachu, 7, { shiny: true }).path).toBe('shiny/10148.png')
  })

  it('drops a female request when no female render exists', () => {
    expect(resolve(ID.raichu, 1, { female: true })).toMatchObject({ path: '10100.png', femaleApplied: false })
    expect(resolve(ID.bulbasaur, 0, { female: true, shiny: true })).toMatchObject({ path: 'shiny/1.png', femaleApplied: false, shinyApplied: true })
    expect(resolve(ID.meowstic, 1, { female: true }).path).toBe('10025.png')
    expect(resolve(ID.meowstic, 0, { female: true }).path).toBe('female/678.png')
  })

  it('uses the Gigantamax render when asked and available', () => {
    expect(resolve(ID.pikachu, 0, { gmax: true })).toEqual({ path: '10199.png', shinyApplied: false, femaleApplied: false, approx: false })
    expect(resolve(ID.pikachu, 0, { gmax: true, shiny: true, female: true })).toEqual({ path: 'shiny/10199.png', shinyApplied: true, femaleApplied: false, approx: false })
    expect(resolve(ID.venusaur, 0, { gmax: true }).path).toBe('10195.png')
    expect(resolve(ID.eevee, 0, { gmax: true }).path).toBe('10205.png')
    expect(resolve(ID.alcremie, 4, { gmax: true, variant: 3 }).path).toBe('10223.png') // one G-Max look for every cream and sweet
  })

  it('ignores gmax for forms that cannot Gigantamax', () => {
    expect(resolve(ID.raichu, 0, { gmax: true, female: true }).path).toBe('female/26.png')
    expect(resolve(ID.pikachu, 1, { gmax: true }).path).toBe('10094.png')
  })

  it('uses a variant render with the variant own shiny flag', () => {
    expect(resolve(ID.alcremie, 0, { variant: 0 }).path).toBe('869.png')
    expect(resolve(ID.alcremie, 0, { variant: 3 }).path).toBe('869-vanilla-cream-star-sweet.png')
    expect(resolve(ID.alcremie, 6, { variant: 6, shiny: true })).toEqual({ path: 'shiny/869-ruby-swirl-ribbon-sweet.png', shinyApplied: true, femaleApplied: false, approx: false })
    expect(resolve(ID.alcremie, 1).path).toBe('869-ruby-cream-strawberry-sweet.png')
  })

  it('falls back to the form render for an unknown variant or a form without variants', () => {
    expect(resolve(ID.alcremie, 1, { variant: 42 }).path).toBe('869-ruby-cream-strawberry-sweet.png')
    expect(resolve(ID.pikachu, 0, { variant: 2 }).path).toBe('25.png')
  })

  it('flags stand-in renders', () => {
    expect(resolve(ID.pikachu, 8)).toMatchObject({ path: '25.png', approx: true })
    expect(resolve(ID.eevee, 1).approx).toBe(true)
    expect(resolve(ID.pichu, 1).approx).toBe(true)
    expect(resolve(ID.koraidon, 2)).toMatchObject({ path: '1007.png', approx: true })
    expect(resolve(ID.koraidon, 0).approx).toBe(false)
  })

  it('falls back to the dex number when a form has no sprite key', () => {
    expect(resolveFormSprite({ id: 7 }, { ...form(ID.bulbasaur), sprite: '' }).path).toBe('7.png')
  })
})

describe('resolveEntrySprite', () => {
  it('applies the entry to its form', () => {
    expect(resolveEntrySprite(dex, { species: 25, form: 0, shiny: true, gender: 'f' })).toMatchObject({ path: 'shiny/female/25.png', approx: false })
    expect(resolveEntrySprite(dex, { species: 25, form: 0, shiny: false, gender: 'm' }).path).toBe('25.png')
    expect(resolveEntrySprite(dex, { species: 25, form: 0, shiny: false, gmax: true }).path).toBe('10199.png')
    expect(resolveEntrySprite(dex, { species: 869, form: 2, shiny: false, variant: 5 }).path).toBe('869-matcha-cream-flower-sweet.png')
    expect(resolveEntrySprite(dex, { species: 26, form: 1, shiny: true }).path).toBe('shiny/10100.png')
  })

  it('falls back to the base form, then to the bare number', () => {
    expect(resolveEntrySprite(dex, { species: 25, form: 77, shiny: false })).toEqual({ path: '25.png', shinyApplied: false, femaleApplied: false, approx: true })
    expect(resolveEntrySprite(dex, { species: 4, form: 0, shiny: true })).toEqual({ path: 'shiny/4.png', shinyApplied: true, femaleApplied: false, approx: true })
  })
})

describe('every slot render', () => {
  it('is a path the sprite:// protocol accepts', () => {
    const slots = buildSlots(dex, RULE_PRESETS.completionist.rules)
    const paths = new Set<string>()
    for (const slot of slots) for (const shiny of [false, true]) paths.add(slot.spritePath(shiny))
    for (const s of dex.speciesList) for (const shiny of [false, true]) paths.add(speciesSpritePath(s, shiny))
    expect(paths.size).toBeGreaterThan(300)
    for (const path of paths) {
      expect(parseSpriteRequest(electronSpriteUrl(path, 160)), path).toEqual({ path, width: 160, bucket: 'w160' })
    }
  })
})
