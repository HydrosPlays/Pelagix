import { cx } from '@renderer/components/ui'
import { useT } from '@renderer/i18n'
import './CaughtMark.css'

/** A small Poké Ball with a tick: this one is in the Living Dex. Decorative; pair it with text or a label. */
export function CaughtBall({ size = 16 }: { size?: number }) {
  return (
    <svg className="dex-caught__ball" width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle cx="9" cy="9" r="7.6" fill="var(--ball-white)" />
      <path d="M1.4 9a7.6 7.6 0 0 1 15.2 0z" fill="var(--ball-red)" />
      <path d="M1.4 9h15.2" stroke="var(--ball-band)" strokeWidth="1.7" />
      <circle cx="9" cy="9" r="2.5" fill="var(--ball-white)" stroke="var(--ball-band)" strokeWidth="1.5" />
      <circle cx="9" cy="9" r="7.6" fill="none" stroke="var(--ball-band)" strokeWidth="1.3" />
      <circle className="dex-caught__tick" cx="14.6" cy="14.6" r="4.9" />
      <path className="dex-caught__check" d="m12.4 14.7 1.6 1.6 2.9-3.2" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export interface CaughtMarkProps {
  /** Logged entries; printed next to the ball. */
  entries: number
  size?: 'sm' | 'md'
  /** Read the mark out ("Caught, 2 entries"). Off where the surrounding text already says it. */
  labelled?: boolean
  className?: string
}

/** The caught pill used on Pokédex tiles and search results: ball, tick and how many entries are logged. */
export function CaughtMark({ entries, size = 'md', labelled = false, className }: CaughtMarkProps) {
  const t = useT()
  const text = t('pokedex.caught.entries', { count: entries })
  return (
    <span className={cx('dex-caught', `dex-caught--${size}`, className)} title={text} role={labelled ? 'img' : undefined} aria-label={labelled ? t('pokedex.caught.label', { count: entries }) : undefined}>
      <CaughtBall size={size === 'sm' ? 15 : 17} />
      <span className="dex-caught__count" aria-hidden={labelled || undefined}>
        {entries > 99 ? '99+' : entries}
      </span>
    </span>
  )
}
