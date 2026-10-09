import { isValidElement, type ComponentPropsWithRef, type ReactElement, type ReactNode } from 'react'
import { cx } from './cx'
import { Icon, type IconName } from './Icon'
import './Button.css'

export type ButtonVariant = 'primary' | 'catch' | 'ghost' | 'subtle' | 'danger'
export type ControlSize = 'sm' | 'md' | 'lg'

/** An icon name from the set, or any element (a BallIcon, a GameIcon ...). */
export type IconSlot = IconName | ReactElement

const ICON_PX: Record<ControlSize, number> = { sm: 14, md: 16, lg: 18 }

export function renderIconSlot(slot: IconSlot | undefined, size: number): ReactNode {
  if (slot === undefined) return null
  return isValidElement(slot) ? slot : <Icon name={slot as IconName} size={size} />
}

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg className={cx('ui-spinner', className)} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: ButtonVariant
  size?: ControlSize
  /** Shows a spinner in place of the leading icon and blocks clicks. */
  loading?: boolean
  icon?: IconSlot
  iconEnd?: IconSlot
  /** Stretch to the width of the container. */
  block?: boolean
}

export function Button({ variant = 'subtle', size = 'md', loading = false, icon, iconEnd, block, className, children, disabled, type, onClick, ...rest }: ButtonProps) {
  const px = ICON_PX[size]
  return (
    <button
      type={type ?? 'button'}
      className={cx('ui-btn', `ui-btn--${variant}`, `ui-btn--${size}`, block && 'ui-btn--block', loading && 'is-loading', className)}
      disabled={disabled}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      onClick={loading ? (e) => e.preventDefault() : onClick}
      {...rest}
    >
      {loading ? <Spinner size={px} /> : renderIconSlot(icon, px)}
      {children !== undefined && children !== null && children !== false && <span className="ui-btn__label">{children}</span>}
      {renderIconSlot(iconEnd, px)}
    </button>
  )
}
