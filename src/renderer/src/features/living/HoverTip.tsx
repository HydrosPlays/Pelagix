import { useCallback, useEffect, useMemo, useRef, useState, type FocusEvent, type PointerEvent, type ReactNode } from 'react'
import { Portal, useFloating, type FloatingSide } from '@renderer/components/ui'

export interface HoverTargetHandlers {
  onPointerOver: (event: PointerEvent<HTMLElement>) => void
  onPointerOut: (event: PointerEvent<HTMLElement>) => void
  onPointerDown: () => void
  onFocus: (event: FocusEvent<HTMLElement>) => void
  onBlur: () => void
}

/**
 * One tooltip for a container full of look-alike targets (hundreds of slots, a strip of boxes),
 * instead of a `Tooltip` around each. Spread `handlers` on the container; `target` is the
 * element matching `selector` that is hovered or keyboard-focused, after the usual delay.
 */
export function useHoverTarget(selector: string, delay = 320): { target: HTMLElement | null; handlers: HoverTargetHandlers; hide: () => void } {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const shown = useRef<HTMLElement | null>(null)
  shown.current = target
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** The element the running timer is for, so moving around inside it does not restart the wait. */
  const waiting = useRef<HTMLElement | null>(null)

  const cancel = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
    waiting.current = null
  }, [])
  const hide = useCallback(() => {
    cancel()
    setTarget(null)
  }, [cancel])

  useEffect(() => cancel, [cancel])

  // Like the shared Tooltip: scrolling or Escape puts it away. A target that left the DOM takes its tip along.
  useEffect(() => {
    if (!target) return
    if (!target.isConnected) {
      setTarget(null)
      return
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') hide()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', hide, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', hide, true)
    }
  }, [target, hide])

  const handlers = useMemo<HoverTargetHandlers>(
    () => ({
      onPointerOver(event) {
        if (event.pointerType === 'touch') return
        const element = (event.target as Element).closest<HTMLElement>(selector)
        if (!element || element === shown.current || element === waiting.current) return
        cancel()
        // Once a tip is up, moving to a neighbour swaps it at once.
        if (shown.current) {
          setTarget(element)
          return
        }
        waiting.current = element
        timer.current = setTimeout(() => {
          waiting.current = null
          setTarget(element)
        }, delay)
      },
      onPointerOut(event) {
        const element = (event.target as Element).closest<HTMLElement>(selector)
        const next = event.relatedTarget
        if (element && next instanceof Node && element.contains(next)) return
        cancel()
        // Left for another target: its own pointerover takes over. Left for anything else: gone.
        if (!(next instanceof Element) || !next.closest(selector)) setTarget(null)
      },
      onPointerDown: hide,
      onFocus(event) {
        const element = (event.target as Element).closest<HTMLElement>(selector)
        if (!element || !element.matches(':focus-visible')) return
        cancel()
        setTarget(element)
      },
      onBlur: hide
    }),
    [selector, delay, cancel, hide]
  )

  return { target, handlers, hide }
}

export interface FloatingTipProps {
  /** The element the tip points at. Give the tip a `key` per target so it re-anchors when the target changes. */
  target: HTMLElement
  side?: FloatingSide
  children: ReactNode
}

/** The tip itself. Purely visual: the target carries the same words in its accessible name. */
export function FloatingTip({ target, side = 'top', children }: FloatingTipProps) {
  const ref = useRef<HTMLDivElement>(null)
  useFloating(true, () => target, ref, { side, align: 'center', offset: 8 })
  return (
    <Portal>
      <div ref={ref} className="living-tip" aria-hidden="true">
        {children}
      </div>
    </Portal>
  )
}
