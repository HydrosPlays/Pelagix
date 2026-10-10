import { describe, expect, it } from 'vitest'
import type { ReleaseNote, UpdateErrorKind, UpdatePhase, UpdateProgress, UpdateState } from '@shared/api'
import { RELEASES_URL } from '@shared/repo'
import { fixtureState, fixtureWhatsNew, HOSTILE_NOTE, NOTES_FIXTURES, REAL_NOTE } from './fixtures/preview'
import {
  amountText,
  autoAction,
  checkOutcome,
  errorWording,
  indicatorInfo,
  noticeInfo,
  lastCheckedText,
  NOTHING_PENDING,
  offerButton,
  offerDescription,
  offerFooter,
  offerProblem,
  offerTitle,
  offerView,
  parseNotes,
  percentText,
  problemWording,
  progressDetail,
  progressFraction,
  releaseDate,
  releaseSubtitle,
  releaseUrl,
  speedText,
  statusLine,
  transitionToast,
  whatsNewDescription,
  whatsNewTitle,
  type HandledHere,
  type Interruptions,
  type OfferView
} from './model'

const FREE: Interruptions = { layerOpen: false, editorOpen: false, paletteOpen: false, recentInput: false }
const NOTHING_HANDLED: HandledHere = { offer: null, whatsNew: null }
const KINDS: readonly UpdateErrorKind[] = ['offline', 'not-ready', 'rate-limited', 'corrupt', 'disk', 'unknown']
const PHASES: readonly UpdatePhase[] = ['idle', 'checking', 'available', 'downloading', 'ready', 'installing']
const NOW = Date.UTC(2026, 9, 9, 12, 0, 0)

const unannounced = (extra: Parameters<typeof fixtureState>[0] = {}): UpdateState => fixtureState({ announced: false, ...extra })
const progress = (patch: Partial<UpdateProgress>): UpdateProgress => ({ percent: 0, transferred: 0, total: 0, bytesPerSecond: 0, ...patch })

// ---------------------------------------------------------------- which window, and when

describe('autoAction', () => {
  it('does nothing without a snapshot, in mode off, or while an update window is already up', () => {
    expect(autoAction(null, 'none', FREE, NOTHING_HANDLED)).toBe('none')
    expect(autoAction(unannounced({ mode: 'off' }), 'none', FREE, NOTHING_HANDLED)).toBe('none')
    expect(autoAction({ ...unannounced({ mode: 'off' }), whatsNew: fixtureWhatsNew() }, 'none', FREE, NOTHING_HANDLED)).toBe('none')
    expect(autoAction(unannounced(), 'offer', FREE, NOTHING_HANDLED)).toBe('none')
    expect(autoAction(unannounced({ whatsNew: fixtureWhatsNew() }), 'whats-new', FREE, NOTHING_HANDLED)).toBe('none')
  })

  it('does nothing when the app is up to date or a check failed in the background', () => {
    expect(autoAction(fixtureState({ notes: null }), 'none', FREE, NOTHING_HANDLED)).toBe('none')
    expect(autoAction(fixtureState({ notes: null, checkedAgoMs: null }), 'none', FREE, NOTHING_HANDLED)).toBe('none')
    expect(autoAction(fixtureState({ notes: null, error: { kind: 'offline', during: 'check' } }), 'none', FREE, NOTHING_HANDLED)).toBe('none')
  })

  it('opens the changelog once per offered version, in both modes', () => {
    expect(autoAction(unannounced(), 'none', FREE, NOTHING_HANDLED)).toBe('offer')
    expect(autoAction(unannounced({ mode: 'manual' }), 'none', FREE, NOTHING_HANDLED)).toBe('offer')
    // The main process remembers it across a reload ...
    expect(autoAction(fixtureState({ announced: true }), 'none', FREE, NOTHING_HANDLED)).toBe('none')
    // ... and this page remembers it until that snapshot arrives.
    expect(autoAction(unannounced(), 'none', FREE, { offer: '0.3.0', whatsNew: null })).toBe('none')
    // A different version is a new offer.
    expect(autoAction(unannounced(), 'none', FREE, { offer: '0.2.5', whatsNew: null })).toBe('offer')
  })

  it('waits while a dialog, the entry editor or the command palette is open, or the user is busy', () => {
    for (const key of ['layerOpen', 'editorOpen', 'paletteOpen', 'recentInput'] as const) {
      expect(autoAction(unannounced(), 'none', { ...FREE, [key]: true }, NOTHING_HANDLED), key).toBe('none')
      expect(autoAction(unannounced({ whatsNew: fixtureWhatsNew() }), 'none', { ...FREE, [key]: true }, NOTHING_HANDLED), key).toBe('none')
      expect(autoAction(unannounced({ whatsNew: fixtureWhatsNew('empty') }), 'none', { ...FREE, [key]: true }, NOTHING_HANDLED), key).toBe('none')
    }
  })

  it('never opens anything new while the app is about to close', () => {
    expect(autoAction(unannounced({ phase: 'installing' }), 'none', FREE, NOTHING_HANDLED)).toBe('none')
  })

  it('puts "What\'s new" before an offer, and never shows both', () => {
    const both = unannounced({ whatsNew: fixtureWhatsNew() })
    expect(autoAction(both, 'none', FREE, NOTHING_HANDLED)).toBe('whats-new')
    // While it is open, or held back by a dialog, the offer waits.
    expect(autoAction(both, 'whats-new', FREE, NOTHING_HANDLED)).toBe('none')
    expect(autoAction(both, 'none', { ...FREE, layerOpen: true }, NOTHING_HANDLED)).toBe('none')
    // Closed on this page: the offer is next, even before the main process has confirmed.
    expect(autoAction(both, 'none', FREE, { offer: null, whatsNew: '0.3.0' })).toBe('offer')
    expect(autoAction({ ...both, whatsNew: null }, 'none', FREE, NOTHING_HANDLED)).toBe('offer')
  })

  it('answers an update without notes with a toast instead of an empty window', () => {
    expect(autoAction(fixtureState({ notes: null, whatsNew: fixtureWhatsNew('empty') }), 'none', FREE, NOTHING_HANDLED)).toBe('updated-toast')
    expect(autoAction(fixtureState({ notes: null, whatsNew: fixtureWhatsNew('empty') }), 'none', FREE, { offer: null, whatsNew: '0.3.0' })).toBe('none')
  })
})

describe('transitionToast', () => {
  it('speaks up when a download ends while the window is closed', () => {
    expect(transitionToast('downloading', fixtureState({ phase: 'ready' }), 'none')).toBe('ready')
    expect(transitionToast('downloading', fixtureState({ phase: 'available', error: { kind: 'offline', during: 'download' } }), 'none')).toBe('download-failed')
    expect(transitionToast('downloading', fixtureState({ phase: 'ready' }), 'whats-new')).toBe('ready')
  })

  it('stays quiet while the window is open, after a cancel, during progress and on a fresh page', () => {
    expect(transitionToast('downloading', fixtureState({ phase: 'ready' }), 'offer')).toBeNull()
    expect(transitionToast('downloading', fixtureState({ phase: 'available' }), 'none')).toBeNull()
    expect(transitionToast('downloading', fixtureState({ phase: 'downloading' }), 'none')).toBeNull()
    expect(transitionToast(null, fixtureState({ phase: 'ready' }), 'none')).toBeNull()
    for (const phase of PHASES.filter((p) => p !== 'downloading')) expect(transitionToast(phase, fixtureState({ phase: 'ready' }), 'none'), phase).toBeNull()
  })

  it('never reports a failed check', () => {
    expect(transitionToast('downloading', fixtureState({ phase: 'available', error: { kind: 'offline', during: 'check' } }), 'none')).toBeNull()
    expect(transitionToast('checking', fixtureState({ notes: null, phase: 'idle', error: { kind: 'offline', during: 'check' } }), 'none')).toBeNull()
  })
})

// ---------------------------------------------------------------- the changelog window

describe('offerView', () => {
  it('follows the phase in the installed copy', () => {
    const views = PHASES.map((phase) => offerView({ mode: 'auto', phase }))
    expect(views).toEqual(['available', 'available', 'available', 'downloading', 'ready', 'installing'])
  })

  it('is "manual" for a copy that cannot update itself, whatever the phase says', () => {
    for (const phase of PHASES) {
      expect(offerView({ mode: 'manual', phase })).toBe('manual')
      expect(offerView({ mode: 'off', phase })).toBe('manual')
      expect(offerView({ mode: 'manual', phase }, { ...NOTHING_PENDING, restart: true })).toBe('manual')
    }
  })

  it('shows the restart from the moment it is asked for', () => {
    expect(offerView({ mode: 'auto', phase: 'ready' }, { ...NOTHING_PENDING, restart: true })).toBe('installing')
    expect(offerView({ mode: 'auto', phase: 'ready' }, { ...NOTHING_PENDING, download: true, cancel: true })).toBe('ready')
  })
})

describe('offer wording', () => {
  it('names the offered version in the title and the running one under it', () => {
    expect(offerTitle('0.3.0', 'available')).toBe('Pelagix 0.3.0 is available')
    expect(offerTitle('0.3.0', 'manual')).toBe('Pelagix 0.3.0 is available')
    expect(offerTitle('0.3.0', 'downloading')).toBe('Pelagix 0.3.0 is available')
    expect(offerTitle('0.3.0', 'ready')).toBe('Pelagix 0.3.0 is ready to install')
    expect(offerTitle('0.3.0', 'installing')).toBe('Installing Pelagix 0.3.0')
    expect(offerDescription('0.2.0', 0)).toBe('You have version 0.2.0.')
    expect(offerDescription('0.2.0', 1)).toBe('You have version 0.2.0.')
    expect(offerDescription('0.2.0', 3)).toBe('You have version 0.2.0. The notes below cover 3 releases, newest first.')
  })

  it('titles "What\'s new" with the version now running', () => {
    expect(whatsNewTitle('0.3.0')).toBe('What’s new in 0.3.0')
    expect(whatsNewDescription(fixtureWhatsNew('real', '0.0.9'))).toBe('Pelagix was updated from version 0.0.9.')
    expect(whatsNewDescription(fixtureWhatsNew('real', null))).toBe('Pelagix was updated.')
    expect(whatsNewDescription(fixtureWhatsNew('two', '0.2.0'))).toBe('Pelagix was updated from version 0.2.0. The notes below cover 2 releases, newest first.')
    expect(whatsNewDescription({ version: '0.3.0', from: '0.3.0', notes: [] })).toBe('Pelagix was updated.')
  })
})

describe('offerFooter', () => {
  it('offers the download in the installed copy', () => {
    const footer = offerFooter(fixtureState())
    expect(footer).toMatchObject({ view: 'available', note: '', secondary: 'later', alert: null })
    expect(footer.primary).toEqual({ action: 'download', label: 'Download and install', icon: 'download', busy: false })
  })

  it('shows the download button as busy while it is starting or a check is running', () => {
    expect(offerFooter(fixtureState(), { ...NOTHING_PENDING, download: true }).primary?.busy).toBe(true)
    expect(offerFooter(fixtureState({ phase: 'checking' })).primary).toMatchObject({ action: 'download', busy: true })
  })

  it('has only a cancel button while downloading, and says the window can be closed', () => {
    const footer = offerFooter(fixtureState({ phase: 'downloading' }))
    expect(footer).toMatchObject({ view: 'downloading', primary: null, secondary: 'cancel', alert: null })
    expect(footer.note).toBe('You can close this window. The download carries on.')
  })

  it('offers the restart once the update is downloaded, and says what will happen', () => {
    const footer = offerFooter(fixtureState({ phase: 'ready' }))
    expect(footer.primary).toEqual({ action: 'restart', label: 'Restart and update', icon: 'refresh', busy: false })
    expect(footer.secondary).toBe('later')
    expect(footer.note).toBe('Pelagix closes and reopens by itself, in a few seconds. Closing it yourself does not install the update.')
  })

  it('has no buttons at all while restarting', () => {
    for (const footer of [offerFooter(fixtureState({ phase: 'installing' })), offerFooter(fixtureState({ phase: 'ready' }), { ...NOTHING_PENDING, restart: true })]) {
      expect(footer).toMatchObject({ view: 'installing', primary: null, secondary: null, alert: null })
      expect(footer.note).toContain('reopens by itself')
    }
  })

  it('sends a copy that cannot update itself to the release page and never offers a download', () => {
    for (const phase of PHASES) {
      const footer = offerFooter(fixtureState({ mode: 'manual', phase, error: { kind: 'offline', during: 'download' } }), { download: true, cancel: true, restart: true }, { type: 'not-saved' })
      expect(footer.view).toBe('manual')
      expect(footer.primary).toEqual({ action: 'release', label: 'Open the release page', icon: 'external', busy: false })
      expect(footer.secondary).toBe('later')
      expect(footer.alert).toBeNull()
      expect(footer.note).toContain('replaced by hand')
    }
  })

  it('reports a failed download and turns the button into a retry where that can help', () => {
    for (const kind of KINDS) {
      const footer = offerFooter(fixtureState({ error: { kind, during: 'download' } }))
      const retry = kind !== 'not-ready' && kind !== 'rate-limited'
      expect(footer.alert, kind).toMatchObject({ tone: 'danger', retry, releaseLink: true })
      expect(footer.alert?.text, kind).toBe(errorWording({ kind, during: 'download' }).text)
      expect(footer.primary, kind).toMatchObject({ action: 'download', label: retry ? 'Try again' : 'Download and install' })
    }
  })

  it('reports a failed install next to the restart button', () => {
    const footer = offerFooter(fixtureState({ phase: 'ready', error: { kind: 'unknown', during: 'install' } }))
    expect(footer.alert).toMatchObject({ tone: 'danger', retry: true, releaseLink: true })
    expect(footer.primary).toMatchObject({ action: 'restart', label: 'Try again' })
  })

  it('says why a restart was refused, and keeps the restart button', () => {
    const editor = offerFooter(fixtureState({ phase: 'ready' }), NOTHING_PENDING, { type: 'editor-open' })
    expect(editor.alert).toMatchObject({ tone: 'warning', retry: false, releaseLink: false })
    expect(editor.alert?.text).toContain('entry you are editing')
    expect(editor.primary).toMatchObject({ action: 'restart', label: 'Restart and update' })

    const unsaved = offerFooter(fixtureState({ phase: 'ready' }), NOTHING_PENDING, { type: 'not-saved' })
    expect(unsaved.alert).toMatchObject({ tone: 'danger', retry: true, releaseLink: false })
    expect(unsaved.alert?.text).toContain('not on disk yet')
    expect(unsaved.primary).toMatchObject({ action: 'restart', label: 'Try again' })
  })

  it('drops reports that no longer apply to the step on screen', () => {
    // A check that failed is the business of Settings, not of this window.
    expect(offerFooter(fixtureState({ error: { kind: 'offline', during: 'check' } })).alert).toBeNull()
    // The download worked in the end.
    expect(offerFooter(fixtureState({ phase: 'ready', error: { kind: 'offline', during: 'download' } })).alert).toBeNull()
    // A refused restart, but the update is not downloaded any more.
    expect(offerFooter(fixtureState({ phase: 'available' }), NOTHING_PENDING, { type: 'editor-open' }).alert).toBeNull()
    // Nothing is reported over a running download or restart.
    expect(offerFooter(fixtureState({ phase: 'downloading', error: { kind: 'offline', during: 'download' } })).alert).toBeNull()
    expect(offerFooter(fixtureState({ phase: 'installing' }), NOTHING_PENDING, { type: 'not-saved' }).alert).toBeNull()
  })
})

describe('offerProblem', () => {
  it('prefers what this page ran into over the failure in the snapshot', () => {
    const state = fixtureState({ phase: 'ready', error: { kind: 'disk', during: 'install' } })
    expect(offerProblem(state, { type: 'editor-open' })).toEqual({ type: 'editor-open' })
    expect(offerProblem(state, null)).toEqual({ type: 'error', kind: 'disk', during: 'install' })
    expect(offerProblem(fixtureState(), null)).toBeNull()
    expect(offerProblem(fixtureState({ mode: 'manual', error: { kind: 'disk', during: 'download' } }), null)).toBeNull()
  })

  it('has wording for every problem', () => {
    expect(problemWording({ type: 'editor-open' }).text).toMatch(/^Finish or close the entry/)
    expect(problemWording({ type: 'not-saved' }).text).toMatch(/^Your latest changes are not on disk yet/)
    expect(problemWording({ type: 'error', kind: 'corrupt', during: 'download' })).toEqual({ tone: 'danger', text: 'The download arrived damaged and was thrown away. Download it again.', retry: true, releaseLink: true })
  })
})

// ---------------------------------------------------------------- failures

describe('errorWording', () => {
  it('has a full sentence for every kind in every step, and no two kinds of a step read the same', () => {
    for (const during of ['check', 'download'] as const) {
      const texts = KINDS.map((kind) => errorWording({ kind, during }).text)
      expect(new Set(texts).size).toBe(KINDS.length)
      for (const text of texts) expect(text).toMatch(/^[A-Z].{20,}\.$/)
    }
    for (const kind of KINDS) expect(errorWording({ kind, during: 'install' }).text).toMatch(/^[A-Z].{20,}\.$/)
  })

  it('says what happened in plain words', () => {
    expect(errorWording({ kind: 'offline', during: 'check' })).toEqual({ text: 'GitHub could not be reached. Check your internet connection, then try again.', retry: true })
    expect(errorWording({ kind: 'rate-limited', during: 'check' })).toEqual({ text: 'GitHub is turning away requests from your network at the moment. That usually clears within an hour.', retry: false })
    expect(errorWording({ kind: 'not-ready', during: 'download' })).toEqual({ text: 'The files for this update are not on GitHub yet. Try again later.', retry: false })
    expect(errorWording({ kind: 'disk', during: 'download' }).text).toBe('The update could not be saved on this computer. Free up some disk space, then try again.')
    expect(errorWording({ kind: 'offline', during: 'install' })).toEqual({ text: 'The update could not be started. Try again, or get the installer from the release page.', retry: true })
    expect(errorWording({ kind: 'corrupt', during: 'install' }).text).toContain('damaged')
  })

  it('falls back to the general wording for a kind it does not know', () => {
    const odd = 'made-up' as UpdateErrorKind
    expect(errorWording({ kind: odd, during: 'check' }).text).toBe(errorWording({ kind: 'unknown', during: 'check' }).text)
    expect(errorWording({ kind: odd, during: 'download' }).text).toBe(errorWording({ kind: 'unknown', during: 'download' }).text)
    expect(errorWording({ kind: odd, during: 'install' }).text).toBe(errorWording({ kind: 'unknown', during: 'install' }).text)
  })
})

// ---------------------------------------------------------------- the indicator in the rail

describe('indicatorInfo', () => {
  it('is only there while a version is on offer', () => {
    expect(indicatorInfo(null)).toBeNull()
    expect(indicatorInfo(fixtureState({ notes: null }))).toBeNull()
    expect(indicatorInfo(fixtureState({ notes: null, phase: 'checking' }))).toBeNull()
    expect(indicatorInfo(fixtureState({ notes: null, error: { kind: 'offline', during: 'check' } }))).toBeNull()
    expect(indicatorInfo(fixtureState({ mode: 'off' }))).toBeNull()
  })

  it('reads "Update available", "Downloading 42%", "Update ready"', () => {
    expect(indicatorInfo(fixtureState())).toEqual({ label: 'Update available', icon: 'download', progress: null, ready: false })
    expect(indicatorInfo(fixtureState({ phase: 'checking' }))?.label).toBe('Update available')
    expect(indicatorInfo(fixtureState({ mode: 'manual' }))).toEqual({ label: 'Update available', icon: 'download', progress: null, ready: false })
    expect(indicatorInfo(fixtureState({ phase: 'downloading', percent: 42 }))).toEqual({ label: 'Downloading 42%', icon: 'download', progress: 0.42, ready: false })
    expect(indicatorInfo(fixtureState({ phase: 'ready' }))).toEqual({ label: 'Update ready', icon: 'refresh', progress: null, ready: true })
    expect(indicatorInfo(fixtureState({ phase: 'installing' }))?.label).toBe('Restarting…')
  })

  it('still shows after the window has been announced or a later step failed', () => {
    expect(indicatorInfo(fixtureState({ announced: true, error: { kind: 'corrupt', during: 'download' } }))?.label).toBe('Update available')
  })
})

describe('noticeInfo', () => {
  it('is there exactly when the rail marker would be', () => {
    for (const state of [null, fixtureState({ notes: null }), fixtureState({ mode: 'off' }), fixtureState({ notes: null, error: { kind: 'offline', during: 'check' } })]) {
      expect(noticeInfo(state)).toBeNull()
      expect(indicatorInfo(state)).toBeNull()
    }
    for (const state of [fixtureState(), fixtureState({ mode: 'manual' }), fixtureState({ phase: 'checking' }), fixtureState({ phase: 'downloading' }), fixtureState({ phase: 'ready' }), fixtureState({ phase: 'installing' })]) {
      expect(noticeInfo(state)).not.toBeNull()
    }
  })

  it('says what is on offer and names the button for what it opens', () => {
    expect(noticeInfo(fixtureState())).toEqual({ text: 'Pelagix 0.3.0 is available', icon: 'download', button: { label: 'See what’s new', icon: 'note' } })
    expect(noticeInfo(fixtureState({ mode: 'manual' }))?.text).toBe('Pelagix 0.3.0 is available')
    expect(noticeInfo(fixtureState({ phase: 'downloading', percent: 42 }))).toMatchObject({ text: 'Downloading Pelagix 0.3.0: 42%', button: { label: 'Show the download' } })
    expect(noticeInfo(fixtureState({ phase: 'ready' }))).toMatchObject({ text: 'Pelagix 0.3.0 is ready to install', button: { label: 'Install the update' } })
    expect(noticeInfo(fixtureState({ phase: 'installing' }))).toMatchObject({ text: 'Installing Pelagix 0.3.0', button: { label: 'Show the restart' } })
  })
})

// ---------------------------------------------------------------- settings

describe('statusLine', () => {
  it('says the app is up to date and when that was last checked', () => {
    expect(statusLine(fixtureState({ notes: null, now: NOW }), NOW)).toEqual({ tone: 'ok', title: 'Pelagix is up to date', detail: 'Last checked 5 min ago' })
  })

  it('says so when no check has run yet', () => {
    expect(statusLine(fixtureState({ notes: null, checkedAgoMs: null, now: NOW }), NOW)).toEqual({ tone: 'quiet', title: 'Not checked yet', detail: 'Pelagix checks by itself a few seconds after it starts.' })
    expect(statusLine(fixtureState({ notes: null, checkedAgoMs: null, autoCheck: false, now: NOW }), NOW).detail).toBe('Automatic checks are off. Check whenever you like.')
  })

  it('follows a version through checking, available, downloading, ready and installing', () => {
    expect(statusLine(fixtureState({ notes: null, phase: 'checking', now: NOW }), NOW)).toEqual({ tone: 'busy', title: 'Checking for updates…', detail: 'Last checked 5 min ago' })
    expect(statusLine(fixtureState({ phase: 'checking', now: NOW }), NOW).detail).toBe('Version 0.3.0 is available.')
    expect(statusLine(fixtureState({ now: NOW }), NOW)).toEqual({ tone: 'news', title: 'Version 0.3.0 is available', detail: 'Last checked 5 min ago' })
    expect(statusLine(fixtureState({ phase: 'downloading', percent: 42, now: NOW }), NOW)).toEqual({ tone: 'busy', title: 'Downloading version 0.3.0', detail: '42% · 45.8 MB of 109.1 MB · 2.10 MB/s' })
    expect(statusLine(fixtureState({ phase: 'ready', now: NOW }), NOW)).toEqual({ tone: 'news', title: 'Version 0.3.0 is ready to install', detail: 'Choose “Restart and update” to install it. Closing Pelagix yourself does not.' })
    expect(statusLine(fixtureState({ phase: 'installing', now: NOW }), NOW)).toMatchObject({ tone: 'busy', title: 'Installing version 0.3.0…' })
  })

  it('never suggests that restarting the app by hand installs a downloaded update', () => {
    // It does not: nothing is installed when the app quits, only by "Restart and update" in the
    // changelog window. So that button alone is called a restart, and the rest say what they do.
    const ready = fixtureState({ phase: 'ready', now: NOW })
    const said = [statusLine(ready, NOW).title, statusLine(ready, NOW).detail, indicatorInfo(ready)?.label ?? '', offerButton('ready').label, offerFooter(ready).note]
    for (const text of said) {
      expect(text).not.toMatch(/restart (pelagix )?to (update|finish)/i)
      expect(text).not.toMatch(/^restart\b/i)
    }
    expect(offerFooter(ready).primary?.label).toBe('Restart and update')
    expect(statusLine(ready, NOW).detail).toContain('Closing Pelagix yourself does not')
    expect(offerFooter(ready).note).toContain('Closing it yourself does not install the update')
  })

  it('tells a portable copy where the new version comes from', () => {
    expect(statusLine(fixtureState({ mode: 'manual', now: NOW }), NOW)).toEqual({ tone: 'news', title: 'Version 0.3.0 is available', detail: 'Download it from GitHub to replace this copy.' })
    expect(statusLine(fixtureState({ mode: 'manual', notes: null, now: NOW }), NOW).title).toBe('Pelagix is up to date')
  })

  it('explains that nothing is checked in development', () => {
    expect(statusLine(fixtureState({ mode: 'off', notes: null, checkedAgoMs: null }), NOW)).toEqual({ tone: 'quiet', title: 'Update checks run in the packaged app', detail: 'This is a development build, so nothing is checked or downloaded.' })
  })

  it('does not claim "up to date" after a check that failed', () => {
    for (const kind of KINDS) {
      expect(statusLine(fixtureState({ notes: null, error: { kind, during: 'check' }, now: NOW }), NOW)).toEqual({ tone: 'warn', title: 'The last check did not work', detail: errorWording({ kind, during: 'check' }).text })
    }
    expect(statusLine(fixtureState({ notes: null, checkedAgoMs: null, error: { kind: 'offline', during: 'check' }, now: NOW }), NOW).tone).toBe('warn')
    // An offer that is still there is the news; a failed download is not about checking.
    expect(statusLine(fixtureState({ error: { kind: 'offline', during: 'check' }, now: NOW }), NOW).title).toBe('Version 0.3.0 is available')
    expect(statusLine(fixtureState({ notes: null, error: { kind: 'offline', during: 'download' }, now: NOW }), NOW).title).toBe('Pelagix is up to date')
  })
})

describe('checkOutcome', () => {
  it('answers a check with "newest", the new version, or what went wrong', () => {
    expect(checkOutcome(fixtureState({ notes: null }))).toEqual({ tone: 'ok', text: 'You have the newest version.' })
    expect(checkOutcome(fixtureState())).toEqual({ tone: 'news', text: 'Version 0.3.0 is available.' })
    for (const kind of KINDS) expect(checkOutcome(fixtureState({ notes: null, error: { kind, during: 'check' } }))).toEqual({ tone: 'error', text: errorWording({ kind, during: 'check' }).text })
    // A failed check does not hide an offer that is still there, and an old download failure is not this check's answer.
    expect(checkOutcome(fixtureState({ error: { kind: 'offline', during: 'check' } })).tone).toBe('error')
    expect(checkOutcome(fixtureState({ error: { kind: 'offline', during: 'download' } })).tone).toBe('news')
  })

  it('labels the button that opens the changelog by what is waiting there', () => {
    const buttons = (['available', 'manual', 'downloading', 'ready', 'installing'] satisfies OfferView[]).map(offerButton)
    expect(buttons.map((b) => b.label)).toEqual(['See what’s new', 'See what’s new', 'Show the download', 'Install the update', 'Show the restart'])
    expect(buttons.map((b) => b.icon)).toEqual(['note', 'note', 'download', 'refresh', 'refresh'])
  })
})

// ---------------------------------------------------------------- amounts and times

describe('progress wording', () => {
  it('rounds the percentage down and keeps it between 0 and 100', () => {
    expect(percentText(null)).toBe('0%')
    expect(percentText(progress({ percent: 0.4 }))).toBe('0%')
    expect(percentText(progress({ percent: 42.9 }))).toBe('42%')
    expect(percentText(progress({ percent: 99.99 }))).toBe('99%')
    expect(percentText(progress({ percent: 100 }))).toBe('100%')
    expect(percentText(progress({ percent: 250 }))).toBe('100%')
    expect(percentText(progress({ percent: -3 }))).toBe('0%')
    expect(progressFraction(progress({ percent: 42 }))).toBe(0.42)
    expect(progressFraction(null)).toBe(0)
  })

  it('works the percentage out from the bytes when it is missing', () => {
    expect(percentText(progress({ percent: Number.NaN, transferred: 50, total: 200 }))).toBe('25%')
    expect(percentText(progress({ percent: Number.NaN }))).toBe('0%')
    expect(percentText(progress({ percent: Number.POSITIVE_INFINITY, transferred: 1, total: 0 }))).toBe('0%')
  })

  it('gives the amount in the units the rest of the app uses', () => {
    expect(amountText(null)).toBe('')
    expect(amountText(progress({ transferred: 13_000_000, total: 30_932_992 }))).toBe('12.4 MB of 29.5 MB')
    // A download of only the changed parts is small.
    expect(amountText(progress({ transferred: 400_000, total: 789_630 }))).toBe('391 KB of 771 KB')
    expect(amountText(progress({ transferred: 0, total: 789_630 }))).toBe('0 KB of 771 KB')
    // Never more than the total, and no total at all is not "of 0 KB".
    expect(amountText(progress({ transferred: 900_000, total: 789_630 }))).toBe('771 KB of 771 KB')
    expect(amountText(progress({ transferred: 2_500_000, total: 0 }))).toBe('2.38 MB')
    expect(amountText(progress({ transferred: 0, total: 0 }))).toBe('')
    expect(amountText(progress({ transferred: Number.NaN, total: Number.NaN }))).toBe('')
  })

  it('gives the speed per second, or nothing when there is none', () => {
    expect(speedText(2_202_009)).toBe('2.10 MB/s')
    expect(speedText(655_360)).toBe('640 KB/s')
    expect(speedText(0)).toBe('')
    expect(speedText(-5)).toBe('')
    expect(speedText(Number.NaN)).toBe('')
  })

  it('joins amount and speed, leaving out what is not known', () => {
    expect(progressDetail(null)).toBe('')
    expect(progressDetail(progress({ transferred: 13_000_000, total: 30_932_992, bytesPerSecond: 2_202_009 }))).toBe('12.4 MB of 29.5 MB · 2.10 MB/s')
    expect(progressDetail(progress({ transferred: 13_000_000, total: 30_932_992 }))).toBe('12.4 MB of 29.5 MB')
    expect(progressDetail(progress({ bytesPerSecond: 655_360 }))).toBe('640 KB/s')
    expect(progressDetail(progress({}))).toBe('')
  })
})

describe('lastCheckedText', () => {
  // Local times, because "yesterday" is about the calendar day where the user is.
  const now = new Date(2026, 9, 9, 15, 0, 0).getTime()
  const ago = (ms: number): number => now - ms

  it('reads as a time ago, then as a date', () => {
    expect(lastCheckedText(null, now)).toBe('Not checked yet')
    expect(lastCheckedText(ago(5_000), now)).toBe('Last checked just now')
    expect(lastCheckedText(ago(5 * 60_000), now)).toBe('Last checked 5 min ago')
    expect(lastCheckedText(ago(3 * 3_600_000), now)).toBe('Last checked 3 h ago')
    expect(lastCheckedText(new Date(2026, 9, 8, 9, 0, 0).getTime(), now)).toBe('Last checked yesterday')
    expect(lastCheckedText(new Date(2026, 9, 5, 9, 0, 0).getTime(), now)).toBe('Last checked 4 days ago')
    expect(lastCheckedText(new Date(2026, 7, 2, 9, 0, 0).getTime(), now)).toBe('Last checked on 2 Aug 2026')
  })

  it('treats a clock that runs ahead, and nonsense, gently', () => {
    expect(lastCheckedText(now + 60_000, now)).toBe('Last checked just now')
    expect(lastCheckedText(Number.NaN, now)).toBe('Not checked yet')
  })
})

// ---------------------------------------------------------------- releases

describe('releaseUrl', () => {
  it('passes the release pages of this repository', () => {
    expect(releaseUrl(`${RELEASES_URL}/tag/v0.3.0`)).toBe('https://github.com/HydrosPlays/Pelagix/releases/tag/v0.3.0')
    expect(releaseUrl(`${RELEASES_URL}/latest`)).toBe(`${RELEASES_URL}/latest`)
  })

  it('turns anything else into the list of all releases', () => {
    const bad = [
      '',
      'javascript:alert(1)',
      'http://github.com/HydrosPlays/Pelagix/releases/tag/v0.3.0',
      'https://github.com/HydrosPlays/Pelagix',
      'https://github.com/HydrosPlays/Pelagix/releasesX/tag/v0.3.0',
      'https://github.com/SomeoneElse/Pelagix/releases/tag/v0.3.0',
      'https://github.com/HydrosPlays/Pelagix/releases/../../../evil/releases/tag/v1',
      'https://github.com.evil.example/HydrosPlays/Pelagix/releases/tag/v0.3.0',
      'https://evil.example/?https://github.com/HydrosPlays/Pelagix/releases/tag/v0.3.0',
      'https://github.com@evil.example/HydrosPlays/Pelagix/releases/tag/v0.3.0',
      'https://github.com/HydrosPlays/Pelagix/releases/tag/v0.3.0 onclick=alert(1)',
      `${RELEASES_URL}/tag/${'v'.repeat(3000)}`
    ]
    for (const url of bad) expect(releaseUrl(url), url).toBe(RELEASES_URL)
    expect(releaseUrl(undefined as unknown as string)).toBe(RELEASES_URL)
  })
})

describe('releaseSubtitle', () => {
  const subtitle = (name: string, version = '0.1.0'): string => releaseSubtitle({ name, version })

  it('leaves out what the heading already says', () => {
    expect(subtitle('Pelagix 0.1.0 | First Release')).toBe('First Release')
    expect(subtitle('v0.1.0')).toBe('')
    expect(subtitle('0.1.0')).toBe('')
    expect(subtitle('')).toBe('')
    expect(subtitle('  Pelagix v0.1.0  ')).toBe('')
    expect(subtitle('Version 0.1.0: Smoother boxes')).toBe('Smoother boxes')
    expect(subtitle('PELAGIX 0.1.0 - the big one')).toBe('the big one')
    expect(subtitle('Release 0.1.0 — Updates')).toBe('Updates')
  })

  it('keeps a title that only starts like those words', () => {
    expect(subtitle('Pelagixology')).toBe('Pelagixology')
    expect(subtitle('0.1.01 hotfix')).toBe('0.1.01 hotfix')
    expect(subtitle('Versions and more')).toBe('Versions and more')
    expect(subtitle('Smoother boxes 0.1.0')).toBe('Smoother boxes 0.1.0')
    expect(subtitle('0.2.0 notes', '0.1.0')).toBe('0.2.0 notes')
  })

  it('removes invisible characters and keeps the title short', () => {
    expect(subtitle('Pelagix 0.1.0 | ‮evil\u0000 name﻿')).toBe('evil name')
    const long = subtitle(`Pelagix 0.1.0 | ${'word '.repeat(40)}`)
    expect(long.length).toBeLessThanOrEqual(80)
    expect(long.endsWith('…')).toBe(true)
  })

  it('formats the date, or leaves it out', () => {
    expect(releaseDate({ publishedAt: null })).toBe('')
    expect(releaseDate({ publishedAt: 'not a date' })).toBe('')
    expect(releaseDate({ publishedAt: '2026-10-09T12:00:00Z' })).toBe('9 Oct 2026')
  })
})

describe('parseNotes', () => {
  const note = (version: string, body: string): ReleaseNote => ({ version, name: '', publishedAt: null, url: `${RELEASES_URL}/tag/v${version}`, body })

  it('parses every release in order', () => {
    const parsed = parseNotes(NOTES_FIXTURES.two)
    expect(parsed.map((p) => p.note.version)).toEqual(['0.3.0', '0.2.1'])
    expect(parsed.every((p) => !p.skipped && !p.doc.truncated && p.doc.blocks.length > 0)).toBe(true)
  })

  it('parses the real v0.1.0 notes completely', () => {
    const [parsed] = parseNotes([REAL_NOTE])
    expect(parsed?.skipped).toBe(false)
    expect(parsed?.doc.truncated).toBe(false)
    expect(parsed?.doc.blocks).toHaveLength(18)
  })

  it('shortens the links GitHub writes into generated notes', () => {
    const [parsed] = parseNotes([note('0.3.0', '* Fix by @someone in https://github.com/HydrosPlays/Pelagix/pull/12')])
    expect(JSON.stringify(parsed?.doc)).toContain('"v":"#12"')
  })

  it('treats a missing or empty description as nothing to show', () => {
    const parsed = parseNotes([note('0.3.0', ''), note('0.2.1', '   \n'), { ...note('0.2.0', ''), body: undefined as unknown as string }])
    expect(parsed.map((p) => [p.skipped, p.doc.truncated, p.doc.blocks.length])).toEqual([
      [false, false, 0],
      [false, false, 0],
      [false, false, 0]
    ])
  })

  it('cuts one enormous description short', () => {
    const [parsed] = parseNotes([note('0.3.0', 'A line of plain text.\n\n'.repeat(5000))])
    expect(parsed?.doc.truncated).toBe(true)
    expect(parsed?.skipped).toBe(false)
    expect(parsed?.doc.blocks.length).toBeGreaterThan(100)
    expect(parsed?.doc.blocks.length).toBeLessThan(3000)
  })

  it('leaves out the oldest releases once the window is full, and says so', () => {
    const big = 'Paragraph of filler text for a long changelog.\n\n'.repeat(1200)
    const parsed = parseNotes(Array.from({ length: 6 }, (_, i) => note(`0.${9 - i}.0`, big)))
    expect(parsed[0]).toMatchObject({ skipped: false })
    expect(parsed[0]?.doc.truncated).toBe(false)
    expect(parsed.at(-1)).toMatchObject({ skipped: true, doc: { blocks: [], truncated: true } })
    // Once one is left out, every older one is too.
    const firstSkipped = parsed.findIndex((p) => p.skipped)
    expect(firstSkipped).toBeGreaterThan(0)
    expect(parsed.slice(firstSkipped).every((p) => p.skipped)).toBe(true)
  })

  it('keeps a hostile description small and quick', () => {
    const started = performance.now()
    const parsed = parseNotes([HOSTILE_NOTE, HOSTILE_NOTE, HOSTILE_NOTE])
    expect(performance.now() - started).toBeLessThan(1000)
    expect(JSON.stringify(parsed).length).toBeLessThan(2_000_000)
    expect(JSON.stringify(parsed.map((p) => p.doc))).not.toMatch(/"href":"(?!https:\/\/)/)
  })

  it('stays within its budget for the long fixture', () => {
    const parsed = parseNotes(NOTES_FIXTURES.long)
    expect(parsed).toHaveLength(14)
    expect(parsed.filter((p) => p.skipped)).toHaveLength(0)
  })
})
