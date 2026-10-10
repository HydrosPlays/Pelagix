import { memo, useMemo } from 'react'
import type { ReleaseNote } from '@shared/api'
import { Icon } from '@renderer/components/ui'
import { openWebPage, WebLink } from './links'
import { parseNotes, releaseDate, releaseSubtitle, releaseUrl, type ParsedNote } from './model'
import { renderMarkdown } from './render'

/** The window title is an h2 and each release an h3, so "#" in a description starts at h4. */
const HEADING_OFFSET = 3

function Release({ parsed }: { parsed: ParsedNote }) {
  const { note, doc, skipped } = parsed
  const subtitle = releaseSubtitle(note)
  const date = releaseDate(note)
  const url = releaseUrl(note.url)
  // In the desktop app a link never navigates the window: it is handed to the system browser.
  const onOpenLink = window.api ? openWebPage : undefined
  return (
    <article className="upd-release">
      <header className="upd-release__head">
        <h3 className="upd-release__version">Version {note.version}</h3>
        {subtitle !== '' && <span className="upd-release__name">{subtitle}</span>}
        {date !== '' && <span className="upd-release__date">{date}</span>}
      </header>
      {skipped ? (
        <p className="upd-release__more">
          These notes are left out to keep this window quick. <WebLink href={url}>Read them on GitHub</WebLink>
        </p>
      ) : doc.blocks.length === 0 ? (
        <p className="upd-release__more">This release has no description.</p>
      ) : (
        renderMarkdown(doc, { onOpenLink, headingOffset: HEADING_OFFSET })
      )}
      {doc.truncated && !skipped && (
        <p className="upd-release__more">
          These notes are longer than this window shows. <WebLink href={url}>Read the rest on GitHub</WebLink>
        </p>
      )}
    </article>
  )
}

/**
 * The descriptions of a list of releases, newest first, each under its version and date. The text
 * is untrusted Markdown: it only ever becomes the fixed set of elements in `render.ts`.
 */
export const ReleaseNotes = memo(function ReleaseNotes({ notes }: { notes: readonly ReleaseNote[] }) {
  const parsed = useMemo(() => parseNotes(notes), [notes])
  return (
    <div className="upd-notes">
      {parsed.map((item, index) => (
        <Release key={`${item.note.version}:${index}`} parsed={item} />
      ))}
    </div>
  )
})

/** Shown in place of the notes when none could be loaded. */
export function NoNotes({ url }: { url: string }) {
  return (
    <div className="upd-nonotes">
      <span className="upd-nonotes__icon" aria-hidden="true">
        <Icon name="note" size={20} />
      </span>
      <p>
        The notes for this version could not be loaded. <WebLink href={url}>Read what changed on GitHub</WebLink>
      </p>
    </div>
  )
}
