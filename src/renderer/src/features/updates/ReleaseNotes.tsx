import { memo, useMemo, type CSSProperties, type ReactNode } from 'react'
import type { ReleaseNote } from '@shared/api'
import { Icon } from '@renderer/components/ui'
import { rich, useT, type MessageKey } from '@renderer/i18n'
import { openWebPage, WebLink } from './links'
import { parseNotes, releaseDate, releaseSubtitle, releaseUrl, type ParsedNote } from './model'
import { renderMarkdown } from './render'

/** The window title is an h2 and each release an h3, so "#" in a description starts at h4. */
const HEADING_OFFSET = 3

/** A text as a CSS string, for a custom property that `content:` reads. */
const cssString = (text: string): string => `"${text.replace(/["\\]/g, '\\$&').replace(/[\n\r]/g, ' ')}"`

/** The labels of highlighted blocks ("Note", "Warning"): CSS draws them, so the words are handed to it. See updates.css. */
const ALERT_LABELS: ReadonlyArray<readonly [string, MessageKey]> = [
  ['--upd-alert-note', 'updates.notes.alert.note'],
  ['--upd-alert-tip', 'updates.notes.alert.tip'],
  ['--upd-alert-important', 'updates.notes.alert.important'],
  ['--upd-alert-warning', 'updates.notes.alert.warning'],
  ['--upd-alert-caution', 'updates.notes.alert.caution']
]

function Release({ parsed }: { parsed: ParsedNote }) {
  const t = useT()
  const { note, doc, skipped } = parsed
  const subtitle = releaseSubtitle(note)
  const date = releaseDate(note)
  const url = releaseUrl(note.url)
  // In the desktop app a link never navigates the window: it is handed to the system browser.
  const onOpenLink = window.api ? openWebPage : undefined
  const link = { link: (c: ReactNode) => <WebLink href={url}>{c}</WebLink> }
  return (
    <article className="upd-release">
      <header className="upd-release__head">
        <h3 className="upd-release__version">{t('updates.notes.version', { version: note.version })}</h3>
        {subtitle !== '' && <span className="upd-release__name">{subtitle}</span>}
        {date !== '' && <span className="upd-release__date">{date}</span>}
      </header>
      {skipped ? (
        <p className="upd-release__more">{rich('updates.notes.skipped', link)}</p>
      ) : doc.blocks.length === 0 ? (
        <p className="upd-release__more">{t('updates.notes.empty')}</p>
      ) : (
        renderMarkdown(doc, { onOpenLink, headingOffset: HEADING_OFFSET })
      )}
      {doc.truncated && !skipped && <p className="upd-release__more">{rich('updates.notes.truncated', link)}</p>}
    </article>
  )
}

/**
 * The descriptions of a list of releases, newest first, each under its version and date. The text
 * is untrusted Markdown: it only ever becomes the fixed set of elements in `render.ts`.
 */
export const ReleaseNotes = memo(function ReleaseNotes({ notes }: { notes: readonly ReleaseNote[] }) {
  const parsed = useMemo(() => parseNotes(notes), [notes])
  const t = useT()
  const labels = Object.fromEntries(ALERT_LABELS.map(([property, key]) => [property, cssString(t(key))])) as CSSProperties
  return (
    <div className="upd-notes" style={labels}>
      {parsed.map((item, index) => (
        <Release key={`${item.note.version}:${index}`} parsed={item} />
      ))}
    </div>
  )
})

/** Shown in place of the notes when none could be loaded. */
export function NoNotes({ url }: { url: string }) {
  useT()
  return (
    <div className="upd-nonotes">
      <span className="upd-nonotes__icon" aria-hidden="true">
        <Icon name="note" size={20} />
      </span>
      <p>{rich('updates.notes.missing', { link: (c) => <WebLink href={url}>{c}</WebLink> })}</p>
    </div>
  )
}
