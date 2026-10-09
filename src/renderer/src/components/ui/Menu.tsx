import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { normalizeText } from '@renderer/lib/search'
import { cx } from './cx'
import { renderIconSlot, type IconSlot } from './Button'
import { Portal } from './Portal'
import { useEscapeLayer, useFloating, useOutsidePress, type FloatingAlign, type FloatingSide } from './layers'
import './Select.css'
import './Menu.css'

export type MenuItem =
  | {
      id: string
      label: string
      icon?: IconSlot
      /** Right-aligned hint such as a shortcut. */
      hint?: ReactNode
      /** Destructive action styling. */
      danger?: boolean
      disabled?: boolean
      /** Shows a check mark (toggle items). */
      checked?: boolean
      onSelect: () => void
    }
  | { separator: true; id?: string }
  | { heading: string; id?: string }

export interface MenuProps {
  /** The element that opens the menu; rendered as given. It should be a button. */
  trigger: ReactNode
  items: ReadonlyArray<MenuItem>
  /** Accessible name of the menu. */
  label: string
  side?: FloatingSide
  align?: FloatingAlign
  /** Minimum width in px. Default 200. */
  minWidth?: number
  disabled?: boolean
  onOpenChange?: (open: boolean) => void
}

/**
 * Dropdown menu. Opens on click, Enter, Space or ArrowDown on the trigger; inside: arrows,
 * Home / End, typing to jump, Enter to run, Escape to close with focus back on the trigger.
 */
export function Menu({ trigger, items, label, side = 'bottom', align = 'start', minWidth = 200, disabled, onOpenChange }: MenuProps) {
  const [open, setOpenState] = useState(false)
  const anchorRef = useRef<HTMLSpanElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const id = useId()

  const triggerEl = (): HTMLElement | null => anchorRef.current?.firstElementChild as HTMLElement | null
  const setOpen = (next: boolean): void => {
    setOpenState(next)
    onOpenChange?.(next)
  }
  const close = (refocus = true): void => {
    setOpen(false)
    if (refocus) triggerEl()?.focus()
  }

  useFloating(open, triggerEl, menuRef, { side, align, maxHeight: 420 })
  useOutsidePress(open, [anchorRef, menuRef], () => close(false))
  useEscapeLayer(open, () => close())

  const focusItem = (which: 'first' | 'last' | 1 | -1): void => {
    const nodes = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([aria-disabled="true"])') ?? [])
    if (nodes.length === 0) return
    const current = nodes.indexOf(document.activeElement as HTMLElement)
    const next = which === 'first' ? 0 : which === 'last' ? nodes.length - 1 : (current + which + nodes.length) % nodes.length
    nodes[next]?.focus()
  }

  // Focus moves into the menu once it is placed.
  useEffect(() => {
    if (open) focusItem('first')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const onMenuKey = (event: KeyboardEvent): void => {
    const { key } = event
    if (key === 'ArrowDown') {
      event.preventDefault()
      focusItem(1)
    } else if (key === 'ArrowUp') {
      event.preventDefault()
      focusItem(-1)
    } else if (key === 'Home') {
      event.preventDefault()
      focusItem('first')
    } else if (key === 'End') {
      event.preventDefault()
      focusItem('last')
    } else if (key === 'Tab') {
      event.preventDefault()
      close()
    } else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const needle = normalizeText(key)
      const nodes = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([aria-disabled="true"])') ?? [])
      const start = nodes.indexOf(document.activeElement as HTMLElement)
      const ordered = [...nodes.slice(start + 1), ...nodes.slice(0, start + 1)]
      ordered.find((n) => normalizeText(n.textContent ?? '').startsWith(needle))?.focus()
    }
  }

  return (
    <>
      <span
        ref={anchorRef}
        className="ui-menu-anchor"
        onClick={() => !disabled && setOpen(!open)}
        onKeyDown={(e) => {
          if (!disabled && !open && e.key === 'ArrowDown') {
            e.preventDefault()
            setOpen(true)
          }
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
      >
        {trigger}
      </span>
      {open && (
        <Portal>
          <div ref={menuRef} id={id} role="menu" aria-label={label} className="ui-listbox ui-menu" style={{ minWidth }} onKeyDown={onMenuKey}>
            <div className="ui-listbox__scroll">
              {items.map((item, i) => {
                if ('separator' in item) return <div key={item.id ?? `sep-${i}`} role="separator" className="ui-menu__separator" />
                if ('heading' in item) {
                  return (
                    <div key={item.id ?? `head-${i}`} className="ui-listbox__group" role="presentation">
                      {item.heading}
                    </div>
                  )
                }
                return (
                  <button
                    key={item.id}
                    type="button"
                    role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
                    aria-checked={item.checked}
                    aria-disabled={item.disabled || undefined}
                    tabIndex={-1}
                    className={cx('ui-option', 'ui-menu__item', item.danger && 'is-danger')}
                    onPointerMove={(e) => !item.disabled && e.currentTarget !== document.activeElement && e.currentTarget.focus()}
                    onClick={() => {
                      if (item.disabled) return
                      close()
                      item.onSelect()
                    }}
                  >
                    {(item.icon !== undefined || item.checked !== undefined) && <span className="ui-option__icon ui-menu__icon">{item.checked !== undefined ? (item.checked ? renderIconSlot('check', 16) : null) : renderIconSlot(item.icon, 16)}</span>}
                    <span className="ui-option__label">{item.label}</span>
                    {item.hint !== undefined && <span className="ui-option__desc">{item.hint}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        </Portal>
      )}
    </>
  )
}
