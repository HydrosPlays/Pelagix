import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Badge, Button, DateField, Icon, Portal, cx, useEscapeLayer, useFloating, useOutsidePress, type IconName } from '@renderer/components/ui'
import { addDays, todayIso } from '@renderer/lib/format'
import { normalizeText } from '@renderer/lib/search'

// ---------------------------------------------------------------- the popover shell

interface FilterPopoverProps {
  /** Text on the button. */
  label: string
  icon?: IconName
  /** How many values are picked; shown as a badge and lights the button up. */
  count: number
  /** What the popover is, for assistive tech. */
  popup: 'listbox' | 'dialog'
  children: (close: () => void) => ReactNode
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * A filter button with a popover under it. Opens on click, Enter, Space or ArrowDown; Escape and
 * a click elsewhere close it; Tab past either end closes it and returns to the button.
 */
function FilterPopover({ label, icon, count, popup, children }: FilterPopoverProps) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const id = useId()

  const close = (refocus = true): void => {
    setOpen(false)
    if (refocus) buttonRef.current?.focus()
  }

  useFloating(open, () => buttonRef.current, panelRef, { side: 'bottom', align: 'start', maxHeight: 440 })
  useOutsidePress(open, [buttonRef, panelRef], () => close(false))
  useEscapeLayer(open, () => close())

  // Focus moves into the popover once it is there.
  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    const target = panel?.querySelector<HTMLElement>('[data-autofocus]') ?? panel?.querySelector<HTMLElement>(FOCUSABLE) ?? panel
    target?.focus({ preventScroll: true })
  }, [open])

  const onPanelKey = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Tab') return
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE))
    const edge = event.shiftKey ? items[0] : items[items.length - 1]
    if (items.length === 0 || document.activeElement === edge) {
      event.preventDefault()
      close()
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={cx('journal-filter', count > 0 && 'is-active', open && 'is-open')}
        aria-haspopup={popup}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (!open && event.key === 'ArrowDown') {
            event.preventDefault()
            setOpen(true)
          }
        }}
      >
        {icon && <Icon name={icon} size={15} />}
        <span>{label}</span>
        {count > 0 && <Badge count={count} label={`${count} selected`} />}
        <Icon name="chevron-down" size={14} className="journal-filter__chevron" />
      </button>
      {open && (
        <Portal>
          <div ref={panelRef} id={id} className="journal-pop" tabIndex={-1} onKeyDown={onPanelKey}>
            {children(close)}
          </div>
        </Portal>
      )}
    </>
  )
}

// ---------------------------------------------------------------- pick several from a list

export interface FilterOption<T extends string | number> {
  value: T
  label: string
  icon?: ReactNode
  /** Entries carrying this value. */
  count?: number
  /** Options sharing a group are listed under that heading. */
  group?: string
}

export interface FilterMenuProps<T extends string | number> {
  label: string
  icon?: IconName
  options: ReadonlyArray<FilterOption<T>>
  selected: readonly T[]
  onChange: (next: T[]) => void
  /** Adds a search box above the list (long lists). */
  searchable?: boolean
}

/** Multi-select filter: a list of ticks, in a popover. Arrows move, Enter or Space toggles. */
export function FilterMenu<T extends string | number>({ label, icon, options, selected, onChange, searchable = false }: FilterMenuProps<T>) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const baseId = useId()
  const picked = useMemo(() => new Set<T>(selected), [selected])

  const shown = useMemo(() => {
    const needle = normalizeText(query)
    return needle === '' ? options : options.filter((o) => normalizeText(`${o.label} ${o.group ?? ''}`).includes(needle))
  }, [options, query])
  const at = Math.min(active, Math.max(0, shown.length - 1))

  const toggle = (value: T): void => {
    onChange(picked.has(value) ? selected.filter((v) => v !== value) : [...selected, value])
  }

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${at}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [at])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const typing = event.target instanceof HTMLInputElement
    const { key } = event
    if (key === 'ArrowDown') setActive(Math.min(shown.length - 1, at + 1))
    else if (key === 'ArrowUp') setActive(Math.max(0, at - 1))
    else if (key === 'Home' && !typing) setActive(0)
    else if (key === 'End' && !typing) setActive(shown.length - 1)
    else if (key === 'Enter' || (key === ' ' && !typing)) {
      const option = shown[at]
      if (option) toggle(option.value)
    } else return
    event.preventDefault()
  }

  return (
    <FilterPopover label={label} icon={icon} count={selected.length} popup="listbox">
      {() => (
        <div className="journal-pop__menu" onKeyDown={onKeyDown}>
          {searchable && (
            <label className="journal-pop__search">
              <Icon name="search" size={15} />
              <input
                type="text"
                value={query}
                placeholder={`Search ${label.toLowerCase()}`}
                aria-label={`Search ${label.toLowerCase()}`}
                aria-controls={`${baseId}-list`}
                aria-activedescendant={shown.length > 0 ? `${baseId}-opt-${at}` : undefined}
                autoComplete="off"
                spellCheck={false}
                data-autofocus
                onChange={(event) => {
                  setQuery(event.target.value)
                  setActive(0)
                }}
              />
            </label>
          )}
          <div
            ref={listRef}
            id={`${baseId}-list`}
            role="listbox"
            aria-label={label}
            aria-multiselectable="true"
            aria-activedescendant={shown.length > 0 ? `${baseId}-opt-${at}` : undefined}
            tabIndex={searchable ? -1 : 0}
            data-autofocus={searchable ? undefined : true}
            className="journal-pop__list"
          >
            {shown.length === 0 && <div className="journal-pop__none">Nothing matches</div>}
            {shown.map((option, i) => {
              const on = picked.has(option.value)
              const heading = option.group !== undefined && option.group !== shown[i - 1]?.group ? option.group : undefined
              return (
                <div key={String(option.value)} role="presentation">
                  {heading !== undefined && <div className="journal-pop__group">{heading}</div>}
                  <div
                    id={`${baseId}-opt-${i}`}
                    role="option"
                    aria-selected={on}
                    data-index={i}
                    className={cx('journal-pop__option', i === at && 'is-active', on && 'is-on')}
                    onPointerMove={() => i !== at && setActive(i)}
                    onClick={() => toggle(option.value)}
                  >
                    <span className="journal-pop__tick" aria-hidden="true">
                      {on && <Icon name="check" size={12} strokeWidth={2.8} />}
                    </span>
                    {option.icon !== undefined && <span className="journal-pop__icon">{option.icon}</span>}
                    <span className="journal-pop__label">{option.label}</span>
                    {option.count !== undefined && <span className="journal-pop__count">{option.count.toLocaleString('en-US')}</span>}
                  </div>
                </div>
              )
            })}
          </div>
          {selected.length > 0 && (
            <div className="journal-pop__foot">
              <span>{selected.length} selected</span>
              <Button size="sm" variant="ghost" onClick={() => onChange([])}>
                Clear
              </Button>
            </div>
          )}
        </div>
      )}
    </FilterPopover>
  )
}

// ---------------------------------------------------------------- date range

export interface DateMenuProps {
  from: string
  to: string
  onChange: (range: { from: string; to: string }) => void
}

/** Catch-date range: two date fields and a few one-click ranges. */
export function DateMenu({ from, to, onChange }: DateMenuProps) {
  const today = todayIso()
  const year = today.slice(0, 4)
  const presets: Array<{ label: string; from: string; to: string }> = [
    { label: 'Last 7 days', from: addDays(today, -6), to: today },
    { label: 'Last 30 days', from: addDays(today, -29), to: today },
    { label: 'This year', from: `${year}-01-01`, to: today },
    { label: 'Last year', from: `${Number(year) - 1}-01-01`, to: `${Number(year) - 1}-12-31` }
  ]
  const active = from !== '' || to !== ''
  return (
    <FilterPopover label="Date" icon="calendar" count={active ? 1 : 0} popup="dialog">
      {(close) => (
        <div className="journal-pop__dates" role="group" aria-label="Date caught">
          <div className="journal-pop__range">
            <DateField label="From" value={from} max={to || undefined} data-autofocus onChange={(value) => onChange({ from: value, to })} />
            <DateField label="To" value={to} min={from || undefined} onChange={(value) => onChange({ from, to: value })} />
          </div>
          <div className="journal-pop__presets">
            {presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className={cx('journal-pop__preset', preset.from === from && preset.to === to && 'is-on')}
                onClick={() => {
                  onChange({ from: preset.from, to: preset.to })
                  close()
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="journal-pop__foot">
            <span>Filters by the day it was caught</span>
            <Button size="sm" variant="ghost" disabled={!active} onClick={() => onChange({ from: '', to: '' })}>
              Clear
            </Button>
          </div>
        </div>
      )}
    </FilterPopover>
  )
}
