/**
 * Motion layer: a small typed wrapper over anime.js v4.
 *
 * Every helper honours both the user's "reduce motion" setting and the OS preference. With motion
 * off nothing moves: effects either do nothing or become a short opacity fade, and always leave
 * the element in its final state. Helpers are fire-and-forget and never block interaction.
 *
 *   motionOK()                      motion is currently allowed
 *   useMotionOK()                   the same, as a hook that re-renders on change
 *   initMotion()                    keeps <html data-motion> in sync; called once by the app shell
 *   safeAnimate(targets, params)    animate(), or jump straight to the end state when motion is off
 *   enterStagger(els, opts)         list / grid entrance: rise + fade, staggered
 *   pageEnter(el)                   routed page entrance
 *   popIn(el)                       springy scale-in (badges, checkmarks, a freshly caught sprite)
 *   pulse(el)                       one attention pulse on something that just changed
 *   flipIn(el)                      card flips up into place (achievement tiles, revealed slots)
 *   shake(el)                       horizontal "no" shake (invalid input)
 *   countUp(el, to, opts)           tweens the element's text from a number to another
 *   burst(container, opts)          star / sparkle particle burst (shiny, achievement, capture)
 *   useAnimeScope(ref, setup, deps) createScope bound to a React ref, reverted on unmount
 */

import { useLayoutEffect, useRef, useSyncExternalStore, type DependencyList, type RefObject } from 'react'
import { animate, createScope, spring, stagger, utils, type AnimationParams, type JSAnimation, type Scope, type StaggerFunction } from 'animejs'
import { useSaveStore } from '@renderer/store/save'

export type AnimTarget = Element | null | undefined
export type AnimTargets = AnimTarget | readonly AnimTarget[] | NodeListOf<Element> | HTMLCollectionOf<Element>

const REDUCE_QUERY = '(prefers-reduced-motion: reduce)'
/** Opacity-only fade used in place of an entrance when motion is off. */
const REDUCED_FADE_MS = 120

function systemReduced(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(REDUCE_QUERY).matches
}

/** True when animation is allowed: the setting is off and the OS does not ask for reduced motion. */
export function motionOK(): boolean {
  return !useSaveStore.getState().save.settings.reduceMotion && !systemReduced()
}

function subscribeMotion(onChange: () => void): () => void {
  const unsubscribe = useSaveStore.subscribe((s) => s.save.settings.reduceMotion, onChange)
  const media = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(REDUCE_QUERY) : null
  media?.addEventListener('change', onChange)
  return () => {
    unsubscribe()
    media?.removeEventListener('change', onChange)
  }
}

/** `motionOK()` as a hook; re-renders when the setting or the OS preference changes. */
export function useMotionOK(): boolean {
  return useSyncExternalStore(subscribeMotion, motionOK, () => true)
}

/**
 * Mirrors the motion state onto `<html data-motion="on|off">`, which is what the CSS reduced-motion
 * rules key on. Returns the unsubscribe function.
 */
export function initMotion(): () => void {
  const apply = (): void => {
    document.documentElement.dataset.motion = motionOK() ? 'on' : 'off'
  }
  apply()
  return subscribeMotion(apply)
}

function toArray(targets: AnimTargets): Element[] {
  if (!targets) return []
  if (targets instanceof Element) return [targets]
  return Array.from(targets as ArrayLike<AnimTarget>).filter((t): t is Element => t instanceof Element)
}

/** Motion is allowed and frames are actually being produced (a hidden window throttles rAF to nothing). */
function canPlay(): boolean {
  return motionOK() && document.visibilityState !== 'hidden'
}

/** The effect currently running on each element, so a new one can take over cleanly. */
const active = new WeakMap<Element, JSAnimation>()

/**
 * Removes the inline styles an effect wrote once it is done, so the stylesheet is in charge again
 * (hover transforms keep working, and no stray `transform` traps fixed-position children).
 */
function release(animation: JSAnimation): void {
  utils.cleanInlineStyles(animation)
  for (const target of animation.targets) {
    if (target instanceof Element && active.get(target) === animation) active.delete(target)
  }
}

/**
 * Runs one effect on `elements`. An effect still running on any of them is reverted first, so
 * effects never stack and the element always ends in its natural state. Because an entrance must
 * never strand content at its invisible start (frames can be throttled to nothing), an effect that
 * has not finished shortly after `expectedMs` is completed by a timer.
 */
function play(elements: Element[], params: AnimationParams, expectedMs: number): JSAnimation {
  for (const element of elements) active.get(element)?.revert()
  const animation = animate(elements, { ...params, onComplete: release })
  for (const element of elements) active.set(element, animation)
  const first = elements[0]
  setTimeout(() => {
    if (!animation.completed && first !== undefined && active.get(first) === animation) animation.complete()
  }, expectedMs + 400)
  return animation
}

function fadeIn(elements: Element[]): JSAnimation | null {
  if (elements.length === 0 || document.visibilityState === 'hidden') return null
  return play(elements, { opacity: [0, 1], duration: REDUCED_FADE_MS, ease: 'linear' }, REDUCED_FADE_MS)
}

/**
 * `animate()` that respects reduced motion: with motion off (or `loop` set) the targets jump to
 * the animation's end state instead of playing. Returns null when there is nothing to animate.
 */
export function safeAnimate(targets: AnimTargets, params: AnimationParams): JSAnimation | null {
  const elements = toArray(targets)
  if (elements.length === 0) return null
  if (canPlay()) return animate(elements, params)
  if (params.loop) return null
  return animate(elements, { ...params, autoplay: false }).complete()
}

export interface EnterStaggerOptions {
  /** Delay before the first element, ms. Default 0. */
  delay?: number
  /** Gap between elements, ms. Default 28. */
  step?: number
  /** Rise distance in px. Default 12. */
  y?: number
  /** Per-element duration, ms. Default 380. */
  duration?: number
  /** Where the wave starts. Default "first". */
  from?: 'first' | 'center' | 'last'
  /** Only the first `limit` elements are staggered; the rest appear with the last of them. Default 36. */
  limit?: number
}

/** Staggered rise-and-fade entrance for a list or grid of elements. */
export function enterStagger(targets: AnimTargets, options: EnterStaggerOptions = {}): JSAnimation | null {
  const elements = toArray(targets)
  if (elements.length === 0) return null
  if (!canPlay()) return fadeIn(elements)
  const { delay = 0, step = 28, y = 12, duration = 380, from = 'first', limit = 36 } = options
  const staggered = stagger(step, { start: delay, from })
  const last = Math.min(elements.length, limit) - 1
  const delayOf: StaggerFunction<number> = (target, index = 0, all) => (index > last ? delay + last * step : staggered(target, index, all))
  return play(elements, { opacity: [0, 1], y: [y, 0], duration, delay: delayOf, ease: 'out(3)' }, duration + delay + last * step)
}

/** Entrance of a routed page: a quick rise and fade. */
export function pageEnter(target: AnimTarget): JSAnimation | null {
  if (!target) return null
  if (!canPlay()) return fadeIn([target])
  return play([target], { opacity: [0, 1], y: [8, 0], duration: 260, ease: 'out(3)' }, 260)
}

/** Springy scale-in for something that has just appeared. */
export function popIn(target: AnimTarget, options: { delay?: number; from?: number } = {}): JSAnimation | null {
  if (!target) return null
  if (!canPlay()) return fadeIn([target])
  const { delay = 0, from = 0.6 } = options
  const ease = spring({ bounce: 0.45, duration: 420 })
  return play([target], { opacity: { from: 0, to: 1, duration: 140, ease: 'linear' }, scale: [from, 1], delay, ease }, 700 + delay)
}

/** One quick scale pulse to draw the eye to a value that changed. No-op with motion off. */
export function pulse(target: AnimTarget, options: { scale?: number } = {}): JSAnimation | null {
  if (!target || !canPlay()) return null
  const peak = options.scale ?? 1.12
  return play(
    [target],
    {
      scale: [
        { to: peak, duration: 130, ease: 'out(3)' },
        { to: 1, ease: spring({ bounce: 0.5, duration: 380 }) }
      ]
    },
    700
  )
}

/** Flips a card up into place around its X axis. */
export function flipIn(target: AnimTarget, options: { delay?: number } = {}): JSAnimation | null {
  if (!target) return null
  if (!canPlay()) return fadeIn([target])
  const delay = options.delay ?? 0
  return play(
    [target],
    {
      opacity: { from: 0, to: 1, duration: 160, ease: 'linear' },
      perspective: [700, 700],
      rotateX: [-78, 0],
      y: [14, 0],
      duration: 520,
      delay,
      ease: 'outBack(1.4)'
    },
    520 + delay
  )
}

/** Horizontal shake for a rejected action or invalid field. No-op with motion off. */
export function shake(target: AnimTarget): JSAnimation | null {
  if (!target || !canPlay()) return null
  return play(
    [target],
    {
      x: [
        { to: -7, duration: 55, ease: 'out(2)' },
        { to: 6, duration: 70 },
        { to: -4, duration: 70 },
        { to: 3, duration: 70 },
        { to: 0, duration: 80 }
      ],
      ease: 'inOut(2)'
    },
    400
  )
}

export interface CountUpOptions {
  /** Start value. Default: the number currently shown in the element, else 0. */
  from?: number
  /** ms. Default scales with the distance, 350-900. */
  duration?: number
  /** Decimal places. Default 0. */
  decimals?: number
  /** Turns the running value into text. Default: thousands-separated. */
  format?: (value: number) => string
}

const groupThousands = (value: number, decimals: number): string => {
  const [whole, fraction] = value.toFixed(decimals).split('.')
  const grouped = (whole ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return fraction === undefined ? grouped : `${grouped}.${fraction}`
}

const runningCounts = new WeakMap<Element, JSAnimation>()

/**
 * Tweens the element's text content to `to`. With motion off the final value is written at once.
 * A new call on the same element replaces the one still running.
 */
export function countUp(target: AnimTarget, to: number, options: CountUpOptions = {}): JSAnimation | null {
  if (!target) return null
  runningCounts.get(target)?.cancel()
  runningCounts.delete(target)
  const decimals = options.decimals ?? 0
  const format = options.format ?? ((v: number) => groupThousands(v, decimals))
  const shown = Number((target.textContent ?? '').replace(/[^0-9.-]/g, ''))
  const from = options.from ?? (Number.isFinite(shown) ? shown : 0)
  if (!canPlay() || from === to) {
    target.textContent = format(to)
    return null
  }
  const state = { value: from }
  const duration = options.duration ?? Math.min(900, Math.max(350, Math.abs(to - from) * 12))
  const write = (): void => {
    target.textContent = format(decimals === 0 ? Math.round(state.value) : state.value)
  }
  const animation = animate(state, { value: to, duration, ease: 'out(4)', onUpdate: write, onComplete: write })
  runningCounts.set(target, animation)
  // Throttled frames must not leave a stale number on screen.
  setTimeout(() => {
    if (runningCounts.get(target) !== animation) return
    runningCounts.delete(target)
    if (!animation.completed) animation.cancel()
    target.textContent = format(to)
  }, duration + 400)
  return animation
}

export interface BurstOptions {
  /** Any CSS colours (custom properties work). Default: gold, ice and white. */
  colors?: readonly string[]
  /** Number of particles. Default 14. */
  count?: number
  /** Origin inside the container, as fractions of its box. Default the centre (0.5, 0.5). */
  x?: number
  y?: number
  /** How far the particles fly, px. Default 72. */
  distance?: number
  /** Particle size range in px. Default [6, 14]. */
  size?: readonly [number, number]
}

const SPARKLE = 'polygon(50% 0%, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0% 50%, 39% 39%)'
const DEFAULT_BURST_COLORS = ['var(--gold)', 'var(--accent-3)', 'var(--ball-white)'] as const

/**
 * Throws a burst of sparkles out from a point of `container` and cleans up after itself. The
 * container needs `position: relative` (or any positioning) and is not otherwise touched.
 * No-op with motion off.
 */
export function burst(container: HTMLElement | null | undefined, options: BurstOptions = {}): void {
  if (!container || !canPlay()) return
  const { colors = DEFAULT_BURST_COLORS, count = 14, x = 0.5, y = 0.5, distance = 72, size = [6, 14] } = options

  const layer = document.createElement('div')
  layer.setAttribute('aria-hidden', 'true')
  layer.style.cssText = `position:absolute;left:${x * 100}%;top:${y * 100}%;width:0;height:0;pointer-events:none;z-index:5;`
  const particles: HTMLElement[] = []
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span')
    const s = utils.random(size[0], size[1])
    const round = i % 4 === 3
    p.style.cssText =
      `position:absolute;left:${-s / 2}px;top:${-s / 2}px;width:${s}px;height:${s}px;opacity:0;will-change:transform,opacity;` +
      `background:${colors[i % colors.length] ?? 'var(--gold)'};` +
      (round ? 'border-radius:50%;transform-origin:center;' : `clip-path:${SPARKLE};`)
    layer.appendChild(p)
    particles.push(p)
  }
  container.appendChild(layer)

  const angleOf = (i: number): number => (i / count) * Math.PI * 2 + utils.random(-0.35, 0.35, 2)
  const angles = particles.map((_, i) => angleOf(i))
  const reach = particles.map(() => distance * utils.random(0.55, 1.1, 2))
  const cleanup = (): void => layer.remove()
  const animation = animate(particles, {
    x: (_: unknown, i: number) => [0, Math.cos(angles[i] ?? 0) * (reach[i] ?? distance)],
    y: (_: unknown, i: number) => [0, Math.sin(angles[i] ?? 0) * (reach[i] ?? distance)],
    rotate: () => [0, utils.random(-160, 160)],
    scale: [
      { from: 0.2, to: 1, duration: 180, ease: 'out(3)' },
      { to: 0, duration: 520, ease: 'in(2)' }
    ],
    opacity: [
      { from: 0, to: 1, duration: 90, ease: 'linear' },
      { to: 0, duration: 610, delay: 0, ease: 'in(3)' }
    ],
    duration: 700,
    delay: stagger(8),
    ease: 'out(4)',
    onComplete: cleanup
  } as AnimationParams)
  setTimeout(() => {
    if (!animation.completed) animation.cancel()
    cleanup()
  }, 1600)
}

export interface AnimeScopeContext {
  /** Motion was allowed when the scope was set up; branch on it for anything that only makes sense animated. */
  motion: boolean
}

/**
 * Runs `setup` inside an anime.js scope rooted at `rootRef` (selectors resolve below it) and
 * reverts everything the scope created on unmount or when `deps` change. The scope is rebuilt
 * when the reduced-motion state flips. `setup` may register methods with `scope.add(name, fn)`;
 * call them through the returned ref: `scope.current?.methods.name()`.
 */
export function useAnimeScope(
  rootRef: RefObject<HTMLElement | SVGElement | null>,
  setup: (scope: Scope, context: AnimeScopeContext) => void | (() => void),
  deps: DependencyList = []
): RefObject<Scope | null> {
  const scopeRef = useRef<Scope | null>(null)
  const motion = useMotionOK()
  const setupRef = useRef(setup)
  setupRef.current = setup

  useLayoutEffect(() => {
    if (!rootRef.current) return
    const scope = createScope({ root: rootRef }).add((self) => setupRef.current(self!, { motion }))
    scopeRef.current = scope
    return () => {
      scope.revert()
      if (scopeRef.current === scope) scopeRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootRef, motion, ...deps])

  return scopeRef
}

/** Re-exported so features animate through one module and keep v4 imports consistent. */
export { animate, createTimeline, spring, stagger, utils } from 'animejs'
export type { AnimationParams, JSAnimation, Scope } from 'animejs'
