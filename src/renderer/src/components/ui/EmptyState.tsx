import type { ReactNode } from 'react'
import { cx } from './cx'
import { Icon, type IconName } from './Icon'
import './EmptyState.css'

export interface EmptyStateProps {
  title: ReactNode
  description?: ReactNode
  /** Glyph in the sonar disc. Default "pokeball". */
  icon?: IconName
  /** Replaces the sonar disc entirely (a Sprite, an illustration ...). */
  media?: ReactNode
  /** Buttons under the text. */
  action?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  tone?: 'neutral' | 'accent' | 'gold' | 'danger'
  className?: string
}

/** Placeholder for "nothing here yet" and "no results", with a sonar-ping illustration. */
export function EmptyState({ title, description, icon = 'pokeball', media, action, size = 'md', tone = 'accent', className }: EmptyStateProps) {
  return (
    <div className={cx('ui-empty', `ui-empty--${size}`, `ui-empty--${tone}`, className)}>
      {media ?? (
        <div className="ui-empty__sonar" aria-hidden="true">
          <span className="ui-empty__ring ui-empty__ring--1" />
          <span className="ui-empty__ring ui-empty__ring--2" />
          <span className="ui-empty__disc">
            <Icon name={icon} size={size === 'sm' ? 20 : size === 'lg' ? 34 : 26} />
          </span>
        </div>
      )}
      <h3 className="ui-empty__title">{title}</h3>
      {description !== undefined && <p className="ui-empty__desc">{description}</p>}
      {action !== undefined && <div className="ui-empty__action">{action}</div>}
    </div>
  )
}
