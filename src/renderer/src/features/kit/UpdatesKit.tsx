/**
 * Kit previews of the update feature: every state of the changelog window, "What's new", the
 * marker in the navigation rail, the notice on the screens without a rail, the toasts and the
 * Settings block, all from made-up states.
 * Nothing here talks to the main process, so it also works in a browser.
 *
 * The buttons carry `data-kit-upd` so that a script can open each state and take its picture.
 */

import { useEffect, useRef, useState } from 'react'
import type { UpdateErrorKind, UpdateState, WhatsNew } from '@shared/api'
import { Button, Icon, Panel } from '@renderer/components/ui'
import { UpdatesBlock, type AskedCheck } from '@renderer/features/settings/UpdatesSection'
import { fixtureProgress, fixtureState, fixtureWhatsNew } from '@renderer/features/updates/fixtures/preview'
import { indicatorInfo, NOTHING_PENDING, noticeInfo, type OfferPending, type OfferProblem } from '@renderer/features/updates/model'
import { toastDownloadFailed, toastReady, toastUpdated } from '@renderer/features/updates/toasts'
import { OfferDialog, WhatsNewDialog } from '@renderer/features/updates/UpdateDialogs'
import { UpdateIndicatorView } from '@renderer/features/updates/UpdateIndicator'
import { UpdateNoticeView } from '@renderer/features/updates/UpdateNotice'
import { toast } from '@renderer/store/ui'
import { Row, Section } from './parts'

const ERROR_KINDS: readonly UpdateErrorKind[] = ['offline', 'not-ready', 'rate-limited', 'corrupt', 'disk', 'unknown']

// ---------------------------------------------------------------- changelog window

interface OfferScene {
  id: string
  label: string
  state: UpdateState
  problem?: OfferProblem
  pending?: OfferPending
  /** Shortens the wait before a stuck restart can be closed. */
  overdueMs?: number
  /** As the watcher opens it: the keyboard focus goes to the window, not to its main button. */
  unasked?: boolean
}

const OFFER_SCENES: ReadonlyArray<{ label: string; scenes: readonly OfferScene[] }> = [
  {
    label: 'Installed copy (mode auto): press the buttons in the window to play it through',
    scenes: [
      { id: 'auto-available', label: 'Available', state: fixtureState() },
      { id: 'auto-checking', label: 'Available, checking again', state: fixtureState({ phase: 'checking' }) },
      { id: 'auto-starting', label: 'Download asked for', state: fixtureState(), pending: { ...NOTHING_PENDING, download: true } },
      { id: 'auto-downloading', label: 'Downloading 42%', state: fixtureState({ phase: 'downloading' }) },
      { id: 'auto-downloading-start', label: 'Downloading, nothing yet', state: { ...fixtureState({ phase: 'downloading' }), progress: null } },
      { id: 'auto-ready', label: 'Ready', state: fixtureState({ phase: 'ready' }) },
      { id: 'auto-installing', label: 'Restarting', state: fixtureState({ phase: 'installing' }) },
      { id: 'auto-installing-stuck', label: 'Restarting, overdue', state: fixtureState({ phase: 'installing' }), overdueMs: 600 }
    ]
  },
  {
    label: 'Opened by itself: the focus is on the window, so Space or Enter press nothing',
    scenes: [
      { id: 'unasked-available', label: 'Available', state: fixtureState(), unasked: true },
      { id: 'unasked-manual', label: 'Portable copy', state: fixtureState({ mode: 'manual' }), unasked: true }
    ]
  },
  {
    label: 'Portable copy (mode manual)',
    scenes: [
      { id: 'manual-available', label: 'Available', state: fixtureState({ mode: 'manual' }) },
      { id: 'manual-checking', label: 'Available, checking again', state: fixtureState({ mode: 'manual', phase: 'checking' }) },
      { id: 'manual-empty', label: 'Available, no notes', state: fixtureState({ mode: 'manual', notes: 'empty' }) }
    ]
  },
  {
    label: 'A download that failed, by kind',
    scenes: ERROR_KINDS.map((kind) => ({ id: `download-${kind}`, label: kind, state: fixtureState({ error: { kind, during: 'download' } }) }))
  },
  {
    label: 'A restart that did not happen',
    scenes: [
      { id: 'restart-editor', label: 'Entry editor open', state: fixtureState({ phase: 'ready' }), problem: { type: 'editor-open' } },
      { id: 'restart-not-saved', label: 'Save not written', state: fixtureState({ phase: 'ready' }), problem: { type: 'not-saved' } },
      ...ERROR_KINDS.map((kind) => ({ id: `install-${kind}`, label: `Install failed: ${kind}`, state: fixtureState({ phase: 'ready', error: { kind, during: 'install' } }) })),
      { id: 'install-earlier', label: 'Started by an earlier run, never arrived', state: fixtureState({ announced: true, error: { kind: 'unknown', during: 'install' } }) }
    ]
  },
  {
    label: 'Notes',
    scenes: [
      { id: 'notes-real', label: 'The real v0.1.0', state: fixtureState({ notes: 'real' }) },
      { id: 'notes-two', label: 'Two releases', state: fixtureState({ notes: 'two' }) },
      { id: 'notes-long', label: 'Fourteen long releases', state: fixtureState({ notes: 'long' }) },
      { id: 'notes-hostile', label: 'Hostile', state: fixtureState({ notes: 'hostile' }) },
      { id: 'notes-empty', label: 'None', state: fixtureState({ notes: 'empty' }) }
    ]
  }
]

function OfferPreviews() {
  const [open, setOpen] = useState(false)
  const [scene, setScene] = useState<OfferScene>(OFFER_SCENES[0]!.scenes[0]!)
  const [state, setState] = useState<UpdateState>(scene.state)
  const [problem, setProblem] = useState<OfferProblem | null>(null)
  const [pending, setPending] = useState<OfferPending>(NOTHING_PENDING)
  // Only a download started from inside the window moves; the "42%" scene stays where it is.
  const [playing, setPlaying] = useState(false)
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([])

  const later = (ms: number, run: () => void): void => {
    timers.current.push(setTimeout(run, ms))
  }
  const clearTimers = (): void => {
    for (const timer of timers.current) clearTimeout(timer)
    timers.current = []
  }
  useEffect(() => clearTimers, [])

  useEffect(() => {
    if (!playing || state.phase !== 'downloading') return
    const timer = setInterval(() => {
      setState((s) => {
        const percent = (s.progress?.percent ?? 0) + 3
        return percent >= 100 ? { ...s, phase: 'ready', progress: null } : { ...s, progress: fixtureProgress(percent) }
      })
    }, 280)
    return () => clearInterval(timer)
  }, [playing, state.phase])

  const show = (next: OfferScene): void => {
    clearTimers()
    setScene(next)
    setState(next.state)
    setProblem(next.problem ?? null)
    setPending(next.pending ?? NOTHING_PENDING)
    setPlaying(false)
    setOpen(true)
    // The real app would be gone by now; the preview lets go of the window by itself.
    if (next.state.phase === 'installing' && next.overdueMs === undefined) later(6000, () => setOpen(false))
  }

  const download = (): void => {
    setProblem(null)
    setPlaying(true)
    setState((s) => ({ ...s, phase: 'downloading', error: null, progress: fixtureProgress(0) }))
  }
  const cancel = (): void => {
    setPlaying(false)
    setState((s) => ({ ...s, phase: 'available', progress: null }))
  }
  const restart = (): void => {
    setProblem(null)
    setPending({ ...NOTHING_PENDING, restart: true })
    later(700, () => {
      setPending(NOTHING_PENDING)
      setState((s) => ({ ...s, phase: 'installing', error: null }))
    })
    later(5200, () => {
      setOpen(false)
      toast({ kind: 'info', title: 'The app would have closed and reopened here' })
    })
  }

  return (
    <Panel title="Changelog window" eyebrow="OfferDialog">
      {OFFER_SCENES.map((group) => (
        <Row key={group.label} label={group.label}>
          {group.scenes.map((item) => (
            <Button key={item.id} size="sm" data-kit-upd={`offer:${item.id}`} onClick={() => show(item)}>
              {item.label}
            </Button>
          ))}
        </Row>
      ))}
      <OfferDialog open={open} state={state} pending={pending} problem={problem} overdueMs={scene.overdueMs} unasked={scene.unasked} onClose={() => setOpen(false)} onDownload={download} onCancel={cancel} onRestart={restart} />
    </Panel>
  )
}

// ---------------------------------------------------------------- what's new, toasts

const WHATS_NEW_SCENES: ReadonlyArray<{ id: string; label: string; whatsNew: WhatsNew }> = [
  { id: 'two', label: 'Two releases', whatsNew: fixtureWhatsNew('two') },
  { id: 'real', label: 'The real v0.1.0', whatsNew: fixtureWhatsNew('real') },
  { id: 'by-hand', label: 'Old version unknown', whatsNew: fixtureWhatsNew('two', null) },
  { id: 'long', label: 'Fourteen long releases', whatsNew: fixtureWhatsNew('long') },
  { id: 'hostile', label: 'Hostile', whatsNew: fixtureWhatsNew('hostile') },
  { id: 'empty', label: 'No notes, shown anyway', whatsNew: fixtureWhatsNew('empty') }
]

function WhatsNewPreviews() {
  const [open, setOpen] = useState(false)
  const [unasked, setUnasked] = useState(false)
  const [whatsNew, setWhatsNew] = useState<WhatsNew>(WHATS_NEW_SCENES[0]!.whatsNew)
  const offered = fixtureState({ phase: 'ready' })
  return (
    <Panel title="What’s new, and the toasts" eyebrow="WhatsNewDialog, toasts.ts">
      <Row label="What’s new: shown once after an update">
        {WHATS_NEW_SCENES.map((item) => (
          <Button
            key={item.id}
            size="sm"
            data-kit-upd={`new:${item.id}`}
            onClick={() => {
              setWhatsNew(item.whatsNew)
              setUnasked(false)
              setOpen(true)
            }}
          >
            {item.label}
          </Button>
        ))}
        <Button
          size="sm"
          data-kit-upd="new:unasked"
          onClick={() => {
            setWhatsNew(WHATS_NEW_SCENES[0]!.whatsNew)
            setUnasked(true)
            setOpen(true)
          }}
        >
          Opened by itself
        </Button>
      </Row>
      <Row label="Toasts: updated without notes, and a download that ended while the window was closed">
        <Button size="sm" data-kit-upd="toast:updated" onClick={() => toastUpdated(fixtureWhatsNew('empty'))}>
          Updated, no notes
        </Button>
        <Button size="sm" data-kit-upd="toast:ready" onClick={() => toastReady(offered.offer!.version, () => toast({ kind: 'info', title: 'Would open the window and restart' }))}>
          Download finished
        </Button>
        <Button size="sm" data-kit-upd="toast:failed" onClick={() => toastDownloadFailed(offered.offer!.version, { kind: 'offline', during: 'download' }, () => toast({ kind: 'info', title: 'Would open the window' }))}>
          Download failed
        </Button>
      </Row>
      <WhatsNewDialog open={open} whatsNew={whatsNew} unasked={unasked} onClose={() => setOpen(false)} />
    </Panel>
  )
}

// ---------------------------------------------------------------- rail marker

const INDICATOR_STATES: readonly UpdateState[] = [
  fixtureState(),
  fixtureState({ phase: 'downloading' }),
  fixtureState({ phase: 'downloading', percent: 100 }),
  fixtureState({ phase: 'ready' }),
  fixtureState({ phase: 'installing' }),
  fixtureState({ mode: 'manual' })
]

function IndicatorPreviews() {
  const opened = (): void => void toast({ kind: 'info', title: 'Would open the changelog window' })
  return (
    <Panel title="Marker in the navigation rail" eyebrow="UpdateIndicatorView: only there while a version is on offer">
      <div className="kit-upd-rails" data-kit-upd="indicator">
        {[false, true].map((collapsed) => (
          <div key={String(collapsed)} className="kit-upd-rail-wrap">
            <div className="u-eyebrow">{collapsed ? 'Collapsed rail (under 1100 px): icon and tooltip' : 'Full rail'}</div>
            <div className={collapsed ? 'kit-upd-rail kit-upd-rail--collapsed' : 'kit-upd-rail'}>
              {INDICATOR_STATES.map((state, i) => {
                const info = indicatorInfo(state)
                return info ? <UpdateIndicatorView key={i} info={info} collapsed={collapsed} onOpen={opened} /> : null
              })}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  )
}

// ---------------------------------------------------------------- notice on the screens without a rail

function NoticePreviews() {
  const opened = (): void => void toast({ kind: 'info', title: 'Would open the changelog window' })
  const first = noticeInfo(INDICATOR_STATES[0] ?? null)
  return (
    <Panel title="Notice where there is no rail" eyebrow="UpdateNoticeView: the start-up error and the crash message, so a version that cannot start can still offer the next one">
      <div className="kit-upd-notices" data-kit-upd="notice">
        <div className="kit-upd-notice-list">
          {INDICATOR_STATES.map((state, i) => {
            const info = noticeInfo(state)
            return info ? <UpdateNoticeView key={i} info={info} onOpen={opened} /> : null
          })}
        </div>
        {/* The card of the start-up error (shell/BootScreen), with the notice where `BootError` puts it. */}
        <div className="boot__error kit-upd-boot">
          <span className="boot__error-icon">
            <Icon name="warning" size={28} />
          </span>
          <h3 className="boot__error-title">Your save could not be loaded</h3>
          <p className="boot__error-hint">Nothing has been overwritten. Make sure the save file is readable, then try again.</p>
          <div className="boot__error-actions">
            <Button variant="primary" icon="refresh">
              Try again
            </Button>
            <Button variant="ghost">Reload app</Button>
          </div>
          {first && (
            <div className="boot__error-notice">
              <UpdateNoticeView info={first} onOpen={opened} />
            </div>
          )}
        </div>
      </div>
    </Panel>
  )
}

// ---------------------------------------------------------------- settings block

interface SettingsScene {
  id: string
  label: string
  state: UpdateState
  asked?: AskedCheck
  checking?: boolean
}

const HOUR = 3_600_000

const SETTINGS_SCENES: readonly SettingsScene[] = [
  { id: 'up-to-date', label: 'Up to date', state: fixtureState({ notes: null }) },
  { id: 'old-check', label: 'Checked long ago', state: fixtureState({ notes: null, checkedAgoMs: 40 * 24 * HOUR, autoCheck: false }) },
  { id: 'never', label: 'Never checked', state: fixtureState({ notes: null, checkedAgoMs: null }) },
  { id: 'never-off', label: 'Never checked, automatic off', state: fixtureState({ notes: null, checkedAgoMs: null, autoCheck: false }) },
  { id: 'checking', label: 'Checking', state: fixtureState({ notes: null, phase: 'checking' }), checking: true },
  { id: 'answer-none', label: 'Asked: nothing new', state: fixtureState({ notes: null, checkedAgoMs: 0 }), asked: 'answered' },
  { id: 'answer-news', label: 'Asked: a new version', state: fixtureState({ checkedAgoMs: 0 }), asked: 'answered' },
  ...ERROR_KINDS.map((kind): SettingsScene => ({ id: `error-${kind}`, label: `Asked: ${kind}`, state: fixtureState({ notes: null, error: { kind, during: 'check' } }), asked: 'answered' })),
  { id: 'error-request', label: 'Asked: no answer at all', state: fixtureState({ notes: null }), asked: 'failed' },
  { id: 'available', label: 'Available', state: fixtureState() },
  { id: 'downloading', label: 'Downloading', state: fixtureState({ phase: 'downloading' }) },
  { id: 'ready', label: 'Ready', state: fixtureState({ phase: 'ready' }) },
  { id: 'installing', label: 'Installing', state: fixtureState({ phase: 'installing' }) },
  { id: 'manual', label: 'Portable copy', state: fixtureState({ mode: 'manual', notes: null }) },
  { id: 'manual-available', label: 'Portable copy, available', state: fixtureState({ mode: 'manual' }) },
  { id: 'off', label: 'Development (mode off)', state: fixtureState({ mode: 'off', notes: null, checkedAgoMs: null }) }
]

function SettingsPreviews() {
  const [scene, setScene] = useState<SettingsScene>(SETTINGS_SCENES[0]!)
  const [state, setState] = useState<UpdateState>(scene.state)
  const [asked, setAsked] = useState<AskedCheck>(null)
  const [checking, setChecking] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current)
    },
    []
  )

  const show = (next: SettingsScene): void => {
    if (timer.current !== null) clearTimeout(timer.current)
    setScene(next)
    setState(next.state)
    setAsked(next.asked ?? null)
    setChecking(next.checking ?? false)
  }
  const check = (): void => {
    setAsked(null)
    setChecking(true)
    timer.current = setTimeout(() => {
      setChecking(false)
      setAsked('answered')
      setState((s) => ({ ...s, phase: s.phase === 'checking' ? 'idle' : s.phase, error: null, lastCheckedAt: Date.now() }))
    }, 1400)
  }

  return (
    <Panel title="Settings › Updates" eyebrow="UpdatesBlock: the section is left out in a browser, so this is the only place to see it there">
      <Row label="State">
        {SETTINGS_SCENES.map((item) => (
          <Button key={item.id} size="sm" variant={item.id === scene.id ? 'primary' : 'subtle'} aria-pressed={item.id === scene.id} data-kit-upd={`settings:${item.id}`} onClick={() => show(item)}>
            {item.label}
          </Button>
        ))}
      </Row>
      {/* `.settings` is the size container the section's narrow layout keys on. */}
      <div className="settings kit-upd-settings" data-kit-upd="settings-block">
        <UpdatesBlock
          state={state}
          checking={checking}
          asked={asked}
          now={Date.now()}
          onCheck={check}
          onAutoCheck={(autoCheck) => setState((s) => ({ ...s, autoCheck }))}
          onShowOffer={() => toast({ kind: 'info', title: 'Would open the changelog window' })}
        />
      </div>
    </Panel>
  )
}

export function UpdatesKit() {
  return (
    <Section id="updates" title="Updates" note="features/updates: every state, from made-up snapshots (fixtures/preview.ts)">
      <div className="kit-upd">
        <OfferPreviews />
        <WhatsNewPreviews />
        <IndicatorPreviews />
        <NoticePreviews />
        <SettingsPreviews />
      </div>
    </Section>
  )
}
