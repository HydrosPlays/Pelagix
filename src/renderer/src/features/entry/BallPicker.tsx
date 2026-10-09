import { useId, useState } from 'react'
import { BALL_BY_ID, BALLS, type BallDef } from '@shared/balls'
import { BallIcon } from '@renderer/components/pokemon'
import { Button, cx, Tooltip } from '@renderer/components/ui'
import { rovingRadioKeyDown } from '@renderer/features/species/hooks'

export interface BallPickerProps {
  /** Balls that can be used in the chosen game; empty when there is no such list (no game yet, HOME ...). */
  legal: readonly BallDef[]
  value: number | null
  onChange: (ball: number | null) => void
  /** The ball the matched source always comes in. */
  forced?: number
  /** Name of the chosen game, for the wording. */
  gameName?: string
}

function BallButton({ ball, selected, tabbable, onPick }: { ball: BallDef; selected: boolean; tabbable: boolean; onPick: () => void }) {
  return (
    <Tooltip content={ball.name} delay={250}>
      <button type="button" role="radio" aria-checked={selected} aria-label={ball.name} tabIndex={tabbable ? 0 : -1} className={cx('ee-ball', selected && 'is-selected')} onClick={onPick}>
        <BallIcon ball={ball} size={26} label="" />
      </button>
    </Tooltip>
  )
}

/** Visual ball choice: the balls of the chosen game first, everything else behind "Show all balls". */
export function BallPicker({ legal, value, onChange, forced, gameName }: BallPickerProps) {
  const labelId = useId()
  const [all, setAll] = useState(false)
  const hasLegal = legal.length > 0
  const legalIds = new Set(legal.map((b) => b.id))
  const selected = value !== null ? BALL_BY_ID.get(value) : undefined
  const forcedBall = forced !== undefined ? BALL_BY_ID.get(forced) : undefined
  // A ball that is chosen (or forced) but not on the game's list still has to be visible.
  const extras = [selected, forcedBall].filter((b, i, list): b is BallDef => b !== undefined && !legalIds.has(b.id) && list.indexOf(b) === i)
  const primary = hasLegal ? [...legal, ...(all ? [] : extras)] : BALLS
  const others = hasLegal && all ? BALLS.filter((b) => !legalIds.has(b.id)) : []
  const shown = [...primary, ...others]
  // One tab stop for the group: the chosen ball, else the first.
  const tabStop = selected && shown.includes(selected) ? selected.id : shown[0]?.id
  const canExpand = hasLegal && legal.length < BALLS.length
  const note = forcedBall ? `This source always comes in a ${forcedBall.name}.` : hasLegal && gameName !== undefined ? `Showing the balls you can use in ${gameName}.` : undefined

  return (
    <div className="ee-balls">
      <div className="ee-balls__head">
        <span id={labelId} className="ui-field__label">
          Ball
        </span>
        <span className={cx('ee-balls__value', !selected && 'is-empty')}>{selected ? selected.name : 'Not set'}</span>
        {value !== null && (
          <button type="button" className="ee-link" onClick={() => onChange(null)}>
            Clear
          </button>
        )}
      </div>
      <div className="ee-balls__grid" role="radiogroup" aria-labelledby={labelId} data-ee-balls="" onKeyDown={rovingRadioKeyDown}>
        {primary.map((ball) => (
          <BallButton key={ball.id} ball={ball} selected={ball.id === value} tabbable={ball.id === tabStop} onPick={() => onChange(ball.id)} />
        ))}
        {others.length > 0 && <span className="ee-balls__rule" role="presentation" />}
        {others.map((ball) => (
          <BallButton key={ball.id} ball={ball} selected={ball.id === value} tabbable={ball.id === tabStop} onPick={() => onChange(ball.id)} />
        ))}
      </div>
      {(note !== undefined || canExpand) && (
        <div className="ee-balls__foot">
          {note !== undefined && <span className="ee-note">{note}</span>}
          {canExpand && (
            <Button size="sm" variant="ghost" icon={all ? 'chevron-up' : 'chevron-down'} aria-expanded={all} onClick={() => setAll(!all)}>
              {all ? 'Show fewer balls' : 'Show all balls'}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
