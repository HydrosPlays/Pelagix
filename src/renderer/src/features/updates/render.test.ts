import v010Body from './fixtures/v0.1.0.body.md?raw'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { parseMarkdown, type MdDoc } from './markdown'
import { renderMarkdown } from './render'

const html = (src: string): string => renderToStaticMarkup(renderMarkdown(parseMarkdown(src, { repo: 'HydrosPlays/Pelagix' })))

/** Every tag name and every attribute in a piece of rendered HTML. */
function inventory(markup: string): { tags: Set<string>; attrs: Set<string>; hrefs: string[] } {
  const tags = new Set<string>()
  const attrs = new Set<string>()
  const hrefs: string[] = []
  for (const m of markup.matchAll(/<([a-z0-9]+)((?:\s+[a-z-]+(?:="[^"]*")?)*)\s*\/?>/g)) {
    tags.add(m[1] as string)
    for (const a of (m[2] as string).matchAll(/([a-z-]+)(?:="([^"]*)")?/g)) {
      attrs.add(a[1] as string)
      if (a[1] === 'href') hrefs.push(a[2] as string)
    }
  }
  return { tags, attrs, hrefs }
}

const ALLOWED_TAGS = ['a', 'blockquote', 'br', 'code', 'del', 'div', 'em', 'h3', 'h4', 'h5', 'h6', 'hr', 'input', 'li', 'ol', 'p', 'pre', 'span', 'strong', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'ul']
const ALLOWED_ATTRS = ['aria-label', 'checked', 'class', 'disabled', 'href', 'readonly', 'rel', 'scope', 'start', 'target', 'title', 'type']

describe('renderMarkdown', () => {
  it('renders every construct with the expected elements', () => {
    expect(html('# Title\n\nText with **bold**, *em*, ~~del~~, `code` and [a link](https://example.com/x).')).toBe(
      '<div class="upd-md u-selectable"><h3 class="upd-md-h upd-md-h1">Title</h3><p>Text with <strong>bold</strong>, <em>em</em>, <del>del</del>, <code class="upd-md-code">code</code> and ' +
        '<a class="upd-md-link" href="https://example.com/x" title="https://example.com/x" target="_blank" rel="noopener noreferrer">a link</a>.</p></div>'
    )
    expect(html('- one\n- two')).toBe('<div class="upd-md u-selectable"><ul><li><span class="upd-md-item-text">one</span></li><li><span class="upd-md-item-text">two</span></li></ul></div>')
    expect(html('3. three\n\n4. four')).toBe('<div class="upd-md u-selectable"><ol start="3"><li><p>three</p></li><li><p>four</p></li></ol></div>')
    expect(html('- [x] done\n- [ ] todo')).toBe(
      '<div class="upd-md u-selectable"><ul><li class="upd-md-task"><input type="checkbox" disabled="" readOnly="" aria-label="Done" checked=""/><span class="upd-md-item-text">done</span></li>' +
        '<li class="upd-md-task"><input type="checkbox" disabled="" readOnly="" aria-label="Not done"/><span class="upd-md-item-text">todo</span></li></ul></div>'
    )
    expect(html('> [!WARNING]\n> careful')).toBe('<div class="upd-md u-selectable"><blockquote class="upd-md-alert upd-md-alert-warning"><p>careful</p></blockquote></div>')
    expect(html('```js\nlet a = "<b>"\n```\n\n---')).toBe('<div class="upd-md u-selectable"><pre class="upd-md-pre"><code>let a = &quot;&lt;b&gt;&quot;</code></pre><hr/></div>')
    expect(html('| a | b |\n| :- | -: |\n| 1 | 2 |')).toBe(
      '<div class="upd-md u-selectable"><div class="upd-md-table-wrap"><table><thead><tr><th class="upd-md-left" scope="col">a</th><th class="upd-md-right" scope="col">b</th></tr></thead>' +
        '<tbody><tr><td class="upd-md-left">1</td><td class="upd-md-right">2</td></tr></tbody></table></div></div>'
    )
    expect(html('one\ntwo')).toBe('<div class="upd-md u-selectable"><p>one<br/>two</p></div>')
    expect(html('![Shot](https://example.com/s.png)')).toBe(
      '<div class="upd-md u-selectable"><p><a class="upd-md-link upd-md-image" href="https://example.com/s.png" title="https://example.com/s.png" target="_blank" rel="noopener noreferrer">Shot</a></p></div>'
    )
  })

  it('escapes raw HTML: nothing the document says becomes a tag', () => {
    const out = html('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n# <iframe src="https://evil.example/">\n\n`<svg onload=alert(1)>`\n\n```\n</code></pre><script>alert(2)</script>\n```')
    expect(out).not.toMatch(/<script|<img|<iframe|<svg/i)
    expect(out).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(out).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(out).toContain('&lt;/code&gt;&lt;/pre&gt;&lt;script&gt;alert(2)&lt;/script&gt;')
  })

  it('cannot be made to emit an attribute through a link label, title, language or alt text', () => {
    const out = html('[x" onmouseover="alert(1)](https://example.com/ "t\\" onclick=\\"alert(1)")\n\n![a" onerror="alert(1)](https://example.com/i.png)\n\n```js" onload="alert(1)\ncode\n```')
    const { attrs } = inventory(out)
    expect([...attrs].filter((a) => a.startsWith('on'))).toEqual([])
    expect(out).toContain('x&quot; onmouseover=&quot;alert(1)')
  })

  it('emits only allowed tags and attributes, and only https hrefs, for a hostile document', () => {
    const src = [
      '[a](javascript:alert(1)) [b](JAVASCRIPT:alert(1)) [c](data:text/html,x) [d](vbscript:x) [e](file:///c:/x) [f](//evil.example) [g](http://plain.example/)',
      '[h](java&Tab;script:alert(1)) [i](&#x6A;avascript:alert(1)) [j](javascript&colon;alert(1)) [k](<javascript:alert(1)>) [l](https://github.com@evil.example/)',
      '<javascript:alert(1)> <data:text/html,x> ![m](javascript:alert(1)) [![n](data:x)](javascript:x)',
      '[o]: javascript:alert(1)\n\n[o] [ok](https://ok.example/1) <https://ok.example/2> https://ok.example/3 ![p](https://ok.example/4.png)',
      '<a href="javascript:alert(1)">x</a> <form action="https://evil.example/"><input name=q></form> <base href="https://evil.example/">',
      '| <script>1</script> | [q](javascript:1) |\n| - | - |\n| <style>*{}</style> | <object data=x> |',
      '> <meta http-equiv=refresh content="0;url=https://evil.example/">',
      '- <link rel=stylesheet href=https://evil.example/x.css>'
    ].join('\n\n')
    const out = html(src)
    const { tags, attrs, hrefs } = inventory(out)
    for (const tag of tags) expect(ALLOWED_TAGS).toContain(tag)
    for (const attr of attrs) expect(ALLOWED_ATTRS).toContain(attr)
    expect(hrefs).toEqual(['https://ok.example/1', 'https://ok.example/2', 'https://ok.example/3', 'https://ok.example/4.png'])
    expect(out).not.toMatch(/href="(?!https:\/\/)/)
    expect(out).not.toMatch(/\son[a-z]+=/)
  })

  it('re-checks the href at render time: a hand-made AST with a bad link renders no anchor', () => {
    const forged: MdDoc = {
      truncated: false,
      blocks: [
        {
          t: 'paragraph',
          c: [
            { t: 'link', href: 'javascript:alert(1)', c: [{ t: 'text', v: 'forged link' }] },
            { t: 'image', href: 'data:image/svg+xml,<svg onload=alert(1)>', alt: 'forged image' },
            { t: 'link', href: 'https://ok.example/', c: [{ t: 'text', v: 'fine' }] }
          ]
        }
      ]
    }
    const out = renderToStaticMarkup(renderMarkdown(forged))
    expect(inventory(out).hrefs).toEqual(['https://ok.example/'])
    expect(out).toContain('<span>forged link</span><span>forged image</span>')
  })

  it('hands clicks to onOpenLink with the checked URL and never lets the page navigate', () => {
    const opened: string[] = []
    const tree = renderMarkdown(parseMarkdown('[go](https://example.com/a)'), { onOpenLink: (href) => opened.push(href) })
    // Walk the element tree to the anchor and call its handler as React would.
    type El = { type: unknown; props: { children?: unknown; onClick?: (e: { preventDefault(): void }) => void; href?: string } }
    const find = (node: unknown): El | null => {
      if (Array.isArray(node)) {
        for (const child of node) {
          const hit = find(child)
          if (hit) return hit
        }
        return null
      }
      if (typeof node !== 'object' || node === null) return null
      const el = node as El
      return el.type === 'a' ? el : find(el.props.children)
    }
    const anchor = find(tree)
    let prevented = 0
    anchor?.props.onClick?.({ preventDefault: () => prevented++ })
    expect(opened).toEqual(['https://example.com/a'])
    expect(prevented).toBe(1)
    expect(anchor?.props.href).toBe('https://example.com/a')
  })

  it('shifts heading levels under the dialog title and clamps at h6', () => {
    expect(html('# a\n\n###### f')).toBe('<div class="upd-md u-selectable"><h3 class="upd-md-h upd-md-h1">a</h3><h6 class="upd-md-h upd-md-h6">f</h6></div>')
  })

  it('renders the published v0.1.0 notes', () => {
    const body = v010Body
    const out = html(body)
    const { tags, attrs, hrefs } = inventory(out)
    expect([...tags].sort()).toEqual(['a', 'code', 'div', 'em', 'h4', 'li', 'p', 'span', 'strong', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'ul'])
    for (const attr of attrs) expect(ALLOWED_ATTRS).toContain(attr)
    expect(hrefs).toEqual(['https://github.com/kwsch/PKHeX', 'https://pokeapi.co/', 'https://github.com/PokeAPI/sprites', 'https://github.com/HydrosPlays/Pelagix/commits/v0.1.0'])
    expect(out).toContain('<h4 class="upd-md-h upd-md-h2">What&#x27;s in it</h4>')
    expect(out).toContain('<td><code class="upd-md-code">Pelagix-0.1.0-setup.exe</code></td><td>Installer. Lets you choose the install folder.</td>')
    expect(out).toContain('<strong>Your data is stored in <code class="upd-md-code">%APPDATA%\\Pelagix</code></strong>')
    expect(out).toContain('Choose <em>More info</em>, then <em>Run anyway</em>.')
    expect(out).not.toContain('\r')
    expect(out.length).toBeGreaterThan(4000)
  })

  it('renders a capped hostile document quickly', () => {
    const doc = parseMarkdown('*a* [b](https://example.com/) `c` '.repeat(6000))
    expect(doc.truncated).toBe(true)
    const started = performance.now()
    const out = renderToStaticMarkup(renderMarkdown(doc))
    expect(performance.now() - started).toBeLessThan(1000)
    expect(out.length).toBeGreaterThan(10_000)
  })
})
