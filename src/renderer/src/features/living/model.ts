/**
 * The Living Dex page as data: boxes of thirty slots, what "filled" means in each mode, how the
 * slots are laid out on screen in both views, and where an arrow key leads. Pure functions; the
 * components only draw what comes out of here.
 */

import type { CatchEntry, DexRules } from '@shared/save-types'
import type { Dex } from '@renderer/lib/data'
import { dexNo, formatCount, plural } from '@renderer/lib/format'
import { sectionsOf } from '@renderer/domain/gamedex'
import { matchRulePreset, RULE_KEYS, RULE_PRESETS, type Collection, type LivingSlot } from '@renderer/domain/slots'
import { offsetsOf } from './rows'

// ---------------------------------------------------------------- modes, views

/** `normal`: any entry fills a slot. `shiny`: only a shiny entry does, and the renders are the shiny ones. */
export type LivingMode = 'normal' | 'shiny'
/** `boxes`: thirty to a box, like Pokémon HOME. `list`: one continuous grid with generation dividers. */
export type LivingView = 'boxes' | 'list'

export const BOX_SIZE = 30
export const BOX_COLS = 6
export const BOX_ROWS = 5

/** The slots that count as caught in a mode. */
export function filledIn(collection: Pick<Collection, 'caught' | 'caughtShiny'>, mode: LivingMode): ReadonlySet<string> {
  return mode === 'shiny' ? collection.caughtShiny : collection.caught
}

// ---------------------------------------------------------------- boxes

export interface BoxModel {
  /** 0-based position; the box is labelled `index + 1`. */
  index: number
  /** Index of its first slot in `Collection.slots`. */
  start: number
  slots: readonly LivingSlot[]
  /** National dex numbers of its first and last slot. */
  firstDex: number
  lastDex: number
  /** The number on its label: boxes count from 1 in every section of a game view (`index + 1` otherwise). */
  no: number
  /** Index of its section in `sectionsOf(slots)`; -1 when the slots have no sections. */
  section: number
  /** Heading of that section. */
  sectionTitle?: string
  /** In a section: places of its first and last slot there, from 1 (the section runs in the game's Pokédex order, not National order). */
  positions?: readonly [number, number]
}

const boxCache = new WeakMap<readonly LivingSlot[], BoxModel[]>()

/**
 * The slots cut into boxes of thirty, in order. In a game view with sections every section starts
 * a new box and numbers its boxes from 1. Cached per slot list.
 */
export function buildBoxes(slots: readonly LivingSlot[]): BoxModel[] {
  let boxes = boxCache.get(slots)
  if (!boxes) {
    boxes = []
    const sections = sectionsOf(slots)
    const spans: ReadonlyArray<{ title?: string; start: number; count: number }> = sections.length > 0 ? sections : [{ start: 0, count: slots.length }]
    for (const [s, span] of spans.entries()) {
      for (let start = span.start; start < span.start + span.count; start += BOX_SIZE) {
        const own = slots.slice(start, Math.min(start + BOX_SIZE, span.start + span.count))
        const from = start - span.start
        boxes.push({
          index: boxes.length,
          start,
          slots: own,
          firstDex: own[0]?.species ?? 0,
          lastDex: own[own.length - 1]?.species ?? 0,
          no: from / BOX_SIZE + 1,
          section: sections.length > 0 ? s : -1,
          ...(span.title !== undefined && { sectionTitle: span.title, positions: [from + 1, from + own.length] as const })
        })
      }
    }
    boxCache.set(slots, boxes)
  }
  return boxes
}

/** Index of the box holding slot `index`; -1 when there is none. */
export function boxIndexAt(boxes: readonly Pick<BoxModel, 'start' | 'slots'>[], index: number): number {
  let lo = 0
  let hi = boxes.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const box = boxes[mid]
    if (!box) return -1
    if (index < box.start) hi = mid - 1
    else if (index >= box.start + box.slots.length) lo = mid + 1
    else return mid
  }
  return -1
}

/** "Box 3", or "Box 3 of the Isle of Armor Pokédex" where the boxes are numbered per section. */
export function boxName(box: Pick<BoxModel, 'no' | 'sectionTitle'>): string {
  if (box.sectionTitle === undefined) return `Box ${box.no}`
  return `Box ${box.no} of ${box.sectionTitle.startsWith('Other ') ? box.sectionTitle.replace('Other ', 'the other ') : `the ${box.sectionTitle}`}`
}

const indexCache = new WeakMap<readonly LivingSlot[], Map<string, number>>()

/** Position of every slot in the list, by slot key. Cached per slot list. */
export function slotIndexByKey(slots: readonly LivingSlot[]): ReadonlyMap<string, number> {
  let index = indexCache.get(slots)
  if (!index) {
    index = new Map(slots.map((slot, i) => [slot.key, i]))
    indexCache.set(slots, index)
  }
  return index
}

/** "#0001 – #0030", or one number when the whole box is one species. In a section: the places it holds there, "31 – 60". */
export function boxRange(box: Pick<BoxModel, 'firstDex' | 'lastDex' | 'positions'>): string {
  if (box.positions) return box.positions[0] === box.positions[1] ? String(box.positions[0]) : `${box.positions[0]} – ${box.positions[1]}`
  return box.firstDex === box.lastDex ? dexNo(box.firstDex) : `${dexNo(box.firstDex)} – ${dexNo(box.lastDex)}`
}

// ---------------------------------------------------------------- generations

export interface GenSpan {
  gen: number
  /** Index of the generation's first slot, and how many slots follow it. */
  start: number
  count: number
}

const genCache = new WeakMap<readonly LivingSlot[], { dex: Dex; gens: Uint8Array; spans: GenSpan[] }>()

function genIndex(dex: Dex, slots: readonly LivingSlot[]): { gens: Uint8Array; spans: GenSpan[] } {
  const hit = genCache.get(slots)
  if (hit && hit.dex === dex) return hit
  const gens = new Uint8Array(slots.length)
  const spans: GenSpan[] = []
  slots.forEach((slot, i) => {
    const gen = dex.species(slot.species)?.gen ?? 0
    gens[i] = gen
    const last = spans[spans.length - 1]
    if (last && last.gen === gen) last.count++
    else spans.push({ gen, start: i, count: 1 })
  })
  const value = { dex, gens, spans }
  genCache.set(slots, value)
  return value
}

/** Debut generation of every slot's species (0 when the dataset does not say), by slot index. */
export function slotGenerations(dex: Dex, slots: readonly LivingSlot[]): Uint8Array {
  return genIndex(dex, slots).gens
}

/** Runs of consecutive slots of one generation, in slot order. */
export function generationSpans(dex: Dex, slots: readonly LivingSlot[]): readonly GenSpan[] {
  return genIndex(dex, slots).spans
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']

/** "IV" for 4; the plain number beyond what the table knows. */
export function romanNumeral(n: number): string {
  return ROMAN[n] ?? String(n)
}

// ---------------------------------------------------------------- stats

export interface GenStat {
  gen: number
  /** Index of the generation's first slot. */
  start: number
  slots: number
  filled: number
}

export interface LivingStats {
  slots: number
  filled: number
  /** Filled slots per box, by box index. */
  boxFilled: number[]
  boxesComplete: number
  /** One entry per generation, ascending. */
  gens: GenStat[]
  /** One entry per section of a game view (see `sectionsOf`), in order; empty without sections. */
  sections: { slots: number; filled: number }[]
}

/** Completion per box and per generation for a set of filled slot keys. */
export function computeStats(dex: Dex, slots: readonly LivingSlot[], filled: ReadonlySet<string>): LivingStats {
  const boxes = buildBoxes(slots)
  const gens = slotGenerations(dex, slots)
  const boxFilled = boxes.map((box) => box.slots.reduce((n, slot) => n + (filled.has(slot.key) ? 1 : 0), 0))
  const sections = sectionsOf(slots).map((span) => {
    let n = 0
    for (let i = span.start; i < span.start + span.count; i++) if (filled.has(slots[i]?.key ?? '')) n++
    return { slots: span.count, filled: n }
  })
  const byGen = new Map<number, GenStat>()
  let total = 0
  slots.forEach((slot, i) => {
    const gen = gens[i] ?? 0
    let stat = byGen.get(gen)
    if (!stat) byGen.set(gen, (stat = { gen, start: i, slots: 0, filled: 0 }))
    stat.slots++
    if (!filled.has(slot.key)) return
    total++
    stat.filled++
  })
  return {
    slots: slots.length,
    filled: total,
    boxFilled,
    boxesComplete: boxes.reduce((n, box) => n + (boxFilled[box.index] === box.slots.length ? 1 : 0), 0),
    gens: [...byGen.values()].sort((a, b) => a.gen - b.gen),
    sections
  }
}

// ---------------------------------------------------------------- one slot

export interface SlotInfo {
  filled: boolean
  /** Entries that count in this mode (all of them, or only the shiny ones). */
  count: number
  /** Ball of the newest of those entries, when it has one. */
  ball: number | undefined
  /** Every entry in the slot, whatever the mode. */
  total: number
  /** The slot also holds a shiny (only interesting in normal mode). */
  hasShiny: boolean
}

const NO_ENTRIES: readonly CatchEntry[] = Object.freeze([])
const EMPTY_SLOT: SlotInfo = Object.freeze({ filled: false, count: 0, ball: undefined, total: 0, hasShiny: false })

/** What a slot shows on the grid: whether it counts as caught in this mode, how many entries, and the newest ball. */
export function slotInfo(collection: Pick<Collection, 'bySlot'>, key: string, mode: LivingMode): SlotInfo {
  const entries = collection.bySlot.get(key)
  if (!entries || entries.length === 0) return EMPTY_SLOT
  let count = 0
  let hasShiny = false
  let newest: CatchEntry | undefined
  for (const entry of entries) {
    if (entry.shiny) hasShiny = true
    if (mode === 'shiny' && !entry.shiny) continue
    count++
    if (!newest || entry.createdAt >= newest.createdAt) newest = entry
  }
  return { filled: count > 0, count, ball: newest?.ball, total: entries.length, hasShiny }
}

/** The entries of a slot, newest first. In shiny mode the shiny ones lead, since they are what fills the slot. */
export function slotEntries(collection: Pick<Collection, 'bySlot'>, key: string, mode: LivingMode): CatchEntry[] {
  const entries = collection.bySlot.get(key) ?? NO_ENTRIES
  return [...entries].sort((a, b) => (mode === 'shiny' ? Number(b.shiny) - Number(a.shiny) : 0) || (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
}

/** The corner marker that tells look-alike slots apart. */
export type SlotMarker = 'male' | 'female' | 'gmax' | 'variant'

export function slotMarker(slot: Pick<LivingSlot, 'gmax' | 'variant' | 'gender'>): SlotMarker | null {
  if (slot.gmax) return 'gmax'
  if (slot.variant !== undefined) return 'variant'
  if (slot.gender === 'm') return 'male'
  if (slot.gender === 'f') return 'female'
  return null
}

/** One line on where a slot stands: "Caught · 3 entries", "Not caught yet", "No shiny yet · 2 regular entries". */
export function slotStatus(info: SlotInfo, mode: LivingMode): string {
  if (mode === 'shiny') {
    if (info.filled) return info.count > 1 ? `Shiny caught · ${plural(info.count, 'shiny entry', 'shiny entries')}` : 'Shiny caught'
    return info.total > 0 ? `No shiny yet · ${plural(info.total, 'regular entry', 'regular entries')}` : 'No shiny yet'
  }
  if (!info.filled) return 'Not caught yet'
  return info.count > 1 ? `Caught · ${plural(info.count, 'entry', 'entries')}` : 'Caught'
}

// ---------------------------------------------------------------- rules line

/** Stable text key of a rule set, for noticing that the rules changed between visits. */
export function rulesKey(rules: DexRules): string {
  return RULE_KEYS.map((k) => (rules[k] ? '1' : '0')).join('')
}

/** "Forms preset", "Completionist preset", or "Custom rules" for a mix of the user's own. */
export function rulesLabel(rules: DexRules): string {
  const preset = matchRulePreset(rules)
  return preset ? `${RULE_PRESETS[preset].label} preset` : 'Custom rules'
}

/** "Forms preset · 1,367 slots". */
export function rulesLine(rules: DexRules, slots: number): string {
  return `${rulesLabel(rules)} · ${formatCount(slots)} ${slots === 1 ? 'slot' : 'slots'}`
}

// ---------------------------------------------------------------- layout

export const BOX_GAP = 16
export const BOX_PAD = 10
export const BOX_HEAD = 38
export const BOX_BORDER = 1
export const CELL_GAP = 4
export const MIN_BOX_WIDTH = 330
export const MAX_BOXES_PER_ROW = 4

export const LIST_GAP = 6
export const LIST_MIN_CELL = 72
/** Caption under each tile in the list view (the dex number). */
export const LIST_CAPTION = 18
export const DIVIDER_HEIGHT = 46

export interface BoxMetrics {
  perRow: number
  boxWidth: number
  /** Side of one slot cell, px (whole pixels, so renders stay crisp). */
  cell: number
  boxHeight: number
}

/** How many boxes fit side by side in `width`, and the sizes that follow from it. */
export function boxMetrics(width: number): BoxMetrics {
  const perRow = Math.max(1, Math.min(MAX_BOXES_PER_ROW, Math.floor((width + BOX_GAP) / (MIN_BOX_WIDTH + BOX_GAP))))
  const boxWidth = (width - BOX_GAP * (perRow - 1)) / perRow
  const inner = boxWidth - 2 * (BOX_PAD + BOX_BORDER)
  const cell = Math.max(24, Math.floor((inner - CELL_GAP * (BOX_COLS - 1)) / BOX_COLS))
  const boxHeight = 2 * (BOX_PAD + BOX_BORDER) + BOX_HEAD + BOX_ROWS * cell + (BOX_ROWS - 1) * CELL_GAP
  return { perRow, boxWidth, cell, boxHeight }
}

export interface ListMetrics {
  cols: number
  cell: number
  /** Height of one line of tiles (tile plus caption). */
  lineHeight: number
}

export function listMetrics(width: number): ListMetrics {
  const cols = Math.max(1, Math.floor((width + LIST_GAP) / (LIST_MIN_CELL + LIST_GAP)))
  const cell = Math.max(24, Math.floor((width - LIST_GAP * (cols - 1)) / cols))
  return { cols, cell, lineHeight: cell + LIST_CAPTION }
}

export type LivingRow =
  | { kind: 'boxes'; key: string; height: number; boxes: readonly BoxModel[] }
  | { kind: 'divider'; key: string; height: number; gen: number }
  /** Heading of one section of a game view; `section` indexes `sectionsOf(slots)`. */
  | { kind: 'section'; key: string; height: number; section: number }
  | { kind: 'slots'; key: string; height: number; indices: readonly number[] }

export interface LivingLayout {
  view: LivingView
  rows: readonly LivingRow[]
  /** Row tops and the total height (see rows.ts). */
  offsets: readonly number[]
  /**
   * The slots as they sit on screen, line by line, left to right: what the arrow keys walk.
   * In the box view a line runs across every box of a row.
   */
  lines: ReadonlyArray<readonly number[]>
  /** Per slot index: its line, its column in that line, and the row that draws it. -1 when the slot is not shown. */
  lineOf: Int32Array
  colOf: Int32Array
  rowOf: Int32Array
  /** Every shown slot in dex order: what "previous" and "next" walk. */
  order: readonly number[]
}

function emptyIndex(size: number): Int32Array {
  return new Int32Array(size).fill(-1)
}

/**
 * Box view. `showBox` hides whole boxes (a complete one under "Missing only"); the slots of a
 * shown box always keep their place, so a box on screen matches the box in the game.
 */
export function layoutBoxes(slots: readonly LivingSlot[], metrics: BoxMetrics, showBox: (box: BoxModel) => boolean = () => true): LivingLayout {
  const shown = buildBoxes(slots).filter(showBox)
  const rows: LivingRow[] = []
  const lines: number[][] = []
  const lineOf = emptyIndex(slots.length)
  const colOf = emptyIndex(slots.length)
  const rowOf = emptyIndex(slots.length)
  const order: number[] = []

  // In a game view with sections each section has its heading and its own rows of boxes.
  const sections = sectionsOf(slots)
  const runs = sections.length > 0 ? sections.map((_, s) => shown.filter((box) => box.section === s)) : [shown]
  for (const [s, run] of runs.entries()) {
    if (run.length === 0) continue
    if (sections.length > 0) rows.push({ kind: 'section', key: `section-${sections[s]?.id ?? s}`, height: DIVIDER_HEIGHT, section: s })
    for (let i = 0; i < run.length; i += metrics.perRow) {
      const group = run.slice(i, i + metrics.perRow)
      const row = rows.length
      rows.push({ kind: 'boxes', key: `boxes-${group[0]?.index ?? i}`, height: metrics.boxHeight, boxes: group })
      for (let r = 0; r < BOX_ROWS; r++) {
        const line: number[] = []
        for (const box of group) {
          for (let c = 0; c < BOX_COLS; c++) {
            const local = r * BOX_COLS + c
            if (local >= box.slots.length) break
            const index = box.start + local
            lineOf[index] = lines.length
            colOf[index] = line.length
            rowOf[index] = row
            line.push(index)
          }
        }
        if (line.length > 0) lines.push(line)
      }
      for (const box of group) for (let k = 0; k < box.slots.length; k++) order.push(box.start + k)
    }
  }
  return { view: 'boxes', rows, offsets: offsetsOf(rows.map((r) => r.height), BOX_GAP), lines, lineOf, colOf, rowOf, order }
}

/** List view: every shown slot in one grid, with a divider row ahead of each generation that has any (ahead of each section, in a game view that has them). */
export function layoutList(slots: readonly LivingSlot[], spans: readonly GenSpan[], metrics: ListMetrics, showSlot: (index: number) => boolean = () => true): LivingLayout {
  const rows: LivingRow[] = []
  const lines: number[][] = []
  const lineOf = emptyIndex(slots.length)
  const colOf = emptyIndex(slots.length)
  const rowOf = emptyIndex(slots.length)
  const order: number[] = []
  const sections = sectionsOf(slots)

  for (const [s, span] of (sections.length > 0 ? sections : spans).entries()) {
    const indices: number[] = []
    for (let i = span.start; i < span.start + span.count; i++) if (showSlot(i)) indices.push(i)
    if (indices.length === 0) continue
    if ('gen' in span) rows.push({ kind: 'divider', key: `gen-${span.gen}-${span.start}`, height: DIVIDER_HEIGHT, gen: span.gen })
    else rows.push({ kind: 'section', key: `section-${span.id}`, height: DIVIDER_HEIGHT, section: s })
    for (let i = 0; i < indices.length; i += metrics.cols) {
      const line = indices.slice(i, i + metrics.cols)
      line.forEach((index, col) => {
        lineOf[index] = lines.length
        colOf[index] = col
        rowOf[index] = rows.length
        order.push(index)
      })
      lines.push(line)
      rows.push({ kind: 'slots', key: `slots-${line[0]}`, height: metrics.lineHeight, indices: line })
    }
  }
  return { view: 'list', rows, offsets: offsetsOf(rows.map((r) => r.height), LIST_GAP), lines, lineOf, colOf, rowOf, order }
}

// ---------------------------------------------------------------- keyboard

export type MoveKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End' | 'PageUp' | 'PageDown'

export const MOVE_KEYS: ReadonlySet<string> = new Set<MoveKey>(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'])

/**
 * Where a key press takes the focus from slot `from`. Arrows move the way they point (left and
 * right wrap to the neighbouring line), Home / End go to the ends of the line or, with Ctrl, of
 * everything, PageUp / PageDown jump a box height. Returns `from` when there is nowhere to go and
 * the first shown slot when `from` itself is not on screen; -1 when nothing is shown.
 */
export function moveFocus(layout: Pick<LivingLayout, 'lines' | 'lineOf' | 'colOf'>, from: number, key: MoveKey, ctrl = false): number {
  const { lines, lineOf, colOf } = layout
  if (lines.length === 0) return -1
  const lineIndex = lineOf[from] ?? -1
  const first = lines[0]?.[0] ?? -1
  if (lineIndex < 0) return first
  const line = lines[lineIndex] ?? []
  const col = colOf[from] ?? 0
  const at = (l: number, c: number): number => {
    const target = lines[Math.max(0, Math.min(lines.length - 1, l))] ?? line
    return target[Math.max(0, Math.min(target.length - 1, c))] ?? from
  }
  const lastLine = lines[lines.length - 1] ?? line

  switch (key) {
    case 'ArrowRight':
      if (col + 1 < line.length) return at(lineIndex, col + 1)
      return lineIndex + 1 < lines.length ? at(lineIndex + 1, 0) : from
    case 'ArrowLeft':
      if (col > 0) return at(lineIndex, col - 1)
      return lineIndex > 0 ? at(lineIndex - 1, Number.MAX_SAFE_INTEGER) : from
    case 'ArrowDown':
      return lineIndex + 1 < lines.length ? at(lineIndex + 1, col) : from
    case 'ArrowUp':
      return lineIndex > 0 ? at(lineIndex - 1, col) : from
    case 'Home':
      return ctrl ? first : at(lineIndex, 0)
    case 'End':
      return ctrl ? (lastLine[lastLine.length - 1] ?? from) : at(lineIndex, Number.MAX_SAFE_INTEGER)
    case 'PageDown':
      return at(lineIndex + BOX_ROWS, col)
    case 'PageUp':
      return at(lineIndex - BOX_ROWS, col)
  }
}

/** The slot `step` places before or after `from` among the shown slots, or -1 at either end. */
export function neighbour(order: readonly number[], from: number, step: 1 | -1): number {
  const at = order.indexOf(from)
  if (at < 0) return -1
  return order[at + step] ?? -1
}

// ---------------------------------------------------------------- accessible names

/** "#0025 Pikachu ♀" - how a slot is announced and titled everywhere on the page. */
export function slotTitle(slot: Pick<LivingSlot, 'species' | 'label'>): string {
  return `${dexNo(slot.species)} ${slot.label}`
}
