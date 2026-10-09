import { useEffect, useState, type ReactNode } from 'react'
import type { AppInfo } from '@shared/api'
import { Icon, Panel, cx, type IconName } from '@renderer/components/ui'
import { errorMessage } from '@renderer/lib/format'
import { useSaveStore } from '@renderer/store/save'
import { toast } from '@renderer/store/ui'

// ---------------------------------------------------------------- sections

export type SectionId = 'trainer' | 'rules' | 'appearance' | 'data' | 'sprites' | 'about'

export interface SectionDef {
  id: SectionId
  title: string
  icon: IconName
}

/** The page's sections, in order. The index and the sections themselves are both built from this. */
export const SECTIONS: readonly SectionDef[] = [
  { id: 'trainer', title: 'Trainer', icon: 'user' },
  { id: 'rules', title: 'Living Dex rules', icon: 'grid' },
  { id: 'appearance', title: 'Appearance', icon: 'sun' },
  { id: 'data', title: 'Your data', icon: 'database' },
  { id: 'sprites', title: 'Sprite cache', icon: 'image' },
  { id: 'about', title: 'About', icon: 'info' }
]

export const sectionDomId = (id: SectionId): string => `settings-${id}`

export interface SettingsSectionProps {
  id: SectionId
  /** One or two sentences under the title. */
  description?: ReactNode
  /** Sits at the right of the header (a status, a figure). */
  aside?: ReactNode
  children: ReactNode
}

/** One titled block of the page. Its heading takes focus when the index jumps to it. */
export function SettingsSection({ id, description, aside, children }: SettingsSectionProps) {
  const def = SECTIONS.find((s) => s.id === id)
  const domId = sectionDomId(id)
  return (
    <section id={domId} className="settings-section" aria-labelledby={`${domId}-title`}>
      <Panel padding="none">
        <header className="settings-section__header">
          <span className="settings-section__icon" aria-hidden="true">
            <Icon name={def?.icon ?? 'settings'} size={20} />
          </span>
          <div className="settings-section__heading">
            <h2 id={`${domId}-title`} className="settings-section__title" tabIndex={-1}>
              {def?.title ?? id}
            </h2>
            {description !== undefined && <p className="settings-section__desc">{description}</p>}
          </div>
          {aside !== undefined && <div className="settings-section__aside">{aside}</div>}
        </header>
        <div className="settings-section__body">{children}</div>
      </Panel>
    </section>
  )
}

/** A setting whose control is not a Switch: text on the left, the control on the right. */
export function SettingRow({ label, description, children, className }: { label: ReactNode; description?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cx('settings-row', className)}>
      <div className="settings-row__text">
        <span className="settings-row__label">{label}</span>
        {description !== undefined && <span className="settings-row__desc">{description}</span>}
      </div>
      <div className="settings-row__control">{children}</div>
    </div>
  )
}

/** A label and a value in a facts list. Render inside `<dl className="settings-facts">`. */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="settings-fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

// ---------------------------------------------------------------- saved state

export type SaveState = 'saved' | 'saving' | 'failing'

/** Whether the latest changes are on disk, on their way there, or stuck. */
export function useSaveState(): SaveState {
  const dirty = useSaveStore((s) => s.dirty)
  const failing = useSaveStore((s) => s.lastError !== null)
  return failing ? 'failing' : dirty ? 'saving' : 'saved'
}

const SAVE_STATE_TEXT: Readonly<Record<SaveState, string>> = { saved: 'Saved', saving: 'Saving…', failing: 'Not saved' }

/** The small "Saved" marker next to a field; it tells the truth while a write is pending or failing. */
export function SavedMark() {
  const state = useSaveState()
  return (
    <span className={cx('settings-saved', `settings-saved--${state}`)}>
      {state !== 'saving' && <Icon name={state === 'failing' ? 'warning' : 'check'} size={14} />}
      {SAVE_STATE_TEXT[state]}
    </span>
  )
}

// ---------------------------------------------------------------- links

/** A web link: the system browser inside the desktop app, a new tab in a browser. */
export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      className="settings-link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => {
        const api = window.api
        if (!api) return
        event.preventDefault()
        api.openExternal(href).catch((err: unknown) => {
          toast({ kind: 'error', title: 'That link could not be opened', body: errorMessage(err) })
        })
      }}
    >
      {children}
      <Icon name="external" size={13} label="(opens in your browser)" />
    </a>
  )
}

// ---------------------------------------------------------------- app info

export interface AppInfoState {
  /** Running inside the desktop app (the bridge to the main process is there). */
  desktop: boolean
  /** Version and data folder; null in a browser and until the desktop app has answered. */
  info: AppInfo | null
  error: string | null
}

/** Asks the desktop app who it is, once. In a browser there is nothing to ask. */
export function useAppInfo(): AppInfoState {
  const api = typeof window === 'undefined' ? undefined : window.api
  const [state, setState] = useState<Pick<AppInfoState, 'info' | 'error'>>({ info: null, error: null })

  useEffect(() => {
    if (!api) return
    let live = true
    api.appInfo().then(
      (info) => {
        if (live) setState({ info, error: null })
      },
      (err: unknown) => {
        if (live) setState({ info: null, error: errorMessage(err) })
      }
    )
    return () => {
      live = false
    }
  }, [api])

  return { desktop: api !== undefined, ...state }
}
