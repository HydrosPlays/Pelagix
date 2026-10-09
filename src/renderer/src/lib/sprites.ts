/**
 * Pokémon HOME render URLs and the rules for picking the right render of a form.
 *
 * A sprite *path* is relative to the HOME folder (`25.png`, `shiny/female/25.png`); see
 * shared/sprites.ts. Inside Electron paths are served by the caching `sprite://` protocol, which
 * can also hand out thumbnails; in a browser they come straight from the CDN at full size.
 */

import type { CatchEntry } from '@shared/save-types'
import type { FormSummary, FormVariant, SpeciesSummary } from '@shared/dex-types'
import { homeSpritePath, SPRITE_CDN_FALLBACK, SPRITE_CDN_PRIMARY } from '@shared/sprites'
import type { Dex } from './data'
import { isElectron } from './env'

/** Thumbnail widths the `sprite://` protocol serves. `full` is the original 512 px render. */
export const SPRITE_SIZES = [96, 128, 160, 256, 384] as const
export type SpriteSize = (typeof SPRITE_SIZES)[number] | 'full'

/** `sprite://home/<path>?w=<size>` as the main process expects it (no query for `full`). */
export function electronSpriteUrl(path: string, size: SpriteSize = 'full'): string {
  return size === 'full' ? `sprite://home/${path}` : `sprite://home/${path}?w=${size}`
}

/** Pinned jsDelivr URL of a render (always full size). */
export function cdnSpriteUrl(path: string): string {
  return SPRITE_CDN_PRIMARY + path
}

/**
 * URL for an `<img>`: the cached `sprite://` protocol in Electron (at the requested thumbnail size),
 * the CDN in a browser (size ignored). `size` defaults to the full 512 px render; grids should pass
 * `spriteSizeFor(cssPixels)`.
 */
export function spriteUrl(path: string, size: SpriteSize = 'full'): string {
  return isElectron ? electronSpriteUrl(path, size) : cdnSpriteUrl(path)
}

/**
 * Second source for the browser `onError` chain (raw.githubusercontent.com, same pinned commit).
 * Not needed in Electron, where the main process already retries both hosts.
 */
export function spriteFallbackUrl(path: string): string {
  return SPRITE_CDN_FALLBACK + path
}

/** Smallest thumbnail that stays sharp when drawn `cssPixels` wide at the given device pixel ratio. */
export function spriteSizeFor(cssPixels: number, dpr: number = globalThis.devicePixelRatio ?? 1): SpriteSize {
  const needed = Math.ceil(cssPixels * Math.max(1, dpr))
  return SPRITE_SIZES.find((s) => s >= needed) ?? 'full'
}

export interface FormSpriteOptions {
  shiny?: boolean
  /** Use the female render when the form has one. */
  female?: boolean
  /** `FormVariant.id` (Alcremie sweet). */
  variant?: number
  /** Use the Gigantamax render when the form has one. */
  gmax?: boolean
}

export interface ResolvedSprite {
  /** Path relative to the HOME folder; feed it to `spriteUrl`. */
  path: string
  /** The render really is the shiny one (false when shiny was asked for but no shiny file exists). */
  shinyApplied: boolean
  /** The render really is the female one. */
  femaleApplied: boolean
  /** The render is a stand-in: HOME has no picture of this exact form. */
  approx: boolean
}

/** Default tile render of a species: always `<national dex number>.png`, which exists (also shiny) for every species. */
export function speciesSpritePath(species: Pick<SpeciesSummary, 'id'> | number, shiny = false): string {
  return homeSpritePath(String(typeof species === 'number' ? species : species.id), { shiny })
}

/**
 * Picks the HOME render of a form.
 *
 * - `gmax` wins when the form has a Gigantamax render (those all have a shiny file and no female one).
 * - else a known `variant` uses the variant's own render and shiny flag.
 * - else the form's render, with `shiny/` and `female/` only when the form's flags say the file exists.
 *
 * Requests the data cannot honour are dropped, never guessed: check `shinyApplied` / `femaleApplied`.
 */
export function resolveFormSprite(species: Pick<SpeciesSummary, 'id'>, form: FormSummary, opts: FormSpriteOptions = {}): ResolvedSprite {
  if (opts.gmax && form.gmax) {
    const shiny = opts.shiny === true
    return { path: homeSpritePath(form.gmax, { shiny }), shinyApplied: shiny, femaleApplied: false, approx: false }
  }

  const variant: FormVariant | undefined = opts.variant === undefined ? undefined : form.variants?.find((v) => v.id === opts.variant)
  if (variant) {
    const shiny = opts.shiny === true && variant.shiny
    return { path: homeSpritePath(variant.sprite, { shiny }), shinyApplied: shiny, femaleApplied: false, approx: false }
  }

  const key = form.sprite || String(species.id)
  const shiny = opts.shiny === true && form.shiny
  const female = opts.female === true && form.female
  return { path: homeSpritePath(key, { shiny, female }), shinyApplied: shiny, femaleApplied: female, approx: form.approx === true }
}

/**
 * Render of a logged Pokémon: its form with the entry's shiny, gender, variant and Gigantamax
 * state applied. Falls back to the species' base form, then to the bare dex number, for entries
 * the dataset does not know.
 */
export function resolveEntrySprite(dex: Dex, entry: Pick<CatchEntry, 'species' | 'form' | 'variant' | 'gender' | 'shiny' | 'gmax'>): ResolvedSprite {
  const species = dex.species(entry.species)
  const form = dex.form(entry.species, entry.form) ?? species?.forms[0]
  if (!species || !form) {
    return { path: speciesSpritePath(entry.species, entry.shiny), shinyApplied: entry.shiny, femaleApplied: false, approx: true }
  }
  const resolved = resolveFormSprite(species, form, { shiny: entry.shiny, female: entry.gender === 'f', variant: entry.variant, gmax: entry.gmax })
  return form.f === entry.form ? resolved : { ...resolved, approx: true }
}
