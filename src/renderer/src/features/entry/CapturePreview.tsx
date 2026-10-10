import { useImperativeHandle, useRef, type Ref } from 'react'
import type { TypeId } from '@shared/dex-types'
import type { CatchEntry } from '@shared/save-types'
import { BallIcon, EntryCard, Sprite, SpriteStage, typeColor } from '@renderer/components/pokemon'
import { cx } from '@renderer/components/ui'
import { useT } from '@renderer/i18n'
import { animate, burst, motionOK, type JSAnimation } from '@renderer/lib/anim'

/** Length of the capture animation, ms. */
const CAPTURE_MS = 1320

export interface CaptureHandle {
  /** Plays the capture and returns how long it takes; 0 when motion is off (nothing plays). */
  play: () => number
  /** Puts the stage back as it was, for the next catch. */
  reset: () => void
}

export interface CapturePreviewProps {
  /** The entry as it would be saved right now. */
  entry: CatchEntry
  /** HOME render path of that entry. */
  spritePath: string
  types: readonly TypeId[]
  /** No game chosen yet: the card hides its game line instead of calling it unknown. */
  noGame: boolean
  ref?: Ref<CaptureHandle>
}

/**
 * The right-hand side of the editor: the Pokémon on a small stage with its ball, and the entry
 * card exactly as it will look. On save the ball flies in, takes the Pokémon, wobbles and clicks shut.
 */
export function CapturePreview({ entry, spritePath, types, noGame, ref }: CapturePreviewProps) {
  const t = useT()
  const stageRef = useRef<HTMLDivElement>(null)
  const spriteRef = useRef<HTMLDivElement>(null)
  const ballRef = useRef<HTMLDivElement>(null)
  const running = useRef<JSAnimation[]>([])
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([])

  useImperativeHandle(ref, () => ({
    play() {
      const stage = stageRef.current
      const sprite = spriteRef.current
      const ball = ballRef.current
      if (!stage || !sprite || !ball || !motionOK()) return 0
      const stageBox = stage.getBoundingClientRect()
      const ballBox = ball.getBoundingClientRect()
      const dx = stageBox.left + stageBox.width / 2 - (ballBox.left + ballBox.width / 2)
      const dy = stageBox.top + stageBox.height / 2 - (ballBox.top + ballBox.height / 2)
      running.current = [
        // The ball hops to the middle, holds, wobbles three times and clicks shut.
        animate(ball, {
          x: [{ to: dx, duration: 340, ease: 'out(3)' }],
          y: [
            { to: dy - 30, duration: 200, ease: 'out(3)' },
            { to: dy, duration: 140, ease: 'in(2)' }
          ],
          scale: [
            { to: 1.55, duration: 340, ease: 'out(3)' },
            { to: 1.55, duration: 600, ease: 'linear' },
            { to: 1.34, duration: 70, ease: 'out(2)' },
            { to: 1.55, duration: 220, ease: 'outBack(3)' }
          ],
          rotate: [
            { to: 0, duration: 500, ease: 'linear' },
            { to: -22, duration: 110, ease: 'inOut(2)' },
            { to: 18, duration: 130, ease: 'inOut(2)' },
            { to: -10, duration: 110, ease: 'inOut(2)' },
            { to: 0, duration: 90, ease: 'inOut(2)' }
          ]
        }),
        // The Pokémon is drawn into it.
        animate(sprite, {
          scale: [
            { to: 1, duration: 250, ease: 'linear' },
            { to: 0.1, duration: 240, ease: 'in(3)' }
          ],
          opacity: [
            { to: 1, duration: 300, ease: 'linear' },
            { to: 0, duration: 190, ease: 'linear' }
          ]
        })
      ]
      const colors = entry.shiny ? ['var(--gold)', 'var(--ball-white)', 'var(--gold)'] : ['var(--catch)', 'var(--ball-white)', 'var(--accent-2)']
      timers.current.push(setTimeout(() => burst(stage, { colors, count: entry.shiny ? 22 : 16, distance: 96 }), 980))
      return CAPTURE_MS
    },
    reset() {
      for (const timer of timers.current) clearTimeout(timer)
      timers.current = []
      for (const animation of running.current) animation.revert()
      running.current = []
    }
  }))

  return (
    <div className="ee-preview">
      <div className="u-eyebrow">{t('entry.preview.eyebrow')}</div>
      <div ref={stageRef} className="ee-cap">
        <SpriteStage glow={types[0] ? typeColor(types[0]) : undefined} glow2={types[1] ? typeColor(types[1]) : undefined} brackets={false} className={cx('ee-cap__stage', entry.shiny && 'is-shiny')}>
          <div ref={spriteRef} className="ee-cap__sprite">
            <Sprite path={spritePath} size="fill" resolution={160} lazy={false} />
          </div>
        </SpriteStage>
        <div ref={ballRef} className={cx('ee-cap__ball', entry.ball === undefined && 'is-default')} aria-hidden="true">
          <BallIcon ball={entry.ball ?? 4} size={40} label="" />
        </div>
      </div>
      <div className={cx('ee-preview__card', noGame && 'ee-preview__card--nogame')}>
        <EntryCard entry={entry} variant="card" actions={false} />
      </div>
    </div>
  )
}
