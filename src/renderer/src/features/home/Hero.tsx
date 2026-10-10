import { useLayoutEffect, useRef } from 'react'
import { Link } from 'wouter'
import logo from '@renderer/assets/logo.png'
import { BallIcon, ShinyMark } from '@renderer/components/pokemon'
import { Button, Icon, Kbd, NumberTicker, Panel, ProgressRing } from '@renderer/components/ui'
import type { Progress } from '@renderer/domain/progress'
import { matchRulePreset } from '@renderer/domain/slots'
import { rich, useT } from '@renderer/i18n'
import { animate, enterStagger, popIn, useAnimeScope } from '@renderer/lib/anim'
import { formatCount, percent } from '@renderer/lib/format'
import { navigate, paths } from '@renderer/shell/router'
import type { DexRules } from '@shared/save-types'
import { useUiStore } from '@renderer/store/ui'
import { greeting, nextStep, tickerPercent } from './home-model'
import { useArmed, useNarrowerThan } from './parts'

const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)

export interface HeroProps {
  progress: Progress
  trainerName: string
  rules: DexRules
}

/** The band at the top of Home: brand, greeting, headline Living Dex progress and the three ways on. */
export function Hero({ progress, trainerName, rules }: HeroProps) {
  const rootRef = useRef<HTMLElement>(null)
  const logoRef = useRef<HTMLDivElement>(null)
  const copyRef = useRef<HTMLDivElement>(null)
  const armed = useArmed()
  // Matches the container query in HomePage.css that tightens the hero.
  const compact = useNarrowerThan(rootRef, 1040)

  const { totals, shiny } = progress
  const preset = matchRulePreset(rules)
  const t = useT()
  const rulesLabel = t(`home.rules.${preset ?? 'custom'}`)
  const caughtText = t('home.hero.ring.value', { caught: totals.caught, total: totals.slots, percent: percent(totals.caught, totals.slots) })
  const complete = totals.slots > 0 && totals.caught >= totals.slots

  useLayoutEffect(() => {
    popIn(logoRef.current, { from: 0.86 })
    enterStagger(copyRef.current?.children, { delay: 60, step: 60, y: 10 })
  }, [])

  // The emblem drifts slowly; a looping effect lives in a scope so it is reverted with the page.
  useAnimeScope(rootRef, (_scope, { motion }) => {
    if (motion) animate('.home-hero__logo-img', { y: [0, -5], duration: 2800, ease: 'inOut(2)', loop: true, alternate: true })
  })

  return (
    <section ref={rootRef} className="home-hero" aria-labelledby="home-title">
      <Panel tone="accent" chamfer brackets padding="none" className="home-hero__panel">
        <span className="home-hero__wash" aria-hidden="true" />
        <span className="home-hero__scan" aria-hidden="true" />

        <div className="home-hero__main">
          <div ref={logoRef} className="home-hero__logo">
            <img className="home-hero__logo-img" src={logo} alt="Pelagix" draggable={false} />
          </div>

          <div ref={copyRef} className="home-hero__copy">
            <div className="u-eyebrow">{t('home.hero.eyebrow')}</div>
            <h1 id="home-title" className="home-hero__title">
              {greeting(trainerName)}
            </h1>
            <p className="home-hero__lead">{nextStep(progress)}</p>
          </div>

          <div className="home-hero__progress">
            <ProgressRing value={armed ? totals.completion : 0} size={compact ? 164 : 188} thickness={compact ? 11 : 12} tone={complete ? 'gold' : 'accent'} label={t('home.hero.ring.label')} valueText={caughtText} className="home-hero__ring">
              <div className="home-hero__figure">
                <NumberTicker value={totals.completion * 100} decimals={1} duration={900} format={(v) => tickerPercent(v, totals.caught, totals.slots)} className="home-hero__pct" />
                <span className="home-hero__count">
                  <NumberTicker value={totals.caught} duration={900} className="home-hero__caught" />
                  <span aria-hidden="true"> / </span>
                  <span className="u-sr-only"> {t('home.hero.of')} </span>
                  {formatCount(totals.slots)}
                </span>
                <span className="u-eyebrow">{t('home.hero.caught')}</span>
              </div>
            </ProgressRing>

            <ul className="home-hero__stats">
              <li className="home-hero__stat home-hero__stat--gold">
                <span className="home-hero__stat-value">
                  <ShinyMark size={18} label="" twinkle={shiny.slots > 0} />
                  <NumberTicker value={shiny.slots} />
                </span>
                <span className="u-eyebrow">{t('common.shiny')}</span>
              </li>
              <li className="home-hero__stat">
                <span className="home-hero__stat-value">
                  <NumberTicker value={totals.speciesCaught} />
                  <span className="home-hero__stat-of"> / {formatCount(totals.species)}</span>
                </span>
                <span className="u-eyebrow">{t('home.hero.stat.species')}</span>
              </li>
              <li className="home-hero__stat">
                <span className="home-hero__stat-value">
                  <NumberTicker value={totals.entries} />
                </span>
                <span className="u-eyebrow">{t('home.hero.stat.entries')}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="home-hero__bar">
          <div className="home-hero__actions">
            <Button variant="catch" size="lg" icon={<BallIcon ball={4} size={22} label="" />} aria-keyshortcuts="Control+K" onClick={() => useUiStore.getState().setCommandPalette(true)}>
              {t('home.action.logCatch')}
            </Button>
            <Button size="lg" icon="dex" onClick={() => navigate(paths.dex())}>
              {t('home.action.browse')}
            </Button>
            <Button size="lg" variant="ghost" icon="grid" onClick={() => navigate(paths.living())}>
              {t('home.action.openLiving')}
            </Button>
          </div>
          <div className="home-hero__aside">
            <span className="home-hero__hint">{rich('home.hero.hint', { keys: () => <Kbd keys={[isMac ? '⌘' : 'Ctrl', 'K']} />, text: (c) => <span>{c}</span> })}</span>
            <Link href={paths.settings()} className="home-hero__rules" title={t('home.hero.rulesHint')}>
              <Icon name="settings" size={14} />
              <span>{t('home.hero.slots', { count: totals.slots, rules: rulesLabel })}</span>
            </Link>
          </div>
        </div>
      </Panel>
    </section>
  )
}
