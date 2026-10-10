import { Component, type ErrorInfo, type ReactNode } from 'react'
import { t } from '@renderer/i18n'
import { errorMessage } from '@renderer/lib/format'
import { Button } from './Button'
import { EmptyState } from './EmptyState'
import './ErrorBoundary.css'

export interface ErrorBoundaryProps {
  children: ReactNode
  /** Custom fallback. `reset` re-mounts the children. */
  fallback?: (error: Error, reset: () => void) => ReactNode
  /** The boundary resets itself when any of these change (e.g. the route path). */
  resetKeys?: readonly unknown[]
  onError?: (error: Error, info: ErrorInfo) => void
  /** Heading of the default fallback. */
  title?: string
  /** Shown under the default fallback: a way on that does not depend on what failed. */
  extra?: ReactNode
}

interface State {
  error: Error | null
}

const sameKeys = (a: readonly unknown[] | undefined, b: readonly unknown[] | undefined): boolean => {
  if (a === b) return true
  if (!a || !b || a.length !== b.length) return false
  return a.every((v, i) => Object.is(v, b[i]))
}

/** Catches render errors below it and shows a recoverable message instead of a blank window. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[Pelagix] render error', error, info.componentStack)
    this.props.onError?.(error, info)
  }

  componentDidUpdate(previous: ErrorBoundaryProps): void {
    if (this.state.error && !sameKeys(previous.resetKeys, this.props.resetKeys)) this.reset()
  }

  reset = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children
    if (this.props.fallback) return this.props.fallback(error, this.reset)
    return (
      <div className="ui-error" role="alert">
        <EmptyState
          tone="danger"
          icon="warning"
          title={this.props.title ?? t('components.error.title')}
          description={<span className="u-selectable">{errorMessage(error, t('components.error.unexpected'))}</span>}
          action={
            <>
              <Button variant="primary" icon="refresh" onClick={this.reset}>
                {t('components.error.tryAgain')}
              </Button>
              <Button variant="ghost" onClick={() => window.location.reload()}>
                {t('components.error.reload')}
              </Button>
            </>
          }
        />
        {this.props.extra !== undefined && <div className="ui-error__extra">{this.props.extra}</div>}
      </div>
    )
  }
}
