import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { Link } from 'wouter'
import logo from '@renderer/assets/logo.png'
import { BallIcon, GameIcon, Sprite } from '@renderer/components/pokemon'
import { Button, Icon, Kbd, Panel, TextField } from '@renderer/components/ui'
import { matchRulePreset, useCollection } from '@renderer/domain/slots'
import { TRAINER_NAME_MAX, useTrainerName } from '@renderer/features/settings/useTrainerName'
import { rich, useT } from '@renderer/i18n'
import { animate, enterStagger, popIn, useAnimeScope } from '@renderer/lib/anim'
import { navigate, paths } from '@renderer/shell/router'
import { useUiStore } from '@renderer/store/ui'

const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)

/** The three starters, the first Pokémon most people ever look up. */
const STEP_ONE_SPECIES = [1, 4, 7] as const
const STEP_TWO_GAMES = ['red', 'heartgold', 'x', 'legendsarceus', 'scarlet'] as const
const STEP_THREE_BALLS = [4, 3, 2, 15] as const

function Step({ number, title, children, art }: { number: number; title: string; children: ReactNode; art: ReactNode }) {
  const t = useT()
  return (
    <li className="home-step">
      <div className="home-step__art" aria-hidden="true">
        {art}
      </div>
      <div className="home-step__text">
        <span className="home-step__number" aria-hidden="true">
          {number}
        </span>
        <h3 className="home-step__title">
          <span className="u-sr-only">{t('home.welcome.step.number', { number: String(number) })} </span>
          {title}
        </h3>
        <p className="home-step__body">{children}</p>
      </div>
    </li>
  )
}

/** First run: nothing is logged yet, so Home explains the idea instead of showing empty charts. */
export function Welcome() {
  const rootRef = useRef<HTMLDivElement>(null)
  const logoRef = useRef<HTMLDivElement>(null)
  const copyRef = useRef<HTMLDivElement>(null)
  const stepsRef = useRef<HTMLOListElement>(null)
  const trainer = useTrainerName()
  const { totals, rules } = useCollection()
  const preset = matchRulePreset(rules)
  const name = trainer.stored
  const t = useT()

  useLayoutEffect(() => {
    popIn(logoRef.current, { from: 0.86 })
    enterStagger(copyRef.current?.children, { delay: 80, step: 70, y: 10 })
    enterStagger(stepsRef.current?.children, { delay: 320, step: 90, y: 16 })
  }, [])

  useAnimeScope(rootRef, (_scope, { motion }) => {
    if (motion) animate('.home-welcome__logo-img', { y: [0, -6], duration: 2800, ease: 'inOut(2)', loop: true, alternate: true })
  })

  return (
    <div ref={rootRef} className="page home home--welcome">
      <section className="home-welcome" aria-labelledby="home-title">
        <Panel tone="accent" chamfer brackets padding="none" className="home-welcome__panel">
          <span className="home-hero__wash" aria-hidden="true" />
          <span className="home-hero__scan" aria-hidden="true" />
          <div className="home-welcome__main">
            <div ref={logoRef} className="home-welcome__logo">
              <img className="home-welcome__logo-img" src={logo} alt="Pelagix" draggable={false} />
            </div>
            <div ref={copyRef} className="home-welcome__copy">
              <div className="u-eyebrow">{name === '' ? t('home.welcome.eyebrow') : t('home.welcome.eyebrowNamed', { name })}</div>
              <h1 id="home-title" className="home-welcome__title">
                {t('home.welcome.title')}
              </h1>
              <p className="home-welcome__lead">{t('home.welcome.lead')}</p>
              <div className="home-welcome__name">
                <TextField
                  label={t('home.welcome.name.label')}
                  placeholder={t('home.welcome.name.placeholder')}
                  icon="user"
                  value={trainer.value}
                  onChange={trainer.onChange}
                  maxLength={TRAINER_NAME_MAX}
                  optional
                  hint={name === '' ? t('home.welcome.name.hint') : t('home.welcome.name.saved', { name })}
                />
              </div>
              <div className="home-welcome__actions">
                <Button variant="primary" size="lg" icon="dex" iconEnd="arrow-right" onClick={() => navigate(paths.dex())}>
                  {t('home.action.browse')}
                </Button>
                <Button size="lg" icon="search" aria-keyshortcuts="Control+K" onClick={() => useUiStore.getState().setCommandPalette(true)}>
                  {t('home.welcome.find')}
                  <Kbd keys={[isMac ? '⌘' : 'Ctrl', 'K']} className="home-welcome__kbd" />
                </Button>
              </div>
            </div>
          </div>
        </Panel>
      </section>

      <section className="section" aria-labelledby="home-steps-title">
        <div className="section-header">
          <h2 id="home-steps-title" className="section-title">
            {t('home.welcome.steps.title')}
          </h2>
        </div>
        <ol ref={stepsRef} className="home-steps">
          <Step
            number={1}
            title={t('home.welcome.step.find.title')}
            art={
              <span className="home-step__sprites">
                {STEP_ONE_SPECIES.map((id) => (
                  <Sprite key={id} species={id} size={64} />
                ))}
              </span>
            }
          >
            {t('home.welcome.step.find.text')}
          </Step>
          <Step
            number={2}
            title={t('home.welcome.step.pick.title')}
            art={
              <span className="home-step__games">
                {STEP_TWO_GAMES.map((id) => (
                  <GameIcon key={id} game={id} size={40} tooltip={false} alt="" />
                ))}
              </span>
            }
          >
            {t('home.welcome.step.pick.text')}
          </Step>
          <Step
            number={3}
            title={t('home.welcome.step.log.title')}
            art={
              <span className="home-step__balls">
                {STEP_THREE_BALLS.map((id) => (
                  <BallIcon key={id} ball={id} size={34} label="" />
                ))}
                <span className="home-step__check">
                  <Icon name="check" size={18} strokeWidth={2.6} />
                </span>
              </span>
            }
          >
            {t('home.welcome.step.log.text')}
          </Step>
        </ol>
        <p className="home-welcome__foot">
          {rich(`home.welcome.foot.${preset ?? 'custom'}`, { b: (c) => <b>{c}</b> }, { count: totals.slots })} <Link href={paths.settings()}>{t('home.welcome.foot.link')}</Link>
        </p>
      </section>
    </div>
  )
}
