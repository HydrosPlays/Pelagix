import { Link } from 'wouter'
import { cx, Icon, Panel, ProgressBar } from '@renderer/components/ui'
import { useAchievementSummary } from '@renderer/domain/achievements'
import { formatCount, formatDateTime, plural, timeAgo } from '@renderer/lib/format'
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

  return (
    <Panel
      tone="gold"
      title="Achievements"
      className={cx('ach-sum', props.className)}
      actions={
        <Link href={paths.achievements()} className="ach-sum__link">
          View all
          <Icon name="arrow-right" size={14} />
        </Link>
      }
    >
      <div className="ach-sum__rank">
        <Medal tier={rankTier(rank.index)} glyph="trophy" size={60} />
        <div className="ach-sum__rank-text">
          <div className="ach-sum__name">{rank.name}</div>
          <div className="ach-sum__line">
            <span className="ach-sum__points">{plural(points, 'point')}</span>
            <span aria-hidden="true">·</span>
            <span>
              {formatCount(unlocked)} / {formatCount(total)} unlocked
            </span>
          </div>
          <ProgressBar
            tone="gold"
            size="sm"
            value={total > 0 ? unlocked / total : 0}
            label="Achievements unlocked"
            valueText={`${formatCount(unlocked)} of ${formatCount(total)}`}
            className="ach-sum__bar"
          />
          <div className="ach-sum__next">{nextRankText(rank, points)}</div>
        </div>
      </div>

      {recent.length > 0 ? (
        <>
          <div className="ach-sum__heading u-eyebrow">Latest medals</div>
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
          <p className="ach-sum__empty">No medals yet. Log a catch and the first one is yours.</p>
          {nearest.length > 0 && (
            <>
              <div className="ach-sum__heading u-eyebrow">First goals</div>
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
