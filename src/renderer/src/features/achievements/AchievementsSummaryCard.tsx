import { Link } from 'wouter'
import { cx, Icon, Panel, ProgressBar } from '@renderer/components/ui'
import { useAchievementSummary } from '@renderer/domain/achievements'
import { useT } from '@renderer/i18n'
import { formatDateTime, timeAgo } from '@renderer/lib/format'
import { paths } from '@renderer/shell/router'
import { Medal } from './Medal'
import { nextRankText, progressText, rankTier } from './model'
import './AchievementsSummaryCard.css'

/**
 * Achievements at a glance, for the Home page: rank, points, how much is unlocked, the latest
 * medals and a way into the full page. With nothing unlocked yet it points at the first goals.
 */
export default function AchievementsSummaryCard(props: { className?: string }) {
  const { rank, points, unlocked, total, recent, nearest } = useAchievementSummary(3, 2)
  const t = useT()

  return (
    <Panel
      tone="gold"
      title={t('achievements.summary.title')}
      className={cx('ach-sum', props.className)}
      actions={
        <Link href={paths.achievements()} className="ach-sum__link">
          {t('achievements.summary.viewAll')}
          <Icon name="arrow-right" size={14} />
        </Link>
      }
    >
      <div className="ach-sum__rank">
        <Medal tier={rankTier(rank.index)} glyph="trophy" size={60} />
        <div className="ach-sum__rank-text">
          <div className="ach-sum__name">{rank.name}</div>
          <div className="ach-sum__line">
            <span className="ach-sum__points">{t('achievements.points', { count: points })}</span>
            <span aria-hidden="true">·</span>
            <span>{t('achievements.summary.unlocked', { unlocked, total })}</span>
          </div>
          <ProgressBar
            tone="gold"
            size="sm"
            value={total > 0 ? unlocked / total : 0}
            label={t('achievements.unlocked.label')}
            valueText={t('achievements.unlocked.value', { unlocked, total })}
            className="ach-sum__bar"
          />
          <div className="ach-sum__next">{nextRankText(rank, points)}</div>
        </div>
      </div>

      {recent.length > 0 ? (
        <>
          <div className="ach-sum__heading u-eyebrow">{t('achievements.summary.latest')}</div>
          <ul className="ach-sum__list">
            {recent.map(({ def, date }) => (
              <li key={def.id} className={cx('ach-sum__item', `ach-tier--${def.tier}`)}>
                <Medal tier={def.tier} glyph={def.glyph} accent={def.accent} size={36} />
                <span className="ach-sum__item-text">
                  <span className="ach-sum__item-title">{def.title}</span>
                  <span className="ach-sum__item-desc">{def.description}</span>
                </span>
                <time className="ach-sum__item-when" dateTime={date} title={formatDateTime(date)}>
                  {timeAgo(date)}
                </time>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <p className="ach-sum__empty">{t('achievements.summary.empty')}</p>
          {nearest.length > 0 && (
            <>
              <div className="ach-sum__heading u-eyebrow">{t('achievements.near.first')}</div>
              <ul className="ach-sum__list">
                {nearest.map(({ def, state }) => (
                  <li key={def.id} className={cx('ach-sum__item', `ach-tier--${def.tier}`)}>
                    <Medal tier={def.tier} glyph={def.glyph} accent={def.accent} locked size={36} />
                    <span className="ach-sum__item-text">
                      <span className="ach-sum__item-title">{def.title}</span>
                      <span className="ach-sum__item-desc">{def.description}</span>
                    </span>
                    <span className="ach-sum__item-when">{progressText(state)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </Panel>
  )
}
