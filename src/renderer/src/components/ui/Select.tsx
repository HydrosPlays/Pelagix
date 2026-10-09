import { Fragment, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { normalizeText } from '@renderer/lib/search'
import { cx } from './cx'
import { renderIconSlot, Spinner, type ControlSize, type IconSlot } from './Button'
import { Field } from './Field'
import { Icon } from './Icon'
import { Portal } from './Portal'
import { useEscapeLayer, useFloating, useOutsidePress } from './layers'
import './Select.css'

export interface SelectOption<T extends string | number = string> {
  value: T
  label: string
  /** Leading element: a GameIcon, BallIcon, Sprite, Icon ... */
  icon?: ReactNode
  /** Secondary text, right-aligned in the row. */
  description?: ReactNode
  /** Options with the same group are listed under that heading (in first-seen order). */
  group?: string
  /** Extra search text for the Combobox. */
  keywords?: string
  disabled?: boolean
}

interface ChoiceChrome {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  optional?: boolean
  /** Accessible name when there is no visible label. */
  ariaLabel?: string
  placeholder?: string
  size?: ControlSize
  disabled?: boolean
  /** Upper bound of the list height, px. Default 320. */
  maxHeight?: number
  id?: string
  className?: string
  /** Class for the outer field wrapper. */
  wrapperClassName?: string
}

interface Row<T extends string | number> {
  option: SelectOption<T>
  /** Position among the selectable rows. */
  index: number
  /** Group heading to print above this row. */
  heading?: string
}

/** Orders options by group (first-seen) and marks where each group starts. */
function toRows<T extends string | number>(options: ReadonlyArray<SelectOption<T>>): Row<T>[] {
  const groups = new Map<string, SelectOption<T>[]>()
  for (const option of options) {
    const key = option.group ?? ''
    const list = groups.get(key)
    if (list) list.push(option)
    else groups.set(key, [option])
  }
  const rows: Row<T>[] = []
  for (const [group, list] of groups) {
    list.forEach((option, i) => rows.push({ option, index: rows.length, heading: i === 0 && group !== '' ? group : undefined }))
  }
  return rows
}

function nextEnabled<T extends string | number>(rows: Row<T>[], from: number, step: 1 | -1): number {
  if (rows.length === 0) return -1
  let i = from
  for (let n = 0; n < rows.length; n++) {
    i = (i + step + rows.length) % rows.length
    if (!rows[i]!.option.disabled) return i
  }
  return -1
}

function edgeEnabled<T extends string | number>(rows: Row<T>[], edge: 'first' | 'last'): number {
  return edge === 'first' ? nextEnabled(rows, -1, 1) : nextEnabled(rows, rows.length, -1)
}

interface ListProps<T extends string | number> {
  listRef: RefObject<HTMLDivElement | null>
  id: string
  rows: Row<T>[]
  active: number
  selected: T | null
  labelledBy?: string
  emptyText?: string
  footer?: ReactNode
  onHover: (index: number) => void
  onPick: (option: SelectOption<T>) => void
}

function OptionList<T extends string | number>({ listRef, id, rows, active, selected, labelledBy, emptyText, footer, onHover, onPick }: ListProps<T>) {
  // Keep the keyboard-highlighted row in view.
  useEffect(() => {
    if (active < 0) return
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active, listRef])

  return (
    <Portal>
      <div ref={listRef} className="ui-listbox" onMouseDown={(e) => e.preventDefault()}>
        <div id={id} role="listbox" aria-labelledby={labelledBy} className="ui-listbox__scroll">
          {rows.length === 0 && <div className="ui-listbox__empty">{emptyText ?? 'No options'}</div>}
          {rows.map(({ option, index, heading }) => (
            <Fragment key={String(option.value)}>
              {heading !== undefined && (
                <div className="ui-listbox__group" role="presentation">
                  {heading}
                </div>
              )}
              <div
                id={`${id}-opt-${index}`}
                role="option"
                aria-selected={option.value === selected}
                aria-disabled={option.disabled || undefined}
                data-index={index}
                className={cx('ui-option', index === active && 'is-active')}
                onPointerMove={() => !option.disabled && index !== active && onHover(index)}
                onClick={() => !option.disabled && onPick(option)}
              >
                {option.icon !== undefined && <span className="ui-option__icon">{option.icon}</span>}
                <span className="ui-option__label">{option.label}</span>
                {option.description !== undefined && <span className="ui-option__desc">{option.description}</span>}
                {option.value === selected && <Icon name="check" size={15} className="ui-option__check" />}
              </div>
            </Fragment>
          ))}
        </div>
        {footer}
      </div>
    </Portal>
  )
}

// ---------------------------------------------------------------- Select

export interface SelectProps<T extends string | number = string> extends ChoiceChrome {
  options: ReadonlyArray<SelectOption<T>>
  value: T | null
  onChange: (value: T, option: SelectOption<T>) => void
  /** Leading icon in the trigger when the selected option has none. */
  icon?: IconSlot
}

/**
 * Single choice from a list. Keyboard: arrows, Home / End, Enter / Space, Escape, and typing to
 * jump to an option. Use `Combobox` instead when the list is long enough to need searching.
 */
export function Select<T extends string | number = string>({ options, value, onChange, icon, label, hint, error, optional, ariaLabel, placeholder = 'Select…', size = 'md', disabled, maxHeight = 320, id, className, wrapperClassName }: SelectProps<T>) {
  const auto = useId()
  const baseId = id ?? auto
  const listId = `${baseId}-list`
  const labelId = label !== undefined ? `${baseId}-label` : undefined
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const typed = useRef({ text: '', at: 0 })

  const rows = useMemo(() => toRows(options), [options])
  const selectedRow = rows.find((r) => r.option.value === value)
  const selected = selectedRow?.option

  const openList = (prefer?: 'first' | 'last'): void => {
    if (disabled) return
    setActive(prefer ? edgeEnabled(rows, prefer) : selectedRow && !selectedRow.option.disabled ? selectedRow.index : edgeEnabled(rows, 'first'))
    setOpen(true)
  }
  const close = (): void => setOpen(false)
  const pick = (option: SelectOption<T>): void => {
    setOpen(false)
    if (option.value !== value) onChange(option.value, option)
    triggerRef.current?.focus()
  }

  useFloating(open, () => triggerRef.current, listRef, { matchWidth: true, maxHeight })
  useOutsidePress(open, [triggerRef, listRef], close)
  useEscapeLayer(open, close)

  const typeahead = (char: string): void => {
    const now = Date.now()
    const state = typed.current
    state.text = now - state.at > 700 ? char : state.text + char
    state.at = now
    const needle = normalizeText(state.text)
    if (needle === '') return
    const start = open ? active : (selectedRow?.index ?? -1)
    const ordered = [...rows.slice(start + 1), ...rows.slice(0, start + 1)]
    const hit = ordered.find((r) => !r.option.disabled && normalizeText(r.option.label).startsWith(needle))
    if (!hit) return
    if (open) setActive(hit.index)
    else if (hit.option.value !== value) onChange(hit.option.value, hit.option)
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if (disabled) return
    const { key } = event
    if (!open) {
      if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter' || key === ' ') {
        event.preventDefault()
        openList()
      } else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        typeahead(key)
      }
      return
    }
    if (key === 'ArrowDown') {
      event.preventDefault()
      setActive((i) => nextEnabled(rows, i, 1))
    } else if (key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => nextEnabled(rows, i < 0 ? 0 : i, -1))
    } else if (key === 'Home') {
      event.preventDefault()
      setActive(edgeEnabled(rows, 'first'))
    } else if (key === 'End') {
      event.preventDefault()
      setActive(edgeEnabled(rows, 'last'))
    } else if (key === 'Enter' || key === ' ') {
      event.preventDefault()
      const row = rows[active]
      if (row && !row.option.disabled) pick(row.option)
    } else if (key === 'Tab') {
      close()
    } else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      typeahead(key)
    }
  }

  return (
    <Field label={label !== undefined ? <span id={labelId}>{label}</span> : undefined} hint={hint} error={error} optional={optional} htmlFor={baseId} hintId={hint !== undefined || error !== undefined ? `${baseId}-hint` : undefined} className={wrapperClassName}>
      <button
        ref={triggerRef}
        type="button"
        id={baseId}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? `${listId}-opt-${active}` : undefined}
        aria-labelledby={labelId ? `${labelId} ${baseId}-value` : undefined}
        aria-label={labelId ? undefined : ariaLabel}
        aria-invalid={error !== undefined && error !== null && error !== false ? true : undefined}
        disabled={disabled}
        className={cx('ui-select', `ui-select--${size}`, open && 'is-open', error !== undefined && error !== null && error !== false && 'is-invalid', className)}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
      >
        {selected?.icon !== undefined ? <span className="ui-option__icon">{selected.icon}</span> : icon !== undefined ? <span className="ui-select__icon">{renderIconSlot(icon, 16)}</span> : null}
        <span id={`${baseId}-value`} className={cx('ui-select__value', !selected && 'is-placeholder')}>
          {selected ? selected.label : placeholder}
        </span>
        <Icon name="chevron-down" size={16} className="ui-select__chevron" />
      </button>
      {open && <OptionList listRef={listRef} id={listId} rows={rows} active={active} selected={value} labelledBy={labelId} onHover={setActive} onPick={pick} />}
    </Field>
  )
}

// ---------------------------------------------------------------- Combobox

export interface ComboboxProps<T extends string | number = string> extends ChoiceChrome {
  options: ReadonlyArray<SelectOption<T>>
  /** The picked option, or null. */
  value: T | null
  /** Called with null when the selection is cleared. */
  onChange: (value: T | null, option: SelectOption<T> | null) => void
  /**
   * Free-text mode: the input keeps whatever is typed and the options act as suggestions.
   * Picking one writes its label through `onTextChange` and reports it through `onChange`.
   */
  freeText?: { text: string; onTextChange: (text: string) => void }
  /** Show a clear button. Default true. */
  clearable?: boolean
  /** Leading icon in the input when the selected option has none. Default "search". */
  icon?: IconSlot
  emptyText?: string
  /** Rows rendered at once; the rest are reached by typing. Default 60. */
  maxItems?: number
  /** Custom match. Receives the option and the normalised query (never empty). */
  filter?: (option: SelectOption<T>, query: string) => boolean
  loading?: boolean
}

function defaultFilter<T extends string | number>(option: SelectOption<T>, query: string): boolean {
  return normalizeText(`${option.label} ${option.keywords ?? ''}`).includes(query)
}

/** Searchable single choice: type to filter, arrows to move, Enter to pick, Escape to close. */
export function Combobox<T extends string | number = string>({
  options,
  value,
  onChange,
  freeText,
  clearable = true,
  icon = 'search',
  emptyText = 'No matches',
  maxItems = 60,
  filter = defaultFilter,
  loading,
  label,
  hint,
  error,
  optional,
  ariaLabel,
  placeholder = 'Search…',
  size = 'md',
  disabled,
  maxHeight = 320,
  id,
  className,
  wrapperClassName
}: ComboboxProps<T>) {
  const auto = useId()
  const baseId = id ?? auto
  const listId = `${baseId}-list`
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState<string | null>(null)
  const [active, setActive] = useState(-1)
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const selected = useMemo(() => options.find((o) => o.value === value), [options, value])
  // What the user is filtering by: their typing, or in free-text mode the text itself.
  const needle = normalizeText(freeText ? (open && query !== null ? query : '') : (query ?? ''))

  const { rows, hidden } = useMemo(() => {
    let matches: SelectOption<T>[]
    if (needle === '') {
      matches = options.slice()
    } else {
      const starts: SelectOption<T>[] = []
      const rest: SelectOption<T>[] = []
      for (const option of options) {
        if (!filter(option, needle)) continue
        if (normalizeText(option.label).startsWith(needle)) starts.push(option)
        else rest.push(option)
      }
      matches = [...starts, ...rest]
    }
    const shown = matches.slice(0, maxItems)
    return { rows: toRows(shown), hidden: matches.length - shown.length }
  }, [options, needle, filter, maxItems])

  const text = freeText ? freeText.text : (query ?? selected?.label ?? '')

  const close = (): void => {
    setOpen(false)
    setQuery(null)
  }
  const openList = (): void => {
    if (disabled || open) return
    setOpen(true)
    setActive(-1)
  }
  const pick = (option: SelectOption<T>): void => {
    freeText?.onTextChange(option.label)
    onChange(option.value, option)
    close()
  }
  const clear = (): void => {
    freeText?.onTextChange('')
    setQuery(null)
    if (value !== null) onChange(null, null)
    inputRef.current?.focus()
  }

  // The first match is pre-highlighted while typing, so Enter takes it.
  useEffect(() => {
    if (!open) return
    if (needle !== '') setActive(edgeEnabled(rows, 'first'))
    else setActive(rows.find((r) => r.option.value === value && !r.option.disabled)?.index ?? -1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needle, open])

  useFloating(open, () => boxRef.current, listRef, { matchWidth: true, maxHeight })
  useOutsidePress(open, [boxRef, listRef], close)
  useEscapeLayer(open, close)

  const onKeyDown = (event: KeyboardEvent): void => {
    const { key } = event
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      event.preventDefault()
      if (!open) return openList()
      setActive((i) => nextEnabled(rows, key === 'ArrowUp' && i < 0 ? 0 : i, key === 'ArrowDown' ? 1 : -1))
    } else if (key === 'Home' && open && rows.length > 0 && (event.ctrlKey || text === '')) {
      event.preventDefault()
      setActive(edgeEnabled(rows, 'first'))
    } else if (key === 'End' && open && rows.length > 0 && (event.ctrlKey || text === '')) {
      event.preventDefault()
      setActive(edgeEnabled(rows, 'last'))
    } else if (key === 'Enter') {
      if (!open) return
      const row = rows[active]
      if (row && !row.option.disabled) {
        event.preventDefault()
        pick(row.option)
      } else if (freeText) {
        event.preventDefault()
        close()
      }
    } else if (key === 'Tab') {
      if (open) close()
    }
  }

  const invalid = error !== undefined && error !== null && error !== false
  const showClear = clearable && !disabled && (freeText ? freeText.text !== '' : value !== null || (query ?? '') !== '')

  return (
    <Field label={label} hint={hint} error={error} optional={optional} htmlFor={baseId} hintId={hint !== undefined || error !== undefined ? `${baseId}-hint` : undefined} className={wrapperClassName}>
      <div ref={boxRef} className={cx('ui-input', `ui-input--${size}`, 'ui-combobox', open && 'is-open', invalid && 'is-invalid', disabled && 'is-disabled', className)} onMouseDown={(e) => e.target !== inputRef.current && e.preventDefault()} onClick={() => inputRef.current?.focus()}>
        {!freeText && selected?.icon !== undefined && query === null ? <span className="ui-option__icon">{selected.icon}</span> : icon !== undefined ? <span className="ui-input__icon">{renderIconSlot(icon, 16)}</span> : null}
        <input
          ref={inputRef}
          id={baseId}
          type="text"
          role="combobox"
          className="ui-input__control"
          value={text}
          placeholder={placeholder}
          disabled={disabled}
          aria-label={label === undefined ? ariaLabel : undefined}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open && active >= 0 ? `${listId}-opt-${active}` : undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={hint !== undefined || error !== undefined ? `${baseId}-hint` : undefined}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            const next = e.target.value
            setQuery(next)
            freeText?.onTextChange(next)
            if (!open) setOpen(true)
          }}
          onFocus={(e) => !freeText && e.target.select()}
          onClick={openList}
          onKeyDown={onKeyDown}
        />
        {loading && <Spinner size={14} className="ui-combobox__spinner" />}
        {showClear && (
          <button type="button" className="ui-input__clear" aria-label="Clear" tabIndex={-1} onClick={clear}>
            <Icon name="close" size={14} />
          </button>
        )}
        <button type="button" className="ui-combobox__toggle" aria-label={open ? 'Close list' : 'Open list'} tabIndex={-1} disabled={disabled} onClick={() => (open ? close() : openList())}>
          <Icon name="chevron-down" size={16} className="ui-select__chevron" />
        </button>
      </div>
      {open && (rows.length > 0 || !freeText) && (
        <OptionList
          listRef={listRef}
          id={listId}
          rows={rows}
          active={active}
          selected={value}
          emptyText={emptyText}
          footer={hidden > 0 ? <div className="ui-listbox__more">{hidden.toLocaleString('en-US')} more - keep typing to narrow down</div> : undefined}
          onHover={setActive}
          onPick={pick}
        />
      )}
    </Field>
  )
}
