import { useRef } from 'react'
import { Link } from 'wouter'
import { Sprite } from '@renderer/components/pokemon'
import { Icon } from '@renderer/components/ui'
import type { LivingSlot } from '@renderer/domain/slots'
import { useT } from '@renderer/i18n'
import { enterStagger } from '@renderer/lib/anim'
import { dexNo } from '@renderer/lib/format'
import { paths } from '@renderer/shell/router'
import { useRevealOnce } from './motion'
import { MoreLink } from './parts'

/** How many suggestions are rendered; CSS shows as many of them as fit one row. */
const MAX_TILES = 10

export interface ContinueHuntProps {
  /** The next uncaught slots, in dex order. */
  slots: readonly LivingSlot[]
  /** Slots still missing in total. */
  missing: number
}

/** "What next": the first Pokémon still missing from the Living Dex, each a link to its Pokédex page. */
export function ContinueHunt({ slots, missing }: ContinueHuntProps) {
  const listRef = useRef<HTMLUListElement>(null)
  const t = useT()
  useRevealOnce(listRef, (list) => void enterStagger(list.children, { step: 32, y: 10 }))

  if (slots.length === 0) {
    return (
      <section className="section home-hunt" aria-labelledby="home-hunt-title">
        <div className="home-hunt__done">
          <span className="home-hunt__done-icon" aria-hidden="true">
            <Icon name="trophy" size={22} />
          </span>
          <div>
            <h2 id="home-hunt-title" className="section-title">
              {t('home.hunt.done.title')}
            </h2>
            <p className="u-muted">{t('home.hunt.done.text')}</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="section home-hunt" aria-labelledby="home-hunt-title">
      <div className="section-header">
        <h2 id="home-hunt-title" className="section-title">
          <Icon name="target" size={18} />
          {t('home.hunt.title')}
        </h2>
        <MoreLink href={paths.living()}>{t('home.hunt.missing', { count: missing })}</MoreLink>
      </div>
      <ul ref={listRef} className="home-hunt__list">
        {slots.slice(0, MAX_TILES).map((slot) => (
          <li key={slot.key} className="home-hunt__item">
            <Link href={paths.species(slot.species, slot.form)} className="home-hunt__tile" aria-label={t('home.hunt.tile', { name: slot.label, number: dexNo(slot.species) })}>
              <span className="home-hunt__art">
                <Sprite path={slot.spritePath(false)} size="fill" resolution={112} silhouette />
              </span>
              <span className="home-hunt__no">{dexNo(slot.species)}</span>
              <span className="home-hunt__name" title={slot.label}>
                {slot.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
