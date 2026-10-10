import type { ReactNode } from 'react'
import { Link } from 'wouter'
import type { DexRules } from '@shared/save-types'
import { ShinyMark } from '@renderer/components/pokemon'
import { HudBrackets, NumberTicker, ProgressRing, SegmentedControl, cx } from '@renderer/components/ui'
import type { CollectionTotals } from '@renderer/domain/slots'
import { rich, useT } from '@renderer/i18n'
import { formatCount, ratio } from '@renderer/lib/format'
import { paths } from '@renderer/shell/router'
import { rulesLine, type LivingMode, type LivingStats } from './model'

export interface LivingHeroProps {
  mode: LivingMode
  onMode: (mode: LivingMode) => void
  stats: LivingStats
  /** Totals of the whole collection, whatever the mode. */
  totals: CollectionTotals
  /** Species with at least one shiny entry. */
  shinySpecies: number
  rules: DexRules
  boxes: number
  /** Short name of the game the page is narrowed to ("Sword"): the numbers count that game only. */
  game?: string
}

/** Percentage for the ring: one decimal, and never 0 or 100 unless that is exact. */
function shownPercent(part: number, total: number): { value: number; decimals: number } {
  if (total <= 0 || part <= 0) return { value: 0, decimals: 0 }
  if (part >= total) return { value: 100, decimals: 0 }
  return { value: Math.min(99.9, Math.max(0.1, Math.round(ratio(part, total) * 1000) / 10)), decimals: 1 }
}

/** The page header: the big progress readout, the mode switch and the rules in force. */
export function LivingHero({ mode, onMode, stats, totals, shinySpecies, rules, boxes, game }: LivingHeroProps) {
  const t = useT()
  const shiny = mode === 'shiny'
  const complete = stats.slots > 0 && stats.filled === stats.slots
  const pct = shownPercent(stats.filled, stats.slots)
  const left = stats.slots - stats.filled
  const unit = game === undefined ? t(shiny ? 'living.hero.unitShiny' : 'living.hero.unit') : t(shiny ? 'living.hero.unitShinyGame' : 'living.hero.unitGame', { game })
  const countText =
    game === undefined
      ? t(shiny ? 'living.hero.countShiny' : 'living.hero.count', { filled: stats.filled, count: stats.slots })
      : t(shiny ? 'living.hero.countShinyGame' : 'living.hero.countGame', { filled: stats.filled, count: stats.slots, game })
  const bold = { b: (text: ReactNode) => <b>{text}</b> }

  return (
    <header className={cx('living-hero', shiny && 'is-shiny', complete && 'is-complete')}>
      <HudBrackets corners="diagonal" inset={8} size={16} />

      <ProgressRing className="living-hero__ring" value={ratio(stats.filled, stats.slots)} size={124} thickness={10} tone={shiny || complete ? 'gold' : 'accent'} label={shiny ? t('living.hero.ringShiny') : t('living.hero.ring')} valueText={countText}>
        <span className="living-hero__pct">
          <NumberTicker value={pct.value} decimals={pct.decimals} />
          <span className="living-hero__pct-sign">%</span>
        </span>
      </ProgressRing>

      <div className="living-hero__main">
        <h1 className="living-hero__title">
          {shiny && <ShinyMark size={22} twinkle label="" />}
          {shiny ? t('living.hero.titleShiny') : t('living.hero.title')}
        </h1>
        <p className="living-hero__count">
          <NumberTicker value={stats.filled} className="living-hero__caught" />
          <span className="living-hero__total"> / {formatCount(stats.slots)}</span>
          <span className="living-hero__unit">{unit}</span>
        </p>
        <p className="living-hero__second">
          {shiny ? (
            <span>{rich('living.hero.anyColour', bold, { count: totals.caught })}</span>
          ) : (
            <span className="living-hero__shiny">
              <ShinyMark size={14} label="" />
              {rich('living.hero.shiny', bold, { count: totals.shiny })}
            </span>
          )}
          <span className="living-hero__dot" aria-hidden="true" />
          <span>{complete ? t('living.hero.done') : t('living.hero.toGo', { count: left })}</span>
        </p>
        <p className="living-hero__rules">
          {rulesLine(rules, stats.slots, game)}
          <Link href={paths.settings()} className="living-hero__rules-link">
            {t('living.rules.change')}
          </Link>
        </p>
      </div>

      <div className="living-hero__side">
        <SegmentedControl
          className="living-hero__mode"
          label={t('living.hero.mode')}
          value={mode}
          onChange={onMode}
          options={[
            { value: 'normal', label: t('living.hero.mode.normal'), icon: 'pokeball' },
            { value: 'shiny', label: t('common.shiny'), icon: 'sparkle' }
          ]}
        />
        <dl className="living-hero__stats">
          <div className="living-hero__stat">
            <dt>{t('living.hero.boxesComplete')}</dt>
            <dd>
              <b>{formatCount(stats.boxesComplete)}</b> / {formatCount(boxes)}
            </dd>
          </div>
          <div className="living-hero__stat">
            <dt>{shiny ? t('living.hero.speciesShiny') : t('living.hero.species')}</dt>
            <dd>
              <b>{formatCount(shiny ? shinySpecies : totals.speciesCaught)}</b> / {formatCount(totals.species)}
            </dd>
          </div>
        </dl>
      </div>
    </header>
  )
}
