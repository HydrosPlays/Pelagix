import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { Link } from 'wouter'
import logo from '@renderer/assets/logo.png'
import { BallIcon, GameIcon, Sprite } from '@renderer/components/pokemon'
import { Button, Icon, Kbd, Panel, TextField } from '@renderer/components/ui'
import { matchRulePreset, RULE_PRESETS, useCollection } from '@renderer/domain/slots'
import { TRAINER_NAME_MAX, useTrainerName } from '@renderer/features/settings/useTrainerName'
import { animate, enterStagger, popIn, useAnimeScope } from '@renderer/lib/anim'
import { formatCount } from '@renderer/lib/format'
import { navigate, paths } from '@renderer/shell/router'
import { useUiStore } from '@renderer/store/ui'

const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)

/** The three starters, the first Pokémon most people ever look up. */
const STEP_ONE_SPECIES = [1, 4, 7] as const
const STEP_TWO_GAMES = ['red', 'heartgold', 'x', 'legendsarceus', 'scarlet'] as const
const STEP_THREE_BALLS = [4, 3, 2, 15] as const

function Step({ number, title, children, art }: { number: number; title: string; children: ReactNode; art: ReactNode }) {
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
          <span className="u-sr-only">Step {number}: </span>
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
              <div className="u-eyebrow">Welcome{name === '' ? '' : `, ${name}`}</div>
              <h1 id="home-title" className="home-welcome__title">
                Your Living Dex starts here
              </h1>
              <p className="home-welcome__lead">
                Pelagix keeps track of every Pokémon you catch, in every game: where you found it, the ball you used, its form, and whether it is shiny. One catch at a time, your Living Dex fills up.
              </p>
              <div className="home-welcome__name">
                <TextField
                  label="What should we call you?"
                  placeholder="Trainer name"
                  icon="user"
                  value={trainer.value}
                  onChange={trainer.onChange}
                  maxLength={TRAINER_NAME_MAX}
                  optional
                  hint={name === '' ? 'Used in greetings and filled in as the Original Trainer when you log a catch.' : `Saved. Nice to meet you, ${name}.`}
                />
              </div>
              <div className="home-welcome__actions">
                <Button variant="primary" size="lg" icon="dex" iconEnd="arrow-right" onClick={() => navigate(paths.dex())}>
                  Browse the Pokédex
                </Button>
                <Button size="lg" icon="search" aria-keyshortcuts="Control+K" onClick={() => useUiStore.getState().setCommandPalette(true)}>
                  Find a Pokémon
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
            How it works
          </h2>
        </div>
        <ol ref={stepsRef} className="home-steps">
          <Step
            number={1}
            title="Find a Pokémon"
            art={
              <span className="home-step__sprites">
                {STEP_ONE_SPECIES.map((id) => (
                  <Sprite key={id} species={id} size={64} />
                ))}
              </span>
            }
          >
            Look through the Pokédex or search by name or number. Every form, gender difference and shiny is in there.
          </Step>
          <Step
            number={2}
            title="Pick the game and location"
            art={
              <span className="home-step__games">
                {STEP_TWO_GAMES.map((id) => (
                  <GameIcon key={id} game={id} size={40} tooltip={false} alt="" />
                ))}
              </span>
            }
          >
            Its page lists every game it can be found in and how: caught, traded, gifted, evolved, bred or from an event.
          </Step>
          <Step
            number={3}
            title="Log it"
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
            Choose the ball, add the details you care about, and check it off. Log the same Pokémon again to collect it across games.
          </Step>
        </ol>
        <p className="home-welcome__foot">
          Your Living Dex has <b>{formatCount(totals.slots)} slots</b> under the {preset ? RULE_PRESETS[preset].label : 'custom'} rules.{' '}
          <Link href={paths.settings()}>Choose which forms count</Link>
        </p>
      </section>
    </div>
  )
}
