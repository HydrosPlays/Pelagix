import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MAX_HISTORY_BYTES, MAX_HISTORY_ROWS, parseHistoryDate, parseShinyDexExport, parseShinyDexFile, parseShinyDexHistory, readShinyDexHistory } from './shinydex'

/** One history row the way a saved page writes it; the content is made up. */
function row(name: string, sprite: string, game: string, method: string, date: string, ball = 'pokeBall.png', phase = ''): string {
  const badge = phase === '' ? '' : `<div class="relative"><div class="spin"><svg viewBox="0 0 5 5"><path d="m1,1 2,2Z"></path></svg></div> <div class="n">${phase}</div></div>`
  return `<button class="relative flex" style="background: transparent; "><div class="dot"></div> <div class="relative"><img src="./History _ ShinyDex_files/${ball}" alt="" class="a"> <img src="./History _ ShinyDex_files/${sprite}" alt="" class="b"></div> <div class="min-w-0"><div class="flex"><span class="text-sm">${name}</span> <img src="./History _ ShinyDex_files/${game}" alt="" class="h"></div> <div class="text-sm">${method} <span class="mx-1">·</span>${date}</div></div> ${badge} </button>`
}

const page = (...rows: string[]): string =>
  `<!DOCTYPE html><html><head><title>History | ShinyDex</title><script>const a = "<button>x · y</button>"</script></head><body>
  <button aria-label="Open navigation"><span></span></button><button>Log in</button>
  <div><div><img src="./f/pokeBall.png"> <img src="./f/pichu.png" alt="Pichu"></div><div><span>Pichu</span> <img src="./f/za.png"></div><div>Random Encounters <span>·</span>1 Jan 2026 <span>·</span>12 encounters</div></div>
  <div class="list">${rows.join('')}</div><button type="button">History <span></span> </button></body></html>`

describe('parseShinyDexHistory', () => {
  it('reads name, slugs, method, date and ball of every row, in page order', () => {
    const { rows, dropped } = parseShinyDexHistory(page(row('Pichu', 'pichu.png', 'za.png', 'Random Encounters', '19 Sept 2026', 'quickBall.png', '4'), row('Eevee', 'eevee.gif', 'soulsilver.png', 'Masuda Method', '3 Feb 2024')))
    expect(dropped).toBe(0)
    expect(rows).toEqual([
      { index: 0, name: 'Pichu', pokemon: 'pichu', game: 'za', method: 'Random Encounters', date: '2026-09-19', ball: 'quickBall' },
      { index: 1, name: 'Eevee', pokemon: 'eevee', game: 'soulsilver', method: 'Masuda Method', date: '2024-02-03', ball: 'pokeBall' }
    ])
  })

  it('keeps the form in name and slug, and drops what a browser adds to a file name', () => {
    const { rows } = parseShinyDexHistory(
      page(
        row('Alolan Raichu', 'raichu-alolan.png', 'sword.png', 'Soft Resets', '1 May 2025'),
        row('Meowstic', 'meowstic-f(1).png', 'y.png', 'Horde Encounter', '2 May 2025'),
        row('Eevee', 'missingo-blu.AbCd1234.png', 'violet.png', 'Zone Resets', '3 May 2025'),
        row('Unown', 'unown%20(2).png?v=3', 'firered.png', 'Random Encounters', '4 May 2025')
      )
    )
    expect(rows.map((r) => [r.name, r.pokemon])).toEqual([
      ['Alolan Raichu', 'raichu-alolan'],
      ['Meowstic', 'meowstic-f'],
      ['Eevee', ''],
      ['Unown', 'unown']
    ])
  })

  it('copes with odd whitespace, entities, quotes and upper-case tags', () => {
    const odd = `<BUTTON\n  class='x'><div><IMG alt="" SRC='https://shinydex.com/img/balls/ultraBall.png'><img\n src="https://shinydex.com/img/sprites/pikachu.png?x=1"></div>
      <span>\n  Flab&#233;b&#xe9; &amp; Co&#x21;\t</span><img src="C:\\saved\\files\\violet.png">
      <div>  Random&nbsp;Encounters\n <span> &middot; </span> 07 Dec 2025\n</div></BUTTON>`
    expect(parseShinyDexHistory(odd).rows).toEqual([{ index: 0, name: 'Flabébé & Co!', pokemon: 'pikachu', game: 'violet', method: 'Random Encounters', date: '2025-12-07', ball: 'ultraBall' }])
  })

  it('ignores everything that is not a history row', () => {
    expect(parseShinyDexHistory(page()).rows).toEqual([])
    // No game picture; no method; a name that would have to be the method too.
    expect(parseShinyDexHistory('<button><img src="a.png"><span>Pichu</span><div>Random <span>·</span>1 Jan 2026</div></button>').rows).toEqual([])
    expect(parseShinyDexHistory('<button><img src="a.png"><span>Pichu</span><img src="za.png"><div><span>·</span>1 Jan 2026</div></button>').rows).toEqual([])
    expect(parseShinyDexHistory('<button><span>A</span><span>·</span><span>B</span></button>').rows).toEqual([])
  })

  it('keeps a row whose date it does not understand, without a date', () => {
    expect(parseShinyDexHistory(row('Pichu', 'pichu.png', 'za.png', 'Random Encounters', 'yesterday')).rows[0]).toMatchObject({ name: 'Pichu', date: null })
  })

  it('never throws on junk', () => {
    const junk = [undefined, null, 42, {}, '', '<', '<button', '<button>', '<button></button>', '<button><img src=></button>', '</button><button>·', '<button>' + '<img src="x.png">'.repeat(5000) + '</button>', '<button><svg>'.repeat(2000)]
    for (const input of junk) {
      expect(() => parseShinyDexHistory(input)).not.toThrow()
      expect(parseShinyDexHistory(input).rows).toEqual([])
    }
  })

  it('has limits: overlong names and methods are no rows, and rows past the cap are counted', () => {
    expect(parseShinyDexHistory(row('P'.repeat(65), 'pichu.png', 'za.png', 'Random Encounters', '1 Jan 2026')).rows).toEqual([])
    expect(parseShinyDexHistory(row('Pichu', 'pichu.png', 'za.png', 'R'.repeat(121), '1 Jan 2026')).rows).toEqual([])
    expect(parseShinyDexHistory(row('Pichu', 'p'.repeat(65) + '.png', 'za.png', 'Random Encounters', '1 Jan 2026')).rows[0]).toMatchObject({ pokemon: '' })
    const many = parseShinyDexHistory('<button><img src="b.png"><img src="pichu.png"><span>Pichu</span><img src="za.png">Fishing<span>·</span>1 Jan 2026</button>'.repeat(MAX_HISTORY_ROWS + 3))
    expect(many.rows).toHaveLength(MAX_HISTORY_ROWS)
    expect(many.dropped).toBe(3)
  })
})

describe('parseHistoryDate', () => {
  it('reads the ways a day is written', () => {
    expect(parseHistoryDate('13 Apr 2026')).toBe('2026-04-13')
    expect(parseHistoryDate('19 Sept 2026')).toBe('2026-09-19')
    expect(parseHistoryDate('1 January 2024')).toBe('2024-01-01')
    expect(parseHistoryDate('Apr 13, 2026')).toBe('2026-04-13')
    expect(parseHistoryDate('2026-04-13')).toBe('2026-04-13')
    expect(parseHistoryDate('3. März 2025')).toBe('2025-03-03')
    expect(parseHistoryDate('14 juil. 2025')).toBe('2025-07-14')
    expect(parseHistoryDate('14 juin 2025')).toBe('2025-06-14')
    expect(parseHistoryDate('2 août 2025')).toBe('2025-08-02')
  })

  it('refuses what is no day', () => {
    for (const text of ['', 'today', '31 Feb 2026', '0 Jan 2026', '13 Foo 2026', '13/04/2026', '13 Apr 26', '2026-13-01']) expect(parseHistoryDate(text)).toBeNull()
  })
})

describe('readShinyDexHistory', () => {
  it('answers with the rows, or with the one reason it could not', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pelagix-shinydex-'))
    try {
      const good = join(dir, 'History _ ShinyDex.html')
      await writeFile(good, page(row('Pichu', 'pichu.png', 'za.png', 'Random Encounters', '19 Sept 2026')), 'utf8')
      expect(await readShinyDexHistory(good)).toEqual({ ok: true, history: { fileName: 'History _ ShinyDex.html', source: 'page', rows: [expect.objectContaining({ name: 'Pichu', game: 'za' })], dropped: 0, unusable: 0 } })

      // The kind of file is decided from its content: an export under a page's name is still an export.
      const exported = join(dir, 'export.html')
      await writeFile(exported, '\uFEFF ' + JSON.stringify({ version: 1, entries: [{ species: 172, form: 0, shiny: true, game: 'za', kind: 'wild', method: 'Random Encounters', date: '2026-01-08' }], settings: { rules: { shiny: false } }, achievements: { first: '2026-01-01' } }), 'utf8')
      expect(await readShinyDexHistory(exported)).toEqual({
        ok: true,
        history: { fileName: 'export.html', source: 'export', rows: [{ index: 0, name: '', pokemon: '', game: 'za', method: 'Random Encounters', date: '2026-01-08', ball: '', known: { species: 172, form: 0, shiny: true, kind: 'wild' } }], dropped: 0, unusable: 0 }
      })

      const noEntries = join(dir, 'settings.json')
      await writeFile(noEntries, JSON.stringify({ settings: { rules: {} }, achievements: {} }), 'utf8')
      expect(await readShinyDexHistory(noEntries)).toEqual({ ok: false, reason: 'not-shinydex' })

      const other = join(dir, 'other.html')
      await writeFile(other, '<html><body><button>Log in</button><p>Nothing here · at all</p></body></html>', 'utf8')
      expect(await readShinyDexHistory(other)).toEqual({ ok: false, reason: 'not-shinydex' })

      const big = join(dir, 'big.html')
      await writeFile(big, Buffer.alloc(MAX_HISTORY_BYTES + 1, 0x20))
      expect(await readShinyDexHistory(big)).toEqual({ ok: false, reason: 'too-large' })

      expect(await readShinyDexHistory(join(dir, 'missing.html'))).toEqual({ ok: false, reason: 'unreadable' })
      expect(await readShinyDexHistory(dir)).toEqual({ ok: false, reason: 'unreadable' })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('parseShinyDexExport', () => {
  const entry = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({ species: 172, form: 0, shiny: true, game: 'za', kind: 'wild', method: 'Random Encounters', date: '2026-01-08', location: null, ball: null, level: null, ot: null, nickname: null, origin: null, ...extra })
  const read = (...entries: unknown[]) => parseShinyDexExport({ entries })!

  it('reads the entries, with null and missing details absent', () => {
    expect(read(entry(), { species: 133, game: 'Violet', date: '2025-12-07' })).toEqual({
      rows: [
        { index: 0, name: '', pokemon: '', game: 'za', method: 'Random Encounters', date: '2026-01-08', ball: '', known: { species: 172, form: 0, shiny: true, kind: 'wild' } },
        { index: 1, name: '', pokemon: '', game: 'violet', method: '', date: '2025-12-07', ball: '', known: { species: 133, form: 0, shiny: true, kind: '' } }
      ],
      dropped: 0,
      unusable: 0
    })
  })

  it('keeps the details an entry does have', () => {
    const { rows } = read(entry({ kind: 'evolved', method: ' Level  up ', location: 'Route 1', ball: 4, level: 16, ot: 'Red', nickname: 'Sparky', origin: [172, 0], shiny: false }))
    expect(rows[0]).toMatchObject({ method: 'Level up', known: { species: 172, form: 0, shiny: false, kind: 'evolved', location: 'Route 1', ball: 4, level: 16, ot: 'Red', nickname: 'Sparky', origin: [172, 0] } })
  })

  it('leaves out a broken detail and keeps the entry', () => {
    const { rows, unusable } = read(entry({ kind: 7, method: {}, location: 5, ball: 'ultra', level: 101, ot: ['a'], nickname: '   ', origin: [1], shiny: 'yes' }), entry({ ball: -1, level: 1.5, origin: [0, 0], location: 'x'.repeat(500), method: 'm'.repeat(500) }))
    expect(unusable).toBe(0)
    expect(rows[0]).toMatchObject({ method: '', known: { species: 172, form: 0, shiny: true, kind: '' } })
    expect(rows[1]!.known).toEqual({ species: 172, form: 0, shiny: true, kind: 'wild', location: 'x'.repeat(200) })
    expect(rows[1]!.method).toHaveLength(120)
  })

  it('keeps an entry whose date is no day, without the date', () => {
    for (const date of [null, undefined, 20260108, '', '8 Jan 2026', '2026-02-31', '2026-01-08T12:00:00.000Z']) expect(read(entry({ date })).rows[0]).toMatchObject({ date: null })
  })

  it('counts an entry without a usable species, form or game as unusable', () => {
    const bad = [null, 3, 'x', [], {}, entry({ species: '172' }), entry({ species: 0 }), entry({ species: 1.5 }), entry({ species: 1e9 }), entry({ form: -1 }), entry({ form: '0' }), entry({ game: null }), entry({ game: '  ' }), entry({ game: 7 }), entry({ game: 'g'.repeat(65) })]
    expect(read(...bad, entry())).toEqual({ rows: [expect.objectContaining({ index: 0, game: 'za' })], dropped: 0, unusable: bad.length })
  })

  it('reads at most a fixed number of entries', () => {
    const many = parseShinyDexExport({ entries: Array.from({ length: MAX_HISTORY_ROWS + 3 }, () => entry()) })!
    expect(many.rows).toHaveLength(MAX_HISTORY_ROWS)
    expect(many.dropped).toBe(3)
  })

  it('is no export without a list of entries, and never throws', () => {
    const thrower = { entries: [{ get species(): number { throw new Error('no') } }, entry()] }
    for (const data of [null, undefined, 3, 'entries', [], [entry()], {}, { entries: null }, { entries: {} }, { entries: 'x' }, { settings: {}, achievements: {} }]) expect(parseShinyDexExport(data)).toBeNull()
    expect(parseShinyDexExport(thrower)).toMatchObject({ unusable: 1, rows: [expect.anything()] })
    expect(parseShinyDexExport({ entries: [] })).toEqual({ rows: [], dropped: 0, unusable: 0 })
  })

  it('reads nothing but the entries: settings, achievements and the rest of the file never come out', () => {
    const file = { version: 3, entries: [entry({ id: 'abc', createdAt: 'x', notes: 'private', settings: { rules: {} } })], settings: { rules: { shiny: false }, theme: 'dark' }, achievements: { first: '2026-01-01' }, createdAt: '2026-01-01' }
    const frozen = JSON.stringify(file)
    const out = parseShinyDexFile(frozen)!
    expect(Object.keys(out).sort()).toEqual(['dropped', 'rows', 'source', 'unusable'])
    expect(Object.keys(out.rows[0]!).sort()).toEqual(['ball', 'date', 'game', 'index', 'known', 'method', 'name', 'pokemon'])
    expect(Object.keys(out.rows[0]!.known!).sort()).toEqual(['form', 'kind', 'shiny', 'species'])
    expect(JSON.stringify(out)).not.toMatch(/settings|achievements|rules|theme|private|abc/)
    expect(JSON.stringify(file)).toBe(frozen)
  })
})

describe('parseShinyDexFile', () => {
  const pichu = '{"entries":[{"species":172,"game":"za","date":"2026-01-08"}]}'

  it('tells an export from a saved page by the content', () => {
    expect(parseShinyDexFile(pichu)).toMatchObject({ source: 'export', rows: [{ game: 'za' }] })
    expect(parseShinyDexFile(`\n  ${pichu}\n`)).toMatchObject({ source: 'export' })
    expect(parseShinyDexFile(page(row('Pichu', 'pichu.png', 'za.png', 'Random Encounters', '19 Sept 2026')))).toMatchObject({ source: 'page', unusable: 0, rows: [{ name: 'Pichu' }] })
  })

  it('is neither for JSON without entries, broken JSON and anything else', () => {
    for (const text of ['', '{}', '[]', '[1,2]', '{"settings":{}}', '{"entries":3}', pichu.slice(0, -1), '{ not json', 'null', '<html></html>', 3, null]) expect(parseShinyDexFile(text)).toBeNull()
  })
})
