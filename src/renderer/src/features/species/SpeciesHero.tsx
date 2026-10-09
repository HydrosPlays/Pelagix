import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { FormSummary, SpeciesSummary } from '@shared/dex-types'
import { Sprite, SpriteStage, typeColor } from '@renderer/components/pokemon'
import { cx, Icon, Tooltip, type IconName } from '@renderer/components/ui'
import { burst, popIn, safeAnimate } from '@renderer/lib/anim'
import { resolveFormSprite } from '@renderer/lib/sprites'
import { rovingRadioKeyDown } from './hooks'

/** What the stage is showing on top of the selected form. */
export interface HeroView {
  shiny: boolean
  female: boolean
  gmax: boolean
  variant: number | undefined
}

/** A catch that was just logged: the stage celebrates each new `nonce` once. */
export interface Celebration {
  nonce: number
  shiny: boolean
}

export interface SpeciesHeroProps {
  species: SpeciesSummary
  form: FormSummary
  view: HeroView
  /** The user asked for shiny (page toggle or the global shiny view), whether or not a render exists. */
  shinyWanted: boolean
  onShiny: (on: boolean) => void
  onFemale: (on: boolean) => void
  onGmax: (on: boolean) => void
  onVariant: (id: number) => void
  celebration: Celebration | null
}

const STAMP_MS = 2000

function ViewToggle({ pressed, onChange, icon, children, gold, unavailable, describedBy }: { pressed: boolean; onChange: (on: boolean) => void; icon: IconName; children: ReactNode; gold?: boolean; unavailable?: string; describedBy?: string }) {
  const off = unavailable !== undefined
  const button = (
    <button
      type="button"
      className={cx('sp-toggle', gold && 'sp-toggle--gold', pressed && !off && 'is-on', off && 'is-off')}
      aria-pressed={pressed && !off}
      aria-disabled={off || undefined}
      aria-describedby={off ? describedBy : undefined}
      onClick={() => !off && onChange(!pressed)}
    >
      <Icon name={icon} size={14} />
      <span>{children}</span>
    </button>
  )
  return off ? <Tooltip content={unavailable}>{button}</Tooltip> : button
}

/**
 * The scanner stage with a large render of the selected form, and the switches that change what
 * it shows: shiny, female, Gigantamax and (Alcremie) the sweet. Only the ones that apply appear.
 */
export function SpeciesHero({ species, form, view, shinyWanted, onShiny, onFemale, onGmax, onVariant, celebration }: SpeciesHeroProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const spriteRef = useRef<HTMLDivElement>(null)
  const stampRef = useRef<HTMLDivElement>(null)
  const noteId = useId()
  const [stamp, setStamp] = useState<Celebration | null>(null)

  const variants = form.variants ?? []
  const variant = variants.find((v) => v.id === view.variant)
  const resolved = resolveFormSprite(species, form, view)
  // Gigantamax renders always have a shiny version; a sweet has its own flag.
  const shinyExists = view.gmax && form.gmax !== undefined ? true : variant ? variant.shiny : form.shiny
  const femaleApplies = form.female && !(view.gmax && form.gmax !== undefined) && !variant
  const name = `${view.shiny ? 'Shiny ' : ''}${view.gmax && form.gmax !== undefined ? 'Gigantamax ' : ''}${form.full}${variant ? ` with ${variant.name}` : ''}${view.female && femaleApplies ? ' (female)' : ''}`

  // A pop each time the picture changes, but not on the first paint (the page entrance covers that).
  const lookKey = `${form.f}|${resolved.path}`
  const firstLook = useRef(true)
  useEffect(() => {
    if (firstLook.current) {
      firstLook.current = false
      return
    }
    popIn(spriteRef.current, { from: 0.86 })
  }, [lookKey])

  // A catch was just registered: sparkles around the render and a stamp that slams in, briefly.
  const nonce = celebration?.nonce
  useEffect(() => {
    if (!celebration) return
    setStamp(celebration)
    const colors = celebration.shiny ? ['var(--gold)', 'var(--ball-white)', 'var(--gold)'] : ['var(--accent-2)', 'var(--ball-white)', 'var(--accent-3)', 'var(--catch)']
    const sparkle = setTimeout(() => burst(stageRef.current, { colors, count: celebration.shiny ? 28 : 20, distance: 150, y: 0.52 }), 260)
    const fade = setTimeout(() => safeAnimate(stampRef.current, { opacity: [1, 0], duration: 240, ease: 'linear' }), STAMP_MS - 280)
    const done = setTimeout(() => setStamp(null), STAMP_MS)
    return () => {
      clearTimeout(sparkle)
      clearTimeout(fade)
      clearTimeout(done)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce])

  useEffect(() => {
    if (stamp) popIn(stampRef.current, { from: 1.7 })
  }, [stamp])

  const shinyUnavailable = shinyExists ? undefined : variant ? 'There is no shiny render of this sweet.' : 'There is no shiny render of this form.'
  const types = form.types
  const variantLabel = variants.length > 0 && variants.every((v) => v.name.endsWith('Sweet')) ? 'Sweet' : 'Variant'

  return (
    <div className="sp-hero__stagecol">
      <div ref={stageRef} className="sp-stagewrap">
        <SpriteStage dexNumber={species.id} glow={types[0] ? typeColor(types[0]) : undefined} glow2={types[1] ? typeColor(types[1]) : undefined} className={cx('sp-stage', view.shiny && 'is-shiny')}>
          <div ref={spriteRef} className="sp-stage__sprite">
            <Sprite path={resolved.path} size="fill" resolution={340} lazy={false} alt={name} />
          </div>
        </SpriteStage>
        {resolved.approx && (
          <Tooltip content="Pokémon HOME has no render of this exact form, so the closest one is shown." placement="bottom">
            <span className="sp-stage__approx">
              <Icon name="info" size={13} />
              Closest render
            </span>
          </Tooltip>
        )}
        {stamp && (
          <div ref={stampRef} className={cx('sp-stamp', stamp.shiny && 'sp-stamp--gold')} role="status">
            <Icon name="check" size={16} strokeWidth={2.6} />
            Registered
          </div>
        )}
      </div>

      <div className="sp-toggles" role="group" aria-label="Render options">
        <ViewToggle pressed={shinyWanted} onChange={onShiny} icon="sparkle" gold unavailable={shinyUnavailable} describedBy={noteId}>
          Shiny
        </ViewToggle>
        {femaleApplies && (
          <ViewToggle pressed={view.female} onChange={onFemale} icon="female">
            Female
          </ViewToggle>
        )}
        {form.gmax !== undefined && (
          <ViewToggle pressed={view.gmax} onChange={onGmax} icon="expand">
            Gigantamax
          </ViewToggle>
        )}
      </div>
      {shinyUnavailable !== undefined && (
        <p id={noteId} className="sp-toggles__note">
          {shinyUnavailable}
        </p>
      )}

      {variants.length > 0 && !(view.gmax && form.gmax !== undefined) && (
        <div className="sp-variants">
          <div className="sp-variants__label">
            <span className="u-eyebrow">{variantLabel}</span>
            <span className="sp-variants__name">{variant?.name ?? variants[0]?.name}</span>
          </div>
          <div className="sp-variants__list" role="radiogroup" aria-label={variantLabel} onKeyDown={rovingRadioKeyDown}>
            {variants.map((v, index) => {
              const selected = variant ? v.id === variant.id : index === 0
              return (
                <Tooltip key={v.id} content={v.name}>
                  <button type="button" role="radio" aria-checked={selected} aria-label={v.name} tabIndex={selected ? 0 : -1} className={cx('sp-variant', selected && 'is-selected')} onClick={() => onVariant(v.id)}>
                    <Sprite species={species} form={form} variant={v.id} shiny={view.shiny} size={36} />
                  </button>
                </Tooltip>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
