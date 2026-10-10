import type { CSSProperties, MouseEventHandler, ReactNode } from 'react'
import { t } from '@renderer/i18n'
import { cx } from './cx'
import { renderIconSlot, type IconSlot } from './Button'
import { Icon } from './Icon'
import './Chip.css'

export type Tone = 'neutral' | 'accent' | 'gold' | 'catch' | 'success' | 'warning' | 'danger'

export interface ChipProps {
  children: ReactNode
  tone?: Tone
  /** soft: tinted fill (default). outline: hairline only. solid: full colour. */
  variant?: 'soft' | 'outline' | 'solid'
  size?: 'sm' | 'md'
  icon?: IconSlot
  /** Makes the chip a toggle button (filters). */
  onClick?: MouseEventHandler<HTMLButtonElement>
  /** Toggle state of a clickable chip. */
  selected?: boolean
  /** Adds a remove button. */
  onRemove?: () => void
  /** Accessible name of the remove button. Default "Remove". */
  removeLabel?: string
  disabled?: boolean
  /** Custom colour (any CSS colour); overrides the tone for both text and tint. */
  color?: string
  title?: string
  className?: string
}

/** Compact label: static tag, toggleable filter chip, or removable token. */
export function Chip({ children, tone = 'neutral', variant = 'soft', size = 'md', icon, onClick, selected, onRemove, removeLabel = t('common.remove'), disabled, color, title, className }: ChipProps) {
  const classes = cx('ui-chip', `ui-chip--${tone}`, `ui-chip--${variant}`, `ui-chip--${size}`, onClick && 'ui-chip--button', selected && 'is-selected', className)
  const style = color ? ({ '--chip-color': color, '--chip-tint': `color-mix(in srgb, ${color} 16%, transparent)`, '--chip-solid': color } as CSSProperties) : undefined
  const inner = (
    <>
      {renderIconSlot(icon, size === 'sm' ? 12 : 14)}
      <span className="ui-chip__label">{children}</span>
    </>
  )
  const remove = onRemove && (
    <button type="button" className="ui-chip__remove" aria-label={removeLabel} disabled={disabled} onClick={onRemove}>
      <Icon name="close" size={12} />
    </button>
  )
  if (onClick) {
    return (
      <span className={cx('ui-chip-wrap', onRemove && 'has-remove')}>
        <button type="button" className={classes} style={style} title={title} aria-pressed={selected} disabled={disabled} onClick={onClick}>
          {inner}
        </button>
        {remove}
      </span>
    )
  }
  return (
    <span className={classes} style={style} title={title}>
      {inner}
      {remove}
    </span>
  )
}

/** A small static label; the same thing as a small Chip. */
export function Tag(props: Omit<ChipProps, 'onClick' | 'selected' | 'onRemove' | 'size'>) {
  return <Chip size="sm" {...props} />
}
