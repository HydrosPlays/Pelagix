import type { ReactNode } from 'react'
import logo from '@renderer/assets/logo-small.png'
import { Button, Icon, Lens, cx } from '@renderer/components/ui'
import { Backdrop } from './Backdrop'
import './BootScreen.css'

export interface BootStep {
  label: string
  state: 'pending' | 'active' | 'done' | 'error'
}

function Frame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('boot', className)}>
      <Backdrop />
      <div className="boot__drag" />
      <div className="boot__body">{children}</div>
    </div>
  )
}

/** Branded loading screen shown while the save and the Pokédex datasets load. */
export function BootScreen({ steps }: { steps: readonly BootStep[] }) {
  return (
    <Frame className="boot--loading">
      <img className="boot__logo" src={logo} alt="Pelagix" width={300} height={225} draggable={false} />
      <div className="boot__status" role="status" aria-live="polite">
        <Lens size={34} busy />
        <ul className="boot__steps">
          {steps.map((step) => (
            <li key={step.label} className={cx('boot__step', `is-${step.state}`)}>
              <span className="boot__step-mark">{step.state === 'done' ? <Icon name="check" size={12} strokeWidth={3} /> : null}</span>
              {step.label}
            </li>
          ))}
        </ul>
      </div>
    </Frame>
  )
}

export interface BootErrorProps {
  title: string
  /** What the user can do about it. */
  hint: ReactNode
  /** The technical message. */
  detail?: string
  onRetry: () => void
  retrying?: boolean
}

/** Full-window error for a start-up failure (datasets missing, save unreadable). */
export function BootError({ title, hint, detail, onRetry, retrying }: BootErrorProps) {
  return (
    <Frame>
      <div className="boot__error" role="alert">
        <span className="boot__error-icon">
          <Icon name="warning" size={28} />
        </span>
        <h1 className="boot__error-title">{title}</h1>
        <p className="boot__error-hint">{hint}</p>
        {detail !== undefined && detail !== '' && <pre className="boot__error-detail u-selectable">{detail}</pre>}
        <div className="boot__error-actions">
          <Button variant="primary" icon="refresh" loading={retrying} onClick={onRetry}>
            Try again
          </Button>
          <Button variant="ghost" onClick={() => window.location.reload()}>
            Reload app
          </Button>
        </div>
      </div>
    </Frame>
  )
}
