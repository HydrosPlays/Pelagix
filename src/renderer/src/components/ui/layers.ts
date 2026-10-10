/**
 * Shared plumbing for everything that floats above the page: a portal target, an Escape stack
 * (only the topmost layer reacts), modal bookkeeping and popover positioning.
 */

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react'
import { motionOK } from '@renderer/lib/anim'

// ---------------------------------------------------------------- escape stack

interface Layer {
  onEscape?: () => void
}

const stack: Layer[] = []
const stackListeners = new Set<() => void>()

function stackChanged(): void {
  for (const listener of stackListeners) listener()
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || event.defaultPrevented) return
  const top = stack[stack.length - 1]
  if (!top) return
  // The top layer owns Escape even when it cannot be dismissed, so nothing underneath closes.
  event.preventDefault()
  event.stopPropagation()
  top.onEscape?.()
}

function pushLayer(layer: Layer): () => void {
  stack.push(layer)
  if (stack.length === 1) document.addEventListener('keydown', onKeyDown, true)
  stackChanged()
  return () => {
    const i = stack.indexOf(layer)
    if (i >= 0) stack.splice(i, 1)
    if (stack.length === 0) document.removeEventListener('keydown', onKeyDown, true)
    stackChanged()
  }
}

/** While `active`, this component is the top layer for the Escape key. Pass no handler to swallow it. */
export function useEscapeLayer(active: boolean, onEscape?: () => void): void {
  const handler = useRef(onEscape)
  handler.current = onEscape
  useEffect(() => {
    if (!active) return
    return pushLayer({ onEscape: () => handler.current?.() })
  }, [active])
}

/**
 * True while anything that Escape would close is up: a dialog, a drawer, the command palette, but
 * also an open menu, a dropdown list, a filter popover or a selection in progress. For things
 * that must wait their turn instead of opening on top of what the user is doing.
 */
export function isLayerOpen(): boolean {
  return stack.length > 0
}

function subscribeStack(onChange: () => void): () => void {
  stackListeners.add(onChange)
  return () => {
    stackListeners.delete(onChange)
  }
}

/** `isLayerOpen()` as a hook: the component renders again when the answer changes. */
export function useLayerOpen(): boolean {
  return useSyncExternalStore(subscribeStack, isLayerOpen, () => false)
}

// ---------------------------------------------------------------- modal bookkeeping

let modalCount = 0

/** While `active`, the app root is inert so focus, clicks and assistive tech stay inside the modal. */
export function useModalRoot(active: boolean): void {
  useEffect(() => {
    if (!active) return
    const root = document.getElementById('root')
    modalCount++
    if (root) root.inert = true
    return () => {
      modalCount--
      if (root && modalCount === 0) root.inert = false
    }
  }, [active])
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function focusableWithin(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0)
}

/** Panels with an active focus trap, bottom to top. */
const trapped: HTMLElement[] = []

/**
 * Where the focus goes when a modal panel opens: a given element, or `'panel'` for the panel
 * itself. The panel is the place for something that opens without being asked for: a key that
 * was on its way to the page then lands on nothing, instead of pressing a button.
 */
export type InitialFocus = RefObject<HTMLElement | null> | 'panel'

/**
 * Focus trap for a modal panel: focuses into it when it opens, keeps Tab inside, and gives focus
 * back to whatever had it before on close. Should focus fall out of the panel altogether (the
 * focused control was removed, say a deleted entry), the next Tab brings it back in.
 */
export function useFocusTrap(active: boolean, panelRef: RefObject<HTMLElement | null>, initialFocus?: InitialFocus): void {
  useEffect(() => {
    if (!active) return
    const panel = panelRef.current
    if (!panel) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    trapped.push(panel)

    const chosen = initialFocus === 'panel' ? panel : initialFocus?.current
    const target = chosen ?? panel.querySelector<HTMLElement>('[data-autofocus]') ?? focusableWithin(panel)[0] ?? panel
    target.focus({ preventScroll: true })

    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Tab') return
      const items = focusableWithin(panel)
      if (items.length === 0) {
        event.preventDefault()
        panel.focus()
        return
      }
      const first = items[0]!
      const last = items[items.length - 1]!
      const current = document.activeElement
      if (event.shiftKey && (current === first || current === panel)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && current === last) {
        event.preventDefault()
        first.focus()
      }
    }
    // Focus is nowhere (on <body>): Tab re-enters the topmost panel instead of wandering off.
    const onStrayTab = (event: KeyboardEvent): void => {
      if (event.key !== 'Tab' || event.defaultPrevented || trapped[trapped.length - 1] !== panel) return
      const current = document.activeElement
      if (current !== null && current !== document.body && current.isConnected) return
      event.preventDefault()
      const items = focusableWithin(panel)
      ;(event.shiftKey ? items[items.length - 1] : items[0])?.focus()
      if (items.length === 0) panel.focus()
    }
    panel.addEventListener('keydown', onKey)
    document.addEventListener('keydown', onStrayTab)
    return () => {
      panel.removeEventListener('keydown', onKey)
      document.removeEventListener('keydown', onStrayTab)
      const at = trapped.indexOf(panel)
      if (at >= 0) trapped.splice(at, 1)
      if (previous && previous.isConnected) previous.focus({ preventScroll: true })
    }
  }, [active, panelRef, initialFocus])
}

// ---------------------------------------------------------------- presence

export type PresenceState = 'open' | 'closing'

/**
 * Keeps something mounted while its exit animation plays. Returns null when it should not be in
 * the DOM at all, else the phase to style ("open" or "closing").
 */
export function usePresence(open: boolean, exitMs: number): PresenceState | null {
  const [state, setState] = useState<PresenceState | null>(open ? 'open' : null)
  const wasOpen = useRef(open)
  useEffect(() => {
    if (open) {
      wasOpen.current = true
      setState('open')
      return
    }
    if (!wasOpen.current) return
    wasOpen.current = false
    if (!motionOK() || exitMs <= 0) {
      setState(null)
      return
    }
    setState('closing')
    const timer = setTimeout(() => setState(null), exitMs)
    return () => clearTimeout(timer)
  }, [open, exitMs])
  return open ? 'open' : state
}

// ---------------------------------------------------------------- floating position

export type FloatingSide = 'bottom' | 'top' | 'right' | 'left'
export type FloatingAlign = 'start' | 'center' | 'end'

export interface FloatingOptions {
  side?: FloatingSide
  align?: FloatingAlign
  /** Gap between anchor and popover, px. Default 6. */
  offset?: number
  /** Make the popover at least as wide as its anchor. */
  matchWidth?: boolean
  /** Upper bound for the popover height, px. Default 360. */
  maxHeight?: number
}

const MARGIN = 8

/**
 * Positions `floatingRef` (a `position: fixed` element) next to the anchor while `open`, flipping
 * to the opposite side when there is no room and staying inside the viewport. Styles are written
 * straight to the element, so following a scroll costs no React render. The element should start
 * with `visibility: hidden`; it is revealed once placed, with `data-side` set to the final side.
 */
export function useFloating(open: boolean, getAnchor: () => Element | null | undefined, floatingRef: RefObject<HTMLElement | null>, options: FloatingOptions = {}): void {
  const { side = 'bottom', align = 'start', offset = 6, matchWidth = false, maxHeight = 360 } = options
  const anchorRef = useRef(getAnchor)
  anchorRef.current = getAnchor

  useLayoutEffect(() => {
    if (!open) return
    const floating = floatingRef.current
    if (!floating) return
    let frame = 0

    const place = (): void => {
      frame = 0
      const anchor = anchorRef.current()
      if (!anchor || !floating.isConnected) return
      const a = anchor.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight
      const style = floating.style
      if (matchWidth) style.minWidth = `${Math.round(a.width)}px`

      let finalSide: FloatingSide = side
      let top: number
      let left: number

      if (side === 'bottom' || side === 'top') {
        const below = vh - a.bottom - offset - MARGIN
        const above = a.top - offset - MARGIN
        style.maxHeight = `${maxHeight}px`
        const natural = floating.offsetHeight
        // Stay on the requested side while a usable amount of the popover fits there.
        const enough = Math.min(natural, 220)
        if (side === 'bottom') finalSide = below >= enough || below >= above ? 'bottom' : 'top'
        else finalSide = above >= enough || above >= below ? 'top' : 'bottom'
        const room = Math.max(120, finalSide === 'bottom' ? below : above)
        style.maxHeight = `${Math.min(maxHeight, room)}px`
        const height = floating.offsetHeight
        const width = floating.offsetWidth
        top = finalSide === 'bottom' ? a.bottom + offset : a.top - offset - height
        left = align === 'start' ? a.left : align === 'end' ? a.right - width : a.left + a.width / 2 - width / 2
      } else {
        const width = floating.offsetWidth
        const height = floating.offsetHeight
        const right = vw - a.right - offset - MARGIN
        const leftRoom = a.left - offset - MARGIN
        if (side === 'right') finalSide = width <= right || right >= leftRoom ? 'right' : 'left'
        else finalSide = width <= leftRoom || leftRoom >= right ? 'left' : 'right'
        left = finalSide === 'right' ? a.right + offset : a.left - offset - width
        top = align === 'start' ? a.top : align === 'end' ? a.bottom - height : a.top + a.height / 2 - height / 2
      }

      const width = floating.offsetWidth
      const height = floating.offsetHeight
      left = Math.min(Math.max(MARGIN, left), Math.max(MARGIN, vw - width - MARGIN))
      top = Math.min(Math.max(MARGIN, top), Math.max(MARGIN, vh - height - MARGIN))
      style.left = `${Math.round(left)}px`
      style.top = `${Math.round(top)}px`
      style.visibility = 'visible'
      floating.dataset.side = finalSide
    }

    const schedule = (): void => {
      if (frame === 0) frame = requestAnimationFrame(place)
    }

    place()
    const observer = new ResizeObserver(schedule)
    observer.observe(floating)
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, true)
    return () => {
      if (frame !== 0) cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule, true)
    }
  }, [open, floatingRef, side, align, offset, matchWidth, maxHeight])
}

/** Calls `onOutside` for a pointer press that lands outside every one of `refs` while `active`. */
export function useOutsidePress(active: boolean, refs: ReadonlyArray<RefObject<Element | null>>, onOutside: () => void): void {
  const handler = useRef(onOutside)
  handler.current = onOutside
  const refsRef = useRef(refs)
  refsRef.current = refs
  useEffect(() => {
    if (!active) return
    const onDown = (event: PointerEvent): void => {
      const target = event.target as Node | null
      if (!target) return
      if (refsRef.current.some((r) => r.current?.contains(target))) return
      handler.current()
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [active])
}
