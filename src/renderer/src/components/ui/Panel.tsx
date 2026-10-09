import type { ComponentPropsWithRef, ElementType, ReactNode } from 'react'
import { cx } from './cx'
import './Panel.css'

export interface HudBracketsProps {
  /** "all": four corners. "diagonal": top-left and bottom-right only (pairs with a chamfer). */
  corners?: 'all' | 'diagonal'
  /** Distance from the edges of the positioned parent, px. Default 8. */
  inset?: number
  /** Arm length, px. Default 14. */
  size?: number
  className?: string
}

/** Pokédex HUD corner brackets; absolutely positioned inside the nearest positioned ancestor. */
export function HudBrackets({ corners = 'all', inset = 8, size = 14, className }: HudBracketsProps) {
  return (
    <span className={cx('ui-brackets', className)} aria-hidden="true" style={{ inset, ['--bracket' as string]: `${size}px` }}>
      <i className="ui-brackets__c ui-brackets__c--tl" />
      {corners === 'all' && <i className="ui-brackets__c ui-brackets__c--tr" />}
      {corners === 'all' && <i className="ui-brackets__c ui-brackets__c--bl" />}
      <i className="ui-brackets__c ui-brackets__c--br" />
    </span>
  )
}

export type PanelTone = 'glass' | 'solid' | 'inset' | 'accent' | 'gold'
export type PanelPadding = 'none' | 'sm' | 'md' | 'lg'

export interface PanelProps extends Omit<ComponentPropsWithRef<'div'>, 'title'> {
  /** Element to render. Default "section" when there is a title, else "div". */
  as?: ElementType
  tone?: PanelTone
  padding?: PanelPadding
  /** Cut the top-right and bottom-left corners (use on a few key panels only). */
  chamfer?: boolean
  /** HUD corner brackets. */
  brackets?: boolean
  /** Hover lift and pointer, for panels that are links or buttons. */
  interactive?: boolean
  /** Header row: title on the left, `actions` on the right. */
  title?: ReactNode
  /** Small uppercase label above the title. */
  eyebrow?: ReactNode
  actions?: ReactNode
}

/** The standard surface: glass card with a hairline border. `Card` is the same component. */
export function Panel({ as, tone = 'glass', padding = 'md', chamfer, brackets, interactive, title, eyebrow, actions, className, children, ...rest }: PanelProps) {
  const Element: ElementType = as ?? (title !== undefined ? 'section' : 'div')
  const hasHeader = title !== undefined || eyebrow !== undefined || actions !== undefined
  return (
    <Element className={cx('ui-panel', `ui-panel--${tone}`, `ui-panel--pad-${padding}`, chamfer && 'ui-panel--chamfer', interactive && 'ui-panel--interactive', className)} {...rest}>
      {brackets && <HudBrackets corners={chamfer ? 'diagonal' : 'all'} />}
      {hasHeader && (
        <header className="ui-panel__header">
          <div className="ui-panel__heading">
            {eyebrow !== undefined && <div className="u-eyebrow">{eyebrow}</div>}
            {title !== undefined && <h3 className="ui-panel__title">{title}</h3>}
          </div>
          {actions !== undefined && <div className="ui-panel__actions">{actions}</div>}
        </header>
      )}
      {children}
    </Element>
  )
}

export const Card = Panel
export type CardProps = PanelProps
