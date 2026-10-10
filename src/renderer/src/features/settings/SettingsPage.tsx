import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Icon, Spinner, cx, useScrollParent } from '@renderer/components/ui'
import { motionOK } from '@renderer/lib/anim'
import { isElectron } from '@renderer/lib/env'
import { errorMessage, formatDateTime } from '@renderer/lib/format'
import { exportSaveToFile } from '@renderer/lib/storage'
import { useSaveStore } from '@renderer/store/save'
import { toast } from '@renderer/store/ui'
import { AboutSection } from './AboutSection'
import { AppearanceSection, SpriteCacheSection, TrainerSection } from './BasicSections'
import { DataSection } from './DataSection'
import { SECTIONS, sectionDomId, useAppInfo, useSaveState, type SectionId } from './parts'
import { RulesSection } from './RulesSection'
import { UpdatesSection } from './UpdatesSection'
import './SettingsPage.css'

/** A section counts as "current" once its top has passed this far below the top of the scrolling region. */
const SPY_OFFSET = 140

/** The section the user is reading, from the scroll position of the main region. */
function useCurrentSection(): SectionId {
  const scrollParent = useScrollParent()
  const [current, setCurrent] = useState<SectionId>(SECTIONS[0]!.id)

  useEffect(() => {
    if (!scrollParent) return
    let frame = 0
    const measure = (): void => {
      frame = 0
      const top = scrollParent.getBoundingClientRect().top
      let next: SectionId = SECTIONS[0]!.id
      for (const section of SECTIONS) {
        const element = document.getElementById(sectionDomId(section.id))
        if (element && element.getBoundingClientRect().top - top <= SPY_OFFSET) next = section.id
      }
      // At the very bottom the last section is current even when it is too short to reach the line.
      if (scrollParent.scrollTop > 0 && scrollParent.scrollTop + scrollParent.clientHeight >= scrollParent.scrollHeight - 2) next = SECTIONS[SECTIONS.length - 1]!.id
      setCurrent(next)
    }
    const schedule = (): void => {
      if (frame === 0) frame = requestAnimationFrame(measure)
    }
    measure()
    scrollParent.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      if (frame !== 0) cancelAnimationFrame(frame)
      scrollParent.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [scrollParent])

  return current
}

/** Tells the user, at all times, whether what they changed is on disk. */
function SaveStatus() {
  const state = useSaveState()
  const updatedAt = useSaveStore((s) => s.save.updatedAt)
  return (
    <div className={cx('settings-status', `settings-status--${state}`)} role="status" aria-live="polite">
      <span className="settings-status__icon" aria-hidden="true">
        {state === 'saving' ? <Spinner size={14} /> : <Icon name={state === 'failing' ? 'warning' : 'check'} size={14} strokeWidth={2.4} />}
      </span>
      <span className="settings-status__text">
        <span className="settings-status__title">{state === 'failing' ? 'Not saved' : state === 'saving' ? 'Saving…' : 'All changes saved'}</span>
        <span className="settings-status__note">{state === 'failing' ? 'Pelagix keeps trying.' : `Settings save automatically. Last change ${formatDateTime(updatedAt)}.`}</span>
      </span>
    </div>
  )
}

/** Shown while writes are failing: what went wrong, a retry, and a way to get the data out. */
function SaveAlert() {
  const lastError = useSaveStore((s) => s.lastError)
  const [retrying, setRetrying] = useState(false)
  if (lastError === null) return null

  const retry = async (): Promise<void> => {
    setRetrying(true)
    const saved = await useSaveStore.getState().flush()
    setRetrying(false)
    if (saved) toast({ kind: 'success', title: 'Saved', body: 'Your changes are stored again.' })
    else toast({ kind: 'error', title: 'Still not saved', body: useSaveStore.getState().lastError ?? undefined })
  }

  const exportCopy = async (): Promise<void> => {
    try {
      const result = await exportSaveToFile(useSaveStore.getState().save)
      if (!result.canceled) toast({ kind: 'success', title: window.api ? 'Save exported' : 'Save downloaded', body: result.path, icon: 'download' })
    } catch (err) {
      toast({ kind: 'error', title: 'The save could not be exported', body: errorMessage(err) })
    }
  }

  return (
    <div className="settings-alert" role="alert">
      <span className="settings-alert__icon" aria-hidden="true">
        <Icon name="warning" size={22} />
      </span>
      <div className="settings-alert__text">
        <h2 className="settings-alert__title">Your changes are not being saved</h2>
        <p className="u-selectable">{lastError}</p>
        <p>Everything is still here while Pelagix stays open. Export a copy to be safe.</p>
      </div>
      <div className="settings-alert__actions">
        <Button variant="primary" icon="refresh" loading={retrying} onClick={() => void retry()}>
          Try again
        </Button>
        <Button icon="download" onClick={() => void exportCopy()}>
          Export a copy
        </Button>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const app = useAppInfo()
  const current = useCurrentSection()
  // Bumped when the whole save is swapped, so the rules section forgets its "before".
  const [epoch, setEpoch] = useState(0)
  const onReplaced = useCallback(() => setEpoch((n) => n + 1), [])

  // When the index is a horizontal strip, keep the current section's link inside it.
  const indexRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const strip = indexRef.current
    const link = strip?.querySelector<HTMLElement>('[aria-current="true"]')
    if (!strip || !link || strip.scrollWidth <= strip.clientWidth) return
    const target = link.offsetLeft - (strip.clientWidth - link.offsetWidth) / 2
    strip.scrollTo({ left: Math.max(0, target), behavior: motionOK() ? 'smooth' : 'auto' })
  }, [current])

  const jump = (id: SectionId): void => {
    const section = document.getElementById(sectionDomId(id))
    if (!section) return
    // Focus first (without its own scroll), so nothing interrupts the glide to the section.
    document.getElementById(`${sectionDomId(id)}-title`)?.focus({ preventScroll: true })
    section.scrollIntoView({ behavior: motionOK() ? 'smooth' : 'auto', block: 'start' })
  }

  return (
    <div className="page settings">
      <header className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Everything here is saved the moment you change it.</p>
        </div>
      </header>

      <SaveAlert />

      <div className="settings-layout">
        <aside className="settings-side">
          <nav ref={indexRef} className="settings-index" aria-label="Settings sections">
            <ul>
              {SECTIONS.map((section) => (
                <li key={section.id}>
                  <button type="button" className={cx('settings-index__link', current === section.id && 'is-current')} aria-current={current === section.id ? 'true' : undefined} onClick={() => jump(section.id)}>
                    <Icon name={section.icon} size={17} />
                    <span>{section.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <SaveStatus />
        </aside>

        <div className="settings-sections">
          <TrainerSection />
          <RulesSection key={epoch} />
          <AppearanceSection />
          <DataSection app={app} onReplaced={onReplaced} />
          <SpriteCacheSection />
          {isElectron && <UpdatesSection />}
          <AboutSection app={app} />
        </div>
      </div>
    </div>
  )
}
