import { memo, useLayoutEffect, useMemo, useRef } from 'react'
import { Link } from 'wouter'
import { Sprite } from '@renderer/components/pokemon'
import { Badge, cx, Icon, IconButton, ProgressBar, Tooltip } from '@renderer/components/ui'
import { missingItems, TIER_LABELS, type AchievementContext, type AchievementDef, type SetItem } from '@renderer/domain/achievements'
import { rich, t, useT } from '@renderer/i18n'
import { enterStagger } from '@renderer/lib/anim'
import { formatDate, formatDateTime } from '@renderer/lib/format'
import { paths } from '@renderer/shell/router'
import { Medal } from './Medal'
import { progressText, type AchievementRow } from './model'

/** How many missing Pokémon a card shows before it says "and N more". */
const MISSING_LIMIT = 12

/** What a missing item is called on its link, given how the achievement checks it. */
function missingLabel(def: AchievementDef, item: SetItem): string {
  return def.test === 'shiny' ? t('achievements.missing.shiny', { name: item.label }) : item.label
}

function MissingList({ def, context, id }: { def: AchievementDef; context: AchievementContext; id: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const missing = useMemo(() => missingItems(context, def, MISSING_LIMIT), [context, def])
  const more = missing.total - missing.items.length
  const t = useT()

  useLayoutEffect(() => {
    enterStagger(ref.current?.querySelectorAll('.ach-missing__cell'), { step: 16, y: 6, duration: 240 })
  }, [])

  return (
    <div ref={ref} id={id} className="ach-missing" role="group" aria-label={t('achievements.missing.label', { title: def.title })}>
      <div className="ach-missing__head u-eyebrow">{missing.total === 0 ? t('achievements.missing.none') : t('achievements.missing.count', { count: missing.total })}</div>
      {missing.total > 0 && (
        <ul className="ach-missing__list">
          {missing.items.map((item) => {
            const label = missingLabel(def, item)
            return (
              <li key={`${item.species}-${item.form ?? 'any'}-${item.variant ?? ''}-${item.gmax ? 'g' : ''}`} className="ach-missing__cell">
                <Tooltip content={label}>
                  <Link href={paths.species(item.species, item.form)} className="ach-missing__item" aria-label={t('achievements.missing.open', { name: label })}>
                    <Sprite species={item.species} form={item.form ?? 0} variant={item.variant} gmax={item.gmax} shiny={def.test === 'shiny'} size={40} className="ach-missing__sprite" />
                  </Link>
                </Tooltip>
              </li>
            )
          })}
          {more > 0 && <li className="ach-missing__cell ach-missing__more">{t('achievements.missing.more', { count: more })}</li>}
        </ul>
      )}
    </div>
  )
}

export interface AchievementCardProps {
  row: AchievementRow
  /** The evaluation context, for working out what is missing. */
  context: AchievementContext
  expanded: boolean
  onToggle: (id: string) => void
}

/**
 * One achievement: medal, what it asks for, its tier and points, then either the progress so far
 * or the day it was unlocked. A locked secret shows "???" and a hint instead.
 */
export const AchievementCard = memo(function AchievementCard({ row, context, expanded, onToggle }: AchievementCardProps) {
  const { def, state, unlockedAt, fresh, concealed } = row
  const unlocked = unlockedAt !== null
  const titleId = `ach-title-${def.id}`
  const missingId = `ach-missing-${def.id}`
  const canExpand = !unlocked && !concealed && def.pool !== undefined && !state.done
  const open = expanded && canExpand
  const t = useT()
  const title = concealed ? '???' : def.title

  return (
    <article
      className={cx('ach-card', `ach-tier--${def.tier}`, unlocked ? 'is-unlocked' : 'is-locked', fresh && 'is-fresh', open && 'is-open')}
      data-ach={def.id}
      aria-labelledby={titleId}
      tabIndex={-1}
    >
      {fresh && (
        <span className="ach-card__fx" aria-hidden="true">
          <span className="ach-card__sheen" />
        </span>
      )}

      <div className="ach-card__medal">
        <Medal tier={def.tier} glyph={concealed ? 'question' : def.glyph} accent={def.accent} locked={!unlocked} size={56} />
      </div>

      <div className="ach-card__body">
        <div className="ach-card__head">
          <h3 id={titleId} className="ach-card__title">
            {unlocked ? (
              title
            ) : (
              <>
                <span aria-hidden="true">{title}</span>
                <span className="u-sr-only">{t('achievements.card.locked', { title: concealed ? t('achievements.card.secret') : def.title })}</span>
              </>
            )}
          </h3>
          {fresh && <Badge tone="gold">{t('achievements.card.new')}</Badge>}
        </div>
        <p className="ach-card__desc">{concealed ? (def.hint ?? t('achievements.card.secretHint')) : def.description}</p>

        <div className="ach-card__meta">
          <span className="ach-card__tier">{TIER_LABELS[def.tier]}</span>
          <span className="ach-card__points">{t('achievements.points', { count: def.points })}</span>
          {def.secret && <span className="ach-card__secret">{t('achievements.card.secretTag')}</span>}
        </div>

        {unlockedAt !== null ? (
          <div className="ach-card__date">
            <Icon name="check" size={14} />
            <span>
              {rich('achievements.card.unlocked', {
                date: () => (
                  <time dateTime={unlockedAt} title={formatDateTime(unlockedAt)}>
                    {formatDate(unlockedAt)}
                  </time>
                )
              })}
            </span>
          </div>
        ) : (
          !concealed && (
            <div className="ach-card__progress">
              <ProgressBar
                size="sm"
                tone="gold"
                value={state.ratio}
                label={t('achievements.card.progress', { title: def.title })}
                valueText={t('achievements.card.progressValue', { current: Math.min(state.current, state.target), target: state.target })}
              />
              <span className="ach-card__count">{progressText(state)}</span>
              {canExpand && (
                <IconButton
                  icon={open ? 'chevron-up' : 'chevron-down'}
                  label={open ? t('achievements.card.hideMissingFor', { title: def.title }) : t('achievements.card.showMissingFor', { title: def.title })}
                  tooltip={open ? t('achievements.card.hideMissing') : t('achievements.card.showMissing')}
                  size="sm"
                  className="ach-card__toggle"
                  aria-expanded={open}
                  aria-controls={open ? missingId : undefined}
                  onClick={() => onToggle(def.id)}
                />
              )}
            </div>
          )
        )}
      </div>

      {open && <MissingList def={def} context={context} id={missingId} />}
    </article>
  )
})
