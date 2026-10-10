/**
 * Pure rules behind the update surfaces: which window may come up by itself, what the changelog
 * window offers in each mode and phase, and the wording of labels, sizes, speeds and failures.
 * No React and no DOM, so everything here is unit-tested.
 */

import type { ReleaseNote, UpdateError, UpdateErrorKind, UpdatePhase, UpdateProgress, UpdateState, WhatsNew } from '@shared/api'
import { RELEASES_URL, REPO_SLUG } from '@shared/repo'
import type { IconName } from '@renderer/components/ui/Icon'
import { formatBytes } from '@renderer/features/settings/settings-model'
import { t, type MessageKey } from '@renderer/i18n/runtime'
import { formatDate, timeAgo } from '@renderer/lib/format'
import { parseMarkdown, safeHref, type Block, type Inline, type MdDoc } from './markdown'

// ---------------------------------------------------------------- which window, and when

/** The update window on screen. There is one slot, so "What's new" and an offer never show together. */
export type UpdateSurface = 'none' | 'offer' | 'whats-new'

/** What the user is in the middle of. A window nobody asked for waits until all of it is over. */
export interface Interruptions {
  /** Something Escape would close is up: a dialog, a drawer, the command palette, an open menu, list or filter popover. */
  layerOpen: boolean
  editorOpen: boolean
  paletteOpen: boolean
  /** A key or a mouse button was pressed a moment ago. */
  recentInput: boolean
}

/**
 * Versions this page has already dealt with. The main process is the memory (`offer.announced`,
 * `whatsNew`); these only cover the moment between acting here and its next snapshot.
 */
export interface HandledHere {
  /** Offered version the changelog window was opened for. */
  offer: string | null
  /** Version whose "What's new" was closed. */
  whatsNew: string | null
}

/**
 * - `whats-new`: open the "What's new" window.
 * - `updated-toast`: the app was updated but there are no notes to show: say so in a toast.
 * - `offer`: open the changelog window for the offered version.
 */
export type AutoAction = 'none' | 'whats-new' | 'updated-toast' | 'offer'

/**
 * What may come up by itself right now. "What's new" goes first and an offer waits behind it;
 * neither opens over a dialog, the entry editor, the command palette or an open dropdown, nor
 * under the hands of someone in the middle of typing or clicking, and an offer opens once per
 * version.
 */
export function autoAction(state: UpdateState | null, surface: UpdateSurface, busy: Interruptions, handled: HandledHere): AutoAction {
  if (state === null || state.mode === 'off' || surface !== 'none') return 'none'
  const interrupted = busy.layerOpen || busy.editorOpen || busy.paletteOpen || busy.recentInput

  const whatsNew = state.whatsNew
  if (whatsNew !== null && whatsNew.version !== handled.whatsNew) {
    if (interrupted) return 'none'
    return whatsNew.notes.length === 0 ? 'updated-toast' : 'whats-new'
  }

  const offer = state.offer
  if (offer === null || offer.announced || offer.version === handled.offer) return 'none'
  // The app is about to close: nothing new opens now.
  if (state.phase === 'installing' || interrupted) return 'none'
  return 'offer'
}

/**
 * A download the user started has ended while the changelog window was closed: `ready` when it
 * can be installed, `download-failed` when it broke. Cancelling says nothing, and neither does a
 * page that loads into a phase (nothing happened while it was looking).
 */
export function transitionToast(previous: UpdatePhase | null, next: UpdateState, surface: UpdateSurface): 'ready' | 'download-failed' | null {
  if (previous !== 'downloading' || surface === 'offer' || next.mode !== 'auto' || next.offer === null) return null
  if (next.phase === 'ready') return 'ready'
  if (next.phase !== 'downloading' && next.error?.during === 'download') return 'download-failed'
  return null
}

// ---------------------------------------------------------------- the changelog window

/**
 * What the changelog window is doing:
 * - `available`: the installed copy can download the update.
 * - `downloading`, `ready`, `installing`: the steps after that.
 * - `manual`: this copy cannot update itself; the window sends the user to the release page.
 */
export type OfferView = 'available' | 'downloading' | 'ready' | 'installing' | 'manual'

/** Steps started from this page that have not come back yet. */
export interface OfferPending {
  download: boolean
  cancel: boolean
  restart: boolean
}

export const NOTHING_PENDING: OfferPending = { download: false, cancel: false, restart: false }

export function offerView(state: Pick<UpdateState, 'mode' | 'phase'>, pending: OfferPending = NOTHING_PENDING): OfferView {
  if (state.mode !== 'auto') return 'manual'
  if (state.phase === 'installing' || pending.restart) return 'installing'
  if (state.phase === 'downloading') return 'downloading'
  if (state.phase === 'ready') return 'ready'
  return 'available'
}

export function offerTitle(version: string, view: OfferView): string {
  if (view === 'ready') return t('updates.offer.title.ready', { version })
  if (view === 'installing') return t('updates.offer.title.installing', { version })
  return t('updates.offer.title.available', { version })
}

/** The line under the title: what is running now, and how many releases the notes cover. */
export function offerDescription(currentVersion: string, releases: number): string {
  return releases > 1 ? t('updates.offer.descriptionMany', { version: currentVersion, count: releases }) : t('updates.offer.description', { version: currentVersion })
}

/**
 * Something the changelog window has to report. `editor-open` and `not-saved` are found by this
 * page before it asks for the restart; `error` is a failed download or install.
 */
export type OfferProblem = { type: 'editor-open' } | { type: 'not-saved' } | { type: 'error'; kind: UpdateErrorKind; during: 'download' | 'install' }

/** What this page ran into, else the failure the main process recorded. A failed check is not the window's business. */
export function offerProblem(state: Pick<UpdateState, 'mode' | 'error'>, local: OfferProblem | null): OfferProblem | null {
  if (local !== null) return local
  const error = state.error
  if (state.mode !== 'auto' || error === null || error.during === 'check') return null
  return { type: 'error', kind: error.kind, during: error.during }
}

export interface ProblemWording {
  tone: 'warning' | 'danger'
  text: string
  /** Doing the same step again can help. */
  retry: boolean
  /** Offer the release page as the way round. */
  releaseLink: boolean
}

export function problemWording(problem: OfferProblem): ProblemWording {
  if (problem.type === 'editor-open') {
    return { tone: 'warning', text: t('updates.problem.editorOpen'), retry: false, releaseLink: false }
  }
  if (problem.type === 'not-saved') {
    return { tone: 'danger', text: t('updates.problem.notSaved'), retry: true, releaseLink: false }
  }
  return { tone: 'danger', ...errorWording(problem), releaseLink: true }
}

export interface OfferPrimary {
  action: 'download' | 'restart' | 'release'
  label: string
  icon: IconName
  busy: boolean
}

export interface OfferFooter {
  view: OfferView
  /** One quiet line beside the buttons; "" for none. */
  note: string
  primary: OfferPrimary | null
  /** The quiet button: "later" closes the window, "cancel" stops the download. */
  secondary: 'later' | 'cancel' | null
  alert: ProblemWording | null
}

const OFFER_NOTES: Readonly<Record<OfferView, MessageKey | null>> = {
  available: null,
  downloading: 'updates.offer.note.downloading',
  // Nothing is installed when the app is simply closed (see `autoInstallOnAppQuit` in the main process), so the window says so.
  ready: 'updates.offer.note.ready',
  installing: 'updates.offer.note.installing',
  manual: 'updates.offer.note.manual'
}

/** Replaces the note of the "installing" view when the app is still open long after it should have closed. */
export function installOverdueNote(): string {
  return t('updates.offer.note.overdue')
}

/** The bottom of the changelog window: its buttons, its one line of explanation and what went wrong, if anything. */
export function offerFooter(state: Pick<UpdateState, 'mode' | 'phase' | 'error'>, pending: OfferPending = NOTHING_PENDING, local: OfferProblem | null = null): OfferFooter {
  const view = offerView(state, pending)
  const noteKey = OFFER_NOTES[view]
  const note = noteKey === null ? '' : t(noteKey)
  const problem = offerProblem(state, local)

  if (view === 'manual') return { view, note, primary: { action: 'release', label: t('updates.action.release'), icon: 'external', busy: false }, secondary: 'later', alert: null }
  if (view === 'downloading') return { view, note, primary: null, secondary: 'cancel', alert: null }
  if (view === 'installing') return { view, note, primary: null, secondary: null, alert: null }

  if (view === 'ready') {
    // A download that failed earlier no longer matters once the update is here.
    const shown = problem !== null && (problem.type !== 'error' || problem.during === 'install') ? problemWording(problem) : null
    return { view, note, primary: { action: 'restart', label: shown?.retry ? t('updates.action.retry') : t('updates.action.restart'), icon: 'refresh', busy: false }, secondary: 'later', alert: shown }
  }

  // "Not saved" and "an entry is open" belong to the restart; before the download they are stale.
  const shown = problem !== null && problem.type === 'error' ? problemWording(problem) : null
  const busy = pending.download || state.phase === 'checking'
  return { view, note, primary: { action: 'download', label: shown?.retry ? t('updates.action.retry') : t('updates.action.download'), icon: 'download', busy }, secondary: 'later', alert: shown }
}

// ---------------------------------------------------------------- what's new

export function whatsNewTitle(version: string): string {
  return t('updates.whatsNew.title', { version })
}

/** The line under the title: where the update came from, and how many releases the notes cover. */
export function whatsNewDescription(whatsNew: Pick<WhatsNew, 'version' | 'from' | 'notes'>): string {
  const count = whatsNew.notes.length
  if (whatsNew.from !== null && whatsNew.from !== whatsNew.version) return count > 1 ? t('updates.whatsNew.updatedFromMany', { from: whatsNew.from, count }) : t('updates.whatsNew.updatedFrom', { from: whatsNew.from })
  return count > 1 ? t('updates.whatsNew.updatedMany', { count }) : t('updates.whatsNew.updated')
}

// ---------------------------------------------------------------- the indicator in the rail

export interface IndicatorInfo {
  label: string
  icon: IconName
  /** 0..1 while a download runs, else null. */
  progress: number | null
  /** The update is downloaded and waits for "Restart and update". */
  ready: boolean
}

/** The small marker in the navigation rail; null when there is nothing to offer. */
export function indicatorInfo(state: UpdateState | null): IndicatorInfo | null {
  if (state === null || state.mode === 'off' || state.offer === null) return null
  const view = offerView(state)
  if (view === 'downloading') return { label: t('updates.indicator.downloading', { percent: percentText(state.progress) }), icon: 'download', progress: progressFraction(state.progress), ready: false }
  // Not "Restart to update": the marker opens the window, and a restart by hand installs nothing.
  if (view === 'ready') return { label: t('updates.indicator.ready'), icon: 'refresh', progress: null, ready: true }
  if (view === 'installing') return { label: t('updates.indicator.restarting'), icon: 'refresh', progress: null, ready: true }
  return { label: t('updates.indicator.available'), icon: 'download', progress: null, ready: false }
}

// ---------------------------------------------------------------- the notice on screens without a rail

export interface NoticeInfo {
  /** "Pelagix 0.3.0 is available", "Pelagix 0.3.0 is ready to install". */
  text: string
  icon: IconName
  /** The button that opens the changelog window. */
  button: { label: string; icon: IconName }
}

/**
 * The update line of the screens that have no navigation rail: a start-up that failed, and the
 * message shown when the whole shell has crashed. A version that cannot start must still be able
 * to offer the one that fixes it. Null when there is nothing to offer.
 */
export function noticeInfo(state: UpdateState | null): NoticeInfo | null {
  const marker = indicatorInfo(state)
  if (marker === null || state === null || state.offer === null) return null
  const view = offerView(state)
  const text = view === 'downloading' ? t('updates.notice.downloading', { version: state.offer.version, percent: percentText(state.progress) }) : offerTitle(state.offer.version, view)
  return { text, icon: marker.icon, button: offerButton(view) }
}

// ---------------------------------------------------------------- settings

export interface StatusLine {
  /** `ok` up to date, `news` something to act on, `busy` working, `warn` the last check failed, `quiet` nothing to report. */
  tone: 'ok' | 'news' | 'busy' | 'warn' | 'quiet'
  title: string
  detail: string
}

/**
 * What a downloaded update still needs. Said in full because the obvious guess is wrong: closing
 * and reopening the app installs nothing, only the button in the changelog window does.
 */
export function readyDetail(): string {
  return t('updates.status.ready.detail')
}

/** The status at the top of the Updates section. */
export function statusLine(state: UpdateState, now: number): StatusLine {
  if (state.mode === 'off') return { tone: 'quiet', title: t('updates.status.off.title'), detail: t('updates.status.off.detail') }

  const offer = state.offer
  const checked = lastCheckedText(state.lastCheckedAt, now)
  if (state.phase === 'checking') return { tone: 'busy', title: t('updates.status.checking'), detail: offer ? t('updates.check.available', { version: offer.version }) : checked }

  if (offer !== null) {
    const view = offerView(state)
    if (view === 'installing') return { tone: 'busy', title: t('updates.status.installing.title', { version: offer.version }), detail: t('updates.status.installing.detail') }
    if (view === 'downloading') {
      const detail = [percentText(state.progress), progressDetail(state.progress)].filter((part) => part !== '').join(' · ')
      return { tone: 'busy', title: t('updates.status.downloading', { version: offer.version }), detail }
    }
    if (view === 'ready') return { tone: 'news', title: t('updates.status.ready.title', { version: offer.version }), detail: readyDetail() }
    return { tone: 'news', title: t('updates.status.available.title', { version: offer.version }), detail: view === 'manual' ? t('updates.status.available.manual') : checked }
  }

  // Only a check the user asked for leaves an error behind; until the next one, "up to date" would be a guess.
  if (state.error !== null && state.error.during === 'check') return { tone: 'warn', title: t('updates.status.checkFailed'), detail: errorWording(state.error).text }

  if (state.lastCheckedAt === null) {
    return { tone: 'quiet', title: t('updates.status.notChecked'), detail: state.autoCheck ? t('updates.status.notChecked.auto') : t('updates.status.notChecked.manual') }
  }
  return { tone: 'ok', title: t('updates.status.upToDate'), detail: checked }
}

/**
 * The button next to the status: it opens the changelog window, and says what is waiting there.
 * Only the button inside that window restarts the app, so only that one is called "Restart".
 */
export function offerButton(view: OfferView): { label: string; icon: IconName } {
  if (view === 'downloading') return { label: t('updates.button.showDownload'), icon: 'download' }
  if (view === 'ready') return { label: t('updates.button.install'), icon: 'refresh' }
  if (view === 'installing') return { label: t('updates.button.showRestart'), icon: 'refresh' }
  return { label: t('updates.button.whatsNew'), icon: 'note' }
}

export interface CheckOutcome {
  tone: 'ok' | 'news' | 'error'
  text: string
}

/** The line shown next to "Check for updates" once a check the user asked for has come back. */
export function checkOutcome(state: UpdateState): CheckOutcome {
  if (state.error !== null && state.error.during === 'check') return { tone: 'error', text: errorWording(state.error).text }
  if (state.offer !== null) return { tone: 'news', text: t('updates.check.available', { version: state.offer.version }) }
  return { tone: 'ok', text: t('updates.check.newest') }
}

// ---------------------------------------------------------------- failures

// Message keys: the text is looked up when the failure is shown.
const CHECK_ERRORS: Readonly<Record<UpdateErrorKind, MessageKey>> = {
  offline: 'updates.error.check.offline',
  'not-ready': 'updates.error.check.notReady',
  'rate-limited': 'updates.error.check.rateLimited',
  corrupt: 'updates.error.check.corrupt',
  disk: 'updates.error.check.disk',
  unknown: 'updates.error.check.unknown'
}

const DOWNLOAD_ERRORS: Readonly<Record<UpdateErrorKind, MessageKey>> = {
  offline: 'updates.error.download.offline',
  'not-ready': 'updates.error.download.notReady',
  'rate-limited': 'updates.error.download.rateLimited',
  corrupt: 'updates.error.download.corrupt',
  disk: 'updates.error.download.disk',
  unknown: 'updates.error.download.unknown'
}

const INSTALL_ERRORS: Readonly<Partial<Record<UpdateErrorKind, MessageKey>>> = {
  corrupt: 'updates.error.install.corrupt',
  disk: 'updates.error.install.disk'
}
const INSTALL_ERROR: MessageKey = 'updates.error.install.unknown'

/** Kinds where pressing the same button again straight away is pointless. */
const NO_RETRY: ReadonlySet<UpdateErrorKind> = new Set(['not-ready', 'rate-limited'])

/** Plain words for a failed step. The error itself never reaches the page, only its kind. */
export function errorWording(error: Pick<UpdateError, 'kind' | 'during'>): { text: string; retry: boolean } {
  if (error.during === 'install') return { text: t(INSTALL_ERRORS[error.kind] ?? INSTALL_ERROR), retry: true }
  const table = error.during === 'download' ? DOWNLOAD_ERRORS : CHECK_ERRORS
  return { text: t(table[error.kind] ?? table.unknown), retry: !NO_RETRY.has(error.kind) }
}

// ---------------------------------------------------------------- amounts and times

function clampPercent(progress: UpdateProgress | null): number {
  if (progress === null) return 0
  // A download that only fetches the changed parts can report odd totals; fall back on the bytes.
  const raw = Number.isFinite(progress.percent) ? progress.percent : progress.total > 0 ? (progress.transferred / progress.total) * 100 : 0
  return Number.isFinite(raw) ? Math.min(100, Math.max(0, raw)) : 0
}

/** "42%". Rounded down, so it only reads 100% when the download is complete. */
export function percentText(progress: UpdateProgress | null): string {
  return `${Math.floor(clampPercent(progress))}%`
}

/** The download as a fraction 0..1, for a progress bar. */
export function progressFraction(progress: UpdateProgress | null): number {
  return clampPercent(progress) / 100
}

/** "640 KB/s", "2.10 MB/s"; "" when nothing is moving (or the figure makes no sense). */
export function speedText(bytesPerSecond: number): string {
  return Number.isFinite(bytesPerSecond) && bytesPerSecond > 0 ? t('updates.progress.speed', { size: formatBytes(bytesPerSecond) }) : ''
}

/** "12.4 MB of 29.5 MB"; only the amount so far when the total is unknown; "" before anything has arrived. */
export function amountText(progress: UpdateProgress | null): string {
  if (progress === null) return ''
  const total = Number.isFinite(progress.total) ? progress.total : 0
  const done = Number.isFinite(progress.transferred) ? Math.max(0, progress.transferred) : 0
  if (total > 0) return t('updates.progress.amount', { done: formatBytes(Math.min(done, total)), total: formatBytes(total) })
  return done > 0 ? formatBytes(done) : ''
}

/** Amount and speed on one line: "12.4 MB of 29.5 MB · 2.10 MB/s". */
export function progressDetail(progress: UpdateProgress | null): string {
  if (progress === null) return ''
  return [amountText(progress), speedText(progress.bytesPerSecond)].filter((part) => part !== '').join(' · ')
}

/** "Last checked 5 min ago", "Last checked yesterday", "Last checked on 2 Oct 2026"; "Not checked yet" for null. */
export function lastCheckedText(at: number | null, now: number): string {
  if (at === null || !Number.isFinite(at)) return t('updates.status.notChecked')
  const ago = timeAgo(new Date(at), new Date(now))
  if (ago === '') return t('updates.status.notChecked')
  // Older than a month comes back as a plain date.
  return ago === formatDate(new Date(at)) ? t('updates.status.lastCheckedOn', { date: ago }) : t('updates.status.lastChecked', { when: ago })
}

// ---------------------------------------------------------------- releases

/** Control characters and text-direction overrides: never wanted in a title. */
const UNPRINTABLE = /[\u0000-\u001f\u007f-\u009f‪-‮⁦-⁩﻿]/g
const TITLE_SEPARATORS = /^[\s|:·•,\-–—]+/
const isWordChar = (ch: string | undefined): boolean => ch !== undefined && /[\p{L}\p{N}]/u.test(ch)

/**
 * A release page from a snapshot, checked again on this side: https, and one of this repository's
 * releases. Anything else becomes the list of all releases.
 */
export function releaseUrl(url: string): string {
  const safe = safeHref(url)
  return safe !== null && safe.startsWith(`${RELEASES_URL}/`) ? safe : RELEASES_URL
}

/**
 * The release title without what the heading already says:
 * "Pelagix 0.1.0 | First Release" -> "First Release", "v0.2.0" -> "".
 */
export function releaseSubtitle(note: Pick<ReleaseNote, 'version' | 'name'>): string {
  let text = note.name.replace(UNPRINTABLE, '').trim()
  const version = note.version.toLowerCase()
  const lead = ['pelagix', 'version', 'release', `v${version}`, version].filter((word) => word !== '' && word !== 'v')
  for (let changed = true; changed; ) {
    changed = false
    const lower = text.toLowerCase()
    for (const word of lead) {
      if (lower.startsWith(word) && !isWordChar(text[word.length])) {
        text = text.slice(word.length)
        changed = true
        break
      }
    }
    const trimmed = text.replace(TITLE_SEPARATORS, '')
    if (trimmed !== text) {
      text = trimmed
      changed = true
    }
  }
  return text.length > 80 ? `${text.slice(0, 79).trimEnd()}…` : text
}

/** "9 Oct 2026", or "" when the date is unknown. */
export function releaseDate(note: Pick<ReleaseNote, 'publishedAt'>): string {
  return formatDate(note.publishedAt)
}

export interface ParsedNote {
  note: ReleaseNote
  doc: MdDoc
  /** The window had no room left for this one; it is listed with a link to its release page only. */
  skipped: boolean
}

/** One release description is read up to here. */
const NOTE_CHARS = 60_000
/** All the notes of one window together: enough for years of ordinary changelogs. */
const WINDOW_CHARS = 150_000
const WINDOW_NODES = 12_000

function countInline(nodes: readonly Inline[]): number {
  let n = nodes.length
  for (const node of nodes) if (node.t === 'strong' || node.t === 'em' || node.t === 'del' || node.t === 'link') n += countInline(node.c)
  return n
}

function countBlocks(blocks: readonly Block[]): number {
  let n = blocks.length
  for (const block of blocks) {
    if (block.t === 'heading' || block.t === 'paragraph') n += countInline(block.c)
    else if (block.t === 'quote') n += countBlocks(block.c)
    else if (block.t === 'list') for (const item of block.items) n += 1 + countBlocks(item.c)
    else if (block.t === 'table') for (const row of [block.head, ...block.rows]) for (const cell of row) n += 1 + countInline(cell)
  }
  return n
}

/**
 * Parses the notes of a window, newest first, within one budget for all of them, so a pile of
 * enormous descriptions cannot make the window slow. What does not fit is marked `truncated`
 * (cut short) or `skipped` (left out); the window then points to the release page.
 */
export function parseNotes(notes: readonly ReleaseNote[]): ParsedNote[] {
  let chars = WINDOW_CHARS
  let nodes = WINDOW_NODES
  return notes.map((note) => {
    const body = typeof note.body === 'string' ? note.body : ''
    if (chars <= 0 || nodes <= 0) return { note, doc: { blocks: [], truncated: body.trim() !== '' }, skipped: body.trim() !== '' }
    const doc = parseMarkdown(body, { maxLength: Math.min(NOTE_CHARS, chars), maxNodes: nodes, repo: REPO_SLUG })
    chars -= Math.min(body.length, NOTE_CHARS)
    nodes -= countBlocks(doc.blocks)
    return { note, doc, skipped: false }
  })
}
