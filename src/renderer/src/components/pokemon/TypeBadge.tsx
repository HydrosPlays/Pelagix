import type { CSSProperties } from 'react'
import type { TypeId } from '@shared/dex-types'
import { t } from '@renderer/i18n'
import { typeName } from '@renderer/i18n/terms'
import { labelTable } from '@renderer/lib/format'
import { cx } from '../ui/cx'
import './TypeBadge.css'

/** The 18 types in game order, then Stellar. */
export const TYPE_IDS: readonly TypeId[] = [
  'normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel',
  'fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon', 'dark', 'fairy', 'stellar'
]

/** Type names in the active language, read when asked for. Prefer `typeName()` from `@renderer/i18n/terms`, which this defers to. */
export const TYPE_NAMES: Readonly<Record<TypeId, string>> = labelTable(TYPE_IDS, typeName)

/** Types whose fill is dark enough for white text; the rest take dark ink (AA either way). */
const LIGHT_INK: ReadonlySet<TypeId> = new Set<TypeId>(['poison', 'ground', 'ghost', 'fire', 'dragon', 'dark'])

/** CSS colour of a type: `var(--type-fire)`. */
export function typeColor(type: TypeId): string {
  return `var(--type-${type})`
}

export interface TypeBadgeProps {
  type: TypeId
  /** pill: labelled capsule (default). dot: a small colour dot with the name as its accessible label. */
  variant?: 'pill' | 'dot'
  size?: 'sm' | 'md'
  className?: string
}

export function TypeBadge({ type, variant = 'pill', size = 'md', className }: TypeBadgeProps) {
  const name = typeName(type)
  const style = { '--tc': typeColor(type) } as CSSProperties
  if (variant === 'dot') {
    return <span className={cx('pk-type', 'pk-type--dot', `pk-type--${size}`, type === 'stellar' && 'pk-type--stellar', className)} style={style} role="img" aria-label={t('components.type.label', { type: name })} title={name} />
  }
  return (
    <span className={cx('pk-type', 'pk-type--pill', `pk-type--${size}`, LIGHT_INK.has(type) ? 'pk-type--ink-light' : 'pk-type--ink-dark', type === 'stellar' && 'pk-type--stellar', className)} style={style}>
      {name}
    </span>
  )
}

export interface TypeBadgesProps extends Omit<TypeBadgeProps, 'type'> {
  types: readonly TypeId[]
}

/** One or two type badges in a row. */
export function TypeBadges({ types, className, ...rest }: TypeBadgesProps) {
  return (
    <span className={cx('pk-types', className)}>
      {types.map((t) => (
        <TypeBadge key={t} type={t} {...rest} />
      ))}
    </span>
  )
}
