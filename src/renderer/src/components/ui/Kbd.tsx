import type { ReactNode } from 'react'
import { cx } from './cx'
import './Kbd.css'

export interface KbdProps {
  /** One key, or several to print as a chord ("Ctrl" + "K"). */
  keys?: readonly string[]
  children?: ReactNode
  className?: string
}

/** Keyboard key cap(s). */
export function Kbd({ keys, children, className }: KbdProps) {
  if (keys && keys.length > 0) {
    return (
      <span className={cx('ui-kbd-group', className)}>
        {keys.map((k) => (
          <kbd key={k} className="ui-kbd">
            {k}
          </kbd>
        ))}
      </span>
    )
  }
  return <kbd className={cx('ui-kbd', className)}>{children}</kbd>
}
