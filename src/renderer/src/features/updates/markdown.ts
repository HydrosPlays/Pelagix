/**
 * Release-notes Markdown: a small GitHub-flavoured subset parsed into a plain AST.
 *
 * - No dependencies and no HTML output: the AST holds text, never markup. Raw HTML in the source
 *   stays literal text (comments are dropped, `<br>` is a line break).
 * - Every `href` in the AST has passed `safeHref` (absolute https only).
 * - Work is bounded: input length, node count, block and inline nesting, table size and the
 *   look-ahead of every scanner are capped, and no regular expression runs over unbounded input
 *   with a pattern that can backtrack.
 */

export type Align = 'left' | 'center' | 'right' | null
export type AlertKind = 'note' | 'tip' | 'important' | 'warning' | 'caution'

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'code'; v: string }
  | { t: 'strong'; c: Inline[] }
  | { t: 'em'; c: Inline[] }
  | { t: 'del'; c: Inline[] }
  | { t: 'link'; href: string; c: Inline[] }
  | { t: 'image'; href: string; alt: string }
  | { t: 'br' }

export interface ListItem {
  /** null for a plain item, otherwise the state of a task-list checkbox. */
  checked: boolean | null
  c: Block[]
}

export type Block =
  | { t: 'heading'; level: number; c: Inline[] }
  | { t: 'paragraph'; c: Inline[] }
  | { t: 'list'; ordered: boolean; start: number; tight: boolean; items: ListItem[] }
  | { t: 'code'; lang: string; v: string }
  | { t: 'quote'; kind: AlertKind | null; c: Block[] }
  | { t: 'rule' }
  | { t: 'table'; align: Align[]; head: Inline[][]; rows: Inline[][][] }

export interface MdDoc {
  blocks: Block[]
  /** True when a limit cut the document short; the UI should offer the full notes on the web. */
  truncated: boolean
}

export interface MdOptions {
  /** Input beyond this many UTF-16 units is dropped. Default 100 000. */
  maxLength?: number
  /** Blocks plus inline nodes. Default 10 000. */
  maxNodes?: number
  /** Lists and quotes nested deeper than this become plain paragraphs. Default 6. */
  maxBlockDepth?: number
  /** Emphasis nested deeper than this loses its formatting. Default 12. */
  maxInlineDepth?: number
  /** A newline inside a paragraph is a line break, as GitHub renders release notes. Default true. */
  breaks?: boolean
  /** "owner/name": bare links to this repository's pulls, issues, commits and compares are shortened. */
  repo?: string
}

export const MAX_URL_LENGTH = 2048
const MAX_TABLE_COLUMNS = 32
const MAX_TABLE_ROWS = 500
const MAX_LABEL = 200
const MAX_REFS = 500
const MAX_LINK_PARENS = 32
const MAX_TITLE = 1000
const DELIM_SCAN = 16
const ASCII_PUNCT = '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~'

// ---------------------------------------------------------------- URLs

/**
 * The only gate a URL passes on its way into the AST. Returns the normalised URL, or null.
 * Accepts absolute `https://` URLs without credentials; everything else (http, mailto,
 * javascript, data, file, relative paths, protocol-relative, anything with whitespace or
 * control characters) is refused.
 */
export function safeHref(raw: string): string | null {
  if (typeof raw !== 'string' || raw.length < 9 || raw.length > MAX_URL_LENGTH) return null
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i)
    // The URL parser silently strips tabs and newlines; refuse them instead, with every other
    // control character, space and backslash.
    if (c <= 0x20 || c === 0x5c || (c >= 0x7f && c <= 0x9f)) return null
  }
  // Must be written as https://, not merely parse to it ("https:evil.example" does).
  if (raw.slice(0, 8).toLowerCase() !== 'https://') return null
  // The host must follow directly, and no "user@" may stand in front of it: the URL parser would
  // accept "https:///evil.example" and "https://github.com@evil.example".
  let hostEnd = 8
  while (hostEnd < raw.length) {
    const c = raw[hostEnd]
    if (c === '/' || c === '?' || c === '#') break
    if (c === '@') return null
    hostEnd++
  }
  if (hostEnd === 8) return null
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || url.hostname === '') return null
  if (url.username !== '' || url.password !== '') return null
  return url.href.length <= MAX_URL_LENGTH ? url.href : null
}

function shortenRepoUrl(href: string, repo: string): string | null {
  const prefix = `https://github.com/${repo}/`
  if (href.length <= prefix.length || href.slice(0, prefix.length).toLowerCase() !== prefix.toLowerCase()) return null
  const rest = href.slice(prefix.length)
  let m = /^(?:pull|issues)\/(\d{1,9})$/.exec(rest)
  if (m) return `#${m[1]}`
  m = /^commit\/([0-9a-f]{7,40})$/.exec(rest)
  if (m) return (m[1] as string).slice(0, 7)
  m = /^compare\/([^/?#]{1,120})$/.exec(rest)
  if (m) return m[1] as string
  return null
}

// ---------------------------------------------------------------- characters

const ENTITIES: Readonly<Record<string, string>> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', copy: '\u00a9', reg: '\u00ae',
  trade: '\u2122', hellip: '\u2026', mdash: '\u2014', ndash: '\u2013', lsquo: '\u2018', rsquo: '\u2019',
  ldquo: '\u201c', rdquo: '\u201d', bull: '\u2022', middot: '\u00b7', times: '\u00d7', divide: '\u00f7',
  larr: '\u2190', rarr: '\u2192', uarr: '\u2191', darr: '\u2193', harr: '\u2194', deg: '\u00b0',
  plusmn: '\u00b1', laquo: '\u00ab', raquo: '\u00bb', euro: '\u20ac', pound: '\u00a3', yen: '\u00a5',
  cent: '\u00a2', sect: '\u00a7', para: '\u00b6', micro: '\u00b5', frac12: '\u00bd', frac14: '\u00bc',
  frac34: '\u00be', check: '\u2713', cross: '\u2717', star: '\u2606', hearts: '\u2665',
  colon: ':', semi: ';', comma: ',', period: '.', excl: '!', quest: '?', num: '#', dollar: '$',
  percnt: '%', ast: '*', plus: '+', equals: '=', sol: '/', bsol: '\\', lowbar: '_', grave: '`',
  lpar: '(', rpar: ')', lbrack: '[', rbrack: ']', lsqb: '[', rsqb: ']', lbrace: '{', rbrace: '}',
  lcub: '{', rcub: '}', vert: '|', verbar: '|', commat: '@', Tab: '\t', NewLine: '\n'
}

/** Removed everywhere: C0 / C1 controls except tab and newline, bidi overrides and isolates, BOM. */
const STRIP = /[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069\ufeff]/g

function codePointText(cp: number): string {
  if (cp === 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return '\ufffd'
  if (cp === 9 || cp === 10) return String.fromCodePoint(cp)
  if (cp < 0x20 || (cp >= 0x7f && cp <= 0x9f)) return '\ufffd'
  if ((cp >= 0x202a && cp <= 0x202e) || (cp >= 0x2066 && cp <= 0x2069) || cp === 0xfeff) return ''
  return String.fromCodePoint(cp)
}

/** `&name;`, `&#123;` or `&#x1F;` at `i`, or null. Looks at most 34 characters ahead. */
function matchEntity(s: string, i: number): { v: string; end: number } | null {
  let j = i + 1
  if (s.charCodeAt(j) === 35 /* # */) {
    j++
    const hex = s[j] === 'x' || s[j] === 'X'
    if (hex) j++
    const from = j
    const max = hex ? 6 : 7
    while (j - from < max) {
      const c = s.charCodeAt(j)
      const digit = c >= 48 && c <= 57
      const alpha = hex && ((c >= 65 && c <= 70) || (c >= 97 && c <= 102))
      if (!digit && !alpha) break
      j++
    }
    if (j === from || s[j] !== ';') return null
    return { v: codePointText(parseInt(s.slice(from, j), hex ? 16 : 10)), end: j + 1 }
  }
  const from = j
  while (j - from < 32) {
    const c = s.charCodeAt(j)
    if (!((c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122))) break
    j++
  }
  if (j === from || s[j] !== ';') return null
  const name = s.slice(from, j)
  return Object.hasOwn(ENTITIES, name) ? { v: ENTITIES[name] as string, end: j + 1 } : null
}

/** Backslash escapes and entities resolved; used for link destinations. */
function unescapeText(s: string): string {
  if (!s.includes('\\') && !s.includes('&')) return s
  let out = ''
  let i = 0
  while (i < s.length) {
    const ch = s[i] as string
    if (ch === '\\' && i + 1 < s.length && ASCII_PUNCT.includes(s[i + 1] as string)) {
      out += s[i + 1]
      i += 2
    } else if (ch === '&') {
      const e = matchEntity(s, i)
      if (e) {
        out += e.v
        i = e.end
      } else {
        out += ch
        i++
      }
    } else {
      out += ch
      i++
    }
  }
  return out
}

const isWsCode = (c: number): boolean => c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0c || c === 0x0d
const UNICODE_SPACE = /\s/u
const UNICODE_PUNCT = /[\p{P}\p{S}]/u

/** The code point ending just before `i` / starting at `i`; '\n' stands for the edge of the text. */
function before(s: string, i: number): string {
  if (i <= 0) return '\n'
  const c = s.charCodeAt(i - 1)
  if (c >= 0xdc00 && c <= 0xdfff && i >= 2) return s.slice(i - 2, i)
  return s[i - 1] as string
}
function after(s: string, i: number): string {
  if (i >= s.length) return '\n'
  const c = s.charCodeAt(i)
  if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) return s.slice(i, i + 2)
  return s[i] as string
}

// ---------------------------------------------------------------- lines

function indentOf(line: string): number {
  let i = 0
  while (line.charCodeAt(i) === 0x20) i++
  return i
}

function isBlank(line: string): boolean {
  for (let i = 0; i < line.length; i++) {
    const c = line.charCodeAt(i)
    if (c !== 0x20 && c !== 0x09) return false
  }
  return true
}

/** Leading tabs become spaces (tab stops of 4), so indentation is counted in one unit. */
function expandTabs(line: string): string {
  if (!line.includes('\t')) return line
  let col = 0
  let i = 0
  for (; i < line.length; i++) {
    const c = line.charCodeAt(i)
    if (c === 0x20) col++
    else if (c === 0x09) col += 4 - (col % 4)
    else break
  }
  return ' '.repeat(col) + line.slice(i)
}

interface Fence {
  ch: string
  len: number
  indent: number
  info: string
}

function openFence(line: string): Fence | null {
  const indent = indentOf(line)
  if (indent > 3) return null
  const ch = line[indent]
  if (ch !== '`' && ch !== '~') return null
  let j = indent
  while (line[j] === ch) j++
  const len = j - indent
  if (len < 3) return null
  const info = line.slice(j).trim()
  if (ch === '`' && info.includes('`')) return null
  return { ch, len, indent, info }
}

function closesFence(line: string, fence: Fence): boolean {
  const indent = indentOf(line)
  if (indent > 3) return false
  let j = indent
  while (line[j] === fence.ch) j++
  if (j - indent < fence.len) return false
  for (; j < line.length; j++) {
    const c = line.charCodeAt(j)
    if (c !== 0x20 && c !== 0x09) return false
  }
  return true
}

/** `---`, `***`, `___` (three or more, spaces allowed between). */
function isRule(line: string): boolean {
  const indent = indentOf(line)
  if (indent > 3) return false
  const ch = line[indent]
  if (ch !== '-' && ch !== '*' && ch !== '_') return false
  let count = 0
  for (let j = indent; j < line.length; j++) {
    const c = line[j]
    if (c === ch) count++
    else if (c !== ' ' && c !== '\t') return false
  }
  return count >= 3
}

function headingOf(line: string): { level: number; text: string } | null {
  const indent = indentOf(line)
  if (indent > 3 || line[indent] !== '#') return null
  let j = indent
  while (line[j] === '#') j++
  const level = j - indent
  if (level > 6) return null
  if (j < line.length && line[j] !== ' ' && line[j] !== '\t') return null
  let text = line.slice(j).trim()
  // Optional closing run of #, which must be preceded by a space (or be all there is).
  let e = text.length
  while (e > 0 && text[e - 1] === '#') e--
  if (e === 0) text = ''
  else if (e < text.length && (text[e - 1] === ' ' || text[e - 1] === '\t')) text = text.slice(0, e).trimEnd()
  return { level, text }
}

/** 1 for a line of `=`, 2 for a line of `-`, else 0. Only meaningful under a paragraph line. */
function setextLevel(line: string): number {
  const indent = indentOf(line)
  if (indent > 3) return 0
  const ch = line[indent]
  if (ch !== '=' && ch !== '-') return 0
  let j = indent
  while (line[j] === ch) j++
  for (let k = j; k < line.length; k++) {
    const c = line[k]
    if (c !== ' ' && c !== '\t') return 0
  }
  return ch === '=' ? 1 : 2
}

interface Marker {
  ordered: boolean
  /** `-`, `+`, `*` for bullets; `.` or `)` for ordered items. */
  ch: string
  start: number
  /** Columns a continuation line must be indented by to belong to the item. */
  width: number
  rest: string
  empty: boolean
}

function matchMarker(line: string): Marker | null {
  const indent = indentOf(line)
  if (indent > 3) return null
  const first = line[indent]
  let j = indent
  let ordered = false
  let ch: string
  let start = 1
  if (first === '-' || first === '+' || first === '*') {
    ch = first
    j++
  } else {
    while (j - indent < 9) {
      const c = line.charCodeAt(j)
      if (c < 48 || c > 57) break
      j++
    }
    if (j === indent) return null
    const d = line[j]
    if (d !== '.' && d !== ')') return null
    ordered = true
    ch = d
    start = parseInt(line.slice(indent, j), 10)
    j++
  }
  if (j >= line.length) return { ordered, ch, start, width: j + 1, rest: '', empty: true }
  if (line.charCodeAt(j) === 0x09) {
    // A tab after the marker counts as one separating space.
    const rest = line.slice(j + 1).trimStart()
    return { ordered, ch, start, width: j + 1, rest, empty: rest === '' }
  }
  if (line[j] !== ' ') return null
  let spaces = 0
  while (line[j + spaces] === ' ') spaces++
  if (j + spaces >= line.length) return { ordered, ch, start, width: j + 1, rest: '', empty: true }
  // Five or more spaces: the content is an indented code block one column after the marker.
  if (spaces >= 5) return { ordered, ch, start, width: j + 1, rest: line.slice(j + 1), empty: false }
  return { ordered, ch, start, width: j + spaces, rest: line.slice(j + spaces), empty: false }
}

/** Cells of a table row: split on unescaped `|`, one leading and one trailing pipe ignored. */
function splitRow(line: string): string[] {
  const s = line.trim()
  const cells: string[] = []
  let cell = ''
  let i = s[0] === '|' ? 1 : 0
  for (; i < s.length; i++) {
    const ch = s[i] as string
    if (ch === '\\' && s[i + 1] === '|') {
      cell += '|'
      i++
    } else if (ch === '|') {
      cells.push(cell)
      cell = ''
      if (cells.length > MAX_TABLE_COLUMNS * 4) return cells
    } else {
      cell += ch
    }
  }
  if (cell.trim() !== '' || s[s.length - 1] !== '|' || s.length === 0) cells.push(cell)
  return cells
}

function tableAt(ls: string[], i: number): { align: Align[]; head: string[] } | null {
  if (i + 1 >= ls.length) return null
  const head = ls[i] as string
  if (!head.includes('|')) return null
  const delim = ls[i + 1] as string
  if (!delim.includes('-') || indentOf(delim) > 3) return null
  for (let k = 0; k < delim.length; k++) {
    const c = delim[k]
    if (c !== '|' && c !== '-' && c !== ':' && c !== ' ' && c !== '\t') return null
  }
  const dcells = splitRow(delim)
  if (dcells.length === 0 || dcells.length > MAX_TABLE_COLUMNS) return null
  const align: Align[] = []
  for (const raw of dcells) {
    const cell = raw.trim()
    if (!/^:?-+:?$/.test(cell)) return null
    const l = cell[0] === ':'
    const r = cell[cell.length - 1] === ':'
    align.push(l && r ? 'center' : l ? 'left' : r ? 'right' : null)
  }
  const hcells = splitRow(head)
  if (hcells.length !== dcells.length) return null
  return { align, head: hcells }
}

function taskMarker(s: string): { checked: boolean; rest: string } | null {
  if (s[0] !== '[' || s[2] !== ']') return null
  const c = s[1]
  if (c !== ' ' && c !== 'x' && c !== 'X') return null
  if (s.length > 3 && s[3] !== ' ' && s[3] !== '\t') return null
  return { checked: c !== ' ', rest: s.slice(4) }
}

const ALERT = /^\[!(note|tip|important|warning|caution)\]$/i
const REF_DEF = /^ {0,3}\[([^[\]\\]{1,200})\]:[ \t]*(\S+)(?:[ \t]+(?:"[^"]*"|'[^']*'|\([^()]*\)))?[ \t]*$/

function normalizeLabel(label: string): string {
  return label.trim().replace(/[ \t\n]+/g, ' ').toLowerCase()
}

// ---------------------------------------------------------------- inline helpers

function plainText(nodes: readonly Inline[]): string {
  let out = ''
  for (const node of nodes) {
    switch (node.t) {
      case 'text':
      case 'code':
        out += node.v
        break
      case 'br':
        out += ' '
        break
      case 'image':
        out += node.alt
        break
      default:
        out += plainText(node.c)
    }
  }
  return out
}

/** A link may not contain another link: inner links and images are reduced to their text. */
function withoutLinks(nodes: Inline[]): Inline[] {
  const out: Inline[] = []
  for (const node of nodes) {
    if (node.t === 'link') out.push(...withoutLinks(node.c))
    else if (node.t === 'image') out.push({ t: 'text', v: node.alt === '' ? 'image' : node.alt })
    else if (node.t === 'strong' || node.t === 'em' || node.t === 'del') out.push({ t: node.t, c: withoutLinks(node.c) })
    else out.push(node)
  }
  return mergeText(out)
}

function mergeText(nodes: Inline[]): Inline[] {
  const out: Inline[] = []
  for (const node of nodes) {
    const last = out[out.length - 1]
    if (node.t === 'text') {
      if (node.v === '') continue
      if (last !== undefined && last.t === 'text') {
        out[out.length - 1] = { t: 'text', v: last.v + node.v }
        continue
      }
    }
    out.push(node)
  }
  return out
}

/** Where a bare URL that runs from `start` to `end` really stops (GFM's trailing rules). */
function trimAutolinkEnd(s: string, start: number, end: number): number {
  let e = end
  let opens = -1
  let closes = 0
  for (;;) {
    if (e <= start) return e
    const c = s[e - 1] as string
    if ('?!.,:*_~\'"'.includes(c)) {
      e--
    } else if (c === ')') {
      if (opens < 0) {
        opens = 0
        for (let k = start; k < e; k++) {
          if (s[k] === '(') opens++
          else if (s[k] === ')') closes++
        }
      }
      if (closes <= opens) return e
      e--
      closes--
    } else if (c === ';') {
      let k = e - 2
      while (k > start && e - k < 34 && /[A-Za-z0-9#]/.test(s[k] as string)) k--
      if (k > start && s[k] === '&') e = k
      else return e
    } else {
      return e
    }
  }
}

const SPECIAL = new Uint8Array(128)
for (const ch of '\\`*_~[]!<&\n') SPECIAL[ch.charCodeAt(0)] = 1

// ---------------------------------------------------------------- the parser

export function parseMarkdown(input: string, options: MdOptions = {}): MdDoc {
  const maxLength = options.maxLength ?? 100_000
  const maxNodes = options.maxNodes ?? 10_000
  const maxBlockDepth = options.maxBlockDepth ?? 6
  const maxInlineDepth = options.maxInlineDepth ?? 12
  const breaks = options.breaks ?? true
  const repo = options.repo !== undefined && /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/.test(options.repo) ? options.repo : null

  let truncated = false
  let nodes = 0

  let src = typeof input === 'string' ? input : ''
  if (src.length > maxLength) {
    truncated = true
    let cut = src.lastIndexOf('\n', maxLength)
    if (cut < 0 || cut < maxLength - 4096) cut = maxLength
    const last = src.charCodeAt(cut - 1)
    if (last >= 0xd800 && last <= 0xdbff) cut--
    src = src.slice(0, cut)
  }
  src = src.replace(/\r\n?/g, '\n').replace(/\u0000/g, '\ufffd').replace(STRIP, '')
  const lines = src.split('\n').map(expandTabs)

  // Link reference definitions: top level only, https destinations only, removed from the text.
  const refs = new Map<string, string>()
  {
    let fence: Fence | null = null
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] as string
      if (fence) {
        if (closesFence(line, fence)) fence = null
        continue
      }
      fence = openFence(line)
      if (fence || line.length > 2400 || line.indexOf(']:') < 0) continue
      const m = REF_DEF.exec(line)
      if (!m) continue
      let dest = m[2] as string
      if (dest.length > 2 && dest[0] === '<' && dest[dest.length - 1] === '>') dest = dest.slice(1, -1)
      const href = safeHref(unescapeText(dest))
      const label = normalizeLabel(m[1] as string)
      if (href === null || label === '' || label[0] === '^') continue
      if (!refs.has(label) && refs.size < MAX_REFS) refs.set(label, href)
      lines[i] = ''
    }
  }

  // -------------------------------------------------------------- inlines

  type Entry =
    | { k: 0; node: Inline; depth: number }
    | { k: 1; ch: string; count: number; orig: number; canOpen: boolean; canClose: boolean }
    | { k: 2; image: boolean; pos: number }

  function entriesToNodes(entries: Entry[]): Inline[] {
    const out: Inline[] = []
    for (const e of entries) {
      if (e.k === 0) out.push(e.node)
      else if (e.k === 1) {
        if (e.count > 0) out.push({ t: 'text', v: e.ch.repeat(e.count) })
      } else out.push({ t: 'text', v: e.image ? '![' : '[' })
    }
    return mergeText(out)
  }

  function maxDepth(entries: Entry[]): number {
    let d = 0
    for (const e of entries) if (e.k === 0 && e.depth > d) d = e.depth
    return d
  }

  /** Turns bare https:// URLs inside text into links (never inside an existing link). */
  function linkify(list: Inline[]): Inline[] {
    const out: Inline[] = []
    for (const node of list) {
      if (node.t === 'strong' || node.t === 'em' || node.t === 'del') {
        out.push({ t: node.t, c: linkify(node.c) })
        continue
      }
      if (node.t !== 'text' || node.v.indexOf('http') < 0) {
        out.push(node)
        continue
      }
      const v = node.v
      let from = 0
      let idx = v.indexOf('http')
      while (idx >= 0) {
        const scheme = v.startsWith('https://', idx) ? 8 : v.startsWith('http://', idx) ? 7 : 0
        const prev = idx === 0 ? ' ' : (v[idx - 1] as string)
        if (scheme === 0 || !(isWsCode(prev.charCodeAt(0)) || '*_~('.includes(prev))) {
          idx = v.indexOf('http', idx + 4)
          continue
        }
        let e = idx + scheme
        const limit = Math.min(v.length, idx + MAX_URL_LENGTH + 64)
        while (e < limit && !isWsCode(v.charCodeAt(e)) && v[e] !== '<') e++
        const stop = e
        e = trimAutolinkEnd(v, idx, e)
        const href = e > idx + scheme && nodes < maxNodes ? safeHref(v.slice(idx, e)) : null
        if (href !== null) {
          if (idx > from) out.push({ t: 'text', v: v.slice(from, idx) })
          const label = (repo !== null ? shortenRepoUrl(href, repo) : null) ?? v.slice(idx, e)
          out.push({ t: 'link', href, c: [{ t: 'text', v: label }] })
          nodes += 2
          from = e
          idx = v.indexOf('http', e)
        } else {
          idx = v.indexOf('http', Math.max(stop, idx + 4))
        }
      }
      if (from < v.length) out.push({ t: 'text', v: from === 0 ? v : v.slice(from) })
    }
    return out
  }

  /** Budget shared by every "is this a link?" look-ahead in the document: keeps them linear overall. */
  let linkScanBudget = Math.max(4096, src.length * 4)

  function parseInline(text: string): Inline[] {
    const n = text.length
    if (n === 0) return []
    const out: Entry[] = []
    const stacks: Record<string, number[]> = { '*': [], _: [], '~': [] }
    const brackets: number[] = []
    /** Pending literal text, kept in pieces and joined once, when the text node is made. */
    let buf: string[] = []
    let i = 0
    let noCommentEnd = false
    let tickRuns: Map<number, number[]> | null = null
    const tickPtr = new Map<number, number>()

    const pushNode = (node: Inline, depth: number): void => {
      out.push({ k: 0, node, depth })
      nodes++
    }
    const flush = (): void => {
      if (buf.length > 0) {
        pushNode({ t: 'text', v: buf.length === 1 ? (buf[0] as string) : buf.join('') }, 0)
        buf = []
      }
    }
    /** Drops spaces and tabs from the end of the pending text; returns how many went. */
    const trimTail = (): number => {
      let removed = 0
      while (buf.length > 0) {
        const last = buf[buf.length - 1] as string
        let e = last.length
        while (e > 0 && (last.charCodeAt(e - 1) === 0x20 || last.charCodeAt(e - 1) === 0x09)) e--
        removed += last.length - e
        if (e > 0) {
          if (e < last.length) buf[buf.length - 1] = last.slice(0, e)
          break
        }
        buf.pop()
      }
      return removed
    }
    /** Forgets every opener that sits above index `k` (they were consumed or turned into text). */
    const prune = (k: number): void => {
      for (const key of ['*', '_', '~']) {
        const s = stacks[key] as number[]
        while (s.length > 0 && (s[s.length - 1] as number) > k) s.pop()
      }
      while (brackets.length > 0 && (brackets[brackets.length - 1] as number) > k) brackets.pop()
    }
    const pushBreak = (): void => {
      trimTail()
      flush()
      const last = out[out.length - 1]
      if (last !== undefined && last.k === 0 && last.node.t === 'br') return
      pushNode({ t: 'br' }, 0)
    }
    const skipLineStart = (): void => {
      while (i < n && (text[i] === ' ' || text[i] === '\t')) i++
    }

    function findTickCloser(from: number, len: number): number {
      if (tickRuns === null) {
        tickRuns = new Map()
        let p = text.indexOf('`')
        while (p >= 0) {
          let q = p
          while (text.charCodeAt(q) === 96) q++
          const list = tickRuns.get(q - p)
          if (list) list.push(p)
          else tickRuns.set(q - p, [p])
          p = text.indexOf('`', q)
        }
      }
      const list = tickRuns.get(len)
      if (!list) return -1
      let p = tickPtr.get(len) ?? 0
      while (p < list.length && (list[p] as number) < from) p++
      tickPtr.set(len, p)
      return p < list.length ? (list[p] as number) : -1
    }

    /** Closes as much of a delimiter run as openers allow; returns how many characters are left over. */
    function closeDelims(ch: string, count: number, closerCanOpen: boolean): number {
      const stack = stacks[ch] as number[]
      let remaining = count
      while (remaining > 0 && stack.length > 0) {
        let found = -1
        for (let si = stack.length - 1, steps = 0; si >= 0 && steps < DELIM_SCAN; si--, steps++) {
          const e = out[stack[si] as number] as Entry & { k: 1 }
          if (ch === '~') {
            if (e.orig === count && e.count === count && remaining === count) {
              found = si
              break
            }
            continue
          }
          // CommonMark's "multiple of 3" rule for runs that can both open and close.
          if ((closerCanOpen || e.canClose) && (e.orig + count) % 3 === 0 && !(e.orig % 3 === 0 && count % 3 === 0)) continue
          found = si
          break
        }
        if (found < 0) break
        const k = stack[found] as number
        const opener = out[k] as Entry & { k: 1 }
        const use = ch === '~' ? count : opener.count >= 2 && remaining >= 2 ? 2 : 1
        const inner = out.splice(k + 1)
        prune(k)
        const depth = maxDepth(inner) + 1
        const children = entriesToNodes(inner)
        opener.count -= use
        remaining -= use
        if (opener.count === 0) {
          out.pop()
          stack.pop()
        }
        if (children.length === 0) continue
        if (depth > maxInlineDepth) {
          for (const child of children) out.push({ k: 0, node: child, depth: depth - 1 })
        } else {
          const node: Inline = ch === '~' ? { t: 'del', c: children } : use === 2 ? { t: 'strong', c: children } : { t: 'em', c: children }
          pushNode(node, depth)
        }
      }
      return remaining
    }

    /** `(destination "title")` starting at the `(` in `pos`. */
    function linkTail(pos: number): { dest: string; end: number } | null {
      let p = pos + 1
      const startBudget = p
      const fail = (): null => {
        linkScanBudget -= p - startBudget
        return null
      }
      while (p < n && isWsCode(text.charCodeAt(p))) p++
      let dest: string
      if (text[p] === '<') {
        const from = ++p
        while (p < n && p - from <= MAX_URL_LENGTH) {
          const c = text[p]
          if (c === '>' || c === '<' || c === '\n') break
          if (c === '\\') p++
          p++
        }
        if (text[p] !== '>') return fail()
        dest = text.slice(from, p)
        p++
      } else {
        const from = p
        let depth = 0
        while (p < n && p - from <= MAX_URL_LENGTH) {
          const c = text.charCodeAt(p)
          if (c <= 0x20 || c === 0x7f) break
          if (c === 92 /* \ */ && p + 1 < n && ASCII_PUNCT.includes(text[p + 1] as string)) {
            p += 2
            continue
          }
          if (c === 40 /* ( */) {
            if (++depth > MAX_LINK_PARENS) return fail()
          } else if (c === 41 /* ) */) {
            if (depth === 0) break
            depth--
          }
          p++
        }
        if (depth !== 0) return fail()
        dest = text.slice(from, p)
      }
      const afterDest = p
      while (p < n && isWsCode(text.charCodeAt(p))) p++
      const q = text[p]
      if (p > afterDest && (q === '"' || q === "'" || q === '(')) {
        const close = q === '(' ? ')' : q
        const from = ++p
        while (p < n && p - from <= MAX_TITLE && text[p] !== close) {
          if (text[p] === '\\') p++
          p++
        }
        if (text[p] !== close) return fail()
        p++
        while (p < n && isWsCode(text.charCodeAt(p))) p++
      }
      if (text[p] !== ')') return fail()
      linkScanBudget -= p - startBudget
      return { dest: unescapeText(dest), end: p + 1 }
    }

    function closeBracket(): void {
      const k = brackets.pop() as number
      const opener = out[k] as Entry & { k: 2 }
      let href: string | null = null
      let matched = false
      let end = i + 1
      if (text[i + 1] === '(' && linkScanBudget > 0) {
        const tail = linkTail(i + 1)
        if (tail) {
          matched = true
          href = safeHref(tail.dest)
          end = tail.end
        }
      }
      if (!matched && refs.size > 0) {
        let label: string | null = null
        let refEnd = i + 1
        if (text[i + 1] === '[') {
          let p = i + 2
          while (p < n && p - i <= MAX_LABEL + 2 && text[p] !== ']' && text[p] !== '[') p++
          if (text[p] === ']') {
            label = text.slice(i + 2, p)
            refEnd = p + 1
          }
        }
        if (label === null || label.trim() === '') {
          label = i - opener.pos <= MAX_LABEL ? text.slice(opener.pos, i) : null
        }
        if (label !== null && !label.includes('[')) {
          const found = refs.get(normalizeLabel(label))
          if (found !== undefined) {
            matched = true
            href = found
            end = refEnd
          }
        }
      }
      if (!matched) {
        // Not a link: the opener stays behind as literal text.
        out[k] = { k: 0, node: { t: 'text', v: opener.image ? '![' : '[' }, depth: 0 }
        buf.push(']')
        i++
        return
      }
      const inner = out.splice(k + 1)
      out.pop()
      prune(k - 1)
      const depth = maxDepth(inner) + 1
      const children = entriesToNodes(inner)
      i = end
      if (opener.image) {
        const alt = plainText(children)
        if (href !== null) pushNode({ t: 'image', href, alt }, 1)
        else if (alt !== '') pushNode({ t: 'text', v: alt }, 0)
        return
      }
      if (href === null) {
        // A destination that is not allowed: keep the words, drop the link.
        for (const child of children) out.push({ k: 0, node: child, depth: depth - 1 })
        return
      }
      const content = depth > maxInlineDepth ? [{ t: 'text', v: plainText(children) } as Inline] : withoutLinks(children)
      pushNode({ t: 'link', href, c: content.length > 0 ? content : [{ t: 'text', v: href }] }, depth > maxInlineDepth ? 1 : depth)
      // Links do not nest: earlier "[" can no longer open one.
      brackets.length = 0
    }

    while (i < n) {
      if (nodes >= maxNodes) {
        truncated = true
        break
      }
      let j = i
      while (j < n) {
        const c = text.charCodeAt(j)
        if (c < 128 && SPECIAL[c] === 1) break
        j++
      }
      if (j > i) {
        buf.push(text.slice(i, j))
        i = j
        if (i >= n) break
      }
      const ch = text[i] as string
      switch (ch) {
        case '\\': {
          const next = text[i + 1]
          if (next === '\n') {
            pushBreak()
            i += 2
            skipLineStart()
          } else if (next !== undefined && ASCII_PUNCT.includes(next)) {
            buf.push(next)
            i += 2
          } else {
            buf.push('\\')
            i++
          }
          break
        }
        case '\n': {
          const hard = trimTail() >= 2 || breaks
          i++
          skipLineStart()
          if (i >= n) break
          if (hard) pushBreak()
          else buf.push(' ')
          break
        }
        case '`': {
          let e = i
          while (text.charCodeAt(e) === 96) e++
          const len = e - i
          const close = findTickCloser(e, len)
          if (close < 0) {
            buf.push(text.slice(i, e))
            i = e
            break
          }
          let code = text.slice(e, close).replace(/\n/g, ' ')
          if (code.length >= 2 && code[0] === ' ' && code[code.length - 1] === ' ' && code.trim() !== '') code = code.slice(1, -1)
          flush()
          pushNode({ t: 'code', v: code }, 0)
          i = close + len
          break
        }
        case '*':
        case '_':
        case '~': {
          let e = i
          while (text[e] === ch) e++
          const count = e - i
          if (ch === '~' && count > 2) {
            buf.push(text.slice(i, e))
            i = e
            break
          }
          const b = before(text, i)
          const a = after(text, e)
          const wsB = UNICODE_SPACE.test(b)
          const wsA = UNICODE_SPACE.test(a)
          const pB = UNICODE_PUNCT.test(b)
          const pA = UNICODE_PUNCT.test(a)
          const left = !wsA && (!pA || wsB || pB)
          const right = !wsB && (!pB || wsA || pA)
          const canOpen = ch === '_' ? left && (!right || pB) : left
          const canClose = ch === '_' ? right && (!left || pA) : right
          flush()
          let remaining = count
          if (canClose) remaining = closeDelims(ch, count, canOpen)
          if (remaining > 0) {
            if (canOpen) {
              out.push({ k: 1, ch, count: remaining, orig: count, canOpen, canClose })
              ;(stacks[ch] as number[]).push(out.length - 1)
            } else {
              buf.push(ch.repeat(remaining))
            }
          }
          i = e
          break
        }
        case '!': {
          if (text[i + 1] === '[') {
            flush()
            out.push({ k: 2, image: true, pos: i + 2 })
            brackets.push(out.length - 1)
            i += 2
          } else {
            buf.push('!')
            i++
          }
          break
        }
        case '[': {
          flush()
          out.push({ k: 2, image: false, pos: i + 1 })
          brackets.push(out.length - 1)
          i++
          break
        }
        case ']': {
          if (brackets.length === 0) {
            buf.push(']')
            i++
          } else {
            flush()
            closeBracket()
          }
          break
        }
        case '<': {
          if (text.startsWith('<!--', i)) {
            const e = noCommentEnd ? -1 : text.indexOf('-->', i + 4)
            if (e >= 0) {
              i = e + 3
              break
            }
            noCommentEnd = true
          }
          // <br>, <br/>, <br />
          if ((text[i + 1] === 'b' || text[i + 1] === 'B') && (text[i + 2] === 'r' || text[i + 2] === 'R')) {
            let p = i + 3
            while (text[p] === ' ') p++
            if (text[p] === '/') p++
            if (text[p] === '>') {
              pushBreak()
              i = p + 1
              if (text[i] === '\n') {
                i++
                skipLineStart()
              }
              break
            }
          }
          // <https://example.com>
          let e = i + 1
          while (e < n && e - i <= MAX_URL_LENGTH + 1) {
            const c = text.charCodeAt(e)
            if (c === 62 /* > */ || c <= 0x20 || c === 60 /* < */) break
            e++
          }
          if (e > i + 1 && text[e] === '>') {
            const inner = text.slice(i + 1, e)
            if (/^[A-Za-z][A-Za-z0-9+.-]{1,31}:/.test(inner)) {
              const href = safeHref(inner)
              if (href !== null) {
                flush()
                pushNode({ t: 'link', href, c: [{ t: 'text', v: inner }] }, 1)
                nodes++
              } else {
                buf.push(inner)
              }
              i = e + 1
              break
            }
          }
          buf.push('<')
          i++
          break
        }
        case '&': {
          const entity = matchEntity(text, i)
          if (entity) {
            buf.push(entity.v)
            i = entity.end
          } else {
            buf.push('&')
            i++
          }
          break
        }
        default: {
          buf.push(ch)
          i++
        }
      }
    }
    flush()

    let result = entriesToNodes(out)
    result = mergeText(linkify(result))
    // Trim the edges: no leading or trailing white space or line breaks.
    while (result.length > 0) {
      const first = result[0] as Inline
      if (first.t === 'br') result.shift()
      else if (first.t === 'text' && first.v.trimStart() !== first.v) {
        const v = first.v.trimStart()
        if (v === '') result.shift()
        else {
          result[0] = { t: 'text', v }
          break
        }
      } else break
    }
    while (result.length > 0) {
      const last = result[result.length - 1] as Inline
      if (last.t === 'br') result.pop()
      else if (last.t === 'text' && last.v.trimEnd() !== last.v) {
        const v = last.v.trimEnd()
        if (v === '') result.pop()
        else {
          result[result.length - 1] = { t: 'text', v }
          break
        }
      } else break
    }
    return result
  }

  // -------------------------------------------------------------- blocks

  /** True when line `j` begins something that ends the paragraph (or lazy continuation) before it. */
  function startsBlock(ls: string[], j: number, depth: number, tables: boolean): boolean {
    const line = ls[j] as string
    const indent = indentOf(line)
    if (indent > 3) return false
    const c = line[indent]
    if (c === '#') return headingOf(line) !== null
    if (c === '`' || c === '~') return openFence(line) !== null
    if (c === '>') return depth < maxBlockDepth
    if (c === '<' && line.startsWith('<!--', indent)) return true
    if (isRule(line)) return true
    if (depth < maxBlockDepth) {
      const m = matchMarker(line)
      if (m && !m.empty && (!m.ordered || m.start === 1)) return true
    }
    return tables && tableAt(ls, j) !== null
  }

  function parseBlocks(ls: string[], depth: number): { blocks: Block[]; spread: boolean } {
    const out: Block[] = []
    let spread = false
    let sawBlank = false
    let noCommentEnd = false
    let i = 0
    const push = (block: Block): void => {
      if (sawBlank && out.length > 0) spread = true
      sawBlank = false
      out.push(block)
      nodes++
    }

    while (i < ls.length) {
      if (nodes >= maxNodes) {
        truncated = true
        break
      }
      const line = ls[i] as string
      if (isBlank(line)) {
        sawBlank = true
        i++
        continue
      }
      const indent = indentOf(line)

      // Indented code.
      if (indent >= 4) {
        const code: string[] = []
        while (i < ls.length) {
          const l = ls[i] as string
          if (isBlank(l)) {
            let j = i + 1
            while (j < ls.length && isBlank(ls[j] as string)) j++
            if (j >= ls.length || indentOf(ls[j] as string) < 4) break
            for (let k = i; k < j; k++) code.push('')
            i = j
            continue
          }
          if (indentOf(l) < 4) break
          code.push(l.slice(4))
          i++
        }
        push({ t: 'code', lang: '', v: code.join('\n') })
        continue
      }

      // Fenced code.
      const fence = openFence(line)
      if (fence) {
        const code: string[] = []
        i++
        while (i < ls.length) {
          const l = ls[i] as string
          i++
          if (closesFence(l, fence)) break
          code.push(l.slice(Math.min(indentOf(l), fence.indent)))
        }
        const word = fence.info.split(/[ \t]/, 1)[0] ?? ''
        push({ t: 'code', lang: /^[A-Za-z0-9_+#.-]{1,32}$/.test(word) ? word.toLowerCase() : '', v: code.join('\n') })
        continue
      }

      // HTML comment: dropped, however many lines it spans. An unclosed one is ordinary text.
      if (line.startsWith('<!--', indent) && !noCommentEnd) {
        let j = i
        let pos = line.indexOf('-->', indent + 4)
        while (pos < 0 && ++j < ls.length) pos = (ls[j] as string).indexOf('-->')
        if (pos >= 0) {
          const rest = (ls[j] as string).slice(pos + 3)
          if (isBlank(rest)) i = j + 1
          else {
            ls[j] = rest
            i = j
          }
          continue
        }
        noCommentEnd = true
      }

      const heading = headingOf(line)
      if (heading) {
        push({ t: 'heading', level: heading.level, c: parseInline(heading.text) })
        i++
        continue
      }

      if (isRule(line)) {
        push({ t: 'rule' })
        i++
        continue
      }

      // Block quote (and GitHub's `> [!NOTE]` alerts).
      if (line[indent] === '>' && depth < maxBlockDepth) {
        const ql: string[] = []
        let qFence: Fence | null = null
        while (i < ls.length) {
          const l = ls[i] as string
          const li = indentOf(l)
          if (li <= 3 && l[li] === '>') {
            let rest = l.slice(li + 1)
            if (rest[0] === ' ') rest = rest.slice(1)
            if (qFence) {
              if (closesFence(rest, qFence)) qFence = null
            } else qFence = openFence(rest)
            ql.push(rest)
            i++
            continue
          }
          if (isBlank(l) || qFence) break
          const prev = ql[ql.length - 1] as string
          // Lazy continuation: only directly after paragraph text.
          if (isBlank(prev) || indentOf(prev) >= 4 || headingOf(prev) !== null || isRule(prev) || openFence(prev) !== null) break
          if (startsBlock(ls, i, depth, false) || matchMarker(l) !== null) break
          ql.push(l)
          i++
        }
        let kind: AlertKind | null = null
        const alert = ALERT.exec((ql[0] as string).trim())
        if (alert) {
          kind = (alert[1] as string).toLowerCase() as AlertKind
          ql.shift()
        }
        const inner = parseBlocks(ql, depth + 1)
        push({ t: 'quote', kind, c: inner.blocks })
        continue
      }

      // List.
      const first = depth < maxBlockDepth ? matchMarker(line) : null
      if (first) {
        const items: ListItem[] = []
        let tight = true
        let endedByBlank = false
        while (i < ls.length && nodes < maxNodes) {
          const cur = ls[i] as string
          const m = matchMarker(cur)
          if (!m || m.ordered !== first.ordered || m.ch !== first.ch || isRule(cur)) break
          const il: string[] = [m.rest]
          let iFence: Fence | null = m.empty ? null : openFence(m.rest)
          endedByBlank = false
          i++
          while (i < ls.length) {
            const l = ls[i] as string
            if (isBlank(l)) {
              let j = i + 1
              while (j < ls.length && isBlank(ls[j] as string)) j++
              if (j < ls.length && indentOf(ls[j] as string) >= m.width) {
                for (let k = i; k < j; k++) il.push('')
                i = j
                continue
              }
              i = j
              endedByBlank = true
              break
            }
            if (indentOf(l) >= m.width) {
              const inner = l.slice(m.width)
              if (iFence) {
                if (closesFence(inner, iFence)) iFence = null
              } else iFence = openFence(inner)
              il.push(inner)
              i++
              continue
            }
            if (iFence) break
            const prev = il[il.length - 1] as string
            // Lazy continuation: only directly after paragraph text.
            if (isBlank(prev) || indentOf(prev) >= 4 || headingOf(prev) !== null || isRule(prev) || openFence(prev) !== null) break
            if (startsBlock(ls, i, depth, false) || matchMarker(l) !== null) break
            il.push(l.trimStart())
            i++
          }
          let checked: boolean | null = null
          const task = taskMarker(il[0] as string)
          if (task) {
            checked = task.checked
            il[0] = task.rest
          }
          const inner = parseBlocks(il, depth + 1)
          if (inner.spread) tight = false
          items.push({ checked, c: inner.blocks })
          nodes++
          if (endedByBlank) {
            const next = i < ls.length ? matchMarker(ls[i] as string) : null
            if (next && next.ordered === first.ordered && next.ch === first.ch && !isRule(ls[i] as string)) {
              tight = false
              continue
            }
            break
          }
        }
        push({ t: 'list', ordered: first.ordered, start: first.start, tight, items })
        if (endedByBlank) sawBlank = true
        continue
      }

      // Table.
      const table = tableAt(ls, i)
      if (table) {
        const cols = table.align.length
        const head = table.head.map((cell) => parseInline(cell.trim()))
        const rows: Inline[][][] = []
        i += 2
        while (i < ls.length) {
          const l = ls[i] as string
          if (isBlank(l) || startsBlock(ls, i, depth, false)) break
          if (rows.length >= MAX_TABLE_ROWS || nodes >= maxNodes) {
            truncated = true
            while (i < ls.length && !isBlank(ls[i] as string)) i++
            break
          }
          const cells = splitRow(l)
          const row: Inline[][] = []
          for (let c = 0; c < cols; c++) row.push(parseInline((cells[c] ?? '').trim()))
          rows.push(row)
          nodes += cols
          i++
        }
        push({ t: 'table', align: table.align, head, rows })
        continue
      }

      // Paragraph (or a setext heading).
      const pl: string[] = [line.slice(indent)]
      let setext = 0
      i++
      while (i < ls.length) {
        const l = ls[i] as string
        if (isBlank(l)) break
        setext = setextLevel(l)
        if (setext !== 0) {
          i++
          break
        }
        if (startsBlock(ls, i, depth, true)) break
        pl.push(l.trimStart())
        i++
      }
      const content = parseInline(pl.join('\n').trimEnd())
      if (setext !== 0) push({ t: 'heading', level: setext, c: content })
      else if (content.length > 0) push({ t: 'paragraph', c: content })
    }
    return { blocks: out, spread }
  }

  const blocks = parseBlocks(lines, 0).blocks
  return { blocks, truncated }
}
