import { useState, type KeyboardEvent, type MouseEvent, type ReactNode, type Ref } from 'react'
import { Chip, Combobox, SegmentedControl, Tooltip, cx, type SelectOption } from '@renderer/components/ui'
import { OTHER_SECTION, pokedexShortName, type DexSection } from '@renderer/domain/gamedex'
import { generationName } from '@renderer/domain/generation'
import { useT } from '@renderer/i18n'
import { formatCount, ratio } from '@renderer/lib/format'
import { FloatingTip, useHoverTarget } from './HoverTip'
import { boxIndexAt, boxName, boxRange, romanNumeral, type BoxModel, type LivingMode, type LivingStats, type LivingView } from './model'

export interface LivingToolbarProps {
  mode: LivingMode
  view: LivingView
  onView: (view: LivingView) => void
  missingOnly: boolean
  onMissingOnly: (on: boolean) => void
  stats: LivingStats
  boxes: readonly BoxModel[]
  /** First and last slot index on screen (-1 before the grid has reported). */
  visible: readonly [number, number]
  /** Generation of the first slot on screen. */
  currentGen: number
  searchOptions: ReadonlyArray<SelectOption<string>>
  /** Key of the slot the search field is holding, or null. */
  found: string | null
  onFind: (key: string | null) => void
  onJumpGen: (gen: number) => void
  onJumpBox: (boxIndex: number) => void
  /** Sections of a game view; with any, their tabs stand in for the generation tabs. */
  sections: readonly DexSection[]
  onJumpSection: (section: number) => void
  ref?: Ref<HTMLDivElement>
}

/** Moves focus along a strip of buttons with the arrow keys, Home and End (one tab stop for the strip). */
function rove(event: KeyboardEvent<HTMLElement>, selector: string): HTMLElement | null {
  const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
  if (step === 0 && event.key !== 'Home' && event.key !== 'End') return null
  const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(selector)).filter((el) => !el.hasAttribute('disabled'))
  if (items.length === 0) return null
  const at = items.indexOf(document.activeElement as HTMLElement)
  const next = event.key === 'Home' ? items[0] : event.key === 'End' ? items[items.length - 1] : items[Math.max(0, Math.min(items.length - 1, at + step))]
  if (!next) return null
  event.preventDefault()
  next.focus()
  return next
}

/**
 * The bar that stays on screen while the boxes scroll: view switch, "Missing only", jump to a
 * generation, find a Pokémon, and the box index (one cell per box, filled as far as the box is).
 */
export function LivingToolbar({ mode, view, onView, missingOnly, onMissingOnly, stats, boxes, visible, currentGen, searchOptions, found, onFind, onJumpGen, onJumpBox, sections, onJumpSection, ref }: LivingToolbarProps) {
  const t = useT()
  const tip = useHoverTarget('[data-cell]', 220)
  const [genStop, setGenStop] = useState<number | null>(null)
  const [cellStop, setCellStop] = useState<number | null>(null)
  const missing = stats.slots - stats.filled
  const firstBox = boxIndexAt(boxes, visible[0])
  const lastBox = boxIndexAt(boxes, visible[1])
  const gens = stats.gens.filter((g) => g.gen > 0)
  // Each strip is one tab stop: the item last focused, else the one for what is on screen.
  const genTab = gens.some((g) => g.gen === genStop) ? genStop : gens.some((g) => g.gen === currentGen) ? currentGen : (gens[0]?.gen ?? -1)
  const cellTab = cellStop !== null && cellStop < boxes.length ? cellStop : Math.max(0, firstBox)

  const tipBox = tip.target ? boxes[Number(tip.target.dataset.cell)] : undefined
  const tipFilled = tipBox ? (stats.boxFilled[tipBox.index] ?? 0) : 0

  const onCellClick = (event: MouseEvent<HTMLElement>): void => {
    const cell = (event.target as HTMLElement).closest<HTMLElement>('[data-cell]')
    if (cell) onJumpBox(Number(cell.dataset.cell))
  }

  const cells: ReactNode[] = boxes.map((box) => {
    const filled = stats.boxFilled[box.index] ?? 0
    const size = box.slots.length
    const complete = size > 0 && filled === size
    const inView = box.index >= firstBox && box.index <= lastBox
    return (
      <button
        key={box.index}
        type="button"
        className={cx('living-map__cell', complete && 'is-complete', filled === 0 && 'is-empty', inView && 'is-in-view')}
        data-cell={box.index}
        tabIndex={box.index === cellTab ? 0 : -1}
        aria-current={inView ? 'true' : undefined}
        aria-label={complete ? t('living.toolbar.boxComplete', { box: boxName(box), range: boxRange(box) }) : t('living.toolbar.box', { box: boxName(box), range: boxRange(box), filled, count: size })}
        onFocus={() => setCellStop(box.index)}
      >
        <span className="living-map__fill" style={{ transform: `scaleY(${ratio(filled, size)})` }} />
      </button>
    )
  })

  return (
    <div ref={ref} className={cx('living-toolbar', mode === 'shiny' && 'is-shiny')}>
      <div className="living-toolbar__row">
        <SegmentedControl
          label={t('living.toolbar.view')}
          value={view}
          onChange={onView}
          options={[
            { value: 'boxes', label: t('living.toolbar.view.boxes'), icon: 'box' },
            { value: 'list', label: t('living.toolbar.view.list'), icon: 'grid' }
          ]}
        />
        <Chip icon="filter" tone={mode === 'shiny' ? 'gold' : 'accent'} selected={missingOnly} onClick={() => onMissingOnly(!missingOnly)}>
          {t('living.toolbar.missingOnly')}
          <span className="living-toolbar__missing"> {formatCount(missing)}</span>
        </Chip>

        {sections.length > 0 && (
          <nav className="gdex-tabs" aria-label={t('living.toolbar.jumpDex')}>
            {sections.map((section, s) => {
              const stat = stats.sections[s]
              return (
                <button key={section.id} type="button" className={cx('gdex-tabs__item', stat && stat.filled === stat.slots && 'is-complete')} title={section.title} onClick={() => onJumpSection(s)}>
                  <span className="gdex-tabs__name">{section.id === OTHER_SECTION ? t('pokedex.dexShort.other') : pokedexShortName(section.id)}</span>
                  {stat && (
                    <span className="gdex-tabs__count">
                      {formatCount(stat.filled)} / {formatCount(stat.slots)}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        )}
        <nav className="living-gens" aria-label={t('living.toolbar.jumpGeneration')} hidden={sections.length > 0} onKeyDown={(event) => rove(event, '.living-gens__item')}>
          {gens.map((g) => {
            const complete = g.slots > 0 && g.filled === g.slots
            const name = generationName(g.gen)
            return (
              <Tooltip key={g.gen} content={`${name} · ${formatCount(g.filled)} / ${formatCount(g.slots)}`} placement="bottom">
                <button
                  type="button"
                  className={cx('living-gens__item', g.gen === currentGen && 'is-current', complete && 'is-complete')}
                  tabIndex={g.gen === genTab ? 0 : -1}
                  aria-current={g.gen === currentGen ? 'true' : undefined}
                  aria-label={t('living.toolbar.generation', { generation: name, filled: g.filled, count: g.slots })}
                  onFocus={() => setGenStop(g.gen)}
                  onClick={() => onJumpGen(g.gen)}
                >
                  <span className="living-gens__numeral">{romanNumeral(g.gen)}</span>
                  <span className="living-gens__bar" aria-hidden="true">
                    <span style={{ transform: `scaleX(${ratio(g.filled, g.slots)})` }} />
                  </span>
                </button>
              </Tooltip>
            )
          })}
        </nav>

        <Combobox<string>
          wrapperClassName="living-toolbar__search"
          ariaLabel={t('living.toolbar.find.label')}
          placeholder={t('living.toolbar.find.placeholder')}
          emptyText={t('living.toolbar.find.empty')}
          options={searchOptions}
          value={found}
          maxItems={40}
          onChange={(key) => onFind(key)}
        />
      </div>

      <nav
        className="living-map"
        aria-label={t('living.toolbar.boxIndex')}
        onClick={onCellClick}
        onKeyDown={(event) => rove(event, '.living-map__cell')}
        onPointerOver={tip.handlers.onPointerOver}
        onPointerOut={tip.handlers.onPointerOut}
        onPointerDown={tip.handlers.onPointerDown}
        onFocus={tip.handlers.onFocus}
        onBlur={tip.handlers.onBlur}
      >
        {cells}
      </nav>

      {tip.target && tipBox && (
        <FloatingTip key={tipBox.index} target={tip.target} side="bottom">
          <span className="living-tip__title">
            {boxName(tipBox)} · {boxRange(tipBox)}
          </span>
          <span className={cx('living-tip__status', tipFilled === tipBox.slots.length && 'is-filled', mode === 'shiny' && 'is-shiny')}>
            {tipFilled === tipBox.slots.length ? t('living.toolbar.tip.complete') : t(mode === 'shiny' ? 'living.toolbar.tip.shinyCaught' : 'living.toolbar.tip.caught', { filled: tipFilled, count: tipBox.slots.length })}
          </span>
        </FloatingTip>
      )}
    </div>
  )
}
