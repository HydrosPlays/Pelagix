import { useEffect, useRef, useState } from 'react'
import type { UpdateState } from '@shared/api'
import { RELEASES_URL } from '@shared/repo'
import { Button, Chip, Icon, ProgressBar, Spinner, Switch, cx, type IconName } from '@renderer/components/ui'
import { isLayerOpen } from '@renderer/components/ui/layers'
import { autoAction, checkOutcome, errorWording, offerButton, offerView, percentText, progressFraction, statusLine, type CheckOutcome, type StatusLine } from '@renderer/features/updates/model'
import { useUpdateStore } from '@renderer/features/updates/store'
import { rich, t, useT } from '@renderer/i18n'
import { toast, useUiStore } from '@renderer/store/ui'
import { ExternalLink, SettingsSection } from './parts'

const STATUS_ICON: Readonly<Record<Exclude<StatusLine['tone'], 'busy'>, IconName>> = { ok: 'check', news: 'download', warn: 'warning', quiet: 'info' }
const OUTCOME_ICON: Readonly<Record<CheckOutcome['tone'], IconName>> = { ok: 'check', news: 'info', error: 'warning' }

/** How a check asked for from this section ended: with an answer in the snapshot, or not at all. */
export type AskedCheck = 'answered' | 'failed' | null

export interface UpdatesBlockProps {
  state: UpdateState
  /** A check the user asked for is running. */
  checking: boolean
  asked: AskedCheck
  /** The current time, for "last checked 5 min ago". */
  now: number
  onCheck: () => void
  onAutoCheck: (enabled: boolean) => void
  /** Opens the changelog window of the offered version. */
  onShowOffer: () => void
}

/** The body of the Updates section, without the store: also what the kit previews. */
export function UpdatesBlock({ state, checking, asked, now, onCheck, onAutoCheck, onShowOffer }: UpdatesBlockProps) {
  const t = useT()
  const status = statusLine(state, now)
  const releases = <p className="settings-footnote">{rich('settings.updates.releases', { link: (c) => <ExternalLink href={RELEASES_URL}>{c}</ExternalLink> })}</p>

  const statusText = (
    <>
      <span className={cx('settings-update__icon', `settings-update__icon--${status.tone}`)} aria-hidden="true">
        {status.tone === 'busy' ? <Spinner size={18} /> : <Icon name={STATUS_ICON[status.tone]} size={20} strokeWidth={status.tone === 'ok' ? 2.4 : undefined} />}
      </span>
      <div className="settings-update__text">
        <span className="settings-update__title">{status.title}</span>
        <span className="settings-update__detail">{status.detail}</span>
      </div>
    </>
  )

  // Development, the screenshot tool, anything that is not the packaged Windows app: nothing to check.
  if (state.mode === 'off') {
    return (
      <>
        <div className="settings-update">{statusText}</div>
        {releases}
      </>
    )
  }

  const view = offerView(state)
  const open = offerButton(view)
  const busy = checking || state.phase === 'checking'
  // The main process does not check while a download runs or an installer is waiting or starting.
  const cannotCheck = view === 'downloading' || view === 'ready' || view === 'installing'
  // Read from the snapshot each time, so the line can never disagree with the status above it.
  const answer: CheckOutcome | null = busy || asked === null ? null : asked === 'failed' ? { tone: 'error', text: errorWording({ kind: 'unknown', during: 'check' }).text } : checkOutcome(state)
  // A new version, or a check that failed, is already what the status says: no point in showing
  // it twice. It is still said, though: the status above is not a live region, so without this
  // line a screen reader would hear nothing at all when a check fails.
  const repeats = asked === 'answered' && answer !== null && (answer.tone === 'news' || status.tone === 'warn')

  return (
    <>
      <div className={cx('settings-update', status.tone === 'news' && 'settings-update--news')}>
        {statusText}
        <div className="settings-update__actions">
          {state.offer !== null && (
            <Button variant="primary" icon={open.icon} onClick={onShowOffer}>
              {open.label}
            </Button>
          )}
          <Button icon="refresh" loading={busy} disabled={cannotCheck} onClick={onCheck}>
            {t('settings.updates.check')}
          </Button>
        </div>
        {view === 'downloading' && <ProgressBar className="settings-update__progress" value={progressFraction(state.progress)} label={t('settings.updates.downloading', { version: state.offer?.version ?? '' })} valueText={percentText(state.progress)} />}
        <div className={cx('settings-update__outcome', repeats && 'u-sr-only')} role="status" aria-live="polite">
          {answer !== null && (
            <span className={cx('settings-update__result', `settings-update__result--${answer.tone}`)}>
              <Icon name={OUTCOME_ICON[answer.tone]} size={15} />
              {answer.text}
            </span>
          )}
        </div>
      </div>

      <div className="settings-list">
        <Switch
          reverse
          className="settings-switch-row"
          checked={state.autoCheck}
          onChange={onAutoCheck}
          label={t('settings.updates.auto.label')}
          description={t('settings.updates.auto.description')}
        />
      </div>

      {state.mode === 'manual' && <p className="settings-text">{t('settings.updates.portable')}</p>}
      {releases}
    </>
  )
}

/** The current time, refreshed now and then, so "5 min ago" does not go stale while the page stays open. */
function useNow(everyMs: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs)
    return () => clearInterval(timer)
  }, [everyMs])
  return now
}

/** Settings › Updates. Only rendered in the desktop app (see `SECTIONS`). */
export function UpdatesSection() {
  const state = useUpdateStore((s) => s.state)
  const checking = useUpdateStore((s) => s.checking)
  const [asked, setAsked] = useState<AskedCheck>(null)
  const now = useNow(30_000)
  useT()
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const check = async (): Promise<void> => {
    setAsked(null)
    const store = useUpdateStore.getState()
    const answered = await store.check()
    if (!mounted.current) return
    setAsked(answered ? 'answered' : 'failed')
    if (!answered) return
    // The user asked, so a version they have not seen yet is shown at once instead of a moment
    // later. Unless they have moved on meanwhile and something is open (the command palette, a
    // dialog, a dropdown): the window would come up under it, or over it, with the keyboard on
    // its button. It then waits its turn like any window that opens by itself.
    const { state: found, surface, handled } = useUpdateStore.getState()
    const ui = useUiStore.getState()
    const inTheWay = { layerOpen: isLayerOpen(), editorOpen: ui.entryEditor.open, paletteOpen: ui.commandPalette, recentInput: false }
    if (autoAction(found, surface, inTheWay, handled) === 'offer') store.openOffer()
  }

  const setAutoCheck = async (enabled: boolean): Promise<void> => {
    const stored = await useUpdateStore.getState().setAutoCheck(enabled)
    if (stored) return
    // The main process switches first and writes second, so the switch on screen may well show
    // the new choice: what failed is keeping it.
    if (useUpdateStore.getState().state?.autoCheck === enabled) {
      toast({ kind: 'error', title: t('settings.updates.notSaved.title'), body: t('settings.updates.notSaved.body') })
    } else {
      toast({ kind: 'error', title: t('settings.updates.notChanged.title'), body: t('settings.updates.notChanged.body') })
    }
  }

  return (
    <SettingsSection
      id="updates"
      description={t('settings.updates.description')}
      aside={
        state ? (
          <Chip size="sm" tone="accent">
            {t('settings.updates.version', { version: state.currentVersion })}
          </Chip>
        ) : undefined
      }
    >
      {state ? (
        <UpdatesBlock state={state} checking={checking} asked={asked} now={now} onCheck={() => void check()} onAutoCheck={(enabled) => void setAutoCheck(enabled)} onShowOffer={useUpdateStore.getState().openOffer} />
      ) : (
        <p className="settings-text">{t('settings.updates.unavailable')}</p>
      )}
    </SettingsSection>
  )
}
