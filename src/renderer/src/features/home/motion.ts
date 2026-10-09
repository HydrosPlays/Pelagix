/**
 * Dashboard motion, built on lib/anim.ts: charts draw themselves once, the first time they are on
 * screen, and are static afterwards.
 *
 * Every element's resting CSS is its final state. An effect only overrides that while it plays and
 * removes its inline styles when it ends, so with motion off, in a hidden window or after a
 * dropped frame the charts are simply there.
 */

import { useLayoutEffect, useRef, type RefObject } from 'react'
import { useScrollParent } from '@renderer/components/ui'
import { animate, motionOK, stagger, utils, type AnimationParams } from '@renderer/lib/anim'

const noop = (): void => {}

export interface GrowOptions {
  /** Delay before the first element, ms. Default 0. */
  delay?: number
  /** Gap between elements, ms. Default 28. */
  step?: number
  /** Per-element duration, ms. Default 620. */
  duration?: number
}

/**
 * Draws bars in: "x" slides each element in from the left edge of its (clipping) track, "y" raises
 * it from its baseline. Returns a function that stops the effect and restores the resting state.
 * Does nothing when motion is off or the window is not visible.
 */
export function growIn(targets: Iterable<Element> | ArrayLike<Element> | null | undefined, axis: 'x' | 'y', options: GrowOptions = {}): () => void {
  const elements = targets ? Array.from(targets) : []
  if (elements.length === 0 || !motionOK() || document.visibilityState === 'hidden') return noop
  const { delay = 0, step = 28, duration = 620 } = options
  const motion: AnimationParams = axis === 'x' ? { x: ['-100%', '0%'] } : { scaleY: [0, 1] }
  const animation = animate(elements, {
    ...motion,
    duration,
    delay: stagger(step, { start: delay }),
    ease: 'out(4)',
    onComplete: (self) => {
      utils.cleanInlineStyles(self)
    }
  })
  // Frames can be throttled to nothing; a chart must never be left half drawn.
  const timer = setTimeout(
    () => {
      if (animation.completed) return
      animation.complete()
      utils.cleanInlineStyles(animation)
    },
    duration + delay + step * elements.length + 400
  )
  return () => {
    clearTimeout(timer)
    animation.revert()
  }
}

/**
 * Runs `reveal` once for the element: straight away (before paint) when it is already inside the
 * scrolling main region, otherwise just before it scrolls into view. `reveal` may return a
 * function that undoes it; that runs when the component unmounts.
 */
export function useRevealOnce<T extends HTMLElement>(ref: RefObject<T | null>, reveal: (element: T) => void | (() => void)): void {
  const scrollParent = useScrollParent()
  const revealRef = useRef(reveal)
  revealRef.current = reveal

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    let undo: void | (() => void)
    let observer: IntersectionObserver | null = null
    const fire = (): void => {
      observer?.disconnect()
      observer = null
      undo = revealRef.current(element)
    }

    const frame = scrollParent?.getBoundingClientRect() ?? { top: 0, bottom: window.innerHeight }
    const box = element.getBoundingClientRect()
    if (box.top < frame.bottom && box.bottom > frame.top) fire()
    else if (typeof IntersectionObserver !== 'undefined') {
      // The margin starts the effect a little before the element is visible, so its first frame is never seen at rest.
      let initial = true
      observer = new IntersectionObserver(
        (entries) => {
          const first = initial
          initial = false
          if (!entries.some((e) => e.isIntersecting)) return
          // On screen by the very first report: the shell restored a scroll position (Back) after this
          // effect measured. It has been painted at rest already, so it stays at rest.
          if (first) observer?.disconnect()
          else fire()
        },
        { root: scrollParent, rootMargin: '0px 0px 96px 0px' }
      )
      observer.observe(element)
    }
    return () => {
      observer?.disconnect()
      if (typeof undo === 'function') undo()
    }
  }, [ref, scrollParent])
}
