import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { burst } from '@renderer/lib/anim'
import { useUiStore, type Toast, type ToastKind } from '@renderer/store/ui'
import { cx } from './cx'
import { Icon, ICON_NAMES, type IconName } from './Icon'
import { Portal } from './Portal'
import './Toaster.css'

const KIND_ICON: Record<ToastKind, IconName> = { info: 'info', success: 'success', error: 'error', achievement: 'medal' }
const EXIT_MS = 170

/** Draws the medal of an achievement toast from the toast's `icon` hint (an achievement id, an icon name, an image URL). */
export type ToastMedalRenderer = (toast: Toast) => ReactNode

let medalRenderer: ToastMedalRenderer | null = null

/**
 * Lets the achievements feature supply the artwork for achievement toasts. Return null / undefined
 * to fall back to the default medal. Pass null to unregister.
 */
export function setToastMedalRenderer(renderer: ToastMedalRenderer | null): void {
  medalRenderer = renderer
}

const isIconName = (value: string): value is IconName => (ICON_NAMES as string[]).includes(value)
const isImageUrl = (value: string): boolean => /^(\.{0,2}\/|https?:|data:image\/|sprite:|blob:)/.test(value)

function ToastGlyph({ toast }: { toast: Toast }) {
  const hint = toast.icon
  if (toast.kind === 'achievement') {
    const custom = medalRenderer?.(toast)
    return (
      <span className="ui-toast__medal">
        {custom ?? (hint && isImageUrl(hint) ? <img src={hint} alt="" draggable={false} /> : <Icon name={hint && isIconName(hint) ? hint : 'medal'} size={24} />)}
      </span>
    )
  }
  if (hint && isImageUrl(hint)) return <img className="ui-toast__image" src={hint} alt="" draggable={false} />
  return <Icon name={hint && isIconName(hint) ? hint : KIND_ICON[toast.kind]} size={20} className="ui-toast__icon" />
}

/** Where keyboard focus was when F6 jumped into the toasts; it goes back there afterwards. */
let focusOrigin: HTMLElement | null = null

function returnFocus(): void {
  const origin = focusOrigin
  focusOrigin = null
  if (origin?.isConnected) origin.focus()
  else if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
}

function ToastCard({ toast }: { toast: Toast }) {
  const dismiss = useUiStore((s) => s.dismiss)
  const runToastAction = useUiStore((s) => s.runToastAction)
  const ref = useRef<HTMLDivElement>(null)
  const [leaving, setLeaving] = useState(false)
  const remaining = useRef(toast.durationMs)
  const startedAt = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const leave = useCallback(() => {
    // A toast that is used from the keyboard hands focus back instead of dropping it.
    if (focusOrigin !== null && ref.current?.contains(document.activeElement)) returnFocus()
    setLeaving(true)
  }, [])

  // The toast goes away once its action has run, also when the handler throws.
  const act = useCallback(() => {
    try {
      runToastAction(toast.id)
    } finally {
      leave()
    }
  }, [runToastAction, toast.id, leave])

  const pause = useCallback(() => {
    if (timer.current === null) return
    clearTimeout(timer.current)
    timer.current = null
    remaining.current = Math.max(600, remaining.current - (Date.now() - startedAt.current))
  }, [])
  const resume = useCallback(() => {
    if (toast.durationMs <= 0 || timer.current !== null) return
    startedAt.current = Date.now()
    timer.current = setTimeout(leave, remaining.current)
  }, [toast.durationMs, leave])

  useEffect(() => {
    resume()
    return () => {
      if (timer.current !== null) clearTimeout(timer.current)
      timer.current = null
    }
  }, [resume])

  useEffect(() => {
    if (!leaving) return
    const t = setTimeout(() => dismiss(toast.id), EXIT_MS)
    return () => clearTimeout(t)
  }, [leaving, dismiss, toast.id])

  useEffect(() => {
    if (toast.kind === 'achievement') burst(ref.current, { x: 0.1, y: 0.5, count: 16, distance: 64 })
  }, [toast.kind])

  return (
    <div
      ref={ref}
      role={toast.kind === 'error' ? 'alert' : 'status'}
      className={cx('ui-toast', `ui-toast--${toast.kind}`, leaving && 'is-leaving')}
      onPointerEnter={pause}
      onPointerLeave={resume}
      onFocus={pause}
      onBlur={resume}
    >
      <ToastGlyph toast={toast} />
      <div className="ui-toast__text">
        {toast.kind === 'achievement' && <div className="ui-toast__eyebrow">Achievement unlocked</div>}
        <div className="ui-toast__title">{toast.title}</div>
        {toast.body !== undefined && toast.body !== '' && <div className="ui-toast__body">{toast.body}</div>}
      </div>
      {toast.action && (
        <button type="button" className="ui-toast__action" disabled={leaving || toast.actionTaken === true} onClick={act}>
          {toast.action.label}
        </button>
      )}
      <button type="button" className="ui-toast__close" aria-label="Dismiss notification" onClick={leave}>
        <Icon name="close" size={14} />
      </button>
    </div>
  )
}

/**
 * Renders the toasts of `store/ui`. Mounted once by the app shell; push with `toast({...})`.
 *
 * A toast with an `action` shows it as a button. The toasts sit at the very end of the tab order,
 * so F6 jumps straight to the newest one (its action when it has one, else its close button) and
 * F6 again goes back; a toast's timer is paused while it has focus or the pointer.
 */
export function Toaster() {
  const toasts = useUiStore((s) => s.toasts)
  const regionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'F6' || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
      const region = regionRef.current
      if (!region) return
      if (region.contains(document.activeElement)) {
        event.preventDefault()
        returnFocus()
        return
      }
      const live = region.querySelectorAll<HTMLElement>('.ui-toast:not(.is-leaving)')
      const newest = live[live.length - 1]
      const target = newest?.querySelector<HTMLElement>('.ui-toast__action:not(:disabled)') ?? newest?.querySelector<HTMLElement>('.ui-toast__close')
      if (!target) return
      event.preventDefault()
      const active = document.activeElement
      focusOrigin = active instanceof HTMLElement && active !== document.body ? active : null
      target.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <Portal>
      <div
        ref={regionRef}
        className="ui-toaster"
        role="region"
        aria-label="Notifications"
        aria-keyshortcuts="F6"
        onBlur={(event) => {
          // Focus left the toasts some other way (Tab, a click): forget where F6 came from.
          if (!event.currentTarget.contains(event.relatedTarget)) focusOrigin = null
        }}
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} />
        ))}
      </div>
    </Portal>
  )
}
