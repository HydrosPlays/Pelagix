import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Button, cx, Portal, useEscapeLayer, useFloating, useFocusTrap, type IconSlot } from '@renderer/components/ui'
import { popIn } from '@renderer/lib/anim'

export interface FilterPopoverProps {
  /** Text of the toolbar button, and the accessible name of the panel. */
  label: string
  icon?: IconSlot
  /** What is currently chosen, shown after the label: a count, a game name ... */
  summary?: ReactNode
  /** The filter narrows the list right now. */
  active?: boolean
  /** Panel width in px. */
  width?: number
  /** Shown in the panel header while the filter is active. */
  onClear?: () => void
  /** Panel content; receives `close` for pickers that are done after one choice. */
  children: ReactNode | ((close: () => void) => ReactNode)
}

/**
 * A toolbar button that opens a small panel of filter controls and stays open while the user
 * toggles several of them (the shared `Menu` closes after each choice). Escape, a press outside or
 * Tab past the last control closes it, and focus goes back to the button.
 */
export function FilterPopover({ label, icon, summary, active = false, width = 300, onClear, children }: FilterPopoverProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const id = useId()
  const close = useCallback(() => setOpen(false), [])

  useFloating(open, () => triggerRef.current, panelRef, { side: 'bottom', align: 'start', offset: 8, maxHeight: 520 })
  useEscapeLayer(open, close)
  useFocusTrap(open, panelRef)

  useLayoutEffect(() => {
    if (open) popIn(panelRef.current, { from: 0.96 })
  }, [open])

  // A press outside closes the panel. Lists that controls inside it open (the game picker's
  // options) are portaled next to it, so they count as inside.
  useEffect(() => {
    if (!open) return
    const onDown = (event: PointerEvent): void => {
      const target = event.target as Element | null
      if (!target || panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      if (target.closest?.('.ui-listbox, .ui-tooltip')) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [open])

  return (
    <>
      <Button
        ref={triggerRef}
        icon={icon}
        iconEnd="chevron-down"
        className={cx('dex-filter', active && 'is-active', open && 'is-open')}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        {summary !== undefined && summary !== null && summary !== false && <span className="dex-filter__summary">{summary}</span>}
      </Button>
      {open && (
        <Portal>
          <div ref={panelRef} id={id} role="dialog" aria-label={label} tabIndex={-1} className="dex-pop" style={{ width }}>
            <div className="dex-pop__body">{typeof children === 'function' ? children(close) : children}</div>
            {/* After the body in the document, so focus starts on the first control; drawn above it. */}
            <div className="dex-pop__head">
              <span className="u-eyebrow">{label}</span>
              {onClear && active && (
                <button
                  type="button"
                  className="dex-pop__clear"
                  onClick={() => {
                    // The button is about to go away; keep focus inside the panel.
                    panelRef.current?.focus()
                    onClear()
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </Portal>
      )}
    </>
  )
}
