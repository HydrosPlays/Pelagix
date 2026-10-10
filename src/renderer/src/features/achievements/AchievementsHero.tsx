import { useLayoutEffect, useRef } from 'react'
import { cx, NumberTicker, Panel, ProgressRing, Tooltip } from '@renderer/components/ui'
import { rankProgress, RANKS, type AchievementRank, type AchievementSummary, type NearAchievement } from '@renderer/domain/achievements'
import { useT } from '@renderer/i18n'
import { enterStagger } from '@renderer/lib/anim'
import { formatCount, percent } from '@renderer/lib/format'
import { Medal } from './Medal'
import { nextRankText, progressText, rankTier } from './model'

/**
 * The way up the ladder as one segmented bar: a segment per rank still to reach, filled as the
 * points come in. Hovering a segment names the rank it leads to.
 */
function RankTrack({ rank, points }: { rank: AchievementRank; points: number }) {
  const progress = rankProgress(rank, points)
  const t = useT()
  return (
    <div
      className="ach-ladder"
      role="progressbar"
      aria-label={rank.nextName === null ? t('achievements.hero.rankProgress') : t('achievements.hero.progressTo', { rank: rank.nextName })}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      aria-valuetext={nextRankText(rank, points)}
    >
      {RANKS.slice(1).map((next, i) => {
        const fill = rank.index > i ? 1 : rank.index === i ? progress : 0
        return (
          <Tooltip key={next.at} content={t('achievements.hero.rankFrom', { rank: next.name, count: next.at })}>
            <span className={cx('ach-ladder__step', `ach-tier--${rankTier(i + 1)}`, rank.index === i && 'is-current')}>
              <span className="ach-ladder__fill" style={{ transform: `scaleX(${fill})` }} />
            </span>
          </Tooltip>
        )
      })}
    </div>
  )
}

function NearItem({ near, onPick }: { near: NearAchievement; onPick: (id: string) => void }) {
  const { def, state } = near
  const t = useT()
  return (
    <li className="ach-near__cell">
      <button
        type="button"
        className={cx('ach-near__item', `ach-tier--${def.tier}`)}
        aria-label={t('achievements.near.item', { title: def.title, current: state.current, target: state.target })}
        onClick={() => onPick(def.id)}
      >
        <Medal tier={def.tier} glyph={def.glyph} accent={def.accent} locked size={40} />
        <span className="ach-near__text" aria-hidden="true">
          <span className="ach-near__title">{def.title}</span>
          <span className="ach-near__meter">
            <span className="ach-near__fill" style={{ transform: `scaleX(${state.ratio})` }} />
          </span>
        </span>
        <span className="ach-near__count" aria-hidden="true">
          {progressText(state)}
        </span>
      </button>
    </li>
  )
}

export interface AchievementsHeroProps {
  summary: AchievementSummary
  /** Jump to an achievement card. */
  onPick: (id: string) => void
}

/** Top of the page: rank and the way to the next one, points, how much is unlocked, and the closest goals. */
export function AchievementsHero({ summary, onPick }: AchievementsHeroProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { rank, points, maxPoints, unlocked, total, nearest } = summary
  const started = nearest.some((near) => near.state.ratio > 0)
  const t = useT()

  useLayoutEffect(() => {
    enterStagger(ref.current?.querySelectorAll('[data-enter]'), { step: 60, y: 10 })
  }, [])

  return (
    <Panel ref={ref} as="section" tone="gold" chamfer brackets padding="lg" className="ach-hero" aria-label={t('achievements.hero.label')}>
      <div className="ach-hero__top">
        <div className="ach-rank" data-enter>
          <div className="ach-rank__medal">
            <Medal tier={rankTier(rank.index)} glyph="trophy" size={104} />
          </div>
          <div className="ach-rank__text">
            <div className="u-eyebrow">{t('achievements.hero.rankOf', { rank: rank.index + 1, total: RANKS.length })}</div>
            <h2 className="ach-rank__name">{rank.name}</h2>
            <RankTrack rank={rank} points={points} />
            <p className="ach-rank__next">{nextRankText(rank, points)}</p>
          </div>
        </div>

        <div className="ach-stats">
          <div className="ach-stat" data-enter>
            <div className="u-eyebrow">{t('achievements.hero.points')}</div>
            <div className="ach-stat__value">
              <NumberTicker value={points} className="ach-stat__number" />
              <span className="ach-stat__of">{t('achievements.hero.pointsOf', { total: maxPoints })}</span>
            </div>
          </div>
          <div className="ach-stat ach-stat--ring" data-enter>
            <ProgressRing value={total > 0 ? unlocked / total : 0} size={72} tone="gold" label={t('achievements.unlocked.label')} valueText={t('achievements.unlocked.value', { unlocked, total })}>
              <span className="ach-stat__percent">{percent(unlocked, total, 0)}</span>
            </ProgressRing>
            <div>
              <div className="u-eyebrow">{t('achievements.hero.unlocked')}</div>
              <div className="ach-stat__value">
                <NumberTicker value={unlocked} className="ach-stat__number" />
                <span className="ach-stat__of">/ {formatCount(total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="ach-near" data-enter>
        <h2 className="ach-near__heading u-eyebrow">{nearest.length === 0 ? t('achievements.near.done.title') : started ? t('achievements.near.started') : t('achievements.near.first')}</h2>
        {nearest.length === 0 ? (
          <p className="ach-near__done">{t('achievements.near.done.text')}</p>
        ) : (
          <ul className="ach-near__list">
            {nearest.map((near) => (
              <NearItem key={near.def.id} near={near} onPick={onPick} />
            ))}
          </ul>
        )}
      </div>
    </Panel>
  )
}
