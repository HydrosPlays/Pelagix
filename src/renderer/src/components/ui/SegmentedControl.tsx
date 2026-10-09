import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cx } from './cx'
import { renderIconSlot, type IconSlot } from './Button'
import { rovingKey, useSlidingMarker } from './Tabs'
import './SegmentedControl.css'

export interface SegmentOption<T extends string | number> {
  value: T
  label?: ReactNode
  icon?: IconSlot
  /** Accessible name; required when there is no text label. */
  ariaLabel?: string
  disabled?: boolean
}

export interface SegmentedControlProps<T extends string | number> {
  options: ReadonlyArray<SegmentOption<T>>
  value: T
  onChange: (value: T) => void
  /** Accessible name of the group. */
  label: string
  size?: 'sm' | 'md'
  /** Stretch to the container width with equal segments. */
  fill?: boolean
  disabled?: boolean
  className?: string
}

/** A small set of mutually exclusive choices (radio group semantics) with a sliding thumb. */
export function SegmentedControl<T extends string | number>({ options, value, onChange, label, size = 'md', fill, disabled, className }: SegmentedControlProps<T>) {
  const groupRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLSpanElement>(null)
  useSlidingMarker(groupRef, thumbRef, '[aria-checked="true"]', [value, options.length], 'width')

  const onKeyDown = (event: KeyboardEvent): void => {
    const next = rovingKey(
      event,
      options.map((o) => o.value),
      value,
      (v) => options.find((o) => o.value === v)?.disabled === true
    )
    if (next === null) return
    onChange(next)
    groupRef.current?.querySelector<HTMLElement>(`[data-value="${CSS.escape(String(next))}"]`)?.focus()
  }

  return (
    <div ref={groupRef} role="radiogroup" aria-label={label} aria-disabled={disabled || undefined} className={cx('ui-seg', `ui-seg--${size}`, fill && 'ui-seg--fill', className)} onKeyDown={onKeyDown}>
      <span ref={thumbRef} className="ui-seg__thumb" aria-hidden="true" />
      {options.map((option) => {
        const checked = option.value === value
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={option.ariaLabel}
            tabIndex={checked ? 0 : -1}
            disabled={disabled || option.disabled}
            data-value={String(option.value)}
            className="ui-seg__item"
            onClick={() => !checked && onChange(option.value)}
          >
            {renderIconSlot(option.icon, size === 'sm' ? 14 : 16)}
            {option.label !== undefined && <span>{option.label}</span>}
          </button>
        )
      })}
    </div>
  )
}
