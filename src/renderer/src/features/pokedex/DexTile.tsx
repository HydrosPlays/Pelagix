import { memo, type CSSProperties } from 'react'
import { GenderIcon, ShinyMark, Sprite, TypeBadges, typeColor } from '@renderer/components/pokemon'
import { cx } from '@renderer/components/ui'
import { t, useT } from '@renderer/i18n'
import { typeName } from '@renderer/i18n/terms'
import { dexNo, listText } from '@renderer/lib/format'
import type { DexDensity } from '@renderer/store/ui'
import { CaughtMark } from './CaughtMark'
import type { DexDisplay, DexTile } from './dex-query'

/** Grid metrics per density: column floor, gap and render size. Heights depend on the display too (see `tileHeight`). */
export const TILE_METRICS: Readonly<Record<DexDensity, { minWidth: number; gap: number; sprite: number }>> = {
  comfortable: { minWidth: 172, gap: 12, sprite: 112 },
  compact: { minWidth: 106, gap: 8, sprite: 60 }
}

/** Fixed row height. Form tiles reserve a second line: their labels ("Paldean Tauros (Blaze Breed)") rarely fit on one. */
export function tileHeight(density: DexDensity, display: DexDisplay): number {
  if (density === 'compact') return display === 'forms' ? 148 : 132
  return display === 'forms' ? 230 : 212
}

/** What a screen reader says for the cell: everything the tile shows, as one sentence group. */
function describe(tile: DexTile, display: DexDisplay): string {
  const parts = [t('pokedex.tile.name', { name: tile.label, number: String(tile.species.id) }), t('pokedex.tile.types', { types: listText(tile.types.map(typeName)) })]
  if (!tile.caught) parts.push(t('pokedex.tile.missing'))
  else parts.push(t(tile.shiny ? 'pokedex.tile.caughtShiny' : 'pokedex.tile.caught', { count: tile.entries }))
  if (display === 'species' && tile.speciesSlots > 1) parts.push(t('pokedex.tile.forms', { caught: String(tile.slotsCaught), count: tile.speciesSlots }))
  return parts.join(' ')
}

/** The label, with a trailing ♂ / ♀ drawn as the app's coloured gender glyph (where the language writes the sign last, as English does). */
function TileName({ tile, compact }: { tile: DexTile; compact: boolean }) {
  const gender = tile.slot?.gender
  const sign = gender === 'm' ? ' ♂' : gender === 'f' ? ' ♀' : null
  if (!gender || sign === null || !tile.label.endsWith(sign)) return <>{tile.label}</>
  return (
    <>
      {tile.label.slice(0, -sign.length)}
      <span className="dex-tile__gender">
        <GenderIcon gender={gender} size={compact ? 11 : 13} />
      </span>
    </>
  )
}

export interface DexTileViewProps {
  tile: DexTile
  display: DexDisplay
  density: DexDensity
  /** Draw shiny renders (the app-wide shiny view). */
  shinyView: boolean
}

/**
 * One Pokédex tile. It renders inside a `VirtualGrid` cell, which is the focus target, so nothing
 * in here is focusable; the visuals are hidden from assistive tech in favour of one description.
 */
export const DexTileView = memo(function DexTileView({ tile, display, density, shinyView }: DexTileViewProps) {
  useT()
  const compact = density === 'compact'
  const [primary, secondary] = tile.types
  const showForms = display === 'species' && tile.speciesSlots > 1
  const complete = tile.slotsCaught >= tile.targets.length && tile.targets.length > 0
  const style = {
    '--dex-type': primary ? typeColor(primary) : 'var(--accent)',
    '--dex-type-2': secondary ? typeColor(secondary) : primary ? typeColor(primary) : 'var(--accent)'
  } as CSSProperties

  const forms = showForms && (
    <span className={cx('dex-tile__forms', complete && 'is-complete')} title={t('pokedex.tile.formsTitle', { caught: String(tile.slotsCaught), count: tile.speciesSlots })}>
      {tile.slotsCaught}/{tile.speciesSlots}
    </span>
  )

  return (
    <div className={cx('dex-tile', `dex-tile--${density}`, `dex-tile--${display}`, tile.caught && 'is-caught', tile.caught && complete && 'is-complete')} style={style} data-key={tile.key}>
      <span className="u-sr-only">{describe(tile, display)}</span>
      <div className="dex-tile__body" aria-hidden="true">
        <div className="dex-tile__head">
          <span className="dex-tile__no">{dexNo(tile.species.id)}</span>
          <span className="dex-tile__marks">
            {tile.shiny && <ShinyMark size={compact ? 13 : 15} label="" />}
            {tile.caught && <CaughtMark entries={tile.entries} size={compact ? 'sm' : 'md'} />}
          </span>
        </div>
        <div className="dex-tile__stage">
          <Sprite path={tile.sprite(shinyView)} size={TILE_METRICS[density].sprite} />
        </div>
        <div className="dex-tile__title">
          <span className="dex-tile__name" title={tile.label}>
            <TileName tile={tile} compact={compact} />
          </span>
          {!compact && forms}
        </div>
        <div className="dex-tile__foot">
          <TypeBadges types={tile.types} variant={compact ? 'dot' : 'pill'} size="sm" className="dex-tile__types" />
          {compact && forms}
        </div>
      </div>
    </div>
  )
})
