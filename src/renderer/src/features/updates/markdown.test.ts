import v010Body from './fixtures/v0.1.0.body.md?raw'
import { describe, expect, it } from 'vitest'
import { MAX_URL_LENGTH, parseMarkdown, safeHref, type Block, type Inline, type ListItem, type MdOptions } from './markdown'

// ---------------------------------------------------------------- builders

const T = (v: string): Inline => ({ t: 'text', v })
const C = (v: string): Inline => ({ t: 'code', v })
const B = (...c: Inline[]): Inline => ({ t: 'strong', c })
const I = (...c: Inline[]): Inline => ({ t: 'em', c })
const S = (...c: Inline[]): Inline => ({ t: 'del', c })
const L = (href: string, ...c: Inline[]): Inline => ({ t: 'link', href, c })
const IMG = (href: string, alt: string): Inline => ({ t: 'image', href, alt })
const BR: Inline = { t: 'br' }

const P = (...c: Inline[]): Block => ({ t: 'paragraph', c })
const H = (level: number, ...c: Inline[]): Block => ({ t: 'heading', level, c })
const CODE = (v: string, lang = ''): Block => ({ t: 'code', lang, v })
const Q = (...c: Block[]): Block => ({ t: 'quote', kind: null, c })
const HR: Block = { t: 'rule' }
const LI = (...c: Block[]): ListItem => ({ checked: null, c })
const UL = (...items: ListItem[]): Block => ({ t: 'list', ordered: false, start: 1, tight: true, items })
const OL = (start: number, ...items: ListItem[]): Block => ({ t: 'list', ordered: true, start, tight: true, items })

const blocks = (src: string, options?: MdOptions): Block[] => parseMarkdown(src, options).blocks
/** The inline content of a one-paragraph document. */
function inline(src: string, options?: MdOptions): Inline[] {
  const out = blocks(src, options)
  if (out.length === 0) return []
  expect(out).toHaveLength(1)
  const only = out[0] as Block
  if (only.t !== 'paragraph') throw new Error(`expected a paragraph, got ${only.t}`)
  return only.c
}

/** Every href anywhere in a document. */
function hrefs(src: string, options?: MdOptions): string[] {
  const found: string[] = []
  const walkInline = (nodes: Inline[]): void => {
    for (const n of nodes) {
      if (n.t === 'link') {
        found.push(n.href)
        walkInline(n.c)
      } else if (n.t === 'image') found.push(n.href)
      else if (n.t === 'strong' || n.t === 'em' || n.t === 'del') walkInline(n.c)
    }
  }
  const walk = (bs: Block[]): void => {
    for (const b of bs) {
      if (b.t === 'paragraph' || b.t === 'heading') walkInline(b.c)
      else if (b.t === 'quote') walk(b.c)
      else if (b.t === 'list') for (const item of b.items) walk(item.c)
      else if (b.t === 'table') {
        b.head.forEach(walkInline)
        for (const row of b.rows) row.forEach(walkInline)
      }
    }
  }
  walk(blocks(src, options))
  return found
}

/** The deepest nesting of arrays / objects in a value. */
function depthOf(value: unknown): number {
  let max = 0
  const stack: [unknown, number][] = [[value, 0]]
  while (stack.length > 0) {
    const [v, d] = stack.pop() as [unknown, number]
    if (d > max) max = d
    if (Array.isArray(v)) for (const x of v) stack.push([x, d + 1])
    else if (typeof v === 'object' && v !== null) for (const x of Object.values(v)) stack.push([x, d + 1])
  }
  return max
}

// ---------------------------------------------------------------- blocks

describe('blocks', () => {
  it('parses ATX headings of every level', () => {
    expect(blocks('# One\n## Two\n### Three\n#### Four\n##### Five\n###### Six')).toEqual([
      H(1, T('One')),
      H(2, T('Two')),
      H(3, T('Three')),
      H(4, T('Four')),
      H(5, T('Five')),
      H(6, T('Six'))
    ])
  })

  it('needs a space after the hashes, allows at most six, and strips a closing run', () => {
    expect(blocks('#hashtag')).toEqual([P(T('#hashtag'))])
    expect(blocks('####### seven')).toEqual([P(T('####### seven'))])
    expect(blocks('## Title ##')).toEqual([H(2, T('Title'))])
    expect(blocks('## C#')).toEqual([H(2, T('C#'))])
    expect(blocks('#')).toEqual([H(1)])
  })

  it('parses setext headings', () => {
    expect(blocks('Title\n=====\n\nSub\n---')).toEqual([H(1, T('Title')), H(2, T('Sub'))])
  })

  it('separates paragraphs on blank lines', () => {
    expect(blocks('one\n\ntwo\n\n\nthree')).toEqual([P(T('one')), P(T('two')), P(T('three'))])
  })

  it('treats CRLF and CR like LF', () => {
    expect(blocks('one\r\n\r\ntwo\rthree')).toEqual([P(T('one')), P(T('two'), BR, T('three'))])
  })

  it('turns a newline in a paragraph into a line break, as GitHub does for release notes', () => {
    expect(inline('first\nsecond')).toEqual([T('first'), BR, T('second')])
  })

  it('keeps soft breaks as spaces when breaks is off, and still honours hard breaks', () => {
    expect(inline('first\nsecond', { breaks: false })).toEqual([T('first second')])
    expect(inline('first  \nsecond', { breaks: false })).toEqual([T('first'), BR, T('second')])
    expect(inline('first\\\nsecond', { breaks: false })).toEqual([T('first'), BR, T('second')])
    expect(inline('first<br>second<br/>third<BR />fourth', { breaks: false })).toEqual([T('first'), BR, T('second'), BR, T('third'), BR, T('fourth')])
  })

  it('does not double a break when <br> ends a line', () => {
    expect(inline('first<br>\nsecond')).toEqual([T('first'), BR, T('second')])
  })

  it('parses a tight unordered list', () => {
    expect(blocks('- one\n- two\n- three')).toEqual([UL(LI(P(T('one'))), LI(P(T('two'))), LI(P(T('three'))))])
    expect(blocks('* one\n* two')).toEqual([UL(LI(P(T('one'))), LI(P(T('two'))))])
    expect(blocks('+ one')).toEqual([UL(LI(P(T('one'))))])
  })

  it('starts a new list when the bullet character changes', () => {
    expect(blocks('- one\n* two')).toEqual([UL(LI(P(T('one')))), UL(LI(P(T('two'))))])
  })

  it('parses ordered lists and keeps the start number', () => {
    expect(blocks('1. one\n2. two')).toEqual([OL(1, LI(P(T('one'))), LI(P(T('two'))))])
    expect(blocks('7) seven\n8) eight')).toEqual([OL(7, LI(P(T('seven'))), LI(P(T('eight'))))])
  })

  it('marks a list loose when blank lines separate its items', () => {
    expect(blocks('- one\n\n- two')).toEqual([{ t: 'list', ordered: false, start: 1, tight: false, items: [LI(P(T('one'))), LI(P(T('two')))] }])
  })

  it('nests lists by indentation', () => {
    expect(blocks('- one\n  - inner a\n  - inner b\n- two')).toEqual([UL(LI(P(T('one')), UL(LI(P(T('inner a'))), LI(P(T('inner b'))))), LI(P(T('two'))))])
    expect(blocks('1. one\n   - inner\n2. two')).toEqual([OL(1, LI(P(T('one')), UL(LI(P(T('inner'))))), LI(P(T('two'))))])
  })

  it('keeps an indented continuation and a second paragraph inside the item', () => {
    expect(blocks('- one\n  still one\n\n  second paragraph\n- two')).toEqual([
      { t: 'list', ordered: false, start: 1, tight: false, items: [LI(P(T('one'), BR, T('still one')), P(T('second paragraph'))), LI(P(T('two')))] }
    ])
  })

  it('accepts a lazy continuation line', () => {
    expect(blocks('- one\nlazy\n- two')).toEqual([UL(LI(P(T('one'), BR, T('lazy'))), LI(P(T('two'))))])
  })

  it('ends the list at a blank line followed by unindented text', () => {
    expect(blocks('- one\n\nafter')).toEqual([UL(LI(P(T('one')))), P(T('after'))])
  })

  it('parses task list items', () => {
    expect(blocks('- [ ] todo\n- [x] done\n- [X] also done\n- [y] not a task')).toEqual([
      {
        t: 'list',
        ordered: false,
        start: 1,
        tight: true,
        items: [
          { checked: false, c: [P(T('todo'))] },
          { checked: true, c: [P(T('done'))] },
          { checked: true, c: [P(T('also done'))] },
          { checked: null, c: [P(T('[y] not a task'))] }
        ]
      }
    ])
  })

  it('lets a list interrupt a paragraph only when it is a bullet or starts at 1', () => {
    expect(blocks('text\n- item')).toEqual([P(T('text')), UL(LI(P(T('item'))))])
    expect(blocks('text\n1. item')).toEqual([P(T('text')), OL(1, LI(P(T('item'))))])
    expect(blocks('released in\n2026. A good year')).toEqual([P(T('released in'), BR, T('2026. A good year'))])
  })

  it('parses fenced code with a language', () => {
    expect(blocks('```ts\nconst a = 1\n\n  indented\n```')).toEqual([CODE('const a = 1\n\n  indented', 'ts')])
    expect(blocks('~~~\n```\nnot closed by backticks\n~~~')).toEqual([CODE('```\nnot closed by backticks')])
    expect(blocks('````\n```\n````')).toEqual([CODE('```')])
  })

  it('never interprets anything inside code', () => {
    expect(blocks('```\n<script>alert(1)</script>\n**not bold** [x](javascript:alert(1))\n<!-- kept -->\n```')).toEqual([
      CODE('<script>alert(1)</script>\n**not bold** [x](javascript:alert(1))\n<!-- kept -->')
    ])
  })

  it('runs an unclosed fence to the end of the document', () => {
    expect(blocks('```\ncode\nmore')).toEqual([CODE('code\nmore')])
  })

  it('drops a language tag that is not a plain word', () => {
    expect(blocks('```"><script>\nx\n```')).toEqual([CODE('x')])
    expect(blocks('```JS extra words\nx\n```')).toEqual([CODE('x', 'js')])
  })

  it('parses indented code', () => {
    expect(blocks('text\n\n    code line\n      deeper\n\n    after blank\n\ntext')).toEqual([P(T('text')), CODE('code line\n  deeper\n\nafter blank'), P(T('text'))])
  })

  it('parses block quotes, nested quotes and lazy continuation', () => {
    expect(blocks('> quoted\n> more')).toEqual([Q(P(T('quoted'), BR, T('more')))])
    expect(blocks('> outer\n>\n> > inner')).toEqual([Q(P(T('outer')), Q(P(T('inner'))))])
    expect(blocks('> quoted\nlazy')).toEqual([Q(P(T('quoted'), BR, T('lazy')))])
    expect(blocks('> - a\n> - b')).toEqual([Q(UL(LI(P(T('a'))), LI(P(T('b')))))])
  })

  it('recognises GitHub alerts', () => {
    expect(blocks('> [!WARNING]\n> Back up your save first.')).toEqual([{ t: 'quote', kind: 'warning', c: [P(T('Back up your save first.'))] }])
    expect(blocks('> [!note]\n> lower case works')).toEqual([{ t: 'quote', kind: 'note', c: [P(T('lower case works'))] }])
    expect(blocks('> [!DANGER]\n> unknown kind')).toEqual([Q(P(T('[!DANGER]'), BR, T('unknown kind')))])
  })

  it('parses horizontal rules', () => {
    expect(blocks('a\n\n---\n\n***\n\n___\n\n- - -\n\n--')).toEqual([P(T('a')), HR, HR, HR, HR, P(T('--'))])
  })

  it('parses a pipe table with alignment', () => {
    expect(blocks('| Left | Centre | Right | None |\n| :--- | :---: | ---: | --- |\n| a | b | c | d |')).toEqual([
      {
        t: 'table',
        align: ['left', 'center', 'right', null],
        head: [[T('Left')], [T('Centre')], [T('Right')], [T('None')]],
        rows: [[[T('a')], [T('b')], [T('c')], [T('d')]]]
      }
    ])
  })

  it('parses a table without outer pipes, pads short rows and drops extra cells', () => {
    expect(blocks('a | b\n--- | ---\n1\n1 | 2 | 3')).toEqual([
      {
        t: 'table',
        align: [null, null],
        head: [[T('a')], [T('b')]],
        rows: [
          [[T('1')], []],
          [[T('1')], [T('2')]]
        ]
      }
    ])
  })

  it('parses inline content and escaped pipes in cells', () => {
    expect(blocks('| File | Notes |\n| --- | --- |\n| `a.exe` | **bold** \\| pipe |')).toEqual([
      { t: 'table', align: [null, null], head: [[T('File')], [T('Notes')]], rows: [[[C('a.exe')], [B(T('bold')), T(' | pipe')]]] }
    ])
  })

  it('does not see a table when the column counts differ or there is no delimiter row', () => {
    expect(blocks('| a | b |\n| --- |')).toEqual([P(T('| a | b |'), BR, T('| --- |'))])
    expect(blocks('a | b\nc | d')).toEqual([P(T('a | b'), BR, T('c | d'))])
  })

  it('ends a table at a blank line and lets it follow a paragraph directly', () => {
    expect(blocks('intro\n| a |\n| - |\n| 1 |\n\nafter')).toEqual([P(T('intro')), { t: 'table', align: [null], head: [[T('a')]], rows: [[[T('1')]]] }, P(T('after'))])
  })

  it('drops HTML comments, on one line or many', () => {
    expect(blocks('<!-- Release notes generated using configuration in .github/release.yml at main -->\n\n## Changes')).toEqual([H(2, T('Changes'))])
    expect(blocks('before\n\n<!--\nhidden\nlines\n-->\n\nafter')).toEqual([P(T('before')), P(T('after'))])
    expect(inline('a <!-- hidden --> b')).toEqual([T('a  b')])
  })

  it('keeps an unclosed comment as text instead of swallowing the rest', () => {
    expect(blocks('<!-- oops\n\nstill visible')).toEqual([P(T('<!-- oops')), P(T('still visible'))])
  })

  it('resolves link reference definitions that point at https', () => {
    expect(blocks('See [the docs][docs] and [docs] and [again][].\n\n[docs]: https://example.com/docs "Title"\n[again]: <https://example.com/again>')).toEqual([
      P(T('See '), L('https://example.com/docs', T('the docs')), T(' and '), L('https://example.com/docs', T('docs')), T(' and '), L('https://example.com/again', T('again')), T('.'))
    ])
  })

  it('leaves text that only looks like a definition alone', () => {
    expect(blocks('[Fixed]: crash')).toEqual([P(T('[Fixed]: crash'))])
    expect(blocks('[x]: javascript:alert(1)\n\n[x]')).toEqual([P(T('[x]: javascript:alert(1)')), P(T('[x]'))])
  })

  it('returns no blocks for empty or blank input', () => {
    expect(parseMarkdown('')).toEqual({ blocks: [], truncated: false })
    expect(parseMarkdown('  \n\t\n\n')).toEqual({ blocks: [], truncated: false })
    expect(parseMarkdown(undefined as unknown as string)).toEqual({ blocks: [], truncated: false })
  })
})

// ---------------------------------------------------------------- inlines

describe('inlines', () => {
  it('parses bold, italic and both', () => {
    expect(inline('**bold** and __bold__')).toEqual([B(T('bold')), T(' and '), B(T('bold'))])
    expect(inline('*em* and _em_')).toEqual([I(T('em')), T(' and '), I(T('em'))])
    expect(inline('***both***')).toEqual([I(B(T('both')))])
    expect(inline('**bold with *em* inside**')).toEqual([B(T('bold with '), I(T('em')), T(' inside'))])
    expect(inline('*em with **bold** inside*')).toEqual([I(T('em with '), B(T('bold')), T(' inside'))])
  })

  it('follows the flanking rules', () => {
    expect(inline('snake_case_name and 2 * 3 * 4')).toEqual([T('snake_case_name and 2 * 3 * 4')])
    expect(inline('un*frigging*believable')).toEqual([T('un'), I(T('frigging')), T('believable')])
    expect(inline('** not bold **')).toEqual([T('** not bold **')])
    expect(inline('*foo**bar*')).toEqual([I(T('foo**bar'))])
    expect(inline('**bold****more**')).toEqual([B(T('bold****more'))])
  })

  it('leaves unbalanced emphasis as text', () => {
    expect(inline('**unclosed')).toEqual([T('**unclosed')])
    expect(inline('unopened**')).toEqual([T('unopened**')])
    // Overlapping runs resolve the way CommonMark's delimiter algorithm does: inner pair first.
    expect(inline('*a **b* c**')).toEqual([I(T('a '), I(I(T('b')), T(' c')))])
    expect(inline('**a *b** c*')).toEqual([I(I(T('a '), I(T('b'))), T(' c'))])
    expect(inline('*a _b* c_')).toEqual([I(T('a _b')), T(' c_')])
    expect(inline('**a ~~b** c~~')).toEqual([B(T('a ~~b')), T(' c~~')])
    expect(inline('***a** b')).toEqual([T('*'), B(T('a')), T(' b')])
  })

  it('parses strikethrough with one or two tildes only', () => {
    expect(inline('~~gone~~ and ~gone~')).toEqual([S(T('gone')), T(' and '), S(T('gone'))])
    expect(inline('a ~~~not~~~ and ~~mismatch~')).toEqual([T('a ~~~not~~~ and ~~mismatch~')])
    expect(inline('~~a **b** c~~')).toEqual([S(T('a '), B(T('b')), T(' c'))])
  })

  it('parses code spans', () => {
    expect(inline('`code` and ``with ` tick`` and `` ` ``')).toEqual([C('code'), T(' and '), C('with ` tick'), T(' and '), C('`')])
    expect(inline('`**not bold** <b> &amp; \\`')).toEqual([C('**not bold** <b> &amp; \\')])
    expect(inline('`unclosed and ``mismatched')).toEqual([T('`unclosed and ``mismatched')])
    expect(inline('`a ``b` c')).toEqual([C('a ``b'), T(' c')])
    expect(inline('`multi\nline`')).toEqual([C('multi line')])
    expect(inline('`%APPDATA%\\Pelagix`')).toEqual([C('%APPDATA%\\Pelagix')])
  })

  it('parses inline links', () => {
    expect(inline('[text](https://example.com)')).toEqual([L('https://example.com/', T('text'))])
    expect(inline('[text](https://example.com/a "A title")')).toEqual([L('https://example.com/a', T('text'))])
    expect(inline("[text](<https://example.com/a b>)")).toEqual([T('text')])
    expect(inline('[text](<https://example.com/a>)')).toEqual([L('https://example.com/a', T('text'))])
    expect(inline('[wiki](https://en.wikipedia.org/wiki/Mew_(Pok%C3%A9mon))')).toEqual([L('https://en.wikipedia.org/wiki/Mew_(Pok%C3%A9mon)', T('wiki'))])
    expect(inline('[**bold** and `code`](https://example.com/)')).toEqual([L('https://example.com/', B(T('bold')), T(' and '), C('code'))])
    expect(inline('*[em link](https://example.com/)*')).toEqual([I(L('https://example.com/', T('em link')))])
  })

  it('keeps brackets that are not links', () => {
    expect(inline('[not a link] and [also] (not)')).toEqual([T('[not a link] and [also] (not)')])
    expect(inline('[a](')).toEqual([T('[a](')])
    expect(inline('[a](https://example.com')).toEqual([T('[a]('), L('https://example.com/', T('https://example.com'))])
    expect(inline(']]][[[')).toEqual([T(']]][[[')])
  })

  it('handles nested brackets', () => {
    expect(inline('[[inner]](https://example.com/)')).toEqual([L('https://example.com/', T('[inner]'))])
    // Links do not nest: the inner one wins, and what is left of the outer one is text (its URL is then a bare link, as on GitHub).
    expect(inline('[outer [inner](https://a.example/) text](https://b.example/)')).toEqual([
      T('[outer '),
      L('https://a.example/', T('inner')),
      T(' text]('),
      L('https://b.example/', T('https://b.example/')),
      T(')')
    ])
  })

  it('parses angle-bracket autolinks', () => {
    expect(inline('<https://example.com/path?q=1>')).toEqual([L('https://example.com/path?q=1', T('https://example.com/path?q=1'))])
  })

  it('links bare https URLs and trims trailing punctuation', () => {
    expect(inline('see https://example.com/a.')).toEqual([T('see '), L('https://example.com/a', T('https://example.com/a')), T('.')])
    expect(inline('(https://example.com/a)')).toEqual([T('('), L('https://example.com/a', T('https://example.com/a')), T(')')])
    expect(inline('https://en.wikipedia.org/wiki/Mew_(Pokemon)')).toEqual([L('https://en.wikipedia.org/wiki/Mew_(Pokemon)', T('https://en.wikipedia.org/wiki/Mew_(Pokemon)'))])
    expect(inline('https://example.com/a?b=1&amp;c=2, next')).toEqual([L('https://example.com/a?b=1&c=2', T('https://example.com/a?b=1&c=2')), T(', next')])
    expect(inline('**Full Changelog**: https://github.com/HydrosPlays/Pelagix/commits/v0.1.0')).toEqual([
      B(T('Full Changelog')),
      T(': '),
      L('https://github.com/HydrosPlays/Pelagix/commits/v0.1.0', T('https://github.com/HydrosPlays/Pelagix/commits/v0.1.0'))
    ])
    expect(inline('**https://example.com/**')).toEqual([B(L('https://example.com/', T('https://example.com/')))])
  })

  it('does not link a URL glued to a word, or inside a link or code', () => {
    expect(inline('xhttps://example.com')).toEqual([T('xhttps://example.com')])
    expect(inline('[https://a.example/](https://b.example/)')).toEqual([L('https://b.example/', T('https://a.example/'))])
    expect(inline('`https://example.com`')).toEqual([C('https://example.com')])
  })

  it('turns an image into an image node (rendered as a link, never loaded)', () => {
    expect(inline('![Screenshot](https://example.com/s.png)')).toEqual([IMG('https://example.com/s.png', 'Screenshot')])
    expect(inline('![](https://example.com/s.png)')).toEqual([IMG('https://example.com/s.png', '')])
    expect(inline('![alt *em*](https://example.com/s.png "t")')).toEqual([IMG('https://example.com/s.png', 'alt em')])
  })

  it('reduces an image inside a link to its text', () => {
    expect(inline('[![Badge](https://img.example/b.svg)](https://example.com/)')).toEqual([L('https://example.com/', T('Badge'))])
  })

  it('handles backslash escapes', () => {
    expect(inline('\\*not em\\* \\[not link\\](x) \\# \\\\ \\a')).toEqual([T('*not em* [not link](x) # \\ \\a')])
    expect(inline('\\<b\\> 1 \\< 2')).toEqual([T('<b> 1 < 2')])
  })

  it('decodes entities and leaves unknown ones alone', () => {
    expect(inline('&amp; &lt; &gt; &quot; &#39; &#x27; &copy; &nbsp;| &unknown; &#0; &#xD800; & alone')).toEqual([T('& < > " \' \' \u00a9 \u00a0| &unknown; \ufffd \ufffd & alone')])
    expect(inline('&lt;script&gt;alert(1)&lt;/script&gt;')).toEqual([T('<script>alert(1)</script>')])
  })

  it('shows raw HTML as literal text', () => {
    expect(inline('<b>bold</b> <kbd>Ctrl</kbd> a < b > c')).toEqual([T('<b>bold</b> <kbd>Ctrl</kbd> a < b > c')])
    expect(blocks('<details>\n<summary>More</summary>\n\nhidden\n\n</details>')).toEqual([P(T('<details>'), BR, T('<summary>More</summary>')), P(T('hidden')), P(T('</details>'))])
  })
})

// ---------------------------------------------------------------- GitHub references

describe('GitHub references', () => {
  it('leaves @mentions, #123 and commit hashes as plain text', () => {
    expect(inline('Thanks @HydrosPlays for #123, fixed in 1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b and GH-7')).toEqual([
      T('Thanks @HydrosPlays for #123, fixed in 1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b and GH-7')
    ])
  })

  it('shortens bare links into the same repository when told which one it is', () => {
    const opts = { repo: 'HydrosPlays/Pelagix' }
    expect(blocks('* Add updater by @HydrosPlays in https://github.com/HydrosPlays/Pelagix/pull/12', opts)).toEqual([
      UL(LI(P(T('Add updater by @HydrosPlays in '), L('https://github.com/HydrosPlays/Pelagix/pull/12', T('#12')))))
    ])
    expect(inline('https://github.com/hydrosplays/pelagix/issues/3 https://github.com/HydrosPlays/Pelagix/compare/v0.1.0...v0.2.0', opts)).toEqual([
      L('https://github.com/hydrosplays/pelagix/issues/3', T('#3')),
      T(' '),
      L('https://github.com/HydrosPlays/Pelagix/compare/v0.1.0...v0.2.0', T('v0.1.0...v0.2.0'))
    ])
    expect(inline('https://github.com/HydrosPlays/Pelagix/commit/1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b', opts)).toEqual([
      L('https://github.com/HydrosPlays/Pelagix/commit/1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b', T('1a2b3c4'))
    ])
    expect(inline('https://github.com/other/repo/pull/12', opts)).toEqual([L('https://github.com/other/repo/pull/12', T('https://github.com/other/repo/pull/12'))])
    expect(inline('[custom text](https://github.com/HydrosPlays/Pelagix/pull/12)', opts)).toEqual([L('https://github.com/HydrosPlays/Pelagix/pull/12', T('custom text'))])
  })
})

describe('typical release notes', () => {
  it("parses GitHub's generated notes", () => {
    const src = [
      '<!-- Release notes generated using configuration in .github/release.yml at main -->',
      '',
      "## What's Changed",
      '* Add an update check by @HydrosPlays in https://github.com/HydrosPlays/Pelagix/pull/4',
      '* Fix the shiny toggle by @someone-else in https://github.com/HydrosPlays/Pelagix/pull/5',
      '',
      '## New Contributors',
      '* @someone-else made their first contribution in https://github.com/HydrosPlays/Pelagix/pull/5',
      '',
      '**Full Changelog**: https://github.com/HydrosPlays/Pelagix/compare/v0.1.0...v0.2.0'
    ].join('\r\n')
    const pull = (n: number): Inline => L(`https://github.com/HydrosPlays/Pelagix/pull/${n}`, T(`#${n}`))
    expect(blocks(src, { repo: 'HydrosPlays/Pelagix' })).toEqual([
      H(2, T("What's Changed")),
      UL(LI(P(T('Add an update check by @HydrosPlays in '), pull(4))), LI(P(T('Fix the shiny toggle by @someone-else in '), pull(5)))),
      H(2, T('New Contributors')),
      UL(LI(P(T('@someone-else made their first contribution in '), pull(5)))),
      P(B(T('Full Changelog')), T(': '), L('https://github.com/HydrosPlays/Pelagix/compare/v0.1.0...v0.2.0', T('v0.1.0...v0.2.0')))
    ])
  })

  it('parses a hand-written changelog with sections, nesting and a wrapped item', () => {
    const src = [
      '### Added',
      '- **Updates.** Pelagix now checks for a new version',
      '  when it starts.',
      '  - Turn it off in *Settings → About*.',
      '- `Ctrl+U` opens the changelog.',
      '',
      '### Fixed',
      '1. Crash when the save is empty (#12).',
      '2. Typo in the Pokédex :tada:',
      '',
      '> [!IMPORTANT]',
      '> Back up `%APPDATA%\\Pelagix` first.'
    ].join('\n')
    expect(blocks(src)).toEqual([
      H(3, T('Added')),
      UL(
        LI(P(B(T('Updates.')), T(' Pelagix now checks for a new version'), BR, T('when it starts.')), UL(LI(P(T('Turn it off in '), I(T('Settings → About')), T('.'))))),
        LI(P(C('Ctrl+U'), T(' opens the changelog.')))
      ),
      H(3, T('Fixed')),
      OL(1, LI(P(T('Crash when the save is empty (#12).'))), LI(P(T('Typo in the Pokédex :tada:')))),
      { t: 'quote', kind: 'important', c: [P(T('Back up '), C('%APPDATA%\\Pelagix'), T(' first.'))] }
    ])
  })

  it('leaves footnotes and emoji shortcodes as plain text', () => {
    expect(blocks('Done[^1] :rocket:\n\n[^1]: A note.')).toEqual([P(T('Done[^1] :rocket:')), P(T('[^1]: A note.'))])
  })
})

// ---------------------------------------------------------------- security

describe('safeHref', () => {
  it('accepts absolute https URLs and normalises them', () => {
    expect(safeHref('https://example.com')).toBe('https://example.com/')
    expect(safeHref('HTTPS://EXAMPLE.COM/Path?q=1#frag')).toBe('https://example.com/Path?q=1#frag')
    expect(safeHref('https://github.com/HydrosPlays/Pelagix/releases/tag/v0.2.0')).toBe('https://github.com/HydrosPlays/Pelagix/releases/tag/v0.2.0')
    expect(safeHref('https://example.com/caf\u00e9')).toBe('https://example.com/caf%C3%A9')
    expect(safeHref('https://\u0440\u0430ypal.com/')).toBe('https://xn--ypal-43d9g.com/')
  })

  const refused: [string, string][] = [
    ['empty', ''],
    ['http', 'http://example.com/'],
    ['javascript', 'javascript:alert(1)'],
    ['javascript, mixed case', 'JaVaScRiPt:alert(1)'],
    ['javascript, leading space', ' javascript:alert(1)'],
    ['javascript, leading tab', '\tjavascript:alert(1)'],
    ['javascript, tab inside the scheme', 'java\tscript:alert(1)'],
    ['javascript, newline inside the scheme', 'java\nscript:alert(1)'],
    ['javascript, leading control character', '\u0001javascript:alert(1)'],
    ['javascript with an https look-alike path', 'javascript://https://example.com/%0Aalert(1)'],
    ['data', 'data:text/html,<script>alert(1)</script>'],
    ['data, base64', 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='],
    ['vbscript', 'vbscript:msgbox(1)'],
    ['file', 'file:///C:/Windows/System32/calc.exe'],
    ['UNC path', '\\\\evil.example\\share\\x.exe'],
    ['custom protocol', 'ms-msdt:/id PCWDiagnostic'],
    ['custom protocol without spaces', 'search-ms:query=x'],
    ['mailto', 'mailto:someone@example.com'],
    ['blob', 'blob:https://example.com/uuid'],
    ['view-source', 'view-source:https://example.com/'],
    ['relative path', 'docs/README.md'],
    ['absolute path', '/HydrosPlays/Pelagix'],
    ['fragment', '#top'],
    ['protocol-relative', '//evil.example/'],
    ['https without slashes', 'https:evil.example'],
    ['https with one slash', 'https:/evil.example'],
    ['https with backslashes', 'https:\\\\evil.example\\'],
    ['backslash in the authority', 'https://github.com\\@evil.example/'],
    ['credentials', 'https://github.com@evil.example/'],
    ['user and password', 'https://user:pass@example.com/'],
    ['space inside', 'https://example.com/a b'],
    ['newline inside', 'https://example.com/\nfoo'],
    ['tab inside', 'https://exam\tple.com/'],
    ['no host', 'https://'],
    ['no host, path only', 'https:///path'],
    ['no host, query only', 'https://?x'],
    ['empty user', 'https://@evil.example/'],
    ['empty user and password', 'https://:@evil.example/'],
    ['encoded at sign in the host', 'https://github.com%40evil.example/'],
    ['too long', `https://example.com/${'a'.repeat(MAX_URL_LENGTH)}`]
  ]
  for (const [name, url] of refused) {
    it(`refuses ${name}`, () => {
      expect(safeHref(url)).toBeNull()
    })
  }

  it('refuses a URL that only becomes too long once it is encoded', () => {
    const url = `https://example.com/${'\u00e9'.repeat(400)}`
    expect(url.length).toBeLessThan(MAX_URL_LENGTH)
    expect(safeHref(url)).toBeNull()
  })

  it('refuses values that are not strings', () => {
    expect(safeHref(undefined as unknown as string)).toBeNull()
    expect(safeHref({ toString: () => 'https://example.com/' } as unknown as string)).toBeNull()
  })
})

describe('hostile links', () => {
  const dropped: [string, string, Inline[]][] = [
    ['javascript:', '[click](javascript:alert(1))', [T('click')]],
    ['mixed case', '[click](JaVaScRiPt:alert(1))', [T('click')]],
    ['entity for the colon', '[click](javascript&colon;alert(1))', [T('click')]],
    ['numeric entities', '[click](&#106;avascript&#58;alert(1))', [T('click')]],
    ['hex entities', '[click](&#x6A;avascript&#x3A;alert(1))', [T('click')]],
    ['entity tab inside the scheme', '[click](java&Tab;script:alert(1))', [T('click')]],
    ['entity newline inside the scheme', '[click](java&NewLine;script:alert(1))', [T('click')]],
    ['backslash escapes', '[click](javascript\\:alert\\(1\\))', [T('click')]],
    ['angle brackets with spaces', '[click](<javascript:alert(1) >)', [T('click')]],
    ['data:', '[click](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)', [T('click')]],
    ['vbscript:', '[click](vbscript:msgbox(1))', [T('click')]],
    ['file:', '[click](file:///C:/Windows/System32/calc.exe)', [T('click')]],
    ['http:', '[click](http://example.com/)', [T('click')]],
    ['mailto:', '[mail](mailto:a@example.com)', [T('mail')]],
    ['relative', '[README](README.md)', [T('README')]],
    ['fragment', '[top](#top)', [T('top')]],
    ['protocol-relative', '[click](//evil.example/)', [T('click')]],
    ['credentials', '[github.com](https://github.com@evil.example/)', [T('github.com')]],
    ['empty destination', '[click]()', [T('click')]],
    ['javascript: image', '![alt](javascript:alert(1))', [T('alt')]],
    ['data: image', '![alt](data:image/svg+xml;base64,PHN2Zz4=)', [T('alt')]],
    ['http image (tracking pixel)', '![alt](http://tracker.example/p.gif)', [T('alt')]],
    ['javascript: autolink', '<javascript:alert(1)>', [T('javascript:alert(1)')]],
    ['http autolink', '<http://example.com/>', [T('http://example.com/')]],
    ['mailto autolink', '<mailto:a@example.com>', [T('mailto:a@example.com')]],
    ['bare http URL', 'http://example.com/', [T('http://example.com/')]],
    ['keeps formatting of a dropped link', '[**bold** text](javascript:alert(1))', [B(T('bold')), T(' text')]]
  ]
  for (const [name, src, expected] of dropped) {
    it(`drops the link: ${name}`, () => {
      expect(inline(src)).toEqual(expected)
      expect(hrefs(src)).toEqual([])
    })
  }

  it('never lets a tab or newline in a destination through', () => {
    // Not a link at all; the URL that is visible in the text is then linked as itself.
    expect(inline('[a](https://example.com/\tx)')).toEqual([T('[a]('), L('https://example.com/', T('https://example.com/')), T('\tx)')])
    expect(hrefs('[a](java\tscript:alert(1))')).toEqual([])
    expect(hrefs('[a](\njavascript:alert(1)\n)')).toEqual([])
  })

  it('emits only https hrefs for a mixed bag of payloads', () => {
    const src = [
      '[a](javascript:alert(1)) [b](https://ok.example/1) ![c](data:x) <https://ok.example/2> <vbscript:x>',
      '[d]: javascript:alert(1)',
      '[e]: https://ok.example/3',
      '[d] [e] https://ok.example/4 http://no.example/ [f](HTTPS://OK.EXAMPLE/5)',
      '| [g](file:///x) | [h](https://ok.example/6) |\n| --- | --- |\n| ![k](https://ok.example/7.png) | [l](data:x) |',
      '> - [i](https://ok.example/8 "t") [j](\\javascript:alert(1))'
    ].join('\n\n')
    const all = hrefs(src)
    expect(all).toEqual([
      'https://ok.example/1',
      'https://ok.example/2',
      'https://ok.example/3',
      'https://ok.example/4',
      'https://ok.example/5',
      'https://ok.example/6',
      'https://ok.example/7.png',
      'https://ok.example/8'
    ])
    for (const href of all) expect(href.startsWith('https://')).toBe(true)
  })

  it('keeps a spoofed label but the real destination is what the node carries', () => {
    expect(inline('[https://github.com/HydrosPlays/Pelagix](https://evil.example/)')).toEqual([L('https://evil.example/', T('https://github.com/HydrosPlays/Pelagix'))])
  })

  it('never nests a link inside a link', () => {
    const out = inline('[a [b](https://b.example/) c](https://a.example/) [![i](https://i.example/x.png)](https://l.example/)')
    const nested = (nodes: Inline[], inside: boolean): boolean =>
      nodes.some((n) => {
        if (n.t === 'link') return inside || nested(n.c, true)
        if (n.t === 'image') return inside
        if (n.t === 'strong' || n.t === 'em' || n.t === 'del') return nested(n.c, inside)
        return false
      })
    expect(nested(out, false)).toBe(false)
  })
})

describe('HTML injection', () => {
  const payloads = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<a href="javascript:alert(1)">click</a>',
    '<iframe src="https://evil.example/"></iframe>',
    '<svg/onload=alert(1)>',
    '<style>*{display:none}</style>',
    '<math><mi//xlink:href="data:x,<script>alert(1)</script>">',
    '"><script>alert(1)</script>',
    '<ScRiPt src=https://evil.example/x.js></ScRiPt>',
    '<body onload=alert(1)>',
    '<input autofocus onfocus=alert(1)>',
    '<meta http-equiv="refresh" content="0;url=https://evil.example/">'
  ]
  for (const payload of payloads) {
    it(`keeps ${payload} as text`, () => {
      const doc = parseMarkdown(payload)
      expect(doc.blocks).toEqual([P(T(payload))])
      expect(hrefs(payload)).toEqual([])
    })
  }

  it('keeps HTML inside every container as text', () => {
    expect(blocks('# <script>x</script>\n\n- <img src=x onerror=alert(1)>\n\n> <b>q</b>\n\n| <i>h</i> |\n| --- |\n| <u>c</u> |')).toEqual([
      H(1, T('<script>x</script>')),
      UL(LI(P(T('<img src=x onerror=alert(1)>')))),
      Q(P(T('<b>q</b>'))),
      { t: 'table', align: [null], head: [[T('<i>h</i>')]], rows: [[[T('<u>c</u>')]]] }
    ])
  })

  it('has no node type that could carry markup', () => {
    const kinds = new Set<string>()
    const visit = (v: unknown): void => {
      if (Array.isArray(v)) v.forEach(visit)
      else if (typeof v === 'object' && v !== null) {
        const t = (v as { t?: unknown }).t
        if (typeof t === 'string') kinds.add(t)
        Object.values(v).forEach(visit)
      }
    }
    visit(parseMarkdown('# h\n\np **b** *i* ~~s~~ `c` [l](https://e.example/) ![i](https://e.example/i.png)<br>x\n\n- [x] t\n\n1. o\n\n> q\n\n---\n\n```\nc\n```\n\n|a|\n|-|\n|b|').blocks)
    expect([...kinds].sort()).toEqual(['br', 'code', 'del', 'em', 'heading', 'image', 'link', 'list', 'paragraph', 'quote', 'rule', 'strong', 'table', 'text'])
  })
})

describe('invisible and control characters', () => {
  it('replaces NUL and strips other control characters', () => {
    expect(inline('a\u0000b\u0007c\u001bd\u007fe\u0085f')).toEqual([T('a\ufffdbcdef')])
  })

  it('strips bidirectional overrides, written raw or as entities', () => {
    expect(inline('safe\u202egpj.exe\u202c \u2066x\u2069 &#x202E;y&#8238;z')).toEqual([T('safegpj.exe x yz')])
  })

  it('strips a byte order mark', () => {
    expect(blocks('\ufeff# Title')).toEqual([H(1, T('Title'))])
  })

  it('handles tabs as indentation', () => {
    expect(blocks('-\titem\n\ntext\n\n\tcode\n\t\tdeeper')).toEqual([UL(LI(P(T('item')))), P(T('text')), CODE('code\n    deeper')])
    expect(blocks('- one\n\t- inner')).toEqual([UL(LI(P(T('one')), UL(LI(P(T('inner'))))))])
  })
})

// ---------------------------------------------------------------- limits

describe('limits', () => {
  it('cuts input at maxLength, on a line boundary when one is near, and says so', () => {
    const doc = parseMarkdown(`${'word '.repeat(10)}\n\n${'x'.repeat(500)}`, { maxLength: 100 })
    expect(doc.truncated).toBe(true)
    expect(doc.blocks).toEqual([P(T('word '.repeat(10).trim()))])
    expect(parseMarkdown('short', { maxLength: 100 }).truncated).toBe(false)
  })

  it('does not split a surrogate pair when cutting', () => {
    const doc = parseMarkdown('ab\ud83d\ude00cd', { maxLength: 3 })
    expect(doc).toEqual({ blocks: [P(T('ab'))], truncated: true })
  })

  it('stops at maxNodes', () => {
    const doc = parseMarkdown('*a* '.repeat(5000), { maxNodes: 200 })
    expect(doc.truncated).toBe(true)
    expect(JSON.stringify(doc).length).toBeLessThan(20_000)
  })

  it('flattens lists nested deeper than maxBlockDepth', () => {
    let src = ''
    for (let d = 0; d < 200; d++) src += `${'  '.repeat(d)}- level ${d}\n`
    const doc = parseMarkdown(src)
    expect(depthOf(doc.blocks)).toBeLessThan(40)
    expect(JSON.stringify(doc)).toContain('level 199')
  })

  it('flattens quotes nested deeper than maxBlockDepth', () => {
    const doc = parseMarkdown(`${'> '.repeat(500)}deep`)
    expect(depthOf(doc.blocks)).toBeLessThan(40)
    expect(JSON.stringify(doc)).toContain('deep')
  })

  it('caps emphasis nesting at maxInlineDepth', () => {
    const k = 400
    const doc = parseMarkdown(`${'*_'.repeat(k)}x${'_*'.repeat(k)}`)
    expect(depthOf(doc.blocks)).toBeLessThan(60)
    expect(JSON.stringify(doc)).toContain('"x"')
  })

  it('caps link nesting inside emphasis the same way', () => {
    const k = 50
    const doc = parseMarkdown(`[${'*_'.repeat(k)}x${'_*'.repeat(k)}](https://example.com/)`)
    expect(depthOf(doc.blocks)).toBeLessThan(60)
    expect(hrefs(`[${'*_'.repeat(k)}x${'_*'.repeat(k)}](https://example.com/)`)).toEqual(['https://example.com/'])
  })

  it('refuses a table wider than 32 columns and caps rows at 500', () => {
    const wide = `${'| h '.repeat(33)}|\n${'| - '.repeat(33)}|\n${'| c '.repeat(33)}|`
    expect(blocks(wide).every((b) => b.t !== 'table')).toBe(true)
    const tall = `| a | b |\n| - | - |\n${'| 1 | 2 |\n'.repeat(2000)}`
    const doc = parseMarkdown(tall)
    const table = doc.blocks[0] as Block
    expect(table.t === 'table' && table.rows.length).toBe(500)
    expect(doc.truncated).toBe(true)
  })

  it('refuses an over-long link destination', () => {
    expect(hrefs(`[a](https://example.com/${'a'.repeat(3000)})`)).toEqual([])
    expect(hrefs(`https://example.com/${'a'.repeat(3000)}`)).toEqual([])
  })
})

/** Inputs built to hit the worst case of each scanner. Each is 200 000 characters. */
const N = 200_000
const fill = (unit: string): string => unit.repeat(Math.ceil(N / unit.length)).slice(0, N)
const HOSTILE: Record<string, string> = {
  'open brackets': fill('['),
  'close brackets': fill(']'),
  'nested brackets': '['.repeat(N / 2) + ']'.repeat(N / 2),
  'bracket pairs': fill('[]'),
  'unclosed link destinations': fill('[a]('),
  'link destinations to the end': fill('[](a'),
  'nested parentheses in a destination': `[a](${'('.repeat(N - 6)})`,
  'image openers': fill('!['),
  'stars': fill('*'),
  'star openers': fill('*a '),
  'star closers': fill('a* '),
  'alternating emphasis': fill('*a_b'),
  'deep emphasis': '*_'.repeat(N / 4) + 'x' + '_*'.repeat(N / 4),
  'emphasis pairs': fill('*a*'),
  'triple runs': fill('***a'),
  'underscores': fill('_'),
  'tildes': fill('~a~~b'),
  'backticks of growing length': (() => {
    let s = ''
    for (let k = 1; s.length < N; k++) s += `${'`'.repeat(k)}a`
    return s.slice(0, N)
  })(),
  'single backticks': fill('`a'),
  'angle brackets': fill('<'),
  'unclosed autolinks': fill('<https://a'),
  'unclosed comments': fill('<!--'),
  'unclosed comment lines': fill('<!-- a\n'),
  'ampersands': fill('&'),
  'unterminated entities': fill('&#x1F600'),
  'backslashes': fill('\\'),
  'bare URLs without spaces': fill('https://a'),
  'bare URL with trailing parentheses': `https://example.com/${')'.repeat(N - 20)}`,
  'bare URL with trailing punctuation': `https://example.com/${'.'.repeat(N - 20)}`,
  'http prefixes': fill('http'),
  'pipes': fill('|'),
  'wide table': `${fill('| a ').slice(0, 1000)}\n${fill('| - ').slice(0, 1000)}\n${fill('| a ')}`,
  'tall table': `| a | b |\n| - | - |\n${fill('| 1 | 2 |\n')}`,
  'table delimiter look-alikes': fill('a|b\n-|-\n'),
  'delimiter row of colons and dashes': fill(':-'),
  'deep list': (() => {
    let s = ''
    for (let d = 0; s.length < N; d++) s += `${' '.repeat(d * 2)}- x\n`
    return s.slice(0, N)
  })(),
  'list markers': fill('- '),
  'list items': fill('- a\n'),
  'ordered markers': fill('1. 1. '),
  'deep quotes': fill('> '),
  'quote lines': fill('> a\n'),
  'quoted lists': fill('> - > - '),
  'hashes': fill('#'),
  'heading lines': fill('# a\n'),
  'fences': fill('```\n'),
  'tilde fence openers': fill('~~~a\n'),
  'reference definitions': fill('[a]: https://example.com/a\n'),
  'definition look-alikes': `[a]: ${fill('x')} "unclosed`,
  'reference lookups': `[a]: https://example.com/\n\n${'['.repeat(N / 2)}a${']'.repeat(N / 2)}`,
  'blank lines': fill('\n'),
  'spaces': fill(' '),
  'tabs': fill('\t'),
  'one long word': fill('a'),
  'one long line of prose': fill('lorem ipsum '),
  'carriage returns': fill('\r'),
  'setext underlines': fill('a\n=\n'),
  'rules': fill('---\n'),
  'null characters': fill('\u0000'),
  'bidi overrides': fill('\u202e'),
  'html tags': fill('<b>'),
  'br tags': fill('<br>'),
  'entities': fill('&amp;'),
  'links': fill('[a](https://example.com/) '),
  'images': fill('![a](https://example.com/a.png) '),
  'javascript links': fill('[a](javascript:alert(1)) '),
  'task items': fill('- [x] a\n'),
  'emoji': fill('\ud83d\ude00*'),
  'mixed soup': fill('*_[`<&\\~|>#-!]()')
}

describe('hostile input stays fast', () => {
  for (const [name, src] of Object.entries(HOSTILE)) {
    it(`${name} (${src.length} chars)`, () => {
      // 200 kB handed straight to the parser with the length cap lifted: the algorithms themselves must stay linear.
      for (const breaks of [true, false]) {
        const started = performance.now()
        const doc = parseMarkdown(src, { maxLength: 1_000_000, breaks })
        const ms = performance.now() - started
        expect(ms).toBeLessThan(1500)
        expect(depthOf(doc.blocks)).toBeLessThan(80)
      }
      // Even with the node cap lifted as well, so that nothing ends the work early.
      const started = performance.now()
      parseMarkdown(src, { maxLength: 1_000_000, maxNodes: 100_000_000 })
      expect(performance.now() - started).toBeLessThan(3000)
      // And with the defaults the result is small enough to render.
      const capped = parseMarkdown(src)
      expect(capped.truncated).toBe(true)
      expect(JSON.stringify(capped).length).toBeLessThan(2_500_000)
    })
  }
})

// ---------------------------------------------------------------- the real thing

describe('the published v0.1.0 release notes', () => {
  // GitHub serves the description with CRLF line endings; the copy in the repository is stored with LF.
  const body = v010Body.replace(/\r?\n/g, '\r\n')
  const doc = parseMarkdown(body, { repo: 'HydrosPlays/Pelagix' })

  it('parses the same with CRLF and with LF line endings', () => {
    expect(body.includes('\r\n')).toBe(true)
    expect(parseMarkdown(body.replace(/\r\n/g, '\n'), { repo: 'HydrosPlays/Pelagix' })).toEqual(doc)
  })

  it('parses into the expected outline', () => {
    expect(doc.truncated).toBe(false)
    expect(doc.blocks.map((b) => (b.t === 'heading' ? `h${b.level}:${(b.c[0] as { v: string }).v}` : b.t))).toEqual([
      'paragraph',
      'paragraph',
      'h2:Download',
      'paragraph',
      'table',
      'paragraph',
      "h2:What's in it",
      'list',
      'h2:Before you run it',
      'list',
      'h2:Known limitations',
      'list',
      'paragraph',
      'h2:Credits',
      'paragraph',
      'paragraph',
      'paragraph',
      'paragraph'
    ])
  })

  it('has the download table', () => {
    expect(doc.blocks[4]).toEqual({
      t: 'table',
      align: [null, null],
      head: [[T('File')], [T('What it is')]],
      rows: [
        [[C('Pelagix-0.1.0-setup.exe')], [T('Installer. Lets you choose the install folder.')]],
        [[C('Pelagix-0.1.0-portable.exe')], [T('Single file that runs without installing.')]]
      ]
    })
  })

  it('has tight lists of 9, 3 and 5 items', () => {
    const lists = doc.blocks.filter((b) => b.t === 'list')
    expect(lists.map((l) => (l.t === 'list' ? [l.ordered, l.tight, l.items.length] : null))).toEqual([
      [false, true, 9],
      [false, true, 3],
      [false, true, 5]
    ])
  })

  it('keeps bold, italic and code inside list items, including code inside bold with a backslash', () => {
    const before = doc.blocks[9]
    if (before?.t !== 'list') throw new Error('expected a list')
    expect(before.items[0]?.c).toEqual([
      P(B(T('The build is not code-signed.')), T(' Windows SmartScreen will warn the first time ("Windows protected your PC"). Choose '), I(T('More info')), T(', then '), I(T('Run anyway')), T('.'))
    ])
    expect((before.items[2]?.c[0] as { c: Inline[] }).c[0]).toEqual(B(T('Your data is stored in '), C('%APPDATA%\\Pelagix')))
  })

  it('finds exactly the four links', () => {
    expect(hrefs(body)).toEqual(['https://github.com/kwsch/PKHeX', 'https://pokeapi.co/', 'https://github.com/PokeAPI/sprites', 'https://github.com/HydrosPlays/Pelagix/commits/v0.1.0'])
  })

  it('ends with the Full Changelog line as bold text and a bare link', () => {
    expect(doc.blocks[doc.blocks.length - 1]).toEqual(
      P(B(T('Full Changelog')), T(': '), L('https://github.com/HydrosPlays/Pelagix/commits/v0.1.0', T('https://github.com/HydrosPlays/Pelagix/commits/v0.1.0')))
    )
  })
})
