import type { ComponentPropsWithRef } from 'react'
import { cx } from './cx'
import { renderIconSlot, Spinner, type ControlSize, type IconSlot } from './Button'
import { Tooltip, type TooltipPlacement } from './Tooltip'
import './IconButton.css'

export type IconButtonVariant = 'ghost' | 'subtle' | 'primary' | 'catch' | 'danger'

const ICON_PX: Record<ControlSize, number> = { sm: 16, md: 18, lg: 20 }

export interface IconButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'children' | 'aria-label'> {
  icon: IconSlot
  /** Accessible name; also shown as the tooltip. */
  label: string
  variant?: IconButtonVariant
  size?: ControlSize
  /** Toggle state: sets aria-pressed and the active look. */
  pressed?: boolean
  loading?: boolean
  /** Tooltip text, or false for none. Default: the label. */
  tooltip?: string | false
  tooltipPlacement?: TooltipPlacement
  /** Fully round instead of a rounded square. */
  round?: boolean
}

export function IconButton({ icon, label, variant = 'ghost', size = 'md', pressed, loading = false, tooltip, tooltipPlacement, round, className, type, onClick, ...rest }: IconButtonProps) {
  const button = (
    <button
      type={type ?? 'button'}
      className={cx('ui-iconbtn', `ui-iconbtn--${variant}`, `ui-iconbtn--${size}`, round && 'ui-iconbtn--round', pressed && 'is-pressed', className)}
      aria-label={label}
      aria-pressed={pressed}
      aria-busy={loading || undefined}
      onClick={loading ? (e) => e.preventDefault() : onClick}
      {...rest}
    >
      {loading ? <Spinner size={ICON_PX[size]} /> : renderIconSlot(icon, ICON_PX[size])}
    </button>
  )
  if (tooltip === false) return button
  return (
    <Tooltip content={tooltip ?? label} placement={tooltipPlacement}>
      {button}
    </Tooltip>
  )
}
