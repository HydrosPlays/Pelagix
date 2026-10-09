import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import type { FormSummary, SpeciesSummary } from '@shared/dex-types'
import { useDexStore } from '@renderer/lib/data'
import { isElectron } from '@renderer/lib/env'
import { resolveFormSprite, speciesSpritePath, spriteFallbackUrl, spriteSizeFor, spriteUrl } from '@renderer/lib/sprites'
import { cx } from '../ui/cx'
import './Sprite.css'

export interface SpriteProps {
  /** HOME render path (`25.png`, `shiny/female/25.png`); wins over `species` / `form`. */
  path?: string
  /** National dex number or species summary. With a number the form is looked up in the loaded dex. */
  species?: number | SpeciesSummary
  /** PKHeX form index or form summary. Default: the base form. */
  form?: number | FormSummary
  /** Variant flags, applied only when the dataset says that render exists. */
  shiny?: boolean
  female?: boolean
  /** `FormVariant.id` (Alcremie sweet). */
  variant?: number
  gmax?: boolean
  /** Box size in CSS px, or "fill" to take the parent's width (square). Default 96. */
  size?: number | 'fill'
  /** With `size="fill"`: roughly how many CSS px it will be drawn at, to pick a thumbnail. Default 256. */
  resolution?: number
  /** Draw the render as a flat dark shape (uncaught slot). */
  silhouette?: boolean
  /** Defer loading until near the viewport. Default true. */
  lazy?: boolean
  /** Alt text. Default "" (decorative: the name is usually printed next to it). */
  alt?: string
  className?: string
  style?: CSSProperties
}

function usePath({ path, species, form, shiny, female, variant, gmax }: SpriteProps): string | null {
  const dex = useDexStore((s) => s.dex)
  if (path !== undefined) return path
  if (species === undefined) return null
  const summary = typeof species === 'number' ? dex?.species(species) : species
  const id = typeof species === 'number' ? species : species.id
  const formSummary = typeof form === 'object' ? form : summary ? (summary.forms.find((f) => f.f === (form ?? 0)) ?? summary.forms[0]) : undefined
  if (!summary || !formSummary) return speciesSpritePath(id, shiny === true)
  return resolveFormSprite(summary, formSummary, { shiny, female, variant, gmax }).path
}

/** Outline Poké Ball shown while there is no image and when every source failed. */
function Placeholder({ failed }: { failed: boolean }) {
  return (
    <svg className={cx('pk-sprite__placeholder', failed && 'is-failed')} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <circle cx="24" cy="24" r="15" stroke="currentColor" strokeWidth="2" />
      <path d="M9 24h9.5M29.5 24H39" stroke="currentColor" strokeWidth="2" />
      <circle cx="24" cy="24" r="5.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

/**
 * A Pokémon HOME render in a fixed square box (no layout shift), faded in once loaded.
 * Source chain: `sprite://` cache in Electron; in a browser jsDelivr, then raw.githubusercontent,
 * then the placeholder.
 */
export function Sprite(props: SpriteProps) {
  const { size = 96, resolution, silhouette = false, lazy = true, alt = '', className, style } = props
  const path = usePath(props)
  // 0: primary source, 1: fallback CDN, 2: gave up.
  const [stage, setStage] = useState<0 | 1 | 2>(0)
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  const [lastPath, setLastPath] = useState(path)
  if (lastPath !== path) {
    setLastPath(path)
    setStage(0)
  }

  const px = typeof size === 'number' ? size : (resolution ?? 256)
  const src = path === null || stage === 2 ? null : stage === 0 ? spriteUrl(path, spriteSizeFor(px)) : spriteFallbackUrl(path)
  const loaded = src !== null && loadedSrc === src

  // An image served from cache can be complete before React attaches onLoad.
  useLayoutEffect(() => {
    const img = imgRef.current
    if (img && src !== null && img.complete && img.naturalWidth > 0) setLoadedSrc(src)
  }, [src])

  const box: CSSProperties = typeof size === 'number' ? { width: size, height: size, ...style } : { width: '100%', aspectRatio: '1', ...style }

  return (
    <span className={cx('pk-sprite', silhouette && 'pk-sprite--silhouette', loaded && 'is-loaded', className)} style={box}>
      {!loaded && <Placeholder failed={src === null} />}
      {src !== null && (
        <img
          ref={imgRef}
          key={src}
          className="pk-sprite__img"
          src={src}
          alt={alt}
          loading={lazy ? 'lazy' : 'eager'}
          decoding="async"
          draggable={false}
          onLoad={() => setLoadedSrc(src)}
          onError={() => setStage(stage === 0 && !isElectron ? 1 : 2)}
        />
      )}
    </span>
  )
}
