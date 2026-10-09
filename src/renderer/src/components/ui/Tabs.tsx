import { useCallback, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { cx } from './cx'
import { renderIconSlot, type IconSlot } from './Button'
import './Tabs.css'

export interface TabItem<T extends string = string> {
  id: T
  label: ReactNode
  icon?: IconSlot
  /** Trailing element, typically a Badge or a count. */
  badge?: ReactNode
  disabled?: boolean
}

export interface TabsProps<T extends string = string> {
  items: ReadonlyArray<TabItem<T>>
  value: T
  onChange: (id: T) => void
  /** Accessible name of the tab list. */
  label: string
  /** Prefix for tab / panel ids, to link `TabPanel`s: tab `${idBase}-tab-${id}`, panel `${idBase}-panel-${id}`. */
  idBase?: string
  size?: 'sm' | 'md'
  /** Stretch the tabs across the full width. */
  fill?: boolean
  className?: string
}

/**
 * Moves the sliding marker onto the active item. "scale" stretches a 1 px bar with scaleX (pure
 * transform); "width" sets the width at once and only slides, which keeps rounded corners intact.
 */
export function useSlidingMarker(
  listRef: RefObject<HTMLElement | null>,
  markerRef: RefObject<HTMLElement | null>,
  activeSelector: string,
  deps: readonly unknown[],
  mode: 'scale' | 'width' = 'scale'
): void {
  const place = useCallback(() => {
    const list = listRef.current
    const marker = markerRef.current
    if (!list || !marker) return
    const active = list.querySelector<HTMLElement>(activeSelector)
    if (!active) {
      marker.style.opacity = '0'
      return
    }
    marker.style.opacity = '1'
    if (mode === 'scale') {
      marker.style.transform = `translateX(${active.offsetLeft}px) scaleX(${active.offsetWidth})`
    } else {
      marker.style.width = `${active.offsetWidth}px`
      marker.style.transform = `translateX(${active.offsetLeft}px)`
    }
  }, [listRef, markerRef, activeSelector, mode])

  useLayoutEffect(() => {
    place()
    const list = listRef.current
    if (!list) return
    const observer = new ResizeObserver(place)
    observer.observe(list)
    for (const child of Array.from(list.children)) observer.observe(child)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place, ...deps])
}

/** Arrow-key navigation shared by tab lists and segmented controls. */
export function rovingKey<T>(event: KeyboardEvent, values: readonly T[], current: T, isDisabled: (v: T) => boolean): T | null {
  const enabled = values.filter((v) => !isDisabled(v))
  if (enabled.length === 0) return null
  const i = enabled.indexOf(current)
  let next: T | undefined
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = enabled[(i + 1) % enabled.length]
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = enabled[(i - 1 + enabled.length) % enabled.length]
  else if (event.key === 'Home') next = enabled[0]
  else if (event.key === 'End') next = enabled[enabled.length - 1]
  if (next === undefined) return null
  event.preventDefault()
  return next
}

/** Tab list with roving focus (arrows, Home, End) and a sliding underline. Selection follows focus. */
export function Tabs<T extends string = string>({ items, value, onChange, label, idBase, size = 'md', fill, className }: TabsProps<T>) {
  const listRef = useRef<HTMLDivElement>(null)
  const markerRef = useRef<HTMLSpanElement>(null)
  useSlidingMarker(listRef, markerRef, '[aria-selected="true"]', [value, items.length])

  const onKeyDown = (event: KeyboardEvent): void => {
    const next = rovingKey(
      event,
      items.map((t) => t.id),
      value,
      (id) => items.find((t) => t.id === id)?.disabled === true
    )
    if (next === null) return
    onChange(next)
    const tab = listRef.current?.querySelector<HTMLElement>(`[data-tab="${CSS.escape(next)}"]`)
    tab?.focus()
    tab?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }

  return (
    <div ref={listRef} role="tablist" aria-label={label} className={cx('ui-tabs', `ui-tabs--${size}`, fill && 'ui-tabs--fill', className)} onKeyDown={onKeyDown}>
      {items.map((tab) => {
        const selected = tab.id === value
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={idBase ? `${idBase}-tab-${tab.id}` : undefined}
            aria-controls={idBase ? `${idBase}-panel-${tab.id}` : undefined}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            disabled={tab.disabled}
            data-tab={tab.id}
            className="ui-tabs__tab"
            onClick={() => onChange(tab.id)}
          >
            {renderIconSlot(tab.icon, 16)}
            <span>{tab.label}</span>
            {tab.badge}
          </button>
        )
      })}
      <span ref={markerRef} className="ui-tabs__marker" aria-hidden="true" />
    </div>
  )
}

export interface TabPanelProps {
  /** The tab this panel belongs to. */
  id: string
  /** The currently selected tab. */
  value: string
  /** Same `idBase` as the `Tabs`. */
  idBase: string
  /** Keep the content mounted while hidden. Default false. */
  keepMounted?: boolean
  className?: string
  children: ReactNode
}

export function TabPanel({ id, value, idBase, keepMounted = false, className, children }: TabPanelProps) {
  const active = id === value
  if (!active && !keepMounted) return null
  return (
    <div role="tabpanel" id={`${idBase}-panel-${id}`} aria-labelledby={`${idBase}-tab-${id}`} hidden={!active} tabIndex={0} className={cx('ui-tabpanel', className)}>
      {children}
    </div>
  )
}
