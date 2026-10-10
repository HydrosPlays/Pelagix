import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { parseMarkdown, safeHref, type Block, type Inline } from './markdown'
import { renderMarkdown } from './render'

/** Deterministic PRNG, so a failure can be reproduced from its seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const TOKENS = [
  '*', '**', '***', '_', '__', '~', '~~', '~~~', '`', '``', '```', '[', ']', '(', ')', '![', '](', ')[', '<', '>', '<!--', '-->', '<br>', '&', '&amp;', '&#x3A;', '&colon;', '&Tab;', '\\', '\\\n',
  '\n', '\n\n', '  \n', '\t', ' ', '    ', '- ', '* ', '+ ', '1. ', '2) ', '> ', '# ', '## ', '---', '===', '|', '| - |', ':-:', '- [ ] ', '- [x] ', '[!NOTE]', '[a]: ', '[a]', '[a][a]',
  'https://ok.example/p', 'https://ok.example/(x)', 'http://plain.example/', 'javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,x', 'vbscript:x', 'file:///c:/x', '//evil.example', 'https:evil.example',
  'https://u:p@evil.example/', 'mailto:a@b.example', '<script>alert(1)</script>', '<img src=x onerror=alert(1)>', '" onclick="alert(1)', "' onfocus='alert(1)", 'word', 'two words', 'Pok\u00e9mon', '\ud83d\ude00', '\u202e', '\u0000', '@user', '#12',
  '.', ',', '!', '?', ':', ';', '"', "'"
]

function randomDoc(rand: () => number): string {
  const count = 1 + Math.floor(rand() * 120)
  let out = ''
  for (let i = 0; i < count; i++) out += TOKENS[Math.floor(rand() * TOKENS.length)] as string
  return out
}

const ALLOWED_TAGS = new Set(['a', 'blockquote', 'br', 'code', 'del', 'div', 'em', 'h3', 'h4', 'h5', 'h6', 'hr', 'input', 'li', 'ol', 'p', 'pre', 'span', 'strong', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'ul'])

function check(src: string): void {
  const doc = parseMarkdown(src)
  // Deterministic, and plain data.
  expect(JSON.parse(JSON.stringify(doc))).toEqual(doc)
  expect(parseMarkdown(src)).toEqual(doc)

  const hrefs: string[] = []
  let maxDepth = 0
  const inl = (nodes: Inline[], depth: number): void => {
    if (depth > maxDepth) maxDepth = depth
    for (const n of nodes) {
      if (n.t === 'link') {
        hrefs.push(n.href)
        // A link never contains a link or an image.
        const flat = JSON.stringify(n.c)
        expect(flat.includes('"t":"link"') || flat.includes('"t":"image"')).toBe(false)
        inl(n.c, depth + 1)
      } else if (n.t === 'image') hrefs.push(n.href)
      else if (n.t === 'strong' || n.t === 'em' || n.t === 'del') inl(n.c, depth + 1)
      else if (n.t === 'text') expect(n.v.length).toBeGreaterThan(0)
    }
  }
  const blk = (list: Block[], depth: number): void => {
    if (depth > maxDepth) maxDepth = depth
    for (const b of list) {
      if (b.t === 'paragraph' || b.t === 'heading') inl(b.c, depth + 1)
      else if (b.t === 'quote') blk(b.c, depth + 1)
      else if (b.t === 'list') for (const item of b.items) blk(item.c, depth + 1)
      else if (b.t === 'table') {
        expect(b.head.length).toBe(b.align.length)
        b.head.forEach((c) => inl(c, depth + 1))
        for (const row of b.rows) {
          expect(row.length).toBe(b.align.length)
          row.forEach((c) => inl(c, depth + 1))
        }
      }
    }
  }
  blk(doc.blocks, 0)
  expect(maxDepth).toBeLessThanOrEqual(6 + 1 + 12 + 1)
  for (const href of hrefs) {
    expect(href.startsWith('https://')).toBe(true)
    expect(safeHref(href)).toBe(href)
  }

  const markup = renderToStaticMarkup(renderMarkdown(doc))
  for (const m of markup.matchAll(/<([a-zA-Z][a-zA-Z0-9]*)/g)) expect(ALLOWED_TAGS.has(m[1] as string)).toBe(true)
  // React escapes & < > " ' in attribute values; undo that to compare with the AST.
  const unescape = (s: string): string => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&')
  const rendered = [...markup.matchAll(/ href="([^"]*)"/g)].map((m) => unescape(m[1] as string))
  expect(rendered).toEqual(hrefs)
  expect(markup).not.toMatch(/<[^>]*\son[a-z]+=/i)
}

describe('fuzz', () => {
  it('holds its invariants on 4000 random documents built from Markdown and attack fragments', () => {
    const rand = mulberry32(20261009)
    for (let i = 0; i < 4000; i++) {
      const src = randomDoc(rand)
      try {
        check(src)
      } catch (err) {
        throw new Error(`failed on document ${i}: ${JSON.stringify(src)}\n${String(err)}`)
      }
    }
  })

  it('holds its invariants on 2000 random documents of raw characters', () => {
    const rand = mulberry32(42)
    const alphabet = '*_~`[]()<>!&\\#-+|:;="\'/ \n\n\tabhtps.x1'
    for (let i = 0; i < 2000; i++) {
      let src = ''
      const len = Math.floor(rand() * 300)
      for (let k = 0; k < len; k++) src += alphabet[Math.floor(rand() * alphabet.length)] as string
      try {
        check(src)
      } catch (err) {
        throw new Error(`failed on document ${i}: ${JSON.stringify(src)}\n${String(err)}`)
      }
    }
  })

  it('parses time roughly in proportion to length', () => {
    const rand = mulberry32(7)
    let unit = ''
    while (unit.length < 2000) unit += randomDoc(rand)
    const time = (text: string): number => {
      let best = Infinity
      for (let k = 0; k < 5; k++) {
        const t = performance.now()
        parseMarkdown(text, { maxLength: 10_000_000, maxNodes: 100_000_000 })
        best = Math.min(best, performance.now() - t)
      }
      return best
    }
    const small = time(unit.repeat(25))
    const large = time(unit.repeat(200))
    // Eight times the input; a quadratic parser would take 64 times as long.
    expect(large / Math.max(small, 0.05)).toBeLessThan(24)
  })
})
