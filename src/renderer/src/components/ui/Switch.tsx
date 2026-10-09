import { useEffect, useId, useRef, type ReactNode } from 'react'
import { cx } from './cx'
import { Icon } from './Icon'
import './Switch.css'

export interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  /** Visible label, right of the control. Without one, pass `ariaLabel`. */
  label?: ReactNode
  /** Secondary line under the label. */
  description?: ReactNode
  ariaLabel?: string
  disabled?: boolean
  /** Put the control on the right and let the label take the row (settings lists). */
  reverse?: boolean
  className?: string
}

/** On / off toggle (role="switch"). */
export function Switch({ checked, onChange, label, description, ariaLabel, disabled, reverse, className }: SwitchProps) {
  const id = useId()
  const hasText = label !== undefined || description !== undefined
  const control = (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label === undefined ? ariaLabel : undefined}
      aria-labelledby={label !== undefined ? `${id}-label` : undefined}
      aria-describedby={description !== undefined ? `${id}-desc` : undefined}
      disabled={disabled}
      className="ui-switch"
      onClick={() => onChange(!checked)}
    >
      <span className="ui-switch__thumb" />
    </button>
  )
  if (!hasText) return control
  return (
    <div className={cx('ui-check-row', reverse && 'ui-check-row--reverse', disabled && 'is-disabled', className)}>
      {control}
      <label htmlFor={id} className="ui-check-row__text">
        {label !== undefined && (
          <span id={`${id}-label`} className="ui-check-row__label">
            {label}
          </span>
        )}
        {description !== undefined && (
          <span id={`${id}-desc`} className="ui-check-row__desc">
            {description}
          </span>
        )}
      </label>
    </div>
  )
}

export interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: ReactNode
  description?: ReactNode
  ariaLabel?: string
  /** Shows a dash: some but not all of a group are selected. */
  indeterminate?: boolean
  disabled?: boolean
  className?: string
}

/** Native checkbox with a custom box. */
export function Checkbox({ checked, onChange, label, description, ariaLabel, indeterminate = false, disabled, className }: CheckboxProps) {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate
  }, [indeterminate])

  const box = (
    <span className="ui-checkbox">
      <input
        ref={inputRef}
        id={id}
        type="checkbox"
        className="ui-checkbox__input"
        checked={checked}
        disabled={disabled}
        aria-label={label === undefined ? ariaLabel : undefined}
        aria-describedby={description !== undefined ? `${id}-desc` : undefined}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="ui-checkbox__box" aria-hidden="true">
        <Icon name={indeterminate ? 'minus' : 'check'} size={13} strokeWidth={2.6} />
      </span>
    </span>
  )
  if (label === undefined && description === undefined) return box
  return (
    <div className={cx('ui-check-row', disabled && 'is-disabled', className)}>
      {box}
      <label htmlFor={id} className="ui-check-row__text">
        {label !== undefined && <span className="ui-check-row__label">{label}</span>}
        {description !== undefined && (
          <span id={`${id}-desc`} className="ui-check-row__desc">
            {description}
          </span>
        )}
      </label>
    </div>
  )
}
