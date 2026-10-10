import { useId, useRef, type ComponentPropsWithRef, type ReactNode } from 'react'
import { t } from '@renderer/i18n'
import { cx } from './cx'
import { renderIconSlot, type ControlSize, type IconSlot } from './Button'
import { Icon } from './Icon'
import './Field.css'

export interface FieldProps {
  label?: ReactNode
  /** Help text under the control. */
  hint?: ReactNode
  /** Error text; replaces the hint and marks the control invalid. */
  error?: ReactNode
  /** Adds the "optional" marker to the label. */
  optional?: boolean
  /** Id of the control the label points at. */
  htmlFor?: string
  /** Ids for aria-describedby wiring, from `useFieldIds`. */
  hintId?: string
  className?: string
  children: ReactNode
}

/** Label + control + hint / error. The text inputs below use it; wrap custom controls with it too. */
export function Field({ label, hint, error, optional, htmlFor, hintId, className, children }: FieldProps) {
  const message = error ?? hint
  return (
    <div className={cx('ui-field', className)}>
      {label !== undefined && (
        <label className="ui-field__label" htmlFor={htmlFor}>
          {label}
          {optional && <span className="ui-field__optional">{t('components.field.optional')}</span>}
        </label>
      )}
      {children}
      {message !== undefined && message !== null && message !== false && (
        <div id={hintId} className={cx('ui-field__hint', error !== undefined && error !== null && error !== false && 'is-error')} role={error ? 'alert' : undefined}>
          {message}
        </div>
      )}
    </div>
  )
}

interface FieldChrome {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  optional?: boolean
  /** Leading icon inside the box. */
  icon?: IconSlot
  /** Trailing content inside the box (unit, button). */
  suffix?: ReactNode
  size?: ControlSize
  /** Class for the outer field wrapper. */
  wrapperClassName?: string
}

function useFieldIds(id: string | undefined, hasMessage: boolean): { inputId: string; hintId: string | undefined } {
  const auto = useId()
  const inputId = id ?? auto
  return { inputId, hintId: hasMessage ? `${inputId}-hint` : undefined }
}

const hasText = (v: ReactNode): boolean => v !== undefined && v !== null && v !== false && v !== ''

// ---------------------------------------------------------------- TextField

export interface TextFieldProps extends Omit<ComponentPropsWithRef<'input'>, 'size' | 'onChange' | 'value'>, FieldChrome {
  value: string
  onChange: (value: string) => void
  /** Shows a clear button while there is text. */
  clearable?: boolean
}

export function TextField({ label, hint, error, optional, icon, suffix, size = 'md', wrapperClassName, className, value, onChange, clearable, id, type, disabled, ...rest }: TextFieldProps) {
  const { inputId, hintId } = useFieldIds(id, hasText(error) || hasText(hint))
  return (
    <Field label={label} hint={hint} error={error} optional={optional} htmlFor={inputId} hintId={hintId} className={wrapperClassName}>
      <div className={cx('ui-input', `ui-input--${size}`, hasText(error) && 'is-invalid', disabled && 'is-disabled', className)}>
        {icon !== undefined && <span className="ui-input__icon">{renderIconSlot(icon, 16)}</span>}
        <input
          id={inputId}
          type={type ?? 'text'}
          className="ui-input__control"
          value={value}
          disabled={disabled}
          aria-invalid={hasText(error) || undefined}
          aria-describedby={hintId}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
          {...rest}
        />
        {clearable && value !== '' && !disabled && (
          <button type="button" className="ui-input__clear" aria-label={t('common.clear')} onClick={() => onChange('')}>
            <Icon name="close" size={14} />
          </button>
        )}
        {suffix !== undefined && <span className="ui-input__suffix">{suffix}</span>}
      </div>
    </Field>
  )
}

// ---------------------------------------------------------------- TextArea

export interface TextAreaProps extends Omit<ComponentPropsWithRef<'textarea'>, 'onChange' | 'value'>, Omit<FieldChrome, 'icon' | 'suffix' | 'size'> {
  value: string
  onChange: (value: string) => void
  /** Shows a "n / max" counter when `maxLength` is set. Default true. */
  counter?: boolean
}

export function TextArea({ label, hint, error, optional, wrapperClassName, className, value, onChange, counter = true, id, rows = 3, maxLength, disabled, ...rest }: TextAreaProps) {
  const { inputId, hintId } = useFieldIds(id, hasText(error) || hasText(hint))
  return (
    <Field label={label} hint={hint} error={error} optional={optional} htmlFor={inputId} hintId={hintId} className={wrapperClassName}>
      <div className={cx('ui-input', 'ui-input--area', hasText(error) && 'is-invalid', disabled && 'is-disabled', className)}>
        <textarea
          id={inputId}
          className="ui-input__control"
          rows={rows}
          value={value}
          maxLength={maxLength}
          disabled={disabled}
          aria-invalid={hasText(error) || undefined}
          aria-describedby={hintId}
          onChange={(e) => onChange(e.target.value)}
          {...rest}
        />
        {counter && maxLength !== undefined && (
          <span className="ui-input__counter" aria-hidden="true">
            {value.length} / {maxLength}
          </span>
        )}
      </div>
    </Field>
  )
}

// ---------------------------------------------------------------- NumberField

export interface NumberFieldProps extends Omit<ComponentPropsWithRef<'input'>, 'size' | 'onChange' | 'value' | 'min' | 'max' | 'step' | 'type'>, FieldChrome {
  /** null = empty. */
  value: number | null
  onChange: (value: number | null) => void
  min?: number
  max?: number
  step?: number
  /** Show the − / + buttons. Default true. */
  steppers?: boolean
}

const clamp = (n: number, min: number | undefined, max: number | undefined): number => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n))

/** Integer / decimal input with steppers. Typing is free; the value is clamped on blur and on step. */
export function NumberField({ label, hint, error, optional, icon, suffix, size = 'md', wrapperClassName, className, value, onChange, min, max, step = 1, steppers = true, id, disabled, onBlur, onKeyDown, ...rest }: NumberFieldProps) {
  const { inputId, hintId } = useFieldIds(id, hasText(error) || hasText(hint))
  const bump = (direction: 1 | -1): void => {
    const base = value ?? (direction === 1 ? (min ?? 0) - step : (max ?? 0) + step)
    onChange(clamp(base + direction * step, min, max))
  }
  return (
    <Field label={label} hint={hint} error={error} optional={optional} htmlFor={inputId} hintId={hintId} className={wrapperClassName}>
      <div className={cx('ui-input', 'ui-input--number', `ui-input--${size}`, hasText(error) && 'is-invalid', disabled && 'is-disabled', className)}>
        {icon !== undefined && <span className="ui-input__icon">{renderIconSlot(icon, 16)}</span>}
        <input
          id={inputId}
          type="text"
          inputMode={Number.isInteger(step) ? 'numeric' : 'decimal'}
          className="ui-input__control"
          value={value === null ? '' : String(value)}
          disabled={disabled}
          role="spinbutton"
          aria-valuenow={value ?? undefined}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-invalid={hasText(error) || undefined}
          aria-describedby={hintId}
          autoComplete="off"
          onChange={(e) => {
            const text = e.target.value.trim()
            if (text === '') return onChange(null)
            if (!/^-?\d*\.?\d*$/.test(text)) return
            const parsed = Number(text)
            if (Number.isFinite(parsed)) onChange(parsed)
          }}
          onBlur={(e) => {
            if (value !== null) {
              const fixed = clamp(value, min, max)
              if (fixed !== value) onChange(fixed)
            }
            onBlur?.(e)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              bump(1)
            } else if (e.key === 'ArrowDown') {
              e.preventDefault()
              bump(-1)
            }
            onKeyDown?.(e)
          }}
          {...rest}
        />
        {suffix !== undefined && <span className="ui-input__suffix">{suffix}</span>}
        {steppers && (
          <span className="ui-input__steppers">
            <button type="button" tabIndex={-1} aria-label={t('components.field.decrease')} disabled={disabled || (value !== null && min !== undefined && value <= min)} onClick={() => bump(-1)}>
              <Icon name="minus" size={14} />
            </button>
            <button type="button" tabIndex={-1} aria-label={t('components.field.increase')} disabled={disabled || (value !== null && max !== undefined && value >= max)} onClick={() => bump(1)}>
              <Icon name="plus" size={14} />
            </button>
          </span>
        )}
      </div>
    </Field>
  )
}

// ---------------------------------------------------------------- DateField

export interface DateFieldProps extends Omit<ComponentPropsWithRef<'input'>, 'size' | 'onChange' | 'value' | 'type' | 'min' | 'max'>, Omit<FieldChrome, 'icon'> {
  /** ISO yyyy-mm-dd, or "" for empty. */
  value: string
  onChange: (value: string) => void
  /** ISO bounds. */
  min?: string
  max?: string
}

/** Calendar date as ISO yyyy-mm-dd, on the platform date picker. */
export function DateField({ label, hint, error, optional, suffix, size = 'md', wrapperClassName, className, value, onChange, id, disabled, ...rest }: DateFieldProps) {
  const { inputId, hintId } = useFieldIds(id, hasText(error) || hasText(hint))
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <Field label={label} hint={hint} error={error} optional={optional} htmlFor={inputId} hintId={hintId} className={wrapperClassName}>
      <div className={cx('ui-input', 'ui-input--date', `ui-input--${size}`, hasText(error) && 'is-invalid', disabled && 'is-disabled', className)}>
        <button
          type="button"
          className="ui-input__icon ui-input__icon--button"
          aria-label={t('components.field.openCalendar')}
          tabIndex={-1}
          disabled={disabled}
          onClick={() => {
            try {
              inputRef.current?.showPicker()
            } catch {
              inputRef.current?.focus()
            }
          }}
        >
          <Icon name="calendar" size={16} />
        </button>
        <input
          ref={inputRef}
          id={inputId}
          type="date"
          className="ui-input__control"
          value={value}
          disabled={disabled}
          aria-invalid={hasText(error) || undefined}
          aria-describedby={hintId}
          onChange={(e) => onChange(e.target.value)}
          {...rest}
        />
        {suffix !== undefined && <span className="ui-input__suffix">{suffix}</span>}
      </div>
    </Field>
  )
}
