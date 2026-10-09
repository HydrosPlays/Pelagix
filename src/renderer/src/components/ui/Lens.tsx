import { cx } from './cx'
import './Lens.css'

export interface LensProps {
  /** Diameter in px. Default 36. */
  size?: number
  /** Slow breathing glow. Default true. */
  pulse?: boolean
  /** Faster pulse with an expanding ring: "working". */
  busy?: boolean
  className?: string
}

/** The Pokédex lens: a glowing cyan orb in a ring. Purely decorative. */
export function Lens({ size = 36, pulse = true, busy = false, className }: LensProps) {
  return (
    <span className={cx('ui-lens', pulse && 'ui-lens--pulse', busy && 'ui-lens--busy', className)} style={{ width: size, height: size }} aria-hidden="true">
      {busy && <span className="ui-lens__ping" />}
      <span className="ui-lens__ring" />
      <span className="ui-lens__orb">
        <span className="ui-lens__glint" />
      </span>
    </span>
  )
}

export interface LedsProps {
  className?: string
}

/** The three indicator LEDs next to the lens: red, amber, green. Decorative. */
export function Leds({ className }: LedsProps) {
  return (
    <span className={cx('ui-leds', className)} aria-hidden="true">
      <i className="ui-leds__led ui-leds__led--r" />
      <i className="ui-leds__led ui-leds__led--y" />
      <i className="ui-leds__led ui-leds__led--g" />
    </span>
  )
}
