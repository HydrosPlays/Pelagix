import { describe, expect, it } from 'vitest'
import { collectionFor, RULE_PRESETS, type LivingSlot } from '@renderer/domain/slots'
import { fixtureDex as dex, ID, makeEntry } from '@renderer/lib/test-fixture'
import {
  BOX_COLS, BOX_ROWS, BOX_SIZE, boxMetrics, boxRange, buildBoxes, computeStats, filledIn, generationSpans, layoutBoxes, layoutList, listMetrics, moveFocus, neighbour, romanNumeral, rulesKey, rulesLabel, rulesLine,
  slotEntries, slotIndexByKey, slotInfo, slotMarker, slotStatus, slotTitle
} from './model'
import { DEFAULT_LIVING_PREFS, parseLivingPrefs } from './prefs'

/** A slot list of any length; only the fields the layout reads are real. */
function fakeSlots(count: number): LivingSlot[] {
  return Array.from({ length: count }, (_, i) => ({ key: String(i + 1), species: i + 1, form: 0, label: `Mon ${i + 1}`, cat: 'base', spritePath: () => `${i + 1}.png` }))
}

const FORMS = RULE_PRESETS.forms.rules
const ALL = RULE_PRESETS.completionist.rules

describe('boxes', () => {
  it('cuts the slots into boxes of thirty and keeps the remainder in a last, shorter box', () => {
    const slots = fakeSlots(70)
    const boxes = buildBoxes(slots)
    expect(boxes.map((b) => b.slots.length)).toEqual([30, 30, 10])
    expect(boxes.map((b) => b.start)).toEqual([0, 30, 60])
    expect(boxes[2]).toMatchObject({ index: 2, firstDex: 61, lastDex: 70 })
    expect(buildBoxes(slots)).toBe(boxes)
  })

  it('has no boxes without slots', () => {
    expect(buildBoxes([])).toEqual([])
  })

  it('names the dex range of a box', () => {
    expect(boxRange({ firstDex: 1, lastDex: 30 })).toBe('#0001 – #0030')
    expect(boxRange({ firstDex: 493, lastDex: 493 })).toBe('#0493')
  })

  it('maps slot keys to positions', () => {
    const slots = fakeSlots(40)
    const index = slotIndexByKey(slots)
    expect(index.get('1')).toBe(0)
    expect(index.get('40')).toBe(39)
    expect(index.get('41')).toBeUndefined()
  })
})

describe('filled slots and stats', () => {
  const entries = [makeEntry(ID.bulbasaur), makeEntry(ID.pikachu, 0, { shiny: true, gender: 'f' }), makeEntry(ID.pikachu, 0, { gender: 'm', ball: 4 }), makeEntry(ID.pikachu, 0, { gender: 'm', ball: 2 })]
  const collection = collectionFor(dex, entries, FORMS)

  it('counts any entry in normal mode and only shiny ones in shiny mode', () => {
    expect(filledIn(collection, 'normal')).toBe(collection.caught)
    expect(filledIn(collection, 'shiny')).toBe(collection.caughtShiny)
    expect([...filledIn(collection, 'shiny')]).toEqual(['25:f'])
  })

  it('describes one slot for the grid', () => {
    expect(slotInfo(collection, '25:m', 'normal')).toEqual({ filled: true, count: 2, ball: 2, total: 2, hasShiny: false })
    expect(slotInfo(collection, '25:m', 'shiny')).toEqual({ filled: false, count: 0, ball: undefined, total: 2, hasShiny: false })
    expect(slotInfo(collection, '25:f', 'shiny')).toMatchObject({ filled: true, count: 1, hasShiny: true })
    expect(slotInfo(collection, '150', 'normal')).toEqual({ filled: false, count: 0, ball: undefined, total: 0, hasShiny: false })
  })

  it('words the status of a slot', () => {
    expect(slotStatus(slotInfo(collection, '25:m', 'normal'), 'normal')).toBe('Caught · 2 entries')
    expect(slotStatus(slotInfo(collection, '1', 'normal'), 'normal')).toBe('Caught')
    expect(slotStatus(slotInfo(collection, '150', 'normal'), 'normal')).toBe('Not caught yet')
    expect(slotStatus(slotInfo(collection, '25:f', 'shiny'), 'shiny')).toBe('Shiny caught')
    expect(slotStatus(slotInfo(collection, '25:m', 'shiny'), 'shiny')).toBe('No shiny yet · 2 regular entries')
    expect(slotStatus(slotInfo(collection, '150', 'shiny'), 'shiny')).toBe('No shiny yet')
  })

  it('lists the entries of a slot newest first, shiny ones leading in shiny mode', () => {
    const mixed = collectionFor(dex, [makeEntry(ID.mewtwo, 0, { shiny: true }), makeEntry(ID.mewtwo), makeEntry(ID.mewtwo)], FORMS)
    const normal = slotEntries(mixed, '150', 'normal')
    expect(normal.map((e) => e.shiny)).toEqual([false, false, true])
    expect(normal[0]!.createdAt > normal[1]!.createdAt).toBe(true)
    expect(slotEntries(mixed, '150', 'shiny').map((e) => e.shiny)).toEqual([true, false, false])
    expect(slotEntries(mixed, '1', 'normal')).toEqual([])
  })

  it('tallies boxes and generations', () => {
    const stats = computeStats(dex, collection.slots, collection.caught)
    expect(stats.slots).toBe(collection.slots.length)
    expect(stats.filled).toBe(3)
    expect(stats.boxFilled.reduce((a, b) => a + b, 0)).toBe(3)
    expect(stats.boxFilled).toHaveLength(Math.ceil(collection.slots.length / BOX_SIZE))
    expect(stats.boxesComplete).toBe(0)
    const gen1 = stats.gens.find((g) => g.gen === 1)
    expect(gen1).toMatchObject({ start: 0, filled: 3 })
    expect(stats.gens.reduce((n, g) => n + g.slots, 0)).toBe(stats.slots)
    expect(stats.gens.map((g) => g.gen)).toEqual([...stats.gens.map((g) => g.gen)].sort((a, b) => a - b))
  })

  it('counts a box as complete only when every slot in it is filled', () => {
    const slots = fakeSlots(40)
    const everything = new Set(slots.map((s) => s.key))
    expect(computeStats(dex, slots, everything).boxesComplete).toBe(2)
    everything.delete('40')
    expect(computeStats(dex, slots, everything).boxesComplete).toBe(1)
    expect(computeStats(dex, slots, new Set()).boxesComplete).toBe(0)
  })

  it('finds the runs of each generation in slot order', () => {
    const spans = generationSpans(dex, collection.slots)
    expect(spans[0]).toMatchObject({ gen: 1, start: 0 })
    expect(spans.reduce((n, s) => n + s.count, 0)).toBe(collection.slots.length)
    for (let i = 1; i < spans.length; i++) expect(spans[i]!.start).toBe(spans[i - 1]!.start + spans[i - 1]!.count)
  })
})

describe('markers and names', () => {
  it('marks gender halves, Gigantamax slots and variants', () => {
    const slots = collectionFor(dex, [], ALL).slots
    const by = (key: string): LivingSlot => slots.find((s) => s.key === key)!
    expect(slotMarker(by('25:m'))).toBe('male')
    expect(slotMarker(by('25:f'))).toBe('female')
    expect(slotMarker(by('25:gmax'))).toBe('gmax')
    expect(slotMarker(slots.find((s) => s.variant !== undefined)!)).toBe('variant')
    expect(slotMarker(by('1'))).toBeNull()
  })

  it('titles a slot with its number and full label', () => {
    expect(slotTitle({ species: 25, label: 'Pikachu ♀' })).toBe('#0025 Pikachu ♀')
  })

  it('writes generations as Roman numerals', () => {
    expect([1, 4, 9].map(romanNumeral)).toEqual(['I', 'IV', 'IX'])
    expect(romanNumeral(40)).toBe('40')
  })

  it('names the rules in force', () => {
    expect(rulesLabel(FORMS)).toBe('Forms preset')
    expect(rulesLabel(ALL)).toBe('Completionist preset')
    expect(rulesLabel({ ...FORMS, mega: true })).toBe('Custom rules')
    expect(rulesLine(FORMS, 1367)).toBe('Forms preset · 1,367 slots')
    expect(rulesLine(RULE_PRESETS.species.rules, 1)).toBe('Species preset · 1 slot')
    expect(rulesKey(FORMS)).not.toBe(rulesKey(ALL))
    expect(rulesKey(FORMS)).toBe(rulesKey({ ...FORMS }))
  })
})

describe('metrics', () => {
  it('fits as many boxes per row as the width allows, at least one and at most four', () => {
    expect(boxMetrics(920).perRow).toBe(2)
    expect(boxMetrics(1104).perRow).toBe(3)
    expect(boxMetrics(1424).perRow).toBe(4)
    expect(boxMetrics(3000).perRow).toBe(4)
    expect(boxMetrics(200).perRow).toBe(1)
  })

  it('sizes cells in whole pixels that fit six across', () => {
    for (const width of [300, 920, 1104, 1424]) {
      const m = boxMetrics(width)
      expect(Number.isInteger(m.cell)).toBe(true)
      expect(BOX_COLS * m.cell).toBeLessThanOrEqual(m.boxWidth)
      expect(m.boxHeight).toBeGreaterThan(BOX_ROWS * m.cell)
    }
  })

  it('fits list tiles to the width', () => {
    const m = listMetrics(1104)
    expect(m.cols).toBe(14)
    expect(m.cols * m.cell).toBeLessThanOrEqual(1104)
    expect(m.lineHeight).toBeGreaterThan(m.cell)
    expect(listMetrics(10).cols).toBe(1)
  })
})

describe('box layout', () => {
  const slots = fakeSlots(100) // boxes of 30, 30, 30, 10
  const layout = layoutBoxes(slots, boxMetrics(1104)) // three per row

  it('lays the boxes out in rows and shows every slot', () => {
    expect(layout.rows.map((r) => (r.kind === 'boxes' ? r.boxes.map((b) => b.index) : null))).toEqual([[0, 1, 2], [3]])
    expect(layout.order).toHaveLength(100)
    expect(layout.offsets).toHaveLength(3)
    expect([...layout.rowOf].every((r) => r >= 0)).toBe(true)
    expect(layout.rowOf[95]).toBe(1)
  })

  it('runs a line across every box of the row', () => {
    expect(layout.lines[0]).toEqual([0, 1, 2, 3, 4, 5, 30, 31, 32, 33, 34, 35, 60, 61, 62, 63, 64, 65])
    expect(layout.lines).toHaveLength(BOX_ROWS + 2)
    expect(layout.lines[BOX_ROWS + 1]).toEqual([96, 97, 98, 99])
  })

  it('moves the way the arrows point, across box edges', () => {
    expect(moveFocus(layout, 5, 'ArrowRight')).toBe(30)
    expect(moveFocus(layout, 30, 'ArrowLeft')).toBe(5)
    expect(moveFocus(layout, 0, 'ArrowDown')).toBe(6)
    expect(moveFocus(layout, 6, 'ArrowUp')).toBe(0)
    // Bottom line of the first row of boxes into the top line of the box below.
    expect(moveFocus(layout, 24, 'ArrowDown')).toBe(90)
    expect(moveFocus(layout, 90, 'ArrowUp')).toBe(24)
    // The row below is shorter: the column is clamped to its last slot.
    expect(moveFocus(layout, 89, 'ArrowDown')).toBe(95)
  })

  it('wraps to the neighbouring line at either end and stops at the very ends', () => {
    expect(moveFocus(layout, 65, 'ArrowRight')).toBe(6)
    expect(moveFocus(layout, 6, 'ArrowLeft')).toBe(65)
    expect(moveFocus(layout, 0, 'ArrowLeft')).toBe(0)
    expect(moveFocus(layout, 0, 'ArrowUp')).toBe(0)
    expect(moveFocus(layout, 99, 'ArrowRight')).toBe(99)
    expect(moveFocus(layout, 99, 'ArrowDown')).toBe(99)
  })

  it('jumps to the ends of the line, of everything, and by a box height', () => {
    expect(moveFocus(layout, 32, 'Home')).toBe(0)
    expect(moveFocus(layout, 32, 'End')).toBe(65)
    expect(moveFocus(layout, 32, 'Home', true)).toBe(0)
    expect(moveFocus(layout, 32, 'End', true)).toBe(99)
    expect(moveFocus(layout, 0, 'PageDown')).toBe(90)
    expect(moveFocus(layout, 90, 'PageUp')).toBe(0)
    expect(moveFocus(layout, 95, 'PageDown')).toBe(99)
  })

  it('hides whole boxes and keeps the slots of a shown box in place', () => {
    const partial = layoutBoxes(slots, boxMetrics(1104), (box) => box.index !== 1)
    expect(partial.rows[0]).toMatchObject({ kind: 'boxes' })
    expect(partial.order).toHaveLength(70)
    expect(partial.rowOf[30]).toBe(-1)
    expect(partial.lineOf[45]).toBe(-1)
    expect(partial.lines[0]).toEqual([0, 1, 2, 3, 4, 5, 60, 61, 62, 63, 64, 65, 90, 91, 92, 93, 94, 95])
    expect(moveFocus(partial, 5, 'ArrowRight')).toBe(60)
    // Focus sat on a slot that is no longer shown: start over at the first one.
    expect(moveFocus(partial, 40, 'ArrowRight')).toBe(0)
  })

  it('has nothing to move to when nothing is shown', () => {
    const none = layoutBoxes(slots, boxMetrics(1104), () => false)
    expect(none.rows).toEqual([])
    expect(none.offsets).toEqual([0])
    expect(moveFocus(none, 0, 'ArrowRight')).toBe(-1)
  })
})

describe('list layout', () => {
  const slots = collectionFor(dex, [], FORMS).slots
  const spans = generationSpans(dex, slots)
  const metrics = listMetrics(400) // five tiles per line

  it('leads each generation with a divider and fills lines left to right', () => {
    const layout = layoutList(slots, spans, metrics)
    expect(metrics.cols).toBe(5)
    expect(layout.rows[0]).toMatchObject({ kind: 'divider', gen: spans[0]!.gen })
    expect(layout.rows.filter((r) => r.kind === 'divider')).toHaveLength(spans.length)
    expect(layout.order).toEqual(slots.map((_, i) => i))
    expect(layout.lines[0]).toEqual([0, 1, 2, 3, 4])
    expect(layout.rowOf[0]).toBe(1)
    expect(layout.offsets).toHaveLength(layout.rows.length + 1)
  })

  it('drops filtered slots and the dividers of generations left empty', () => {
    const firstSpan = spans[0]!
    const layout = layoutList(slots, spans, metrics, (index) => index >= firstSpan.count)
    expect(layout.rows.filter((r) => r.kind === 'divider')).toHaveLength(spans.length - 1)
    expect(layout.order[0]).toBe(firstSpan.count)
    expect(layout.rowOf[0]).toBe(-1)
    expect(layoutList(slots, spans, metrics, () => false).rows).toEqual([])
  })

  it('walks previous and next through the shown slots only', () => {
    const layout = layoutList(slots, spans, metrics, (index) => index % 2 === 0)
    expect(neighbour(layout.order, 0, 1)).toBe(2)
    expect(neighbour(layout.order, 2, -1)).toBe(0)
    expect(neighbour(layout.order, 0, -1)).toBe(-1)
    expect(neighbour(layout.order, 1, 1)).toBe(-1)
    expect(neighbour(layout.order, layout.order[layout.order.length - 1]!, 1)).toBe(-1)
  })

  it('moves down a line in the same column, over the divider', () => {
    const layout = layoutList(slots, spans, metrics)
    expect(moveFocus(layout, 1, 'ArrowDown')).toBe(6)
    const lastOfFirst = spans[0]!.count - 1
    const below = moveFocus(layout, lastOfFirst, 'ArrowDown')
    expect(below).toBeGreaterThan(lastOfFirst)
    expect(layout.lineOf[below]).toBe((layout.lineOf[lastOfFirst] ?? 0) + 1)
  })
})

describe('remembered preferences', () => {
  it('falls back to the defaults for anything missing or malformed', () => {
    expect(parseLivingPrefs(null)).toEqual(DEFAULT_LIVING_PREFS)
    expect(parseLivingPrefs('boxes')).toEqual(DEFAULT_LIVING_PREFS)
    expect(parseLivingPrefs({ view: 'tiles', missingOnly: 'yes', seen: { rules: 5 } })).toEqual(DEFAULT_LIVING_PREFS)
  })

  it('keeps what is valid', () => {
    expect(parseLivingPrefs({ view: 'list', missingOnly: true, seen: { rules: '1100', slots: 1367 } })).toEqual({ view: 'list', missingOnly: true, seen: { rules: '1100', slots: 1367 } })
  })
})
