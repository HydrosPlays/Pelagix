/**
 * Made-up update states and release notes for the kit previews and the tests. Development only:
 * nothing the app ships imports this file.
 */

import type { ReleaseNote, UpdateError, UpdateMode, UpdatePhase, UpdateProgress, UpdateState, WhatsNew } from '@shared/api'
import { RELEASES_URL } from '@shared/repo'
import hostileBody from './hostile.body.md?raw'
import sampleBody from './sample.body.md?raw'
import v010Body from './v0.1.0.body.md?raw'

const releasePage = (version: string): string => `${RELEASES_URL}/tag/v${version}`

function note(version: string, publishedAt: string | null, name: string, body: string): ReleaseNote {
  return { version, name, publishedAt, url: releasePage(version), body }
}

/** The description of the real v0.1.0 release, exactly as published. */
export const REAL_NOTE: ReleaseNote = note('0.1.0', '2026-10-09T18:34:04Z', 'Pelagix 0.1.0 | First Release', v010Body)

/** A made-up release that uses every kind of formatting the notes can show. */
export const SAMPLE_NOTE: ReleaseNote = note('0.3.0', '2026-11-20T17:05:00Z', 'Pelagix 0.3.0 | Updates from inside the app', sampleBody)

const PATCH_NOTE: ReleaseNote = note('0.2.1', '2026-10-28T09:12:00Z', 'v0.2.1', 'A small fix release.\n\n- The window no longer forgets its size on a second monitor.\n- `Ctrl+K` works again while a tooltip is showing.')

/** Things only an attacker would write, each a few thousand times over. */
const HOSTILE_EXTRAS = [
  `Bidirectional override: ‮gpj.exe.tnemucod‬ and a zero byte: \u0000.`,
  `An unbroken word: ${'W'.repeat(600)}`,
  `A long address: https://example.com/${'path-segment/'.repeat(60)}end`,
  Array.from({ length: 60 }, (_, depth) => `${'  '.repeat(depth)}- level ${depth + 1}`).join('\n'),
  `${'> '.repeat(60)}sixty quote markers`,
  `${'*'.repeat(3000)}emphasis that never closes`,
  `${'['.repeat(1500)}brackets${'](javascript:alert(1))'.repeat(1500)}`,
  `| ${Array.from({ length: 48 }, (_, i) => `column ${i + 1}`).join(' | ')} |\n|${' --- |'.repeat(48)}\n| ${Array.from({ length: 48 }, (_, i) => `<b>${i}</b>`).join(' | ')} |`,
  `${'`'.repeat(900)} backticks`,
  `<script>${'alert(1);'.repeat(400)}</script>`
].join('\n\n')

/** Script tags, javascript: links, raw HTML, attribute injection and huge nesting, in one description. */
export const HOSTILE_NOTE: ReleaseNote = note('0.3.0', '2026-11-20T17:05:00Z', '<img src=x onerror=alert(1)> ‮evil', `${hostileBody}\n\n${HOSTILE_EXTRAS}`)

const LONG_PARAGRAPH =
  'This release reworks how the Living Dex is drawn, so that scrolling through all 1,627 slots of the Completionist preset stays smooth on slower machines. Boxes that are not on screen are skipped, renders are decoded ahead of time, and the hover card no longer re-reads the whole save each time it opens.'

/** Fourteen releases in a row, to check scrolling and the budget for very long notes. */
const LONG_NOTES: readonly ReleaseNote[] = Array.from({ length: 14 }, (_, i) => {
  const minor = 16 - i
  const body = [`## Release ${i + 1} of 14`, LONG_PARAGRAPH, ...Array.from({ length: 6 }, (__, k) => `- Change ${k + 1}: ${LONG_PARAGRAPH.slice(0, 96 + k * 22)}`), i === 0 ? `${LONG_PARAGRAPH} `.repeat(80) : LONG_PARAGRAPH].join('\n\n')
  return note(`0.${minor}.0`, `2027-${String(12 - Math.floor(i / 2)).padStart(2, '0')}-0${(i % 9) + 1}T10:00:00Z`, i % 3 === 0 ? `Pelagix 0.${minor}.0` : `0.${minor}.0: Smoother boxes`, body)
})

export type NotesFixture = 'two' | 'real' | 'long' | 'hostile' | 'empty'

export const NOTES_FIXTURES: Readonly<Record<NotesFixture, readonly ReleaseNote[]>> = {
  two: [SAMPLE_NOTE, PATCH_NOTE],
  real: [REAL_NOTE],
  long: LONG_NOTES,
  hostile: [HOSTILE_NOTE],
  empty: []
}

/** The running and the offered version each set of notes is shown with. */
const VERSIONS: Readonly<Record<NotesFixture, { current: string; target: string }>> = {
  two: { current: '0.2.0', target: '0.3.0' },
  real: { current: '0.0.9', target: '0.1.0' },
  long: { current: '0.2.0', target: '0.16.0' },
  hostile: { current: '0.2.0', target: '0.3.0' },
  empty: { current: '0.2.0', target: '0.3.0' }
}

export interface FixtureOptions {
  mode?: UpdateMode
  phase?: UpdatePhase
  /** Notes of the offer; null for no offer at all. Default "two". */
  notes?: NotesFixture | null
  announced?: boolean
  /** Download progress, 0 to 100. Only used while downloading. Default 42. */
  percent?: number
  error?: Pick<UpdateError, 'kind' | 'during'> | null
  autoCheck?: boolean
  /** Milliseconds before `now` of the last check; null for never. Default five minutes. */
  checkedAgoMs?: number | null
  whatsNew?: WhatsNew | null
  now?: number
}

const INSTALLER_BYTES = 114_380_829

export function fixtureProgress(percent: number): UpdateProgress {
  return { percent, transferred: Math.round((INSTALLER_BYTES * percent) / 100), total: INSTALLER_BYTES, bytesPerSecond: 2_202_009 }
}

/** An `UpdateState` as the main process would send it, for one situation. */
export function fixtureState(options: FixtureOptions = {}): UpdateState {
  const { mode = 'auto', phase = 'available', announced = true, percent = 42, error = null, autoCheck = true, whatsNew = null } = options
  const notes = options.notes === undefined ? 'two' : options.notes
  const now = options.now ?? Date.now()
  const checkedAgoMs = options.checkedAgoMs === undefined ? 5 * 60_000 : options.checkedAgoMs
  const versions = VERSIONS[notes ?? 'two']
  return {
    mode,
    currentVersion: versions.current,
    autoCheck,
    phase,
    lastCheckedAt: checkedAgoMs === null ? null : now - checkedAgoMs,
    offer: notes === null ? null : { version: versions.target, url: releasePage(versions.target), notes: [...NOTES_FIXTURES[notes]], announced },
    progress: phase === 'downloading' ? fixtureProgress(percent) : null,
    error: error === null ? null : { ...error, at: now },
    whatsNew
  }
}

/** The record shown once after an update: the notes of what was installed. */
export function fixtureWhatsNew(which: NotesFixture = 'two', from: string | null = VERSIONS[which].current): WhatsNew {
  const { target } = VERSIONS[which]
  return { version: target, from, url: releasePage(target), notes: [...NOTES_FIXTURES[which]] }
}
