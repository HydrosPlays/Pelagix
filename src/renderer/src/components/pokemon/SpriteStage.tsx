import type { CSSProperties, ReactNode } from 'react'
import { cx } from '../ui/cx'
import { HudBrackets } from '../ui/Panel'
import { DexNumber } from './Marks'
import './SpriteStage.css'

export interface SpriteStageProps {
  /** The sprite (and anything layered with it). */
  children: ReactNode
  /** Giant dex number behind the sprite. */
  dexNumber?: number
  /** Glow colour behind the sprite (any CSS colour, e.g. `typeColor(type)`). Default: the accent. */
  glow?: string
  /** A second glow colour for dual types. */
  glow2?: string
  /** HUD corner brackets. Default true. */
  brackets?: boolean
  /** Faint scan grid. Default true. */
  grid?: boolean
  className?: string
  style?: CSSProperties
}

/**
 * The hero "scanner" stage a featured sprite sits on: scan grid, HUD brackets, a soft type-coloured
 * glow and an optional dex-number watermark. Size it from outside (it fills its box).
 */
export function SpriteStage({ children, dexNumber, glow, glow2, brackets = true, grid = true, className, style }: SpriteStageProps) {
  const vars = { ...(glow ? { '--stage-a': glow } : null), ...(glow2 ? { '--stage-b': glow2 } : glow ? { '--stage-b': glow } : null), ...style } as CSSProperties
  return (
    <div className={cx('pk-stage', className)} style={vars}>
      <span className="pk-stage__glow" aria-hidden="true" />
      {grid && <span className="pk-stage__grid" aria-hidden="true" />}
      {dexNumber !== undefined && <DexNumber id={dexNumber} variant="watermark" className="pk-stage__number" />}
      {brackets && <HudBrackets inset={10} size={18} />}
      <div className="pk-stage__content">{children}</div>
    </div>
  )
}
