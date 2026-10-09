import type { FormCategory, RegionalVariant } from '@shared/dex-types'
import type { EntryGender } from '@shared/save-types'
import { dexNo, genderLabel } from '@renderer/lib/format'
import { Chip, type Tone } from '../ui/Chip'
import { cx } from '../ui/cx'
import { Icon } from '../ui/Icon'
import './Marks.css'

// ---------------------------------------------------------------- GenderIcon

export interface GenderIconProps {
  gender: EntryGender | null | undefined
  /** Square size in px. Default 16. */
  size?: number
  className?: string
}

/** ♂ / ♀ / genderless glyph in the gender's colour. Renders nothing for an unknown gender. */
export function GenderIcon({ gender, size = 16, className }: GenderIconProps) {
  if (gender !== 'm' && gender !== 'f' && gender !== 'n') return null
  const name = gender === 'm' ? 'male' : gender === 'f' ? 'female' : 'genderless'
  return <Icon name={name} size={size} strokeWidth={2.2} label={genderLabel(gender)} className={cx('pk-gender', `pk-gender--${gender}`, className)} />
}

// ---------------------------------------------------------------- ShinyMark

export interface ShinyMarkProps {
  /** Square size in px. Default 16. */
  size?: number
  /** Slow twinkle. Default false; keep it for hero placements, not for grids. */
  twinkle?: boolean
  /** Accessible name. Default "Shiny"; pass "" when the word is printed next to it. */
  label?: string
  className?: string
}

/** The gold sparkle that marks a shiny. */
export function ShinyMark({ size = 16, twinkle = false, label = 'Shiny', className }: ShinyMarkProps) {
  return <Icon name="sparkle" size={size} label={label === '' ? undefined : label} className={cx('pk-shiny', twinkle && 'pk-shiny--twinkle', className)} />
}

// ---------------------------------------------------------------- DexNumber

export interface DexNumberProps {
  /** National dex number. */
  id: number
  /** badge: chamfered tag (default). plain: inline muted text. watermark: giant faded display number. */
  variant?: 'badge' | 'plain' | 'watermark'
  className?: string
}

/** `#0025`, tabular. */
export function DexNumber({ id, variant = 'badge', className }: DexNumberProps) {
  return (
    <span className={cx('pk-dexno', `pk-dexno--${variant}`, className)} aria-hidden={variant === 'watermark' ? true : undefined}>
      {dexNo(id)}
    </span>
  )
}

// ---------------------------------------------------------------- FormCategoryTag

export const FORM_CATEGORY_LABELS: Readonly<Record<FormCategory, string>> = {
  base: 'Base',
  regional: 'Regional',
  gender: 'Gender form',
  cosmetic: 'Cosmetic',
  changeable: 'Changeable',
  fusion: 'Fusion',
  event: 'Event',
  partner: 'Partner',
  mega: 'Mega',
  battle: 'Battle only',
  hidden: 'Hidden'
}

const REGION_LABELS: Readonly<Record<RegionalVariant, string>> = { alola: 'Alolan', galar: 'Galarian', hisui: 'Hisuian', paldea: 'Paldean' }

const CATEGORY_TONE: Readonly<Record<FormCategory, Tone>> = {
  base: 'neutral',
  regional: 'accent',
  gender: 'accent',
  cosmetic: 'success',
  changeable: 'success',
  fusion: 'warning',
  event: 'gold',
  partner: 'gold',
  mega: 'catch',
  battle: 'catch',
  hidden: 'neutral'
}

export interface FormCategoryTagProps {
  cat: FormCategory
  /** For regional forms: prints "Alolan" etc. instead of "Regional". */
  region?: RegionalVariant
  className?: string
}

/** Small tag naming what kind of form this is. */
export function FormCategoryTag({ cat, region, className }: FormCategoryTagProps) {
  const label = cat === 'regional' && region ? REGION_LABELS[region] : (FORM_CATEGORY_LABELS[cat] ?? cat)
  return (
    <Chip size="sm" tone={CATEGORY_TONE[cat] ?? 'neutral'} variant={cat === 'base' || cat === 'hidden' ? 'outline' : 'soft'} className={className}>
      {label}
    </Chip>
  )
}
