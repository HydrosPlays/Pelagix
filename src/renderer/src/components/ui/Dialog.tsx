import { useId, useRef, type CSSProperties, type ReactNode } from 'react'
import { t } from '@renderer/i18n'
import { cx } from './cx'
import { IconButton } from './IconButton'
import { Portal } from './Portal'
import { useEscapeLayer, useFocusTrap, useModalRoot, usePresence, type InitialFocus } from './layers'
import './Dialog.css'

const EXIT_MS = 170

interface ModalShellProps {
  open: boolean
  onClose: () => void
  /** Scrim click and Escape close it. Default true. */
  dismissable?: boolean
  /** What gets the focus on opening, instead of the `data-autofocus` element: an element, or `'panel'` for the panel itself. */
  initialFocus?: InitialFocus
  labelledBy?: string
  describedBy?: string
  ariaLabel?: string
  kind: 'dialog' | 'drawer'
  className?: string
  style?: CSSProperties
  children: ReactNode
}

/** Portal + scrim + focus trap + Escape handling shared by Dialog and Drawer. */
function ModalShell({ open, onClose, dismissable = true, initialFocus, labelledBy, describedBy, ariaLabel, kind, className, style, children }: ModalShellProps) {
  const presence = usePresence(open, EXIT_MS)
  const panelRef = useRef<HTMLDivElement>(null)
  const mounted = presence !== null
  const active = presence === 'open'
  // The page is released the moment closing starts, not when the exit animation ends: the focus
  // trap hands focus back at that same moment, and an inert page would refuse it. (Declared before
  // the trap so its cleanup runs first.) The closing scrim ignores the pointer.
  useModalRoot(active)
  useEscapeLayer(active, dismissable ? onClose : undefined)
  useFocusTrap(active, panelRef, initialFocus)
  // A press that starts inside the panel and ends on the scrim (a text selection drag) must not close it.
  const pressedOnScrim = useRef(false)

  if (!mounted) return null
  return (
    <Portal>
      <div
        className={cx('ui-modal', `ui-modal--${kind}`)}
        data-state={presence}
        onPointerDown={(e) => {
          pressedOnScrim.current = e.target === e.currentTarget
        }}
        onClick={(e) => {
          if (dismissable && pressedOnScrim.current && e.target === e.currentTarget) onClose()
        }}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          aria-describedby={describedBy}
          aria-label={ariaLabel}
          tabIndex={-1}
          className={className}
          style={style}
        >
          {children}
        </div>
      </div>
    </Portal>
  )
}

export type DialogSize = 'sm' | 'md' | 'lg' | 'xl'

interface ModalContentProps {
  /** Heading. Omit for a bare panel (then pass `ariaLabel`). */
  title?: ReactNode
  description?: ReactNode
  /** Element shown left of the title (an Icon, a Sprite ...). */
  media?: ReactNode
  /** Right-aligned action row at the bottom. */
  footer?: ReactNode
  /** Hide the close button in the header. */
  hideClose?: boolean
  /** Remove the body padding (full-bleed lists, custom layouts). */
  flush?: boolean
  children?: ReactNode
}

export interface DialogProps extends ModalContentProps, Pick<ModalShellProps, 'open' | 'onClose' | 'dismissable' | 'initialFocus' | 'ariaLabel'> {
  size?: DialogSize
  /** Cut the top-right and bottom-left corners. */
  chamfer?: boolean
  className?: string
}

function ModalContent({ title, description, media, footer, hideClose, flush, children, titleId, descId, onClose }: ModalContentProps & { titleId: string; descId: string; onClose: () => void }) {
  const hasHeader = title !== undefined || !hideClose
  return (
    <>
      {hasHeader && (
        <header className="ui-modal__header">
          {media && <div className="ui-modal__media">{media}</div>}
          <div className="ui-modal__heading">
            {title !== undefined && (
              <h2 id={titleId} className="ui-modal__title">
                {title}
              </h2>
            )}
            {description !== undefined && (
              <p id={descId} className="ui-modal__desc">
                {description}
              </p>
            )}
          </div>
          {!hideClose && <IconButton icon="close" label={t('common.close')} size="sm" tooltip={false} className="ui-modal__close" onClick={onClose} />}
        </header>
      )}
      <div className={cx('ui-modal__body', flush && 'ui-modal__body--flush')}>{children}</div>
      {footer && <footer className="ui-modal__footer">{footer}</footer>}
    </>
  )
}

/**
 * Modal dialog: portal, scrim, focus trap, Escape, focus restore. Put `data-autofocus` on the
 * element that should receive focus first (default: the first focusable one).
 */
export function Dialog({ open, onClose, dismissable, initialFocus, ariaLabel, size = 'md', chamfer, className, ...content }: DialogProps) {
  const id = useId()
  const titleId = `${id}-title`
  const descId = `${id}-desc`
  return (
    <ModalShell
      kind="dialog"
      open={open}
      onClose={onClose}
      dismissable={dismissable}
      initialFocus={initialFocus}
      ariaLabel={content.title === undefined ? ariaLabel : undefined}
      labelledBy={content.title !== undefined ? titleId : undefined}
      describedBy={content.description !== undefined ? descId : undefined}
      className={cx('ui-dialog', `ui-dialog--${size}`, chamfer && 'ui-dialog--chamfer', className)}
    >
      <ModalContent {...content} titleId={titleId} descId={descId} onClose={onClose} />
    </ModalShell>
  )
}

export interface DrawerProps extends ModalContentProps, Pick<ModalShellProps, 'open' | 'onClose' | 'dismissable' | 'initialFocus' | 'ariaLabel'> {
  side?: 'right' | 'left'
  /** Panel width in px. Default 440. */
  width?: number
  className?: string
}

/** Modal side panel with the same behaviour as Dialog. */
export function Drawer({ open, onClose, dismissable, initialFocus, ariaLabel, side = 'right', width = 440, className, ...content }: DrawerProps) {
  const id = useId()
  const titleId = `${id}-title`
  const descId = `${id}-desc`
  return (
    <ModalShell
      kind="drawer"
      open={open}
      onClose={onClose}
      dismissable={dismissable}
      initialFocus={initialFocus}
      ariaLabel={content.title === undefined ? ariaLabel : undefined}
      labelledBy={content.title !== undefined ? titleId : undefined}
      describedBy={content.description !== undefined ? descId : undefined}
      className={cx('ui-drawer', `ui-drawer--${side}`, className)}
      style={{ width }}
    >
      <ModalContent {...content} titleId={titleId} descId={descId} onClose={onClose} />
    </ModalShell>
  )
}
