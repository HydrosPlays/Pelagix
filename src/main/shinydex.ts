/**
 * Reads what "Import from ShinyDex" accepts: a ShinyDex export (JSON, the main input) or a History
 * page of shinydex.com that the user saved from the browser. Which of the two a file is, is decided
 * from its content, not from its name.
 *
 * The file is untrusted text. Nothing of it is run or rendered: an export is parsed as JSON and only
 * its `entries` are looked at (settings, achievements and whatever else it holds are never read), a
 * page is scanned for history rows, and every value is checked and cut to a limit. No DOM is involved.
 *
 * An entry of an export (details are optional and often null):
 *
 *   { "species": 173, "form": 0, "shiny": true, "game": "za", "kind": "wild",
 *     "method": "Random Encounters", "date": "2026-01-08", "location": null, "ball": null,
 *     "level": null, "ot": null, "nickname": null, "origin": null }
 *
 * What a row looks like (styling attributes left out):
 *
 *   <button>
 *     <div><img src=".../nestBall.png"> <img src=".../cleffa.png"></div>
 *     <div><div><span>Cleffa</span> <img src=".../za.png"></div>
 *          <div>Hyperspace encounter <span>·</span>13 Apr 2026</div></div>
 *     <div>... <div>2</div></div>          (the phase number, on some rows; not read)
 *   </button>
 *
 * Only this is relied on: a row is a `<button>`, its first text is the name, a "·" on its own
 * stands between method and date, the pictures before the name are ball and Pokémon, and the first
 * picture after it is the game. Class names are not looked at.
 */

import { promises as fs } from 'node:fs'
import { basename } from 'node:path'
import type { ShinyDexHistory, ShinyDexKnown, ShinyDexResult, ShinyDexRow } from '@shared/shinydex-types'

export const MAX_HISTORY_BYTES = 16 * 1024 * 1024
export const MAX_HISTORY_ROWS = 20_000
/** A real row is about 5 KB, nearly all of it one inline drawing. */
const MAX_ROW_CHARS = 64 * 1024
const MAX_NAME = 64
const MAX_METHOD = 120
const MAX_SLUG = 64
const MAX_FILE_NAME = 255
const MAX_TEXT = 200
const MAX_NUMBER = 99_999

const NAMED: Readonly<Record<string, string>> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·' }

function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,8});/gi, (whole, code: string) => {
    if (code[0] !== '#') return NAMED[code.toLowerCase()] ?? whole
    const point = code[1] === 'x' || code[1] === 'X' ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10)
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : whole
  })
}

const tidy = (text: string): string => decode(text).replace(/\s+/g, ' ').trim()

/**
 * The file name behind a picture's address, without folder, extension, bundler hash or the "(1)" a
 * browser adds to a second file of the same name: "./x_files/tepig(1).png" -> "tepig",
 * "/_app/immutable/assets/missingo-blu.CUeHdv21.png" -> "missingo-blu". Empty when it is not a plain name.
 */
function slugOf(src: string): string {
  let name = decode(src).split(/[?#]/)[0]!
  name = name.slice(Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\')) + 1)
  try {
    name = decodeURIComponent(name)
  } catch {
    // Not percent-encoded after all: taken as it is.
  }
  name = name.split('.')[0]!.replace(/\s*\(\d+\)$/, '').trim()
  return name.length <= MAX_SLUG && /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(name) ? name : ''
}

/** First three letters of a month in English, German or French, without accents, to its number. */
const MONTHS: Readonly<Record<string, number>> = {
  jan: 1, feb: 2, fev: 2, mar: 3, mrz: 3, apr: 4, avr: 4, may: 5, mai: 5, jun: 6, jul: 7,
  aug: 8, aou: 8, sep: 9, oct: 10, okt: 10, nov: 11, dec: 12, dez: 12
}

function monthOf(word: string): number | undefined {
  const plain = word.normalize('NFKD').replace(/[^a-zA-Z]/g, '').toLowerCase()
  // French "juin" and "juillet" share their first three letters.
  if (plain.startsWith('jui')) return plain.startsWith('juin') ? 6 : 7
  const key = plain.slice(0, 3)
  return Object.hasOwn(MONTHS, key) ? MONTHS[key] : undefined
}

/** "13 Apr 2026", "19 Sept 2026", "Apr 13, 2026" or "2026-04-13" as yyyy-mm-dd; null for anything else. */
export function parseHistoryDate(text: string): string | null {
  const t = text.trim()
  let y: number, m: number | undefined, d: number
  let hit = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t)
  if (hit) [y, m, d] = [Number(hit[1]), Number(hit[2]), Number(hit[3])]
  else if ((hit = /^(\d{1,2})\.?\s+([^\s\d,]+),?\s+(\d{4})$/.exec(t))) [y, m, d] = [Number(hit[3]), monthOf(hit[2]!), Number(hit[1])]
  else if ((hit = /^([^\s\d,]+)\s+(\d{1,2}),?\s+(\d{4})$/.exec(t))) [y, m, d] = [Number(hit[3]), monthOf(hit[1]!), Number(hit[2])]
  else return null
  if (m === undefined || m < 1 || m > 12 || y < 1990 || y > 2999 || d < 1) return null
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null
  return date.toISOString().slice(0, 10)
}

type Token = { img: string } | { text: string }
const SEPARATORS: ReadonlySet<string> = new Set(['·', '•', '∙'])

/** One `<button>…</button>` as a history row, or null when it is not one. */
function rowOf(chunk: string, index: number): ShinyDexRow | null {
  const plain = chunk.replace(/<(svg|script|style)\b[\s\S]*?<\/\1\s*>/gi, ' ')
  const tokens: Token[] = []
  for (const part of plain.matchAll(/<img\b[^>]*?\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>|<[^>]*>|([^<]+)/gi)) {
    const src = part[1] ?? part[2]
    if (src !== undefined) tokens.push({ img: slugOf(src) })
    else if (part[3] !== undefined) {
      const text = tidy(part[3])
      if (text !== '') tokens.push({ text })
    }
  }

  const nameAt = tokens.findIndex((t) => 'text' in t)
  const dotAt = tokens.findIndex((t) => 'text' in t && SEPARATORS.has(t.text))
  if (nameAt < 0 || dotAt <= nameAt) return null
  const text = (t: Token | undefined): string => (t !== undefined && 'text' in t ? t.text : '')
  const name = text(tokens[nameAt])
  const method = text(tokens[dotAt - 1])
  // The name must not double as the method: a row has both.
  if (dotAt - 1 === nameAt || method === '' || name.length > MAX_NAME || method.length > MAX_METHOD) return null

  const before = tokens.slice(0, nameAt).flatMap((t) => ('img' in t ? [t.img] : []))
  const after = tokens.slice(nameAt + 1, dotAt).flatMap((t) => ('img' in t ? [t.img] : []))
  const game = after[0] ?? ''
  if (game === '') return null
  const pokemon = (before.at(-1) ?? '').toLowerCase()
  return {
    index,
    name,
    // ShinyDex shows a placeholder until the real picture has loaded.
    pokemon: pokemon.startsWith('missingo') ? '' : pokemon,
    game: game.toLowerCase(),
    method,
    date: parseHistoryDate(text(tokens[dotAt + 1])),
    ball: before.length >= 2 ? before.at(-2)! : ''
  }
}

/**
 * Every history row of a saved page, in page order. Whatever is not a row is ignored; rows past
 * `MAX_HISTORY_ROWS` are counted in `dropped`. Never throws: text that is no ShinyDex page has no rows.
 */
export function parseShinyDexHistory(html: unknown): { rows: ShinyDexRow[]; dropped: number } {
  const rows: ShinyDexRow[] = []
  let dropped = 0
  if (typeof html !== 'string') return { rows, dropped }
  try {
    const open = /<button\b/gi
    const close = /<\/button\b/gi
    while (open.exec(html) !== null) {
      close.lastIndex = open.lastIndex
      const end = close.exec(html)?.index ?? -1
      if (end < 0) break
      // After the opening tag's own ">", so that its attributes are not taken for text.
      const start = html.indexOf('>', open.lastIndex) + 1
      open.lastIndex = end
      if (start === 0 || start > end || end - start > MAX_ROW_CHARS) continue
      const row = rowOf(html.slice(start, end), rows.length)
      if (row === null) continue
      if (rows.length < MAX_HISTORY_ROWS) rows.push(row)
      else dropped++
    }
  } catch {
    // Whatever was found until then stands.
  }
  return { rows, dropped }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const whole = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max
/** A text cut to `max`; undefined for anything that is not a text or is empty. */
const textOf = (v: unknown, max: number): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : undefined)

/**
 * One entry of an export as a row, or null when it cannot be used: it is no object, its species is
 * not a whole number from 1, its form is given but is not a whole number from 0, or its game is not
 * a short text. Everything else is optional: a date that is not a real ISO day is null (the preview
 * then says so), and any other value of the wrong type or out of range is left out.
 */
function rowOfEntry(raw: unknown, index: number): ShinyDexRow | null {
  if (!isRecord(raw)) return null
  const species = raw['species']
  const form = raw['form'] === undefined || raw['form'] === null ? 0 : raw['form']
  const game = typeof raw['game'] === 'string' ? raw['game'].trim().toLowerCase() : ''
  if (!whole(species, 1, MAX_NUMBER) || !whole(form, 0, MAX_NUMBER) || game === '' || game.length > MAX_SLUG) return null

  const known: ShinyDexKnown = { species, form, shiny: raw['shiny'] !== false, kind: textOf(raw['kind'], MAX_SLUG) ?? '' }
  const location = textOf(raw['location'], MAX_TEXT)
  const ot = textOf(raw['ot'], MAX_TEXT)
  const nickname = textOf(raw['nickname'], MAX_TEXT)
  const origin: unknown = raw['origin']
  if (location !== undefined) known.location = location
  if (whole(raw['ball'], 0, MAX_NUMBER)) known.ball = raw['ball']
  if (whole(raw['level'], 1, 100)) known.level = raw['level']
  if (ot !== undefined) known.ot = ot
  if (nickname !== undefined) known.nickname = nickname
  if (Array.isArray(origin) && origin.length === 2 && whole(origin[0], 1, MAX_NUMBER) && whole(origin[1], 0, MAX_NUMBER)) known.origin = [origin[0], origin[1]]
  const date = raw['date']
  return { index, name: '', pokemon: '', game, method: textOf(raw['method'], MAX_METHOD) ?? '', date: typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim()) ? parseHistoryDate(date) : null, ball: '', known }
}

/**
 * The entries of a parsed export, in file order, or null when it is not one (no `entries` list).
 * Only `entries` is read. Entries that cannot be used are counted in `unusable`, those past
 * `MAX_HISTORY_ROWS` in `dropped`. Never throws.
 */
export function parseShinyDexExport(data: unknown): { rows: ShinyDexRow[]; dropped: number; unusable: number } | null {
  try {
    if (!isRecord(data) || !Array.isArray(data['entries'])) return null
    const entries: readonly unknown[] = data['entries']
    const rows: ShinyDexRow[] = []
    let unusable = 0
    const count = Math.min(entries.length, MAX_HISTORY_ROWS)
    for (let i = 0; i < count; i++) {
      let row: ShinyDexRow | null = null
      try {
        row = rowOfEntry(entries[i], rows.length)
      } catch {
        // A value that throws when looked at: the entry is unusable.
      }
      if (row === null) unusable++
      else rows.push(row)
    }
    return { rows, dropped: entries.length - count, unusable }
  } catch {
    return null
  }
}

/**
 * The text of a picked file as a history: an export when it is JSON, otherwise a saved page.
 * Null when it is neither. Never throws.
 */
export function parseShinyDexFile(text: unknown): Pick<ShinyDexHistory, 'source' | 'rows' | 'dropped' | 'unusable'> | null {
  if (typeof text !== 'string') return null
  const start = text.replace(/^\uFEFF/, '').trimStart()
  if (start.startsWith('{') || start.startsWith('[')) {
    let data: unknown
    let json = true
    try {
      data = JSON.parse(start)
    } catch {
      json = false
    }
    if (json) {
      const read = parseShinyDexExport(data)
      return read === null ? null : { source: 'export', ...read }
    }
  }
  const { rows, dropped } = parseShinyDexHistory(text)
  return rows.length === 0 ? null : { source: 'page', rows, dropped, unusable: 0 }
}

/** Reads and parses the picked file. Never rejects: what went wrong is the result's `reason`. */
export async function readShinyDexHistory(path: string): Promise<ShinyDexResult> {
  let html: string
  try {
    const stat = await fs.stat(path)
    if (!stat.isFile()) return { ok: false, reason: 'unreadable' }
    if (stat.size > MAX_HISTORY_BYTES) return { ok: false, reason: 'too-large' }
    html = (await fs.readFile(path)).toString('utf8')
  } catch {
    return { ok: false, reason: 'unreadable' }
  }
  const read = parseShinyDexFile(html)
  if (read === null) return { ok: false, reason: 'not-shinydex' }
  const history: ShinyDexHistory = { fileName: basename(path).slice(0, MAX_FILE_NAME), ...read }
  return { ok: true, history }
}
