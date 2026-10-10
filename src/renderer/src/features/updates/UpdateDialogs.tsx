import { useEffect, useRef, useState, type RefObject } from 'react'
import type { UpdateState, WhatsNew } from '@shared/api'
import { Button, Dialog, Icon, ProgressBar, Spinner, cx } from '@renderer/components/ui'
import { rich, t as translate, useT } from '@renderer/i18n'
import { openWebPage, WebLink } from './links'
import {
  installOverdueNote,
  NOTHING_PENDING,
  offerDescription,
  offerFooter,
  offerTitle,
  percentText,
  progressDetail,
  progressFraction,
  releaseUrl,
  whatsNewDescription,
  whatsNewTitle,
  type OfferFooter,
  type OfferPending,
  type OfferProblem,
  type OfferView
} from './model'
import { NoNotes, ReleaseNotes } from './ReleaseNotes'
import './updates.css'

/**
 * How long the "restarting" state may last before the window can be closed again. The app is
 * normally gone within a few seconds; if it is still here after this, something went wrong and
 * the user must not be left behind a window that cannot be closed.
 */
export const RESTART_OVERDUE_MS = 20_000

/** True once `active` has been true for `ms` without a break. */
function useOverdue(active: boolean, ms: number): boolean {
  const [overdue, setOverdue] = useState(false)
  useEffect(() => {
    if (!active) return
    const timer = setTimeout(() => setOverdue(true), ms)
    return () => {
      clearTimeout(timer)
      setOverdue(false)
    }
  }, [active, ms])
  return active && overdue
}

// ---------------------------------------------------------------- the changelog of an offer

interface OfferFootProps {
  footer: OfferFooter
  state: UpdateState
  url: string
  pending: OfferPending
  overdue: boolean
  /** Read out by a screen reader when it changes; never shown. */
  spoken: string
  footRef: RefObject<HTMLDivElement | null>
  onClose: () => void
  onDownload: () => void
  onCancel: () => void
  onRestart: () => void
}

function OfferFoot({ footer, state, url, pending, overdue, spoken, footRef, onClose, onDownload, onCancel, onRestart }: OfferFootProps) {
  const { view, primary, alert } = footer
  const version = state.offer?.version ?? ''
  const openRelease = (): void => openWebPage(url)
  const t = useT()

  let row
  if (view === 'downloading') {
    const detail = progressDetail(state.progress)
    row = (
      <div className="upd-foot__row">
        <div className="upd-progress">
          <div className="upd-progress__head">
            <span className="upd-progress__label">{rich('updates.progress.label', { b: (c) => <b>{c}</b> }, { percent: percentText(state.progress) })}</span>
            {detail !== '' && <span className="upd-progress__detail">{detail}</span>}
          </div>
          <ProgressBar value={progressFraction(state.progress)} label={t('updates.progress.bar', { version })} valueText={[percentText(state.progress), detail].filter((part) => part !== '').join(', ')} />
          <p className="upd-foot__note">{footer.note}</p>
        </div>
        <div className="upd-foot__actions">
          <Button variant="ghost" loading={pending.cancel} onClick={onCancel}>
            {t('common.cancel')}
          </Button>
        </div>
      </div>
    )
  } else if (view === 'installing') {
    row = (
      <div className="upd-foot__row upd-restarting" role="status">
        <Spinner size={20} />
        <div className="upd-restarting__text">
          <span className="upd-restarting__title">{t('updates.offer.restarting')}</span>
          <span className="upd-foot__note">{overdue ? installOverdueNote() : footer.note}</span>
        </div>
        {overdue && (
          <div className="upd-foot__actions">
            <Button variant="ghost" onClick={onClose}>
              {t('common.close')}
            </Button>
          </div>
        )}
      </div>
    )
  } else {
    const run = primary?.action === 'download' ? onDownload : primary?.action === 'restart' ? onRestart : openRelease
    row = (
      <div className="upd-foot__row">
        {footer.note !== '' && <p className="upd-foot__note">{footer.note}</p>}
        <div className="upd-foot__actions">
          <Button variant="ghost" onClick={onClose}>
            {t('updates.offer.later')}
          </Button>
          {alert?.releaseLink && (
            <Button iconEnd="external" onClick={openRelease}>
              {t('updates.action.release')}
            </Button>
          )}
          {primary && (
            <Button variant="primary" icon={primary.action === 'release' ? undefined : primary.icon} iconEnd={primary.action === 'release' ? primary.icon : undefined} loading={primary.busy} onClick={run} data-autofocus>
              {primary.label}
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div ref={footRef} className="upd-foot">
      {/* Always there, so that a change of its text is announced: an element that arrives with its text often is not. */}
      <span className="u-sr-only" role="status">
        {spoken}
      </span>
      {alert && (
        <div className={cx('upd-alert', `upd-alert--${alert.tone}`)} role="alert">
          <Icon name="warning" size={18} />
          <p className="upd-alert__text">{alert.text}</p>
        </div>
      )}
      {row}
    </div>
  )
}

export interface OfferDialogProps {
  open: boolean
  /** A snapshot with an offer. The last one stays on screen while the window fades out. */
  state: UpdateState | null
  pending?: OfferPending
  problem?: OfferProblem | null
  /** "Later", the close button, Escape and the scrim. Never stops a download. */
  onClose: () => void
  onDownload: () => void
  onCancel: () => void
  onRestart: () => void
  /**
   * The window is opening by itself. The keyboard focus then goes to the window, not to its main
   * button: whoever was typing when it came up would otherwise start the download with the next
   * Space or Enter.
   */
  unasked?: boolean
  /** Overrides `RESTART_OVERDUE_MS` (the kit previews the overdue state without the wait). */
  overdueMs?: number
}

/**
 * The changelog of a newer version, with the step that comes next along the bottom: download,
 * progress, restart, or (for a copy that cannot update itself) the way to the release page.
 */
export function OfferDialog({ open, state, pending = NOTHING_PENDING, problem = null, onClose, onDownload, onCancel, onRestart, unasked = false, overdueMs = RESTART_OVERDUE_MS }: OfferDialogProps) {
  // Frozen while the dialog plays its exit, so its text neither blanks out nor changes under the fade.
  const last = useRef<UpdateState | null>(null)
  if (state?.offer) last.current = state
  const shown = last.current
  const offer = shown?.offer ?? null
  const footer = shown ? offerFooter(shown, pending, problem) : null
  const view = footer?.view ?? 'available'
  const overdue = useOverdue(open && view === 'installing', overdueMs)
  const footRef = useRef<HTMLDivElement>(null)
  const viewBefore = useRef<OfferView | null>(null)
  const [spoken, setSpoken] = useState('')
  const version = offer?.version ?? ''
  useT()

  // The buttons change with every step, and the one that had the keyboard focus goes away with
  // its step. The focus is then on the window itself (or on the page behind it): it is moved to
  // the main button of the new step, so that Enter carries on from "Download" to "Restart".
  // Only on a change of step: when the window opens, the dialog places the first focus itself.
  useEffect(() => {
    const before = viewBefore.current
    viewBefore.current = open ? view : null
    if (!open) {
      setSpoken('')
      return
    }
    if (before === null || before === view) return
    // Nothing on screen says "finished" except the heading, which a screen reader does not read again.
    setSpoken(before === 'downloading' && view === 'ready' ? translate('updates.offer.readySpoken', { version }) : '')
    const panel = footRef.current?.closest<HTMLElement>('[role="dialog"]')
    if (!panel) return
    const focused = document.activeElement
    if (focused !== panel && panel.contains(focused)) return
    ;(panel.querySelector<HTMLElement>('[data-autofocus]') ?? panel).focus({ preventScroll: true })
  }, [open, view, version])

  if (!shown || !offer || !footer) return null
  const url = releaseUrl(offer.url)
  // While the app saves and closes, nothing behind the window may be touched: a change made now could be lost.
  const locked = view === 'installing' && !overdue
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      className="upd-dialog"
      dismissable={!locked}
      hideClose={locked}
      initialFocus={unasked ? 'panel' : undefined}
      title={offerTitle(offer.version, view)}
      description={offerDescription(shown.currentVersion, offer.notes.length)}
      media={
        <span className="upd-dialog__icon">
          <Icon name={view === 'ready' || view === 'installing' ? 'refresh' : 'download'} size={22} />
        </span>
      }
      footer={<OfferFoot footer={footer} state={shown} url={url} pending={pending} overdue={overdue} spoken={spoken} footRef={footRef} onClose={onClose} onDownload={onDownload} onCancel={onCancel} onRestart={onRestart} />}
    >
      {offer.notes.length === 0 ? <NoNotes url={url} /> : <ReleaseNotes notes={offer.notes} />}
    </Dialog>
  )
}

// ---------------------------------------------------------------- what's new

export interface WhatsNewDialogProps {
  open: boolean
  /** The last one stays on screen while the window fades out. */
  whatsNew: WhatsNew | null
  onClose: () => void
  /** The window is opening by itself: the focus goes to the window, so that a stray Space or Enter does not close it unread. */
  unasked?: boolean
}

/** Shown once after an update: the notes of every release between the old version and this one. */
export function WhatsNewDialog({ open, whatsNew, onClose, unasked = false }: WhatsNewDialogProps) {
  const last = useRef<WhatsNew | null>(null)
  if (whatsNew) last.current = whatsNew
  const shown = last.current
  const t = useT()
  if (!shown) return null
  const url = releaseUrl(shown.url)
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      className="upd-dialog"
      initialFocus={unasked ? 'panel' : undefined}
      title={whatsNewTitle(shown.version)}
      description={whatsNewDescription(shown)}
      media={
        <span className="upd-dialog__icon">
          <Icon name="gift" size={22} />
        </span>
      }
      footer={
        <div className="upd-foot">
          <div className="upd-foot__row">
            <p className="upd-foot__note">
              <WebLink href={url}>{t('updates.whatsNew.release')}</WebLink>
            </p>
            <div className="upd-foot__actions">
              <Button variant="primary" onClick={onClose} data-autofocus>
                {t('common.close')}
              </Button>
            </div>
          </div>
        </div>
      }
    >
      {shown.notes.length === 0 ? <NoNotes url={url} /> : <ReleaseNotes notes={shown.notes} />}
    </Dialog>
  )
}
