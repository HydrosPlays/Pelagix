import { useRef, type KeyboardEvent } from 'react'
import { cx, Icon } from '@renderer/components/ui'
import type { AchievementGlyph, CategoryStats } from '@renderer/domain/achievements'
import { formatCount } from '@renderer/lib/format'
import { GlyphIcon } from './glyphs'
import type { CategoryChoice } from './model'

interface Item {
  id: CategoryChoice
  name: string
  glyph: AchievementGlyph
  unlocked: number
  total: number
}

export interface CategoryListProps {
  stats: readonly CategoryStats[]
  value: CategoryChoice
  onChange: (value: CategoryChoice) => void
  /** Id of the panel the tabs control. */
  panelId: string
}

export const categoryTabId = (id: CategoryChoice): string => `ach-tab-${id}`

/**
 * The category picker: "All" plus one tab per category, each with its completion. A side list on
 * wide layouts, a wrapping row of pills on narrow ones. Arrow keys, Home and End move the selection.
 */
export function CategoryList({ stats, value, onChange, panelId }: CategoryListProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const items: Item[] = [
    { id: 'all', name: 'All achievements', glyph: 'trophy', unlocked: stats.reduce((n, s) => n + s.unlocked, 0), total: stats.reduce((n, s) => n + s.total, 0) },
    ...stats.map((s) => ({ id: s.category.id, name: s.category.name, glyph: s.category.glyph, unlocked: s.unlocked, total: s.total }))
  ]

  const onKeyDown = (event: KeyboardEvent): void => {
    const index = items.findIndex((item) => item.id === value)
    let next = -1
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (index + 1) % items.length
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = items.length - 1
    const target = items[next]
    if (!target) return
    event.preventDefault()
    onChange(target.id)
    const tab = listRef.current?.querySelector<HTMLElement>(`#${CSS.escape(categoryTabId(target.id))}`)
    tab?.focus()
    tab?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }

  return (
    <div ref={listRef} className="ach-cats" role="tablist" aria-label="Achievement categories" aria-orientation="vertical" onKeyDown={onKeyDown}>
      {items.map((item) => {
        const selected = item.id === value
        const complete = item.total > 0 && item.unlocked >= item.total
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={categoryTabId(item.id)}
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            className={cx('ach-cat', selected && 'is-selected', complete && 'is-complete')}
            onClick={() => onChange(item.id)}
          >
            <span className="ach-cat__icon">
              <GlyphIcon name={item.glyph} size={18} />
            </span>
            <span className="ach-cat__name">{item.name}</span>
            <span className="ach-cat__count" aria-label={`${formatCount(item.unlocked)} of ${formatCount(item.total)} unlocked`}>
              {complete ? <Icon name="check" size={14} /> : null}
              {formatCount(item.unlocked)}/{formatCount(item.total)}
            </span>
            <span className="ach-cat__meter" aria-hidden="true">
              <span className="ach-cat__fill" style={{ transform: `scaleX(${item.total > 0 ? item.unlocked / item.total : 0})` }} />
            </span>
          </button>
        )
      })}
    </div>
  )
}
