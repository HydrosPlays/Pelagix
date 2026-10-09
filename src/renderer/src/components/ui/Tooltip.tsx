import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Portal } from './Portal'
import { useFloating, type FloatingAlign, type FloatingSide } from './layers'
import './Tooltip.css'

export type TooltipPlacement = FloatingSide

export interface TooltipProps {
  /** Tooltip body. Nothing is shown when it is empty. */
  content: ReactNode
  children: ReactNode
  placement?: TooltipPlacement
  align?: FloatingAlign
  /** Hover delay in ms. Default 350; keyboard focus shows it at once. */
  delay?: number
  disabled?: boolean
}

/**
 * Hover / focus tooltip. Wraps its child in a `display: contents` span, so layout is untouched;
 * the first element child is the anchor.
 */
export function Tooltip({ content, children, placement = 'top', align = 'center', delay = 350, disabled = false }: TooltipProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const id = useId()
  const empty = content === null || content === undefined || content === '' || content === false

  const cancel = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
  }, [])
  const show = useCallback(
    (wait: number) => {
      cancel()
      if (wait <= 0) setOpen(true)
      else timer.current = setTimeout(() => setOpen(true), wait)
    },
    [cancel]
  )
  const hide = useCallback(() => {
    cancel()
    setOpen(false)
  }, [cancel])

  useEffect(() => cancel, [cancel])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') hide()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', hide, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', hide, true)
    }
  }, [open, hide])

  const visible = open && !disabled && !empty
  useFloating(visible, () => wrapRef.current?.firstElementChild, tipRef, { side: placement, align, offset: 8 })

  return (
    <>
      <span
        ref={wrapRef}
        className="ui-tooltip-anchor"
        aria-describedby={visible ? id : undefined}
        onPointerEnter={(e) => e.pointerType !== 'touch' && show(delay)}
        onPointerLeave={hide}
        onPointerDown={hide}
        onFocus={(e) => (e.target as HTMLElement).matches(':focus-visible') && show(0)}
        onBlur={hide}
      >
        {children}
      </span>
      {visible && (
        <Portal>
          <div ref={tipRef} id={id} role="tooltip" className="ui-tooltip">
            {content}
          </div>
        </Portal>
      )}
    </>
  )
}
